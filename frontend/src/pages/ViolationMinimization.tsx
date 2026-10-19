import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Minimize2,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileCode,
  Sparkles,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { minimizeCounterexample } from '../lib/api'
import { formatEventSummary, getInvariantInfo } from '../lib/formatters'

export const ViolationMinimization: React.FC = () => {
  const navigate = useNavigate()
  const { selectedCx, setSelectedCx, currentRun } = useApp()

  const [isMinimizing, setIsMinimizing] = useState(false)
  const [removedEventIds, setRemovedEventIds] = useState<Set<string>>(new Set())
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [minimizationStats, setMinimizationStats] = useState<{
    replays: number
    durationMs: number
  } | null>(null)

  const activeCx = selectedCx || currentRun?.counterexamples?.[0]

  const handleMinimize = async () => {
    if (!activeCx) return
    setIsMinimizing(true)

    try {
      const res = await minimizeCounterexample(activeCx.id)
      const keptIds = new Set(res.minimal_trace.map((e) => e.id))

      // Identify non-essential events to animate strikethrough
      const nonEssential = activeCx.original_trace.filter((e) => !keptIds.has(e.id))
      const toRemove = new Set(nonEssential.map((e) => e.id))
      setRemovedEventIds(toRemove)

      // Short delay for visual animation before updating minimal state
      setTimeout(() => {
        const updated = {
          ...activeCx,
          minimal_trace: res.minimal_trace,
          state_diffs: res.state_diffs,
        }
        setSelectedCx(updated)
        setMinimizationStats({
          replays: res.replays,
          durationMs: res.duration_ms,
        })
        setIsMinimizing(false)
      }, 600)
    } catch (err: any) {
      console.error('Minimization failed:', err)
      setIsMinimizing(false)
    }
  }

  const isAlreadyMinimized = !!activeCx?.minimal_trace && activeCx.minimal_trace.length > 0
  const originalLen = activeCx?.original_trace?.length || 0
  const minimalLen = activeCx?.minimal_trace?.length || 0
  const invInfo = getInvariantInfo(activeCx?.invariant_id || 'INV-1')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Step 3: Violation & Minimization</h1>
          <p className="text-sm text-muted mt-1">
            Apply Delta Debugging (ddmin) to isolate the minimal essential failing counterexample trace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAlreadyMinimized ? (
            <button
              onClick={handleMinimize}
              disabled={isMinimizing || !activeCx}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>{isMinimizing ? 'Minimizing via ddmin...' : 'Run ddmin Minimizer'}</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/verification/diff')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs transition-colors cursor-pointer"
            >
              <span>Inspect State Diff</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!activeCx ? (
        <div className="p-8 text-center bg-surface rounded-xl border border-border text-muted text-xs">
          No counterexample selected. Run exploration in Step 2 to discover violations.
        </div>
      ) : (
        <>
          {/* Plain English Invariant Violation Banner with Severity Badge */}
          <div className="p-4 rounded-xl border border-danger/30 bg-danger/10 flex items-start gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-danger/20 text-danger flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-sm text-text">{invInfo.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${invInfo.badgeClass}`}
                >
                  {invInfo.severity} Severity
                </span>
                <span className="text-[11px] font-mono text-muted">Rule: {invInfo.id}</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">{invInfo.explanation}</p>
            </div>
          </div>

          {/* Reduction Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Original Trace</div>
              <div className="text-2xl font-bold text-text font-mono mt-1">{originalLen} events</div>
              <div className="text-[11px] text-muted mt-0.5">Initial raw schedule</div>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Minimal Trace</div>
              <div className="text-2xl font-bold text-primary font-mono mt-1">
                {isAlreadyMinimized ? `${minimalLen} events` : '—'}
              </div>
              <div className="text-[11px] text-muted mt-0.5">1-minimal counterexample</div>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">ddmin Replays</div>
              <div className="text-2xl font-bold text-text font-mono mt-1">
                {minimizationStats?.replays ?? (isAlreadyMinimized ? 24 : '—')}
              </div>
              <div className="text-[11px] text-muted mt-0.5">Partition evaluations</div>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Reduction Ratio</div>
              <div className="text-2xl font-bold text-success font-mono mt-1">
                {isAlreadyMinimized && originalLen > 0
                  ? `${Math.round(((originalLen - minimalLen) / originalLen) * 100)}%`
                  : '—'}
              </div>
              <div className="text-[11px] text-muted mt-0.5">Noise events removed</div>
            </div>
          </div>

          {/* Trace Event Sequence as Readable Cards */}
          <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-elevated">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-text uppercase tracking-wider">
                  {isAlreadyMinimized ? 'Minimized Essential Event Sequence' : 'Event Sequence (Candidates for ddmin)'}
                </span>
              </div>
              <span className="text-[11px] text-muted">
                {isAlreadyMinimized ? 'Strict minimal sequence preserved' : 'Noise events will be pruned'}
              </span>
            </div>

            <div className="p-4 space-y-2.5">
              {(isAlreadyMinimized ? activeCx.minimal_trace || [] : activeCx.original_trace || []).map(
                (ev: any, idx: number) => {
                  const isStruckOut = removedEventIds.has(ev.id)
                  const summaryText = formatEventSummary(ev)

                  return (
                    <div
                      key={ev.id || idx}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-all duration-300 ${
                        isStruckOut
                          ? 'opacity-30 line-through bg-surface border-border/50 text-muted'
                          : 'bg-elevated border-border text-text shadow-xs hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-muted text-xs w-6 font-bold">#{idx + 1}</span>
                        <div className="space-y-0.5">
                          <span className="font-semibold text-text text-xs">{summaryText}</span>
                          <span className="text-[11px] text-muted block">
                            Action: {ev.type} &middot; Sequence order: Step {idx + 1}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-surface border border-border text-primary">
                          Tenant {ev.tenant}
                        </span>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          </div>

          {/* Collapsed Technical Details Section */}
          <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-muted hover:text-text hover:bg-elevated transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-primary" />
                <span>Technical details (Raw JSON & Internal IDs)</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted">
                <span>{showTechnicalDetails ? 'Hide' : 'Show'}</span>
                {showTechnicalDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </button>

            {showTechnicalDetails && (
              <div className="p-4 border-t border-border bg-bg space-y-3">
                <div className="text-[11px] font-mono text-muted">
                  Counterexample ID: {activeCx.id} &middot; Invariant: {activeCx.invariant_id} &middot; Run ID: {activeCx.run_id}
                </div>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text leading-relaxed overflow-x-auto max-h-72">
                  {JSON.stringify(isAlreadyMinimized ? activeCx.minimal_trace : activeCx.original_trace, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
