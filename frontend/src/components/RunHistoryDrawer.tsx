import React, { useState } from 'react'
import { X, History, RefreshCw, RotateCcw, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { resetDemoData } from '../lib/api'

export const RunHistoryDrawer: React.FC = () => {
  const { isHistoryOpen, setIsHistoryOpen, runHistory, currentRun, openRun, fetchHistory, fetchModels, toast } = useApp()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  if (!isHistoryOpen) return null

  const handleConfirmReset = async () => {
    setIsResetting(true)
    try {
      await resetDemoData()
      await fetchHistory()
      await fetchModels()
      window.dispatchEvent(new CustomEvent('refresh-dashboard'))
      toast('Demo Data Reset', 'Runs and counterexamples cleared, sample models re-seeded', 'success')
      setShowConfirm(false)
    } catch (err: any) {
      toast('Reset Failed', err.message || 'Failed to reset demo data', 'error')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsHistoryOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-surface border-l border-border shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-elevated">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-text">Run History</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-semibold font-mono">
                {runHistory.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchHistory()}
                className="p-1.5 text-muted hover:text-text rounded-md hover:bg-surface transition-colors cursor-pointer"
                title="Refresh history"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={isResetting}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-danger bg-danger/10 hover:bg-danger/20 border border-danger/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Reset demo data"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>Reset Demo</span>
              </button>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 text-muted hover:text-text rounded-md hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Runs List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {runHistory.length === 0 ? (
              <div className="text-center py-12 text-muted text-sm">
                No past runs recorded. Run an exploration to see history.
              </div>
            ) : (
              runHistory.map((run) => {
                const isSelected = currentRun?.id === run.id
                const violationsCount = run.stats?.violations ?? run.counterexamples?.length ?? 0
                const statesCount = run.stats?.states_explored ?? 0
                const duration = run.stats?.duration_ms ? `${run.stats.duration_ms.toFixed(1)}ms` : '—'

                return (
                  <div
                    key={run.id}
                    onClick={() => openRun(run.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all shadow-xs ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border bg-surface hover:border-border/80 hover:bg-elevated'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-mono text-muted text-[11px]">
                        {run.id.slice(0, 8)}...
                      </span>
                      <span className="text-muted text-[11px]">
                        {new Date(run.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          run.status === 'done'
                            ? violationsCount === 0
                              ? 'bg-success/20 text-success border border-success/30'
                              : 'bg-danger/20 text-danger border border-danger/30'
                            : run.status === 'running'
                            ? 'bg-primary/20 text-primary border border-primary/30 animate-pulse'
                            : 'bg-elevated text-muted border border-border'
                        }`}
                      >
                        {run.status === 'done'
                          ? violationsCount === 0
                            ? '0 Violations'
                            : `${violationsCount} Violations`
                          : run.status}
                      </span>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          run.fixed
                            ? 'bg-success/15 text-success border border-success/30'
                            : 'bg-warn/15 text-warn border border-warn/30'
                        }`}
                      >
                        {run.fixed ? 'fixed=true' : 'fixed=false'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 text-[11px] text-muted gap-1 bg-elevated p-2 rounded-lg border border-border font-mono">
                      <div>States: <span className="font-bold text-text">{statesCount}</span></div>
                      <div>Duration: <span className="font-bold text-text">{duration}</span></div>
                    </div>

                    {run.counterexamples && run.counterexamples.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Array.from(new Set(run.counterexamples.map((c) => c.invariant_id))).map((inv) => (
                          <span
                            key={inv}
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-danger/15 text-danger border border-danger/30"
                          >
                            {inv}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer Action */}
          <div className="p-3.5 border-t border-border bg-elevated/70 flex items-center justify-between gap-3">
            <div className="text-[11px] text-muted">
              Clear runs and re-seed sample models
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isResetting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-danger bg-danger/10 hover:bg-danger/20 border border-danger/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Reset Demo Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-danger/15 text-danger flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-text">Reset Demo Data?</h3>
                <p className="text-xs text-muted leading-relaxed">
                  This will clear all runs, counterexamples, and regression tests, and re-seed sample models. Saved models will be kept.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isResetting}
                className="px-3 py-1.5 text-xs font-medium text-text bg-elevated hover:bg-elevated/80 border border-border rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-danger hover:bg-danger/90 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <span>Confirm Reset</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

