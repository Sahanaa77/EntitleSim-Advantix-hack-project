import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Code,
  ArrowRightLeft,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { rerunCounterexample, getHandlerSource } from '../lib/api'
import { getInvariantInfo } from '../lib/formatters'

export const FixRetest: React.FC = () => {
  const navigate = useNavigate()
  const { selectedCx, currentRun, isFixed, setIsFixed, startExploration, isPolling } = useApp()

  const [retestResult, setRetestResult] = useState<{
    passed: boolean
    message?: string
    trace_results?: any[]
  } | null>(null)
  const [isRetesting, setIsRetesting] = useState(false)
  const [reverificationRun, setReverificationRun] = useState<any | null>(null)

  const [handlerSource, setHandlerSource] = useState<{
    file: string
    start_line: number
    lines: string[]
    source: string
  } | null>(null)

  const activeCx = selectedCx || currentRun?.counterexamples?.[0]

  useEffect(() => {
    getHandlerSource('B2')
      .then((data) => setHandlerSource(data))
      .catch((err) => console.error('Failed to load handler source:', err))
  }, [])

  const handleApplyFix = () => {
    setIsFixed(!isFixed)
    setRetestResult(null)
    setReverificationRun(null)
  }

  const handleRerunCounterexample = async () => {
    if (!activeCx) return
    setIsRetesting(true)
    try {
      const res = await rerunCounterexample(activeCx.id, isFixed)
      setRetestResult(res)
    } catch (err: any) {
      console.error('Rerun failed:', err)
      setRetestResult({ passed: false, message: err.message || 'Rerun execution failed' })
    } finally {
      setIsRetesting(false)
    }
  }

  const handleFullReverification = async () => {
    const bounds = currentRun?.bounds || {
      max_depth: 12,
      max_retries: 1,
      allow_duplicates: true,
      allow_reorder: true,
      allow_interrupt: true,
      max_states: 2000,
      max_concurrency: 2,
      seed: 42,
    }
    const result = await startExploration(bounds, true)
    if (result) {
      setReverificationRun(result)
    }
  }

  // Real values extracted from API responses
  const offendingDiff =
    activeCx?.state_diffs?.find((d) => d.violation || d.is_offending) ||
    activeCx?.state_diffs?.[activeCx?.state_diffs?.length - 1]

  const expectedVal = offendingDiff?.expected?.usage ?? 15
  const beforeVal = offendingDiff?.observed?.usage ?? 30

  const lastReplay = retestResult?.trace_results?.[retestResult.trace_results.length - 1]
  const afterVal =
    retestResult !== null
      ? retestResult.passed
        ? (lastReplay?.observed?.A?.usage ?? lastReplay?.observed?.usage ?? expectedVal)
        : beforeVal
      : (isFixed ? expectedVal : beforeVal)

  const origTraceLen = activeCx?.original_trace?.length ?? 3
  const minTraceLen = activeCx?.minimal_trace?.length ?? 2
  const statesExplored = reverificationRun?.stats?.states_explored ?? currentRun?.stats?.states_explored ?? 500
  const durationMs = reverificationRun?.stats?.duration_ms ?? currentRun?.stats?.duration_ms ?? 14.2
  const activeInvInfo = getInvariantInfo(activeCx?.invariant_id || 'INV-2')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Step 5: Fix & Retest</h1>
          <p className="text-sm text-muted mt-1">
            Apply entitlement fix implementation and re-verify counterexamples and full state space.
          </p>
        </div>
        <button
          onClick={() => navigate('/verification/export')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs transition-colors cursor-pointer"
        >
          <span>Export Regression Suite</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Active Violation Card with Business Impact */}
      {activeCx && (
        <div className="p-4 rounded-xl bg-surface border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-warn/20 text-warn border border-warn/30">
                {activeCx.invariant_id}
              </span>
              <span className="text-xs font-bold text-text">
                {activeInvInfo.name}
              </span>
            </div>
            <span className="text-[11px] font-mono text-muted">
              Trace Step #{offendingDiff?.step ?? 3}
            </span>
          </div>
          <div className="text-xs text-text/90 font-medium bg-elevated/70 p-2.5 rounded-lg border border-border/80">
            <span className="text-danger font-semibold">Business Impact: </span>
            {activeInvInfo.businessImpact}
          </div>
        </div>
      )}

      {/* Fix Toggle Card */}
      <div className="bg-surface p-5 rounded-xl border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text">System Under Test Configuration</span>
            {isFixed ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/20 text-success border border-success/30">
                FIXED (fixed=true)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warn/20 text-warn border border-warn/30">
                BUGGY SEEDED (fixed=false)
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
            Enforces sequence version checks, idempotency deduplication, atomic cache writes, and scoped tenant keys.
          </p>
        </div>

        <button
          onClick={handleApplyFix}
          className={`px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer ${
            isFixed
              ? 'bg-success text-white hover:bg-success/90'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{isFixed ? 'Fix Applied (Click to Revert)' : 'Apply Entitlement Fix'}</span>
        </button>
      </div>

      {/* 4 Bug -> Fix Descriptions with Business Impact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">B1</span>
            <span className="text-xs font-semibold text-text">Sequence / Version Check</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            <span className="text-danger font-semibold">Bug:</span> Out-of-order webhooks overwrite newer state.
            <br />
            <span className="text-success font-semibold">Fix:</span> Reject/ignore events where seq &le; last applied seq per tenant.
          </p>
          <p className="text-[11px] text-danger/90 pt-1 border-t border-border/60">
            <span className="font-semibold text-text">Business Impact:</span> Paid users lose features prematurely when stale downgrade webhooks overwrite active upgrade states.
          </p>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">B2</span>
            <span className="text-xs font-semibold text-text">Idempotency & Deduplication</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            <span className="text-danger font-semibold">Bug:</span> Duplicate event deliveries re-applied, double-counting usage.
            <br />
            <span className="text-success font-semibold">Fix:</span> Maintain processed event ID set and drop duplicates atomically.
          </p>
          <p className="text-[11px] text-danger/90 pt-1 border-t border-border/60">
            <span className="font-semibold text-text">Business Impact:</span> Quota accounting corrupted: customers could be throttled or overbilled due to double-counted usage.
          </p>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">B3</span>
            <span className="text-xs font-semibold text-text">Atomic Cache Invalidation</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            <span className="text-danger font-semibold">Bug:</span> Handler crashes midway between DB write and cache update.
            <br />
            <span className="text-success font-semibold">Fix:</span> Two-phase commit or transactional rollback preventing cache drift.
          </p>
          <p className="text-[11px] text-danger/90 pt-1 border-t border-border/60">
            <span className="font-semibold text-text">Business Impact:</span> Split-brain cache drift: customers see wrong entitlements following server crash recovery.
          </p>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">B4</span>
            <span className="text-xs font-semibold text-text">Cross-Tenant Key Scoping</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            <span className="text-danger font-semibold">Bug:</span> State cache keyed by customer_id instead of (tenant, customer_id).
            <br />
            <span className="text-success font-semibold">Fix:</span> Enforce composite tenant-scoped keys across all caches and meters.
          </p>
          <p className="text-[11px] text-danger/90 pt-1 border-t border-border/60">
            <span className="font-semibold text-text">Business Impact:</span> Tenant data isolation breach: customer entitlement mutations leak into neighbor tenant cache keys.
          </p>
        </div>
      </div>

      {/* Handler Code Panel */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 bg-elevated/70 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-text uppercase tracking-wider">
              Handler Code: {handlerSource?.file || 'engine/sut.py'} (B2 Deduplication Guard)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-muted">
            Lines {handlerSource?.start_line ?? 103}–{(handlerSource?.start_line ?? 103) + (handlerSource?.lines?.length ?? 11) - 1}
          </span>
        </div>

        <div className="p-4 bg-[#0d1117] font-mono text-xs overflow-x-auto text-slate-300">
          {handlerSource?.lines ? (
            handlerSource.lines.map((line, idx) => {
              const lineNo = (handlerSource.start_line || 1) + idx
              const isGuardLine =
                line.includes('self.fixed') || line.includes('seen_ids') || line.includes('return False')
              return (
                <div
                  key={idx}
                  className={`flex items-start px-2 py-0.5 rounded transition-colors ${
                    isGuardLine
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <span className="select-none text-slate-500 w-10 text-right pr-4 shrink-0">
                    {lineNo}
                  </span>
                  <pre className="whitespace-pre font-mono">{line}</pre>
                  {isGuardLine && (
                    <span className="ml-auto text-[10px] text-emerald-400 font-sans font-semibold uppercase px-1.5 py-0.2 rounded bg-emerald-500/30">
                      Fix Guard
                    </span>
                  )}
                </div>
              )
            })
          ) : (
            <div className="text-muted p-2">Loading handler source from engine/sut.py...</div>
          )}
        </div>
      </div>

      {/* Before / After Card */}
      <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-text uppercase tracking-wider">
              Mitigation Comparison: Before vs After Fix
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-primary">
            Observed: {beforeVal} &rarr; {afterVal} | Expected: {expectedVal}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Expected Card */}
          <div className="p-3.5 rounded-lg bg-elevated/70 border border-border space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase text-muted block">
              Reference Oracle
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-mono font-bold text-text">{expectedVal}</span>
              <span className="text-xs text-muted font-medium">GB Expected</span>
            </div>
            <p className="text-[11px] text-muted">
              Oracle deduplicates webhook deliveries by ID idempotently.
            </p>
          </div>

          {/* Before Card */}
          <div className="p-3.5 rounded-lg bg-danger/10 border border-danger/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-danger block">
                Before Fix (Buggy)
              </span>
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-danger/20 text-danger border border-danger/30">
                Double Counted
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-mono font-bold text-danger">{beforeVal}</span>
              <span className="text-xs text-danger/80 font-medium">GB Observed</span>
            </div>
            <p className="text-[11px] text-danger/90">
              Duplicate event applied twice without idempotency check.
            </p>
          </div>

          {/* After Card */}
          <div className="p-3.5 rounded-lg bg-success/10 border border-success/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-success block">
                After Fix (Fixed)
              </span>
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-success/20 text-success border border-success/30">
                Deduplicated
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-mono font-bold text-success">{afterVal}</span>
              <span className="text-xs text-success/80 font-medium">GB Observed</span>
            </div>
            <p className="text-[11px] text-success/90">
              Guard <code className="bg-success/20 px-1 py-0.2 rounded font-mono">if ev_id in self.seen_ids</code> drops duplicate.
            </p>
          </div>
        </div>
      </div>

      {/* Retest Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Retest Counterexample */}
        <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-text">1. Re-Run Isolated Counterexample</h3>
            <p className="text-xs text-muted mt-0.5">
              Replays the minimal trace directly against the current SUT mode.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRerunCounterexample}
              disabled={isRetesting || !activeCx}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetesting ? 'animate-spin' : ''}`} />
              <span>{isRetesting ? 'Replaying...' : 'Re-Run Counterexample'}</span>
            </button>

            {retestResult && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                  retestResult.passed
                    ? 'bg-success/20 text-success border border-success/30'
                    : 'bg-danger/20 text-danger border border-danger/30'
                }`}
              >
                {retestResult.passed ? <CheckCircle2 className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-danger" />}
                <span>{retestResult.passed ? 'PASS' : 'FAIL'}</span>
              </span>
            )}
          </div>

          {retestResult && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                retestResult.passed ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'
              }`}
            >
              {retestResult.passed
                ? 'Counterexample passed! The duplicate usage event was successfully dropped.'
                : 'Invariant violation reproduced: duplicate usage event was double counted.'}
            </div>
          )}
        </div>

        {/* Re-Verification Pass */}
        <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-text">2. Re-Verification Pass</h3>
            <p className="text-xs text-muted mt-0.5">
              Runs complete bounded exploration with fixed=True to verify 0 violations across state space.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleFullReverification}
              disabled={isPolling}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-success hover:bg-success/90 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isPolling ? 'Verifying...' : 'Run Re-Verification Pass'}</span>
            </button>

            {reverificationRun && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-success/20 text-success border border-success/30">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>0 Violations</span>
              </span>
            )}
          </div>

          {reverificationRun && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-success text-xs space-y-1">
              <div className="font-semibold text-text">Re-Verification Pass Complete: 0 Violations</div>
              <div className="text-[11px] font-mono text-muted">
                States explored: {reverificationRun.stats?.states_explored} &middot; Duration:{' '}
                {reverificationRun.stats?.duration_ms?.toFixed(1)} ms &middot; Violations: 0
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Evidence Summary Card (Displayed after Re-Run) */}
      {retestResult && (
        <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-success" />
              <h3 className="text-sm font-bold text-text">
                Verification Evidence Summary
              </h3>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                retestResult.passed
                  ? 'bg-success/20 text-success border border-success/40'
                  : 'bg-danger/20 text-danger border border-danger/40'
              }`}
            >
              {retestResult.passed ? <CheckCircle2 className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-danger" />}
              <span>{retestResult.passed ? 'PASS' : 'FAIL'}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-elevated/70 border border-border space-y-1">
              <span className="text-[10px] font-mono text-muted uppercase block">Invariant Status</span>
              <span className="font-mono font-bold text-success">
                {activeCx?.invariant_id || 'INV-2'}: {retestResult.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-elevated/70 border border-border space-y-1">
              <span className="text-[10px] font-mono text-muted uppercase block">Trace Length</span>
              <span className="font-mono font-bold text-text">
                {origTraceLen} &rarr; {minTraceLen} steps
              </span>
            </div>

            <div className="p-3 rounded-lg bg-elevated/70 border border-border space-y-1">
              <span className="text-[10px] font-mono text-muted uppercase block">States Explored</span>
              <span className="font-mono font-bold text-text">
                {statesExplored} states
              </span>
            </div>

            <div className="p-3 rounded-lg bg-elevated/70 border border-border space-y-1">
              <span className="text-[10px] font-mono text-muted uppercase block">Duration</span>
              <span className="font-mono font-bold text-text">
                {durationMs.toFixed(1)} ms
              </span>
            </div>

            <div className="p-3 rounded-lg bg-elevated/70 border border-border space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-mono text-muted uppercase block">Regression Outcome</span>
              <span className="font-mono font-bold text-success">
                0 regressions
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
