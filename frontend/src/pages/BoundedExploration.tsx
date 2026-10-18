import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Sliders, AlertTriangle, Layers, Timer, ArrowRight } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useApp } from '../context/AppContext'
import { BoundsConfig } from '../types'

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
      navigate('/minimize')
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Step 2: Bounded Exploration</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure exploration bounds and systematically search event delivery permutations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleStart}
            disabled={isPolling}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
                navigate('/minimize')
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs cursor-pointer"
            >
              <span>Inspect Violations</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bounds Configuration Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 pb-3 border-b border-slate-100">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span>Exploration Bounds</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
              <span>Max Depth</span>
              <span className="font-mono text-blue-600 font-semibold">{maxDepth}</span>
            </div>
            <input
              type="range"
              min="4"
              max="20"
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-[11px] text-slate-400">Max sequence length</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
              <span>Max Retries</span>
              <span className="font-mono text-blue-600 font-semibold">{maxRetries}</span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-[11px] text-slate-400">Duplicate deliveries</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
              <span>Concurrency</span>
              <span className="font-mono text-blue-600 font-semibold">{maxConcurrency}</span>
            </div>
            <input
              type="range"
              min="1"
              max="4"
              value={maxConcurrency}
              onChange={(e) => setMaxConcurrency(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-[11px] text-slate-400">Concurrent handler steps</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
              <span>Max States Cap</span>
              <span className="font-mono text-blue-600 font-semibold">{maxStates}</span>
            </div>
            <input
              type="range"
              min="200"
              max="10000"
              step="200"
              value={maxStates}
              onChange={(e) => setMaxStates(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-[11px] text-slate-400">State search limit</span>
          </div>
        </div>

        {/* Toggles */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-6 text-xs text-slate-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowReorder}
              onChange={(e) => setAllowReorder(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Allow Event Reordering (B1)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowDuplicates}
              onChange={(e) => setAllowDuplicates(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Allow Duplicate Events (B2)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowInterrupt}
              onChange={(e) => setAllowInterrupt(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Allow Mid-handler Interrupts (B3)</span>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-slate-400">Deterministic Seed:</span>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs border border-slate-200 rounded font-mono"
            />
          </div>
        </div>
      </div>

      {/* Live progress feed during 300ms polling */}
      {isPolling && (
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
              <span>Exploring state space in background thread...</span>
            </div>
            <span className="font-mono">{liveProgress?.elapsed_ms?.toFixed(1) || 0} ms elapsed</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(5, ((liveProgress?.states_explored || 0) / maxStates) * 100))}%`,
              }}
            />
          </div>

          <div className="flex justify-between text-xs text-blue-700 font-mono">
            <span>States explored: {liveProgress?.states_explored || 0}</span>
            <span>Violations found: {liveProgress?.violations || 0}</span>
          </div>

          {/* Real-time timeline feed of violations */}
          {liveProgress?.found && liveProgress.found.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-blue-100">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                Live Violation Stream
              </span>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {liveProgress.found.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 bg-white/80 rounded border border-blue-100 text-xs flex items-center justify-between font-mono"
                  >
                    <span className="font-bold text-rose-600">[{item.invariant_id}]</span>
                    <span className="text-slate-600 truncate max-w-xs">{item.message}</span>
                    <span className="text-slate-400 text-[10px]">Step {item.step}</span>
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
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">States Explored</div>
              <div className="text-2xl font-bold text-slate-900 font-mono mt-0.5">
                {currentRun.stats.states_explored.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Bounded sequence states</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Violations Found</div>
              <div className="text-2xl font-bold text-rose-600 font-mono mt-0.5">
                {currentRun.stats.violations}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Invariant divergences</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Timer className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Exploration Time</div>
              <div className="text-2xl font-bold text-slate-900 font-mono mt-0.5">
                {currentRun.stats.duration_ms.toFixed(1)} ms
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Measured engine runtime</div>
            </div>
          </div>
        </div>
      )}

      {/* Recharts Visualizations */}
      {currentRun?.stats && !isPolling && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              States Explored by Sequence Depth
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={depthChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="depth" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                  />
                  <Bar dataKey="states" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Violations by Invariant
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invariantChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="invariant" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Discovered Counterexamples ({currentRun.counterexamples.length})
            </span>
            <span className="text-[11px] text-slate-400">Click to isolate & minimize</span>
          </div>
          <div className="divide-y divide-slate-100">
            {currentRun.counterexamples.map((cx) => (
              <div
                key={cx.id}
                onClick={() => handleSelectViolation(cx.id)}
                className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                      {cx.invariant_id}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {cx.invariant_id === 'INV-1'
                        ? 'Unauthorized premium access after out-of-order delivery'
                        : cx.invariant_id === 'INV-2'
                        ? 'Usage counter double-counting or lost update'
                        : cx.invariant_id === 'INV-3'
                        ? 'Cross-tenant state isolation breach'
                        : 'Invariant divergence'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Trace length: {cx.original_trace.length} events &middot; ID: {cx.id.slice(0, 8)}...
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                  <span>Minimize & Inspect</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
