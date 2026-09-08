import React, { Component, ErrorInfo, ReactNode } from 'react'
import i18n from '../i18n/i18n'
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Development console logging
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught render error:', error, errorInfo)
    }

    // Safely log technical details to main process local logs without PII
    try {
      if (typeof window !== 'undefined' && (window as any).schoolApp?.app?.logError) {
        (window as any).schoolApp.app.logError({
          category: 'renderer-render-error',
          message: error.name || 'RenderError',
          componentStack: errorInfo.componentStack?.slice(0, 500),
        })
      }
    } catch {
      // Ignore logging failures to prevent secondary crash
    }
  }

  private handleRestartView = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleReturnDashboard = () => {
    this.setState({ hasError: false, error: null })
    if (window.location.hash !== '#/dashboard') {
      window.location.hash = '#/dashboard'
    } else {
      window.location.reload()
    }
  }

  public render() {
    if (this.state.hasError) {
      const isRTL = i18n.language === 'ar'
      const title = i18n.t('errors.title', 'Something went wrong')
      const subtitle = i18n.t(
        'errors.subtitle',
        'An unexpected error occurred in this view. Your data is safe.'
      )
      const restartLabel = i18n.t('errors.restartView', 'Restart this view')
      const dashboardLabel = i18n.t('errors.returnDashboard', 'Return to Dashboard')

      return (
        <div
          className="min-h-100 h-full flex items-center justify-center p-6 bg-slate-50/50"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-6 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200">
              <AlertTriangle size={28} />
            </div>

            <h2 className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">{subtitle}</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                onClick={this.handleRestartView}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                <RefreshCw size={14} />
                <span>{restartLabel}</span>
              </button>

              <button
                onClick={this.handleReturnDashboard}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
              >
                <LayoutDashboard size={14} />
                <span>{dashboardLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
