import React from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

export interface ToastItem {
  id: string
  title: string
  message?: string
  type: 'success' | 'error' | 'info' | 'warning'
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success'
        const isError = t.type === 'error'
        const isWarning = t.type === 'warning'
        const isInfo = t.type === 'info'

        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
              isSuccess
                ? 'bg-surface/95 border-success/40 text-text'
                : isError
                ? 'bg-surface/95 border-danger/40 text-text'
                : isWarning
                ? 'bg-surface/95 border-amber-500/40 text-text'
                : 'bg-surface/95 border-primary/40 text-text'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-success" />}
              {isError && <AlertCircle className="w-4 h-4 text-danger" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {isInfo && <Info className="w-4 h-4 text-primary" />}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="text-xs font-semibold tracking-tight text-text">{t.title}</div>
              {t.message && (
                <div className="text-[11px] text-muted mt-0.5 leading-relaxed">{t.message}</div>
              )}
            </div>

            <button
              onClick={() => onDismiss(t.id)}
              className="shrink-0 p-1 rounded-md text-muted hover:text-text hover:bg-elevated transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
