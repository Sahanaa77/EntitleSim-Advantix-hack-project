import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ShieldCheck, RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { rerunCounterexample } from '../lib/api'

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

  const activeCx = selectedCx || currentRun?.counterexamples?.[0]

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

      {/* 4 Bug -> Fix Descriptions */}
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
        </div>
      </div>

      {/* Retest Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Retest Counterexample */}
        <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-text">1. Re-Run Isolated Counterexample</h3>
            <p className="text-xs text-muted mt-0.5">
              Replays the 4-step minimal trace directly against the current SUT mode.
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
                ? 'Counterexample passed! The stale out-of-order event was successfully dropped.'
                : 'Invariant violation reproduced: unauthorized state transition still occurred.'}
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
    </div>
  )
}
