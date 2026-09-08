import { describe, it, expect } from 'vitest'
import { IPC_CHANNELS } from '../../shared/constants/index'

describe('IPC Channels and Health Constants', () => {
  it('defines HEALTH_CHECK channel correctly', () => {
    expect(IPC_CHANNELS.HEALTH_CHECK).toBe('health:check')
  })

  it('defines setup and auth channels correctly', () => {
    expect(IPC_CHANNELS.AUTH_CHECK_FIRST_RUN).toBe('auth:checkFirstRun')
    expect(IPC_CHANNELS.AUTH_COMPLETE_SETUP).toBe('auth:completeSetup')
    expect(IPC_CHANNELS.AUTH_LOGIN).toBe('auth:login')
  })
})
