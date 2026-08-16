/**
 * Voice input surface plugin, browser half.
 *
 * Mic button at the right end of the composer tool row (between the model
 * select and the send button, via `conversation.input.right`) streams 16kHz
 * mono PCM over a WebSocket to the local sherpa-onnx sidecar
 * (ws://127.0.0.1:6035, managed by @deepseek-ai/dsh-host-voice-input).
 * Incremental text shows in a live pill above the composer; each committed
 * endpoint appends to the draft via the inputActions seat; the sidecar's
 * authoritative 3s silence timeout (empty transcript only) stops the
 * recording, with a client timer as backup.
 *
 * Draft-append discipline: the mirror of the live draft is refreshed on
 * every render through the slot's useInput standard prop. Appends always
 * base on that mirror (never on remembered content), so a cleared draft can
 * never resurrect earlier text.
 */
import type { Context } from '@deepseek-ai/cordis'
import { createElement, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
// Type-only: pulls the ui-conversation SlotMap merge (the input tool-row keys).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import css from './voice.module.css'

export const name = 'ui-voice-input'

export const inject = ['slots'] as const

const SIDECAR_URL = 'ws://127.0.0.1:6035'
const SILENCE_MS = 3000

interface TimerLike {
  timeout(callback: () => void, delay: number): () => void
}

/** Minimal shape of the slot standard props this plugin consumes. */
interface MicSeatProps {
  inputActions?: {
    setDraft?: (draft: string) => void
    submit?: () => void
  }
  useInput?: () => { draft?: string } | undefined
  input?: { draft?: string }
  sessionId?: string
}

type VoiceState = 'idle' | 'starting' | 'listening' | 'error'

interface VoiceStore {
  state: VoiceState
  partial: string
  error: string | null
}

interface ListeningSession {
  ws: WebSocket
  audioCtx: AudioContext
  track: MediaStreamTrack | null
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

function audioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
}

interface Latest {
  inputActions: MicSeatProps['inputActions']
  draft: string
  sessionId: string | null
}

const MIC_PATH = 'M512 683.52c130.56 0 235.52-102.4 235.52-232.96V256c0-130.56-104.96-232.96-235.52-232.96s-235.52 102.4-235.52 232.96v194.56c0 130.56 102.4 232.96 235.52 232.96z m368.64-281.6c0-23.04-20.48-43.52-46.08-43.52s-43.52 20.48-43.52 43.52c0 5.12 0 10.24 2.56 12.8v33.28c0 151.04-125.44 276.48-281.6 276.48-153.6 0-281.6-125.44-281.6-276.48V409.6c0-2.56 2.56-5.12 2.56-10.24 0-23.04-20.48-43.52-43.52-43.52-25.6 0-43.52 20.48-43.52 43.52v64c0 186.88 140.8 335.36 320 360.96v87.04h-122.88c-25.6 0-46.08 20.48-46.08 46.08s20.48 43.52 46.08 43.52h332.8c28.16 0 43.52-17.92 43.52-43.52 0-23.04-17.92-46.08-43.52-46.08h-122.88v-87.04c184.32-20.48 327.68-174.08 327.68-360.96v-61.44z m0 0'

const PENDING_PATH = 'M554.666667 128v768c0 23.466667-19.2 42.666667-42.666667 42.666667s-42.666667-19.2-42.666667-42.666667V128c0-23.466667 19.2-42.666667 42.666667-42.666667s42.666667 19.2 42.666667 42.666667z m149.333333 128c-23.466667 0-42.666667 19.2-42.666667 42.666667v426.666666c0 23.466667 19.2 42.666667 42.666667 42.666667s42.666667-19.2 42.666667-42.666667V298.666667c0-23.466667-19.2-42.666667-42.666667-42.666667z m-384 0c-23.466667 0-42.666667 19.2-42.666667 42.666667v426.666666c0 23.466667 19.2 42.666667 42.666667 42.666667s42.666667-19.2 42.666667-42.666667V298.666667c0-23.466667-19.2-42.666667-42.666667-42.666667z m-192 106.666667c-23.466667 0-42.666667 19.2-42.666667 42.666666v213.333334c0 23.466667 19.2 42.666667 42.666667 42.666666s42.666667-19.2 42.666667-42.666666V405.333333c0-23.466667-19.2-42.666667-42.666667-42.666666z m768 0c-23.466667 0-42.666667 19.2-42.666667 42.666666v213.333334c0 23.466667 19.2 42.666667 42.666667 42.666666s42.666667-19.2 42.666667-42.666666V405.333333c0-23.466667-19.2-42.666667-42.666667-42.666666z'

export function apply(ctx: Context): void {
  const timer = ctx.get('timer') as TimerLike | undefined

  let store: VoiceStore = { state: 'idle', partial: '', error: null }
  const subs = new Set<() => void>()

  function patch(p: Partial<VoiceStore>): void {
    store = { ...store, ...p }
    for (const fn of subs) {
      try { fn() } catch { /* listener errors never break a patch */ }
    }
  }

  function subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => { subs.delete(fn) }
  }

  let session: ListeningSession | null = null
  let autoStop: (() => void) | null = null

  function clearAutoStop(): void {
    if (autoStop !== null) {
      try { autoStop() } catch { /* already consumed */ }
      autoStop = null
    }
  }

  function scheduleAutoStop(): void {
    clearAutoStop()
    if (timer === undefined) return
    autoStop = timer.timeout(() => {
      autoStop = null
      if (session !== null && store.partial === '') stopListening()
    }, SILENCE_MS)
  }

  const latest: Latest = { inputActions: undefined, draft: '', sessionId: null }

  function stopListening(): void {
    clearAutoStop()
    const s = session
    session = null
    if (s === null) return
    try { s.track?.stop() } catch { /* already stopped */ }
    try { s.ws.close() } catch { /* already closed */ }
    try { void s.audioCtx.close() } catch { /* already closed */ }
    patch({ state: 'idle', partial: '' })
  }

  function appendToDraft(text: string): void {
    const ia = latest.inputActions
    if (ia?.setDraft === undefined) {
      patch({ state: 'error', error: '无法写入输入框：inputActions.setDraft 不可用' })
      return
    }
    const base = latest.draft
    const next = base === '' ? text : `${base} ${text}`
    latest.draft = next
    try {
      ia.setDraft(next)
    } catch (error) {
      patch({ state: 'error', error: `写入输入框失败：${String(error)}` })
    }
  }

  async function startListening(): Promise<void> {
    if (session !== null) {
      stopListening()
      return
    }
    if (typeof navigator === 'undefined' || navigator.mediaDevices === undefined || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      patch({ state: 'error', error: '浏览器不支持 getUserMedia（需要 Chromium/Firefox 且允许麦克风权限）' })
      return
    }
    if (typeof WebSocket === 'undefined') {
      patch({ state: 'error', error: '浏览器不支持 WebSocket' })
      return
    }
    const AC = audioContextCtor()
    if (AC === undefined) {
      patch({ state: 'error', error: '浏览器不支持 AudioContext' })
      return
    }
    patch({ state: 'starting', error: null, partial: '' })

    let ws: WebSocket | null = null
    let audioCtx: AudioContext | null = null
    let track: MediaStreamTrack | null = null
    try {
      ws = new WebSocket(SIDECAR_URL)
      await new Promise<void>((resolve, reject) => {
        ws!.onopen = () => { resolve() }
        ws!.onerror = () => { reject(new Error(`无法连接语音服务 ${SIDECAR_URL}（sidecar 未启动？）`)) }
      })
      ws.onmessage = (ev: MessageEvent): void => {
        let msg: { type?: string, text?: string } = {}
        try { msg = JSON.parse(String(ev.data)) as { type?: string, text?: string } } catch { return }
        if (msg.type === 'partial') {
          patch({ partial: msg.text ?? '' })
          if (msg.text !== undefined && msg.text !== '') scheduleAutoStop()
        } else if (msg.type === 'endpoint') {
          if (msg.text !== undefined && msg.text !== '') {
            appendToDraft(msg.text)
            scheduleAutoStop()
          }
          patch({ partial: '' })
        } else if (msg.type === 'silence-timeout') {
          stopListening()
        }
      }
      ws.onclose = (): void => {
        if (session !== null && session.ws === ws) {
          session = null
          clearAutoStop()
          patch({ state: 'idle', partial: '' })
        }
      }
      ws.send(JSON.stringify({ type: 'reset' }))

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      track = stream.getTracks()[0] ?? null
      audioCtx = new AC({ sampleRate: 16000 })
      await audioCtx.resume()
      const source = audioCtx.createMediaStreamSource(stream)
      const gain = audioCtx.createGain()
      gain.gain.value = 0
      const proc = audioCtx.createScriptProcessor(2048, 1, 1)
      proc.onaudioprocess = (e: AudioProcessingEvent): void => {
        if (session === null || session.ws !== ws || ws?.readyState !== 1) return
        const ch = e.inputBuffer.getChannelData(0)
        const buf = new ArrayBuffer(ch.length * 2)
        const dv = new DataView(buf)
        for (let i = 0; i < ch.length; i++) {
          let v = ch[i] ?? 0
          if (v > 1) v = 1
          if (v < -1) v = -1
          dv.setInt16(i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
        }
        ws?.send(buf)
      }
      source.connect(proc)
      proc.connect(gain)
      gain.connect(audioCtx.destination)
      session = { ws, audioCtx, track }
      patch({ state: 'listening' })
      scheduleAutoStop()
    } catch (error) {
      try { ws?.close() } catch { /* already closed */ }
      try { track?.stop() } catch { /* already stopped */ }
      try { void audioCtx?.close() } catch { /* already closed */ }
      session = null
      clearAutoStop()
      patch({ state: 'error', error: String(error) })
    }
  }

  function MicIcon(): ReactElement {
    return createElement(
      'svg',
      { className: css.micSvg, viewBox: '0 0 1024 1024', width: 16, height: 16, 'aria-hidden': true },
      createElement('path', { d: MIC_PATH }),
    )
  }

  function PendingIcon(): ReactElement {
    return createElement(
      'svg',
      { className: css.pendingSvg, viewBox: '0 0 1024 1024', width: 12, height: 12, 'aria-hidden': true },
      createElement('path', { d: PENDING_PATH }),
    )
  }

  function MicButton(props: unknown): ReactElement {
    const [st, setSt] = useState(store)
    useEffect(() => subscribe(() => { setSt(store) }), [])

    const seat = (props ?? {}) as MicSeatProps
    if (seat.inputActions !== undefined) latest.inputActions = seat.inputActions
    if (typeof seat.sessionId === 'string') latest.sessionId = seat.sessionId
    let d: string | null = null
    if (typeof seat.useInput === 'function') {
      try {
        const input = seat.useInput()
        if (input !== undefined && typeof input.draft === 'string') d = input.draft
      } catch { /* selector hook outside its window: keep the last mirror */ }
    }
    if (d === null && seat.input !== undefined && typeof seat.input.draft === 'string') d = seat.input.draft
    if (d !== null) latest.draft = d

    const label = st.state === 'error'
      ? (st.error ?? '语音输入错误')
      : st.state === 'listening'
        ? '停止语音输入'
        : '语音输入（sherpa-onnx 本地识别）'
    return createElement(
      'button',
      {
        type: 'button',
        className: css.micBtn,
        'data-state': st.state,
        title: label,
        'aria-label': label,
        onClick: () => { void startListening() },
      },
      st.state === 'listening' ? createElement(PendingIcon) : createElement(MicIcon),
    )
  }

  function LiveOverlay(): ReactElement | null {
    const [st, setSt] = useState(store)
    useEffect(() => subscribe(() => { setSt(store) }), [])
    if (st.state !== 'listening' && st.state !== 'starting') return null
    if (st.state === 'starting') {
      return createElement('div', { className: css.livePill }, '\u6B63\u5728\u542F\u52A8\u9EA6\u514B\u98CE...')
    }
    const text = st.partial === '' ? '\u6B63\u5728\u542C...' : st.partial
    return createElement(
      'div',
      { className: css.livePill },
      createElement(PendingIcon),
      text,
    )
  }

  ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
    { name: 'conversation.input.right', id: 'voice-mic', order: 5 },
    MicButton,
  ))
  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register(
    { name: 'conversation.input.overlay', id: 'voice-live', order: 5 },
    () => createElement(LiveOverlay),
  ))
}
