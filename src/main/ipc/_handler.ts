import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/index'
import { AppError } from '../../shared/errors/index'
import type { ApiResult } from '../../shared/types/index'
import log from 'electron-log'

// ─── IPC wrapper: validates sender, catches errors, sanitizes responses ────────

export function handle<T>(
  channel: string,
  fn: (payload: unknown) => Promise<T>
): void {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      const data = await fn(payload)
      return { success: true, data } satisfies ApiResult<T>
    } catch (err) {
      if (err instanceof AppError) {
        return { success: false, error: err.message, code: err.code } satisfies ApiResult<T>
      }
      // Sanitize unexpected errors — never expose stack traces to renderer
      log.error(`IPC error on channel [${channel}]:`, err)
      return {
        success: false,
        error: 'An internal error occurred. Please try again.',
        code: 'INTERNAL_ERROR',
      } satisfies ApiResult<T>
    }
  })
}
