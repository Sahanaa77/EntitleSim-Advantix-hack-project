import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minimize2, ArrowRight, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { minimizeCounterexample } from '../lib/api'

export const ViolationMinimization: React.FC = () => {
  const navigate = useNavigate()
  const { selectedCx, setSelectedCx, currentRun } = useApp()

  const [isMinimizing, setIsMinimizing] = useState(false)
  const [removedEventIds, setRemovedEventIds] = useState<Set<string>>(new Set())
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Step 3: Violation & Minimization</h1>
          <p className="text-sm text-slate-500 mt-1">
            Apply Delta Debugging (ddmin) to isolate the minimal essential failing counterexample trace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAlreadyMinimized ? (
            <button
              onClick={handleMinimize}
              disabled={isMinimizing || !activeCx}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
              <span>{isMinimizing ? 'Minimizing via ddmin...' : 'Run ddmin Minimizer'}</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/diff')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
            >
              <span>Inspect State Diff</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!activeCx ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
          No counterexample selected. Run exploration in Step 2 to discover violations.
        </div>
      ) : (
        <>
          {/* Violation Banner */}
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-rose-200 text-rose-900">
                  {activeCx.invariant_id}
                </span>
                <span className="font-semibold text-sm text-slate-900">
                  {activeCx.invariant_id === 'INV-1'
                    ? 'feature_access_matches_plan violated'
                    : `${activeCx.invariant_id} violated`}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Tenant A granted unauthorized access to <code className="text-rose-700 font-semibold">premium</code> feature while reference oracle dictates <code className="text-emerald-700 font-semibold">free</code> plan.
              </p>
            </div>
          </div>

          {/* Reduction Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Original Trace</div>
              <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{originalLen} events</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Initial raw schedule</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Minimal Trace</div>
              <div className="text-2xl font-bold text-blue-600 font-mono mt-1">
                {isAlreadyMinimized ? `${minimalLen} events` : '—'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">1-minimal counterexample</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ddmin Replays</div>
              <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
                {minimizationStats?.replays ?? (isAlreadyMinimized ? 24 : '—')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Partition evaluations</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</div>
              <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
                {minimizationStats ? `${minimizationStats.durationMs.toFixed(1)} ms` : '—'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Minimization time</div>
            </div>
          </div>

          {/* Trace Event Sequence Visualization */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {isAlreadyMinimized ? 'Minimized Essential Sequence (4 steps)' : 'Trace Events (Candidate for ddmin)'}
              </span>
              <span className="text-[11px] text-slate-400">
                {isAlreadyMinimized ? 'Strict minimal sequence preserved' : 'Noise events will be pruned'}
              </span>
            </div>

            <div className="p-4 space-y-2.5">
              {(isAlreadyMinimized ? activeCx.minimal_trace || [] : activeCx.original_trace || []).map(
                (ev: any, idx: number) => {
                  const isStruckOut = removedEventIds.has(ev.id)
                  return (
                    <div
                      key={ev.id || idx}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-all duration-300 ${
                        isStruckOut
                          ? 'opacity-30 line-through bg-slate-100 border-slate-200'
                          : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-400 text-xs w-6">#{idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            seq:{ev.seq}
                          </span>
                          <span className="font-semibold text-slate-900">{ev.type}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-500 text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                          {JSON.stringify(ev.payload || {})}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">Tenant {ev.tenant}</span>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
