import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileCode,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { StateMachineGraph } from '../components/StateMachineGraph'
import { formatEventSummary, getInvariantInfo } from '../lib/formatters'

export const InspectStateDiff: React.FC = () => {
  const navigate = useNavigate()
  const { selectedCx, currentRun, currentModel } = useApp()
  const displayUnit = currentModel?.definition?.unit || currentModel?.definition?.display?.unit || 'GB'

  const activeCx = selectedCx || currentRun?.counterexamples?.[0]
  const diffs = activeCx?.state_diffs || []

  // Default to offending step or last step
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

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
    }, 1400)
    return () => clearInterval(timer)
  }, [isPlaying, diffs.length])

  // Fallback trace data if diffs not yet populated
  const currentDiff = diffs[currentStepIdx] || {
    step: 1,
    event: { type: 'SubscriptionCreated', seq: 1, tenant: 'A', payload: { plan: 'free' } },
    expected: { plan: 'free', status: 'active', features: ['basic'], usage: 0 },
    observed: { plan: 'free', status: 'active', features: ['basic'], usage: 0 },
    is_offending: false,
  }

  const isInv3 = activeCx?.invariant_id === 'INV-3'
  const invInfo = getInvariantInfo(activeCx?.invariant_id || 'INV-1')

  const expectedFeatures: string[] = currentDiff.expected?.features || []
  const observedFeatures: string[] = currentDiff.observed?.features || []

  const isPlanMismatched = currentDiff.expected?.plan !== currentDiff.observed?.plan
  const isStatusMismatched = currentDiff.expected?.status !== currentDiff.observed?.status
  const isUsageMismatched = currentDiff.expected?.usage !== currentDiff.observed?.usage

  const currentEventCardText = formatEventSummary(currentDiff.event || {})

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Step 4: Inspect State Diff</h1>
          <p className="text-sm text-muted mt-1">
            Playback step-by-step state transitions and inspect the divergence between reference oracle and SUT.
          </p>
        </div>
        <button
          onClick={() => navigate('/verification/fix')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs transition-colors cursor-pointer"
        >
          <span>Proceed to Fix & Retest</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Playback Controls & Timeline Chips */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsPlaying(false)
              setCurrentStepIdx((prev) => Math.max(0, prev - 1))
            }}
            disabled={currentStepIdx === 0}
            className="p-1.5 text-muted hover:text-text disabled:opacity-30 rounded-md hover:bg-elevated cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 text-primary hover:text-primary/80 rounded-md hover:bg-elevated cursor-pointer transition-colors"
            title={isPlaying ? 'Pause' : 'Play sequence'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-elevated border border-border rounded-lg text-text">
            Step {currentStepIdx + 1} of {Math.max(1, diffs.length)}
          </span>

          <button
            onClick={() => {
              setIsPlaying(false)
              setCurrentStepIdx((prev) => Math.min(diffs.length - 1, prev + 1))
            }}
            disabled={currentStepIdx >= diffs.length - 1}
            className="p-1.5 text-muted hover:text-text disabled:opacity-30 rounded-md hover:bg-elevated cursor-pointer transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline chips with readable step titles */}
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
                      ? 'bg-danger/20 border-danger text-danger shadow-xs ring-1 ring-danger'
                      : 'bg-primary/20 border-primary text-primary shadow-xs ring-1 ring-primary'
                    : 'bg-elevated border-border text-muted hover:text-text hover:bg-elevated/80'
                }`}
              >
                <span className="font-mono text-[10px] font-bold">#{step.step}</span>
                <span>{step.event?.type}</span>
                {step.is_offending && <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Step Event Summary Card */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold font-mono text-xs">
            #{currentDiff.step}
          </div>
          <div>
            <span className="text-xs font-bold text-text block">{currentEventCardText}</span>
            <span className="text-[11px] text-muted">
              Action type: {currentDiff.event?.type} &middot; Target: Tenant {currentDiff.event?.tenant || 'A'}
            </span>
          </div>
        </div>

        {currentDiff.is_offending ? (
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${invInfo.badgeClass}`}
            >
              {invInfo.severity} Violation
            </span>
            <span className="text-xs font-semibold text-danger">Offending Step</span>
          </div>
        ) : (
          <span className="text-[11px] font-medium text-success flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>State Synchronized</span>
          </span>
        )}
      </div>

      {/* Offending Invariant Explanation Banner */}
      {currentDiff.is_offending && (
        <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 flex items-start gap-3 shadow-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-text">{invInfo.name}</span>
              <span className="text-[11px] font-mono text-muted">({invInfo.id})</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">{invInfo.explanation}</p>
            {invInfo.businessImpact && (
              <p className="text-[11px] text-danger font-medium pt-1">
                <span className="font-semibold text-text">Business Impact: </span>
                {invInfo.businessImpact}
              </p>
            )}
          </div>
        </div>
      )}

      {/* State Machine Graph Visualization */}
      <StateMachineGraph
        currentPlan={currentDiff.observed?.plan || currentDiff.observed?.features?.includes('premium') ? 'pro' : 'free'}
        expectedPlan={currentDiff.expected?.plan || 'free'}
        isOffending={!!currentDiff.is_offending}
        offendingReason={currentDiff.violation?.message || 'Out-of-order event applied without sequence version validation'}
      />

      {/* Labeled Field Comparisons (Expected Truth vs Observed SUT) */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-elevated">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-text uppercase tracking-wider">
              Labeled Field Comparison (Step {currentDiff.step})
            </h3>
          </div>
          <span className="text-[11px] text-muted">Reference Oracle Truth vs SUT Observed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-elevated/40 text-[11px] font-mono text-muted uppercase">
                <th className="py-2.5 px-4 w-40">State Attribute</th>
                <th className="py-2.5 px-4">Oracle Truth (Expected)</th>
                <th className="py-2.5 px-4">SUT Result (Observed)</th>
                <th className="py-2.5 px-4 w-28 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-xs">
              {/* Plan Tier */}
              <tr className={isPlanMismatched ? 'bg-danger/10' : 'hover:bg-elevated/30'}>
                <td className="py-3 px-4 font-bold text-text">Plan Tier</td>
                <td className="py-3 px-4 text-success font-bold uppercase">
                  {currentDiff.expected?.plan || 'none'}
                </td>
                <td className={`py-3 px-4 font-bold uppercase ${isPlanMismatched ? 'text-danger underline' : 'text-text'}`}>
                  {currentDiff.observed?.plan || 'none'}
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isPlanMismatched
                        ? 'bg-danger/20 text-danger border-danger/30'
                        : 'bg-success/15 text-success border-success/30'
                    }`}
                  >
                    {isPlanMismatched ? 'Diverged' : 'Match'}
                  </span>
                </td>
              </tr>

              {/* Subscription Status */}
              <tr className={isStatusMismatched ? 'bg-danger/10' : 'hover:bg-elevated/30'}>
                <td className="py-3 px-4 font-bold text-text">Subscription Status</td>
                <td className="py-3 px-4 text-text">{currentDiff.expected?.status || 'none'}</td>
                <td className={`py-3 px-4 ${isStatusMismatched ? 'text-danger font-bold' : 'text-text'}`}>
                  {currentDiff.observed?.status || 'none'}
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isStatusMismatched
                        ? 'bg-danger/20 text-danger border-danger/30'
                        : 'bg-success/15 text-success border-success/30'
                    }`}
                  >
                    {isStatusMismatched ? 'Diverged' : 'Match'}
                  </span>
                </td>
              </tr>

              {/* Entitled Features */}
              <tr className="hover:bg-elevated/30">
                <td className="py-3 px-4 font-bold text-text">Active Features</td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {expectedFeatures.length > 0 ? (
                      expectedFeatures.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded text-[10px] bg-success/15 text-success border border-success/30">
                          {f}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted italic">none</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {observedFeatures.length > 0 ? (
                      observedFeatures.map((f) => {
                        const isUnexpected = !expectedFeatures.includes(f)
                        return (
                          <span
                            key={f}
                            className={`px-1.5 py-0.5 rounded text-[10px] border ${
                              isUnexpected
                                ? 'bg-danger/20 text-danger border-danger font-bold'
                                : 'bg-elevated text-text border-border'
                            }`}
                          >
                            {f}
                          </span>
                        )
                      })
                    ) : (
                      <span className="text-muted italic">none</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      JSON.stringify([...expectedFeatures].sort()) !== JSON.stringify([...observedFeatures].sort())
                        ? 'bg-danger/20 text-danger border-danger/30'
                        : 'bg-success/15 text-success border-success/30'
                    }`}
                  >
                    {JSON.stringify([...expectedFeatures].sort()) !== JSON.stringify([...observedFeatures].sort())
                      ? 'Diverged'
                      : 'Match'}
                  </span>
                </td>
              </tr>

              {/* Metered Usage */}
              <tr className={isUsageMismatched ? 'bg-danger/10' : 'hover:bg-elevated/30'}>
                <td className="py-3 px-4 font-bold text-text">Metered Usage ({displayUnit})</td>
                <td className="py-3 px-4 text-text">{currentDiff.expected?.usage ?? 0} {displayUnit}</td>
                <td className={`py-3 px-4 ${isUsageMismatched ? 'text-danger font-bold' : 'text-text'}`}>
                  {currentDiff.observed?.usage ?? 0} {displayUnit}
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isUsageMismatched
                        ? 'bg-danger/20 text-danger border-danger/30'
                        : 'bg-success/15 text-success border-success/30'
                    }`}
                  >
                    {isUsageMismatched ? 'Diverged' : 'Match'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tenant Isolation Panel if INV-3 */}
      {isInv3 && (
        <div className="p-4 rounded-xl border border-warn/30 bg-warn/10 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-warn">
            <ShieldAlert className="w-4 h-4 text-warn" />
            <span>Cross-Tenant Isolation Breach</span>
          </div>
          <p className="text-xs text-text">
            Key collision across tenants: Webhook delivery intended for Tenant A mutated the cache and usage counters of Tenant B.
          </p>
        </div>
      )}

      {/* Collapsed Technical Details Section */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-muted hover:text-text hover:bg-elevated transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            <span>Technical details (Raw JSON & State Diffs)</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted">
            <span>{showTechnicalDetails ? 'Hide' : 'Show'}</span>
            {showTechnicalDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        {showTechnicalDetails && (
          <div className="p-4 border-t border-border bg-bg grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-muted block mb-1">
                Raw Expected State JSON
              </span>
              <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-success leading-relaxed overflow-x-auto max-h-60">
                {JSON.stringify(currentDiff.expected || {}, null, 2)}
              </pre>
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-muted block mb-1">
                Raw Observed State JSON
              </span>
              <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-danger leading-relaxed overflow-x-auto max-h-60">
                {JSON.stringify(currentDiff.observed || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
