import React, { useEffect, useState } from 'react'
import { Play, Pause, SkipForward, X, Sparkles, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext'

interface DemoControllerProps {
  onOpenBoundaries: () => void
}

export const DemoController: React.FC<DemoControllerProps> = ({ onOpenBoundaries }) => {
  const {
    isDemoActive,
    demoStep,
    demoMessage,
    isDemoPaused,
    stopDemo,
    pauseDemo,
    resumeDemo,
    advanceDemoStep,
  } = useApp()

  const [progress, setProgress] = useState(0)

  // Visual countdown progress indicator
  useEffect(() => {
    if (!isDemoActive || isDemoPaused) {
      return
    }

    setProgress(0)
    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100
        return prev + 2.5
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isDemoActive, demoStep, isDemoPaused])

  if (!isDemoActive) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in slide-in-from-bottom-6 duration-200">
      <div className="bg-surface/95 backdrop-blur-md text-text rounded-2xl shadow-2xl border border-border p-4">
        {/* Progress bar at top of card */}
        <div className="w-full bg-elevated rounded-full h-1 mb-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary to-indigo-400 h-full transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Demo Walkthrough
                </span>
                <span className="px-2 py-0.5 rounded-full bg-elevated border border-border text-[11px] font-mono font-medium text-text">
                  Step {demoStep} of 6
                </span>
                {demoStep === 6 && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </span>
                )}
              </div>
              <p className="text-sm text-text truncate mt-0.5" title={demoMessage}>
                {demoMessage}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={isDemoPaused ? resumeDemo : pauseDemo}
              className="p-2 text-muted hover:text-text hover:bg-elevated rounded-lg transition-colors cursor-pointer"
              title={isDemoPaused ? 'Resume auto-play' : 'Pause auto-play'}
            >
              {isDemoPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>

            {demoStep < 6 ? (
              <button
                onClick={advanceDemoStep}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-medium rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <span>Next</span>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  stopDemo()
                  onOpenBoundaries()
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-success hover:bg-success/90 text-white text-xs font-medium rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <span>Finish & Boundaries</span>
              </button>
            )}

            <button
              onClick={stopDemo}
              className="p-2 text-muted hover:text-danger hover:bg-elevated rounded-lg transition-colors cursor-pointer"
              title="Exit demo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
