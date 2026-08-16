/**
 * Voice input host half: lifecycle supervisor for the local ASR sidecar.
 *
 * The browser client streams 16kHz PCM to `ws://127.0.0.1:6035`, served by a
 * small Node process running sherpa-onnx-node with a streaming zh-en model.
 * The sidecar runtime (server.js + node_modules + ONNX models) lives under
 * `${DSH_HOME}/voice-asr/` — deployment-local data, never part of the
 * repository. This plugin spawns it at activation, restarts nothing, and
 * terminates the process tree when the host composition tears down.
 *
 * The sidecar is a deliberate out-of-process component: the native addon
 * cannot live inside this plugin bundle, and process isolation keeps model
 * memory reclaimable without a host restart.
 */
import { homedir } from 'node:os'
import { appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-subprocess'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'

export const name = 'voice-input'

/** Fixed localhost port the browser client connects to. */
export const VOICE_SIDECAR_PORT = 6035

/** Default model subdirectory inside the sidecar root. */
const MODEL_DIR_NAME = 'sherpa-onnx-x-asr-480ms-streaming-zipformer-transducer-zh-en-punct-int8-2026-06-05'

function dshHome(): string {
  return process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
}

/** `${DSH_HOME}/voice-asr` — server.js, node_modules, and the models/ tree. */
export function sidecarRoot(): string {
  return join(dshHome(), 'voice-asr')
}

/** Append one diagnostic line to the sidecar root's host-plugin.log. */
function trace(root: string, message: string): void {
  try {
    appendFileSync(join(root, 'host-plugin.log'), `${new Date().toISOString()} ${message}\n`)
  } catch {
    /* diagnostics must never break the plugin */
  }
}

export const inject = ['subprocess']

/**
 * Spawn the sidecar if its runtime directory is present, and own its
 * termination for the plugin's whole lifetime.
 */
export function apply(ctx: Context): void {
  const logger = ctx.logger('voice-input')
  const root = sidecarRoot()
  const script = join(root, 'server.js')
  const modelDir = join(root, 'models', MODEL_DIR_NAME)
  trace(root, `apply: root=${root}`)

  if (!existsSync(script)) {
    trace(root, 'apply: sidecar script missing, giving up')
    logger.warn('voice input sidecar not found at %s; the composer mic button will report the service as offline', script)
    return
  }
  if (!existsSync(modelDir)) {
    trace(root, 'apply: model dir missing, spawning anyway')
    logger.warn('voice input model not found at %s; the sidecar will fail to load', modelDir)
  }

  let handle: SubprocessHandle | null = null
  let disposed = false

  const spawn = async (): Promise<void> => {
    if (disposed) return
    try {
      let node: string
      try {
        node = await ctx.subprocess.resolveExecutable('node')
      } catch {
        // The provider's scrubbed PATH may not include node (e.g. launched
        // from a pnpm shim with a minimal environment): the DSH process's
        // own executable is always a valid fallback.
        node = process.execPath
        trace(root, `spawn: resolveExecutable failed, using execPath=${node}`)
      }
      trace(root, `spawn: node=${node}`)
      handle = ctx.subprocess.spawn({
        argv: [node, script, '--port', String(VOICE_SIDECAR_PORT), '--model-dir', modelDir],
        cwd: root,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: 32 * 1024 },
          stderr: { maxBytes: 32 * 1024 },
        },
        graceMs: 5000,
      })
      trace(root, `spawn: pid=${handle.pid}`)
      logger.info('voice-asr sidecar spawned (pid %d) on ws://127.0.0.1:%d', handle.pid, VOICE_SIDECAR_PORT)
      void handle.done.then((outcome) => {
        if (disposed) return
        handle = null
        const detail = outcome.exitCode !== null
          ? `exit ${outcome.exitCode}`
          : `signal ${String(outcome.signal)}`
        trace(root, `done: ${detail}`)
        logger.warn('voice-asr sidecar exited (%s); voice input is offline until the host restarts', detail)
      })
    } catch (error) {
      trace(root, `spawn-failed: ${String(error)}`)
      logger.warn('failed to spawn voice-asr sidecar: %s', String(error))
    }
  }

  void spawn()

  ctx.effect(() => () => {
    disposed = true
    handle?.terminate()
    handle = null
    trace(root, 'dispose: sidecar terminated')
  }, 'voice-input: sidecar supervision')
}
