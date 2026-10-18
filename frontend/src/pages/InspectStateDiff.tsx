import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Play, Pause, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { StateMachineGraph } from '../components/StateMachineGraph'

export const InspectStateDiff: React.FC = () => {
  const navigate = useNavigate()
  const { selectedCx, currentRun } = useApp()

  const activeCx = selectedCx || currentRun?.counterexamples?.[0]
  const diffs = activeCx?.state_diffs || []

  // Default to offending step or last step
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (diffs.length > 0) {
      const offendingIdx = diffs.findIndex((d) => d.is_offending)
      setCurrentStepIdx(offendingIdx >= 0 ? offendingIdx : diffs.length - 1)
    }
  }, [diffs.length])

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => {
      setCurrentStepIdx((prev) => {
        if (prev >= diffs.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1200)
    return () => clearInterval(timer)
  }, [isPlaying, diffs.length])

  // Fallback trace data if diffs not yet populated
  const currentDiff = diffs[currentStepIdx] || {
    step: 1,
    event: { type: 'SubscriptionCreated', seq: 1, payload: { plan: 'free' } },
    expected: { plan: 'free', status: 'active', features: ['basic'], usage: 0 },
    observed: { plan: 'free', status: 'active', features: ['basic'], usage: 0 },
    is_offending: false,
  }

  const isInv3 = activeCx?.invariant_id === 'INV-3'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Step 4: Inspect State Diff</h1>
          <p className="text-sm text-slate-500 mt-1">
            Playback step-by-step state transitions and inspect the divergence between reference oracle and SUT.
          </p>
        </div>
        <button
          onClick={() => navigate('/fix')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
        >
          <span>Proceed to Fix & Retest</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Playback Controls & Timeline Chips */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsPlaying(false)
              setCurrentStepIdx((prev) => Math.max(0, prev - 1))
            }}
            disabled={currentStepIdx === 0}
            className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play sequence'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <span className="font-mono text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-700">
            Step {currentStepIdx + 1} / {Math.max(1, diffs.length)}
          </span>

          <button
            onClick={() => {
              setIsPlaying(false)
              setCurrentStepIdx((prev) => Math.min(diffs.length - 1, prev + 1))
            }}
            disabled={currentStepIdx >= diffs.length - 1}
            className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {diffs.map((step, idx) => {
            const isSelected = idx === currentStepIdx
            return (
              <button
                key={idx}
                onClick={() => {
                  setIsPlaying(false)
                  setCurrentStepIdx(idx)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? step.is_offending
                      ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-xs ring-1 ring-rose-400'
                      : 'bg-blue-50 border-blue-300 text-blue-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="font-mono text-[10px] font-bold">#{step.step}</span>
                <span>{step.event?.type}</span>
                {step.is_offending && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* State Machine Visualization */}
      <StateMachineGraph
        currentPlan={currentDiff.observed?.plan || currentDiff.observed?.features?.includes('premium') ? 'pro' : 'free'}
        expectedPlan={currentDiff.expected?.plan || 'free'}
        isOffending={!!currentDiff.is_offending}
        offendingReason={currentDiff.violation?.message || 'Out-of-order event applied without sequence version validation'}
      />

      {/* Side-by-Side Expected vs Observed JSON Diff */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expected State (Green) */}
        <div className="bg-white rounded-xl border border-emerald-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Reference Model (Oracle Expected)</span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
              Truth
            </span>
          </div>
          <div className="p-4 bg-slate-900">
            <pre className="font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto">
              {JSON.stringify(currentDiff.expected || {}, null, 2)}
            </pre>
          </div>
        </div>

        {/* Observed State (Red) */}
        <div
          className={`bg-white rounded-xl border shadow-xs overflow-hidden ${
            currentDiff.is_offending ? 'border-rose-300 ring-1 ring-rose-300' : 'border-slate-200'
          }`}
        >
          <div
            className={`px-4 py-3 border-b flex items-center justify-between ${
              currentDiff.is_offending ? 'bg-rose-50 text-rose-900 border-rose-200' : 'bg-slate-50 text-slate-800 border-slate-100'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertCircle className={`w-4 h-4 ${currentDiff.is_offending ? 'text-rose-600' : 'text-slate-500'}`} />
              <span>System Under Test (SUT Observed)</span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                currentDiff.is_offending ? 'bg-rose-200 text-rose-900' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {currentDiff.is_offending ? 'Diverged' : 'Aligned'}
            </span>
          </div>
          <div className="p-4 bg-slate-900">
            <pre
              className={`font-mono text-xs leading-relaxed overflow-x-auto ${
                currentDiff.is_offending ? 'text-rose-400 font-semibold' : 'text-slate-300'
              }`}
            >
              {JSON.stringify(currentDiff.observed || {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Tenant Isolation Panel if INV-3 */}
      {isInv3 && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Cross-Tenant Isolation Breach (Tenant A &middot; Tenant B)</span>
          </div>
          <p className="text-xs text-amber-800">
            Bug B4 shared key collision: Event delivered for Tenant A mutated cache or usage counters of Tenant B.
          </p>
        </div>
      )}
    </div>
  )
}
