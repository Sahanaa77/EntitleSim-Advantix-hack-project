import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Sliders, AlertTriangle, Layers, Timer, ArrowRight } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useApp } from '../context/AppContext'
import { BoundsConfig } from '../types'
import { getInvariantInfo } from '../lib/formatters'

export const BoundedExploration: React.FC = () => {
  const navigate = useNavigate()
  const { currentRun, startExploration, isPolling, setSelectedCx } = useApp()

  const [maxDepth, setMaxDepth] = useState(12)
  const [maxRetries, setMaxRetries] = useState(1)
  const [maxConcurrency, setMaxConcurrency] = useState(2)
  const [allowDuplicates, setAllowDuplicates] = useState(true)
  const [allowReorder, setAllowReorder] = useState(true)
  const [allowInterrupt, setAllowInterrupt] = useState(true)
  const [maxStates, setMaxStates] = useState(2000)
  const [seed, setSeed] = useState(42)

  const handleStart = async () => {
    const bounds: BoundsConfig = {
      max_depth: maxDepth,
      max_retries: maxRetries,
      allow_duplicates: allowDuplicates,
      allow_reorder: allowReorder,
      allow_interrupt: allowInterrupt,
      max_states: maxStates,
      max_concurrency: maxConcurrency,
      seed: seed,
    }
    await startExploration(bounds, false)
  }

  const handleSelectViolation = (cxId: string) => {
    const cx = currentRun?.counterexamples?.find((c) => c.id === cxId)
    if (cx) {
      setSelectedCx(cx)
      navigate('/verification/minimize')
    }
  }

  // Format chart data from measured run stats
  const depthChartData =
    currentRun?.stats?.by_depth?.map((item) => ({
      depth: `D${item.depth}`,
      states: item.states,
    })) || []

  const invariantChartData =
    currentRun?.stats?.by_invariant
      ? Object.entries(currentRun.stats.by_invariant).map(([inv, count]) => ({
          invariant: inv,
          violations: count,
        }))
      : []

  const liveProgress = currentRun?.progress

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Step 2: Bounded Exploration</h1>
          <p className="text-sm text-muted mt-1">
            Configure exploration bounds and systematically search event delivery permutations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleStart}
            disabled={isPolling}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPolling ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Exploring...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Start Exploration</span>
              </>
            )}
          </button>
          {currentRun?.counterexamples && currentRun.counterexamples.length > 0 && (
            <button
              onClick={() => {
                const inv1 = currentRun.counterexamples.find((c) => c.invariant_id === 'INV-1')
                setSelectedCx(inv1 || currentRun.counterexamples[0])
                navigate('/verification/minimize')
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs cursor-pointer transition-colors"
            >
              <span>Inspect Violations</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bounds Configuration Controls */}
      <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text pb-3 border-b border-border">
          <Sliders className="w-4 h-4 text-primary" />
          <span>Exploration Bounds</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <div className="flex justify-between text-xs font-medium text-text mb-1.5">
              <span>Max Depth</span>
              <span className="font-mono text-primary font-semibold">{maxDepth}</span>
            </div>
            <input
              type="range"
              min="4"
              max="20"
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="w-full h-1.5 bg-elevated rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-[11px] text-muted">Max sequence length</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-text mb-1.5">
              <span>Max Retries</span>
              <span className="font-mono text-primary font-semibold">{maxRetries}</span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
              className="w-full h-1.5 bg-elevated rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-[11px] text-muted">Duplicate deliveries</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-text mb-1.5">
              <span>Concurrency</span>
              <span className="font-mono text-primary font-semibold">{maxConcurrency}</span>
            </div>
            <input
              type="range"
              min="1"
              max="4"
              value={maxConcurrency}
              onChange={(e) => setMaxConcurrency(Number(e.target.value))}
              className="w-full h-1.5 bg-elevated rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-[11px] text-muted">Concurrent handler steps</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-text mb-1.5">
              <span>Max States Cap</span>
              <span className="font-mono text-primary font-semibold">{maxStates}</span>
            </div>
            <input
              type="range"
              min="200"
              max="10000"
              step="200"
              value={maxStates}
              onChange={(e) => setMaxStates(Number(e.target.value))}
              className="w-full h-1.5 bg-elevated rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-[11px] text-muted">State search limit</span>
          </div>
        </div>

        {/* Toggles */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center gap-6 text-xs text-text">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowReorder}
              onChange={(e) => setAllowReorder(e.target.checked)}
              className="rounded accent-primary text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <span>Allow Event Reordering (B1)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowDuplicates}
              onChange={(e) => setAllowDuplicates(e.target.checked)}
              className="rounded accent-primary text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <span>Allow Duplicate Events (B2)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowInterrupt}
              onChange={(e) => setAllowInterrupt(e.target.checked)}
              className="rounded accent-primary text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <span>Allow Mid-handler Interrupts (B3)</span>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted">Deterministic Seed:</span>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs border border-border bg-elevated text-text rounded font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Live progress feed during 300ms polling */}
      {isPolling && (
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/10 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-text">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
              <span>Exploring state space in background thread...</span>
            </div>
            <span className="font-mono text-muted">{liveProgress?.elapsed_ms?.toFixed(1) || 0} ms elapsed</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-elevated rounded-full h-2 overflow-hidden border border-border">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(5, ((liveProgress?.states_explored || 0) / maxStates) * 100))}%`,
              }}
            />
          </div>

          <div className="flex justify-between text-xs text-muted font-mono">
            <span>States explored: <strong className="text-text">{liveProgress?.states_explored || 0}</strong></span>
            <span>Violations found: <strong className="text-danger">{liveProgress?.violations || 0}</strong></span>
          </div>

          {/* Real-time timeline feed of violations */}
          {liveProgress?.found && liveProgress.found.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-primary/20">
              <span className="text-[11px] font-bold text-text uppercase tracking-wider">
                Live Violation Stream
              </span>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {liveProgress.found.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 bg-surface rounded border border-border text-xs flex items-center justify-between font-mono"
                  >
                    <span className="font-bold text-danger">[{item.invariant_id}]</span>
                    <span className="text-text truncate max-w-xs">{item.message}</span>
                    <span className="text-muted text-[10px]">Step {item.step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Measured Stats Cards (No hardcoded metrics) */}
      {currentRun?.stats && !isPolling && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wider">States Explored</div>
              <div className="text-2xl font-bold text-text font-mono mt-0.5">
                {currentRun.stats.states_explored.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted mt-0.5">Bounded sequence states</div>
            </div>
          </div>

          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-danger/15 text-danger flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wider">Violations Found</div>
              <div className="text-2xl font-bold text-danger font-mono mt-0.5">
                {currentRun.stats.violations}
              </div>
              <div className="text-[11px] text-muted mt-0.5">Invariant divergences</div>
            </div>
          </div>

          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
              <Timer className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wider">Exploration Time</div>
              <div className="text-2xl font-bold text-text font-mono mt-0.5">
                {currentRun.stats.duration_ms.toFixed(1)} ms
              </div>
              <div className="text-[11px] text-muted mt-0.5">Measured engine runtime</div>
            </div>
          </div>
        </div>
      )}

      {/* Recharts Visualizations */}
      {currentRun?.stats && !isPolling && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-3">
            <div className="text-xs font-semibold text-text uppercase tracking-wider">
              States Explored by Sequence Depth
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={depthChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F2D4A" />
                  <XAxis dataKey="depth" tick={{ fontSize: 11, fill: '#8FA3C0' }} stroke="#1F2D4A" />
                  <YAxis tick={{ fontSize: 11, fill: '#8FA3C0' }} stroke="#1F2D4A" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111A2E', borderColor: '#1F2D4A', borderRadius: '8px', color: '#E6EDF7', fontSize: '12px' }}
                    itemStyle={{ color: '#E6EDF7' }}
                  />
                  <Bar dataKey="states" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-3">
            <div className="text-xs font-semibold text-text uppercase tracking-wider">
              Violations by Invariant
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invariantChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F2D4A" />
                  <XAxis dataKey="invariant" tick={{ fontSize: 11, fill: '#8FA3C0' }} stroke="#1F2D4A" />
                  <YAxis tick={{ fontSize: 11, fill: '#8FA3C0' }} stroke="#1F2D4A" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111A2E', borderColor: '#1F2D4A', borderRadius: '8px', color: '#E6EDF7', fontSize: '12px' }}
                    itemStyle={{ color: '#E6EDF7' }}
                  />
                  <Bar dataKey="violations" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Discovered Counterexamples List */}
      {currentRun?.counterexamples && currentRun.counterexamples.length > 0 && !isPolling && (
        <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between bg-elevated">
            <span className="text-xs font-bold text-text uppercase tracking-wider">
              Discovered Invariant Violations ({currentRun.counterexamples.length})
            </span>
            <span className="text-[11px] text-muted">Click to isolate & minimize with ddmin</span>
          </div>
          <div className="divide-y divide-border">
            {currentRun.counterexamples.map((cx, idx) => {
              const invInfo = getInvariantInfo(cx.invariant_id)

              return (
                <div
                  key={cx.id || idx}
                  onClick={() => handleSelectViolation(cx.id)}
                  className="p-4 hover:bg-elevated transition-colors cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-text">{invInfo.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${invInfo.badgeClass}`}
                      >
                        {invInfo.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">{invInfo.explanation}</p>
                    {invInfo.businessImpact && (
                      <p className="text-[11px] text-danger font-medium">
                        <span className="font-semibold text-text">Business Impact: </span>
                        {invInfo.businessImpact}
                      </p>
                    )}
                    <div className="text-[11px] text-muted font-mono">
                      Failing sequence length: {cx.original_trace.length} events &middot; Candidate for minimization
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-primary shrink-0">
                    <span>Minimize & Inspect</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
