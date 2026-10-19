import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileCode,
  ShieldCheck,
  Play,
  ArrowRight,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Plus,
  Compass,
  Minimize2,
  Inbox,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useApp } from '../context/AppContext'
import { getRuns, getModels } from '../lib/api'
import { ModelRecord, Run } from '../types'

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { openRun, startDemo, isDemoActive, fetchHistory, fetchModels } = useApp()

  const [runs, setRuns] = useState<Run[]>([])
  const [modelsList, setModelsList] = useState<ModelRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  // Load real API data from GET /runs and GET /models
  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const [runsData, modelsData] = await Promise.all([getRuns(), getModels()])
      setRuns(runsData)
      setModelsList(modelsData)
      setLastRefreshed(new Date())
      // Keep global AppContext sync
      fetchHistory()
      fetchModels()
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err)
    } finally {
      if (isInitial) setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [fetchHistory, fetchModels])

  // Initial load + Auto-refresh every 5 seconds + External refresh events
  useEffect(() => {
    loadData(true)
    const interval = setInterval(() => {
      loadData(false)
    }, 5000)

    const handleRefresh = () => {
      loadData(false)
    }
    window.addEventListener('refresh-dashboard', handleRefresh)

    return () => {
      clearInterval(interval)
      window.removeEventListener('refresh-dashboard', handleRefresh)
    }
  }, [loadData])

  // Computed KPIs
  const totalModels = modelsList.length
  const totalRuns = runs.length

  const totalViolationsFound = useMemo(() => {
    return runs.reduce(
      (acc, r) => acc + (r.stats?.violations ?? r.counterexamples?.length ?? 0),
      0
    )
  }, [runs])

  // Trace reduction % after minimization
  const { avgReductionPct, minimizedTracesCount } = useMemo(() => {
    let totalReduction = 0
    let count = 0

    runs.forEach((r) => {
      r.counterexamples?.forEach((cx) => {
        if (
          cx.minimal_trace &&
          Array.isArray(cx.minimal_trace) &&
          cx.original_trace &&
          Array.isArray(cx.original_trace) &&
          cx.original_trace.length > 0
        ) {
          const origLen = cx.original_trace.length
          const minLen = cx.minimal_trace.length
          const reduction = Math.max(0, ((origLen - minLen) / origLen) * 100)
          totalReduction += reduction
          count += 1
        }
      })
    })

    return {
      avgReductionPct: count > 0 ? totalReduction / count : null,
      minimizedTracesCount: count,
    }
  }, [runs])

  // Latest pass/fail
  const latestRun = runs[0]
  const latestRunStatus = useMemo(() => {
    if (!latestRun) {
      return {
        status: 'None',
        badge: 'bg-muted/15 text-muted border-border',
        description: 'No runs recorded yet',
        icon: Clock,
      }
    }

    const viols = latestRun.stats?.violations ?? latestRun.counterexamples?.length ?? 0

    if (latestRun.status === 'running') {
      return {
        status: 'Running',
        badge: 'bg-primary/15 text-primary border-primary/30',
        description: 'Exploration in progress',
        icon: RefreshCw,
      }
    }

    if (latestRun.status === 'failed') {
      return {
        status: 'Failed',
        badge: 'bg-danger/15 text-danger border-danger/30',
        description: 'Execution error occurred',
        icon: XCircle,
      }
    }

    if (viols === 0) {
      return {
        status: 'Passed',
        badge: 'bg-success/15 text-success border-success/30',
        description: '0 violations detected',
        icon: CheckCircle2,
      }
    }

    return {
      status: 'Failed',
      badge: 'bg-danger/15 text-danger border-danger/30',
      description: `${viols} violation${viols > 1 ? 's' : ''} found`,
      icon: XCircle,
    }
  }, [latestRun])

  // Chronological Line Chart Data: Violations per Run
  const violationsPerRunData = useMemo(() => {
    if (runs.length === 0) return []
    // Take up to 20 most recent runs, reversed for chronological display (oldest on left)
    return [...runs]
      .slice(0, 20)
      .reverse()
      .map((r, i) => {
        const viols = r.stats?.violations ?? r.counterexamples?.length ?? 0
        const shortId = r.id.slice(0, 8)
        return {
          name: `Run ${i + 1}`,
          runId: shortId,
          violations: viols,
          states: r.stats?.states_explored ?? 0,
          target: r.fixed ? 'Fixed' : 'Buggy',
        }
      })
  }, [runs])

  // Bar Chart Data: Violations aggregated by Invariant
  const invariantChartData = useMemo(() => {
    const counts: Record<string, number> = {
      'INV-1': 0,
      'INV-2': 0,
      'INV-3': 0,
      'INV-4': 0,
      'INV-5': 0,
    }

    runs.forEach((r) => {
      if (r.stats?.by_invariant && Object.keys(r.stats.by_invariant).length > 0) {
        Object.entries(r.stats.by_invariant).forEach(([inv, count]) => {
          counts[inv] = (counts[inv] || 0) + count
        })
      } else if (r.counterexamples) {
        r.counterexamples.forEach((cx) => {
          if (cx.invariant_id) {
            counts[cx.invariant_id] = (counts[cx.invariant_id] || 0) + 1
          }
        })
      }
    })

    const invCatalog: Record<string, string> = {
      'INV-1': 'Feature Match',
      'INV-2': 'Quota Limit',
      'INV-3': 'Tenant Isolation',
      'INV-4': 'No Access Cancel',
      'INV-5': 'Cache Consistency',
    }

    return Object.entries(counts).map(([inv, count]) => ({
      id: inv,
      name: invCatalog[inv] || inv,
      violations: count,
    }))
  }, [runs])

  // Handle open run from recent-runs table
  const handleOpenRun = async (runId: string) => {
    await openRun(runId)
    navigate('/verification/explore')
  }

  // Model lookup helper
  const getModelName = (modelId: string) => {
    const found = modelsList.find((m) => m.id === modelId)
    return found?.name || 'Standard Model'
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text">SaaS Verification Dashboard</h1>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-primary/15 text-primary border border-primary/30 rounded-full">
              Live Metrics
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Real-time bounded verification telemetries, invariant breakdown, and counterexample minimization tracking.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/models')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>New Model</span>
          </button>
          <button
            onClick={() => navigate('/verification/explore')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs cursor-pointer transition-colors"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Run Verification</span>
          </button>
          <button
            onClick={() => navigate('/simulator')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 shadow-xs cursor-pointer transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-success" />
            <span>Open Simulator</span>
          </button>
          <button
            onClick={() => loadData(false)}
            disabled={isRefreshing}
            className="p-1.5 text-muted hover:text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 transition-colors cursor-pointer"
            title={`Auto-refreshes every 5s. Last updated: ${lastRefreshed.toLocaleTimeString()}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Auto-refresh Status Banner */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-surface/80 rounded-lg border border-border text-xs text-muted font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-ping" />
          <span>Real API live feed (GET /runs &middot; GET /models)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>Auto-refresh: 5s interval</span>
          <span>&middot;</span>
          <span>Updated: {lastRefreshed.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Skeleton Loaders during initial fetch */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-surface p-5 rounded-xl border border-border shadow-xs animate-pulse space-y-3"
              >
                <div className="w-8 h-8 rounded-lg bg-elevated" />
                <div className="h-3 w-16 bg-elevated rounded" />
                <div className="h-6 w-24 bg-elevated rounded" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface p-5 rounded-xl border border-border shadow-xs animate-pulse h-64" />
            <div className="bg-surface p-5 rounded-xl border border-border shadow-xs animate-pulse h-64" />
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-xs animate-pulse p-6 space-y-4">
            <div className="h-4 w-32 bg-elevated rounded" />
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-10 bg-elevated rounded" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards (5 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Models */}
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Models</span>
                <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-text">{totalModels}</div>
                <div className="text-[11px] text-muted mt-0.5">Defined specifications</div>
              </div>
            </div>

            {/* 2. Total Runs */}
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Total Runs</span>
                <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-text">{totalRuns}</div>
                <div className="text-[11px] text-muted mt-0.5">Recorded engine runs</div>
              </div>
            </div>

            {/* 3. Violations Found */}
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Violations</span>
                <div className="w-8 h-8 rounded-lg bg-danger/15 text-danger flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-danger">{totalViolationsFound}</div>
                <div className="text-[11px] text-muted mt-0.5">Invariant divergences</div>
              </div>
            </div>

            {/* 4. Avg Trace Reduction % */}
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Avg Reduction</span>
                <div className="w-8 h-8 rounded-lg bg-success/15 text-success flex items-center justify-center">
                  <Minimize2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-success">
                  {avgReductionPct !== null ? `${avgReductionPct.toFixed(1)}%` : '0.0%'}
                </div>
                <div className="text-[11px] text-muted mt-0.5 font-mono">
                  {minimizedTracesCount > 0 ? `${minimizedTracesCount} trace minimized` : 'No traces minimized'}
                </div>
              </div>
            </div>

            {/* 5. Latest Pass/Fail */}
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Latest Run</span>
                <div className="w-8 h-8 rounded-lg bg-elevated text-text flex items-center justify-center">
                  <latestRunStatus.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${latestRunStatus.badge}`}>
                    {latestRunStatus.status}
                  </span>
                </div>
                <div className="text-[11px] text-muted mt-1 truncate">{latestRunStatus.description}</div>
              </div>
            </div>
          </div>

          {/* Empty State when no runs exist */}
          {runs.length === 0 ? (
            <div className="bg-surface p-10 rounded-2xl border border-border text-center shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Inbox className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-text">No Verification Runs Recorded Yet</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Start your first model verification run or launch the guided walkthrough to observe bounded exploration,
                  counterexample extraction, and trace minimization in action.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => navigate('/models')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Choose Model</span>
                </button>
                <button
                  onClick={startDemo}
                  disabled={isDemoActive}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-text bg-elevated hover:bg-elevated/80 border border-border rounded-lg shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-warn" />
                  <span>Guided Tour</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Visualizations Section: Line Chart & Bar Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Line Chart: Violations per Run */}
                <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-danger" />
                      <h3 className="text-xs font-bold text-text uppercase tracking-wider">
                        Violations Found per Run
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono text-muted">Chronological Trend</span>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={violationsPerRunData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F2D4A" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#8FA3C0' }}
                          stroke="#1F2D4A"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: '#8FA3C0' }}
                          stroke="#1F2D4A"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#111A2E',
                            borderColor: '#1F2D4A',
                            borderRadius: '8px',
                            color: '#E6EDF7',
                            fontSize: '12px',
                          }}
                          itemStyle={{ color: '#E6EDF7' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="violations"
                          stroke="#EF4444"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#EF4444' }}
                          activeDot={{ r: 6, fill: '#EF4444' }}
                          name="Violations"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart: Violations by Invariant */}
                <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-bold text-text uppercase tracking-wider">
                        Violations by Invariant Rule
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono text-muted">Cumulative Breakdown</span>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={invariantChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F2D4A" />
                        <XAxis
                          dataKey="id"
                          tick={{ fontSize: 11, fill: '#8FA3C0' }}
                          stroke="#1F2D4A"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: '#8FA3C0' }}
                          stroke="#1F2D4A"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#111A2E',
                            borderColor: '#1F2D4A',
                            borderRadius: '8px',
                            color: '#E6EDF7',
                            fontSize: '12px',
                          }}
                          itemStyle={{ color: '#E6EDF7' }}
                        />
                        <Bar
                          dataKey="violations"
                          fill="#3B82F6"
                          radius={[4, 4, 0, 0]}
                          name="Violations Found"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Recent Runs Table */}
              <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between bg-elevated">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    <h2 className="text-xs font-bold text-text uppercase tracking-wider">
                      Recent Verification Runs ({runs.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-muted">Click row to inspect run</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-elevated/50 text-[11px] font-mono text-muted uppercase">
                        <th className="py-2.5 px-4">Run ID</th>
                        <th className="py-2.5 px-4">Model</th>
                        <th className="py-2.5 px-4">Target Mode</th>
                        <th className="py-2.5 px-4 text-center">Violations</th>
                        <th className="py-2.5 px-4 text-center">States Explored</th>
                        <th className="py-2.5 px-4 text-center">Duration</th>
                        <th className="py-2.5 px-4">Created</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {runs.slice(0, 8).map((run) => {
                        const viols = run.stats?.violations ?? run.counterexamples?.length ?? 0
                        const states = run.stats?.states_explored ?? 0
                        const duration = run.stats?.duration_ms ? `${run.stats.duration_ms.toFixed(1)}ms` : '—'
                        const createdStr = run.created_at
                          ? new Date(run.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : '—'

                        return (
                          <tr
                            key={run.id}
                            onClick={() => handleOpenRun(run.id)}
                            className="hover:bg-elevated/70 transition-colors cursor-pointer group"
                          >
                            {/* Run ID */}
                            <td className="py-3 px-4 font-mono font-bold text-text">
                              <span className="text-primary group-hover:underline">
                                {run.id.slice(0, 8)}
                              </span>
                            </td>

                            {/* Model Name */}
                            <td className="py-3 px-4 font-medium text-text">
                              {getModelName(run.model_id)}
                            </td>

                            {/* Target Mode */}
                            <td className="py-3 px-4 font-mono">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  run.fixed
                                    ? 'bg-success/15 border-success/30 text-success'
                                    : 'bg-warn/15 border-warn/30 text-warn'
                                }`}
                              >
                                {run.fixed ? 'fixed=true' : 'fixed=false'}
                              </span>
                            </td>

                            {/* Violations */}
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                  viols === 0
                                    ? 'bg-success/15 border-success/30 text-success'
                                    : 'bg-danger/15 border-danger/30 text-danger'
                                }`}
                              >
                                {viols === 0 ? '0' : viols}
                              </span>
                            </td>

                            {/* States Explored */}
                            <td className="py-3 px-4 text-center font-mono text-muted">
                              {states.toLocaleString()}
                            </td>

                            {/* Duration */}
                            <td className="py-3 px-4 text-center font-mono text-muted">
                              {duration}
                            </td>

                            {/* Created */}
                            <td className="py-3 px-4 font-mono text-muted text-[11px]">
                              {createdStr}
                            </td>

                            {/* Action */}
                            <td className="py-3 px-4 text-right">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                                <span>Inspect</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
