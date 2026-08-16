// server.js — voice input sidecar: sherpa-onnx-node streaming ASR over WebSocket.
// Usage: node server.js [--port 6035] [--model-dir <dir>] [--num-threads 2]
// Protocol: client sends Int16 PCM 16kHz mono binary frames;
// server replies JSON {type:'ready'|'partial'|'endpoint', text?}.
// Also serves GET /health for liveness checks.
'use strict'
const fs = require('fs')
const path = require('path')
const http = require('http')
const sherpaOnnx = require('sherpa-onnx-node')
const { WebSocketServer } = require('ws')

const args = process.argv.slice(2)
function arg(name, dflt) {
  const i = args.indexOf(name)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt
}
const PORT = Number(arg('--port', '6035'))
const MODEL_DIR = arg('--model-dir', path.join(__dirname, 'models', 'sherpa-onnx-x-asr-480ms-streaming-zipformer-transducer-zh-en-punct-int8-2026-06-05'))
const NUM_THREADS = Number(arg('--num-threads', '2'))
const SAMPLE_RATE = 16000

function findFile(dir, re) {
  const entries = fs.readdirSync(dir)
  const hit = entries.find((n) => re.test(n))
  if (!hit) throw new Error('missing file matching ' + re + ' in ' + dir + ' (entries: ' + entries.join(', ') + ')')
  return path.join(dir, hit)
}

function buildModelConfig() {
  const mc = {
    transducer: {
      encoder: findFile(MODEL_DIR, /^encoder/),
      decoder: findFile(MODEL_DIR, /^decoder/),
      joiner: findFile(MODEL_DIR, /^joiner/),
    },
    tokens: findFile(MODEL_DIR, /^tokens\.txt$/),
    numThreads: NUM_THREADS,
    provider: 'cpu',
    debug: 0,
  }
  try {
    mc.bpeVocab = findFile(MODEL_DIR, /\.model$/)
    mc.modelType = 'zipformer2'
  } catch (e) {
    mc.modelType = 'zipformer2'
    mc.modelingUnit = 'cjkchar'
  }
  return mc
}

const recognizer = new sherpaOnnx.OnlineRecognizer({
  featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
  modelConfig: buildModelConfig(),
  decodingMethod: 'greedy_search',
  enableEndpoint: true,
  rule1MinTrailingSilence: 2.4,
  rule2MinTrailingSilence: 1.2,
  rule3MinUtteranceLength: 20,
})
console.log('[asr] model loaded')

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
  } else {
    res.writeHead(404)
    res.end('not found')
  }
})
const wss = new WebSocketServer({ server, maxPayload: 4 * 1024 * 1024 })

wss.on('connection', (ws) => {
  console.log('[asr] client connected')
  let lastText = ''
  let lastTextAt = Date.now()
  let silenceSent = false
  const stream = recognizer.createStream()
  ws.send(JSON.stringify({ type: 'ready' }))

  // Authoritative 3s silence detection: only when the recognizer holds no
  // text (i.e., the client overlay is empty), and no new text for 3 seconds.
  const silenceCheck = setInterval(() => {
    if (silenceSent) return
    if (lastText !== '') return
    if (Date.now() - lastTextAt <= 3000) return
    silenceSent = true
    ws.send(JSON.stringify({ type: 'silence-timeout' }))
  }, 500)

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
      const n = Math.floor(buf.length / 2)
      if (n <= 0) return
      const samples = new Float32Array(n)
      for (let i = 0; i < n; i++) samples[i] = buf.readInt16LE(i * 2) / 32768
      stream.acceptWaveform({ samples, sampleRate: SAMPLE_RATE })
      while (recognizer.isReady(stream)) recognizer.decode(stream)
      const text = recognizer.getResult(stream).text || ''
      if (text !== lastText) {
        lastText = text
        if (text !== '') {
          lastTextAt = Date.now()
          silenceSent = false
        }
        ws.send(JSON.stringify({ type: 'partial', text }))
      }
      if (recognizer.isEndpoint(stream)) {
        ws.send(JSON.stringify({ type: 'endpoint', text: lastText }))
        recognizer.reset(stream)
        const hadText = lastText !== ''
        lastText = ''
        if (hadText) {
          // A real utterance just committed: the 3s silence window starts now.
          lastTextAt = Date.now()
          silenceSent = false
        }
        // Empty endpoints (pure-silence rule1 spam) must NOT refresh the clock,
        // otherwise the 3s window can never elapse.
      }
      return
    }
    try {
      const msg = JSON.parse(data.toString('utf8'))
      if (msg && msg.type === 'reset') {
        recognizer.reset(stream)
        lastText = ''
        lastTextAt = Date.now()
        silenceSent = false
        ws.send(JSON.stringify({ type: 'ready' }))
      } else if (msg && msg.type === 'report') {
        try {
          const line = JSON.stringify({ t: new Date().toISOString(), data: msg.data })
          fs.appendFileSync(path.join(__dirname, '..', 'voice-log.jsonl'), line + '\n')
        } catch (e) {
          console.log('[asr] report write failed', String(e && e.message))
        }
      }
    } catch (e) { /* ignore malformed text frames */ }
  })
  ws.on('close', () => {
    clearInterval(silenceCheck)
    console.log('[asr] client disconnected')
  })
  ws.on('error', (e) => console.log('[asr] ws error', String(e && e.message)))
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('[asr] listening on ws://127.0.0.1:' + PORT)
})
