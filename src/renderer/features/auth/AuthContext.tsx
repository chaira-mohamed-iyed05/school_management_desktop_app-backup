import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { AuthSession } from '@shared/types/index'
import { applyLanguage, type SupportedLanguage } from '../../i18n/i18n'

interface AuthContextValue {
  session: AuthSession | null
  isLoading: boolean
  isFirstRun: boolean
  bridgeError: string | null
  startupState: 'checking' | 'bridge-error' | 'database-error' | 'setup-required' | 'login-required' | 'authenticated'
  retryInit: () => void
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  completeSetup: (data: Parameters<typeof window.schoolApp.auth.completeSetup>[0]) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes auto-lock

export function AuthProvider({ children }: { children: React.ReactNode }) {
  type StartupState =
    | 'checking'
    | 'bridge-error'
    | 'database-error'
    | 'setup-required'
    | 'login-required'
    | 'authenticated'

  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFirstRun, setIsFirstRun] = useState(false)
  const [startupState, setStartupState] = useState<StartupState>('checking')
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(async () => {
      if (window.schoolApp?.auth) {
        await window.schoolApp.auth.logout()
      }
      setSession(null)
    }, INACTIVITY_TIMEOUT_MS)
  }, [])

  // Listen for user activity
  useEffect(() => {
    if (!session) return
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer))
    resetInactivityTimer()
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [session, resetInactivityTimer])

  const init = useCallback(async () => {
    setIsLoading(true)
    setBridgeError(null)
    setStartupState('checking')

    if (!window.schoolApp || !window.schoolApp.health) {
      setBridgeError('Electron bridge unavailable. Preload script was not loaded.')
      setStartupState('bridge-error')
      setIsLoading(false)
      return
    }

    try {
      const healthRes = await window.schoolApp.health.check()
      if (!healthRes.success || !healthRes.data?.sqliteOpen) {
        setBridgeError(
          !healthRes.success
            ? healthRes.error ?? 'IPC health check failed'
            : 'Database failed to initialize or open SQLite connection.'
        )
        setStartupState('database-error')
        setIsLoading(false)
        return
      }

      const [sessionResult, firstRunResult] = await Promise.all([
        window.schoolApp.auth.getSession(),
        window.schoolApp.auth.checkFirstRun(),
      ])

      if (!firstRunResult.success) {
        setBridgeError(firstRunResult.error ?? 'Failed to determine first-run state.')
        setStartupState('bridge-error')
        setIsLoading(false)
        return
      }

      if (firstRunResult.data?.firstRun) {
        setIsFirstRun(true)
        setStartupState('setup-required')
      } else if (sessionResult.success && sessionResult.data) {
        setSession(sessionResult.data)
        applyLanguage(sessionResult.data.preferredLanguage as SupportedLanguage)
        setStartupState('authenticated')
      } else {
        setStartupState('login-required')
      }
    } catch (err) {
      setBridgeError(`Startup initialization error: ${err instanceof Error ? err.message : String(err)}`)
      setStartupState('bridge-error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialize: check health + session + first-run status
  useEffect(() => {
    init()
  }, [init])

  const login = useCallback(async (username: string, password: string) => {
    const result = await window.schoolApp.auth.login(username, password)
    if (result.success && result.data) {
      setSession(result.data)
      applyLanguage(result.data.preferredLanguage as SupportedLanguage)
      setIsFirstRun(false)
      setStartupState('authenticated')
      return { success: true }
    }
    return { success: false, error: !result.success ? result.error : undefined }
  }, [])

  const logout = useCallback(async () => {
    await window.schoolApp.auth.logout()
    setSession(null)
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
  }, [])

  const completeSetup = useCallback(async (data: Parameters<typeof window.schoolApp.auth.completeSetup>[0]) => {
    const result = await window.schoolApp.auth.completeSetup(data)
    if (result.success && result.data) {
      setSession(result.data)
      applyLanguage(result.data.preferredLanguage as SupportedLanguage)
      setIsFirstRun(false)
      setStartupState('authenticated')
      return { success: true }
    }
    return { success: false, error: !result.success ? result.error : undefined }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isFirstRun,
        bridgeError,
        startupState,
        retryInit: init,
        login,
        logout,
        completeSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
