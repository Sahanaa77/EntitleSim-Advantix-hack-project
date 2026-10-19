import React, { useState, useEffect, useMemo } from 'react'
import {
  Download,
  FileCode,
  Search,
  AlertTriangle,
  Sparkles,
  Copy,
  Check,
  X,
  FileText,
  ChevronDown,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { getRuns, getModels, exportCounterexample, exportSuite } from '../lib/api'
import { Run, ModelRecord } from '../types'
import { getInvariantInfo } from '../lib/formatters'

export const Reports: React.FC = () => {
  const { runHistory, models, toast } = useApp()

  const [runs, setRuns] = useState<Run[]>([])
  const [modelsList, setModelsList] = useState<ModelRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'passed' | 'failed'>('all')
  const [targetFilter, setTargetFilter] = useState<'all' | 'buggy' | 'fixed'>('all')

  // Technical details toggle per run
  const [expandedTechRunId, setExpandedTechRunId] = useState<string | null>(null)

  // Export Modal State
  const [exportModalFile, setExportModalFile] = useState<{
    title: string
    filename: string
    content: string
  } | null>(null)
  const [copiedModal, setCopiedModal] = useState<boolean>(false)

  // Suite Modal State
  const [suiteModalFiles, setSuiteModalFiles] = useState<
    Array<{ filename: string; content: string }> | null
  >(null)
  const [activeSuiteTab, setActiveSuiteTab] = useState<number>(0)
  const [suiteCopied, setSuiteCopied] = useState<boolean>(false)

  // Fetch runs and models
  useEffect(() => {
    Promise.all([getRuns(), getModels()])
      .then(([runsData, modelsData]) => {
        setRuns(runsData)
        setModelsList(modelsData)
      })
      .catch((err) => {
        console.error('Failed to load reports data:', err)
        toast('Load Error', 'Failed to retrieve verification runs', 'error')
      })
      .finally(() => setIsLoading(false))
  }, [runHistory.length, models.length, toast])

  // Model name lookup helper
  const getModelName = (modelId: string) => {
    const found = modelsList.find((m) => m.id === modelId)
    return found?.name || 'SaaS Entitlement Model'
  }

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const modelName = getModelName(run.model_id).toLowerCase()
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch = !query || modelName.includes(query) || run.id.toLowerCase().includes(query)

      const viols = run.stats?.violations ?? run.counterexamples?.length ?? 0
      const passed = viols === 0

      const matchesOutcome =
        outcomeFilter === 'all' ||
        (outcomeFilter === 'passed' && passed) ||
        (outcomeFilter === 'failed' && !passed)

      const matchesTarget =
        targetFilter === 'all' ||
        (targetFilter === 'fixed' && run.fixed) ||
        (targetFilter === 'buggy' && !run.fixed)

      return matchesSearch && matchesOutcome && matchesTarget
    })
  }, [runs, modelsList, searchQuery, outcomeFilter, targetFilter])

  // Summary counts
  const cleanRuns = useMemo(() => {
    return runs.filter((r) => (r.stats?.violations ?? r.counterexamples?.length ?? 0) === 0)
  }, [runs])

  const runsWithViolations = useMemo(() => {
    return runs.filter((r) => (r.stats?.violations ?? r.counterexamples?.length ?? 0) > 0)
  }, [runs])

  // Single counterexample export handler
  const handleExportSingle = async (cxId: string, format: 'pytest' | 'json') => {
    try {
      const res = await exportCounterexample(cxId, format)
      setExportModalFile({
        title: format === 'pytest' ? 'Standalone Pytest Regression' : 'JSON Counterexample Trace',
        filename: res.filename,
        content: res.content,
      })
      toast('Export Ready', `Generated ${format.toUpperCase()} export file`, 'success')
    } catch (err: any) {
      console.error('Export failed:', err)
      toast('Export Failed', err.message || 'Failed to export counterexample', 'error')
    }
  }

  // Full CI suite export handler
  const handleExportSuite = async (runId: string) => {
    try {
      const res = await exportSuite(runId)
      setSuiteModalFiles(res.files)
      setActiveSuiteTab(0)
      toast('CI Suite Ready', 'Generated multi-file CI regression suite & GitHub Action', 'success')
    } catch (err: any) {
      console.error('Suite export failed:', err)
      toast('Export Failed', err.message || 'Failed to export CI suite', 'error')
    }
  }

  // Copy modal content
  const handleCopyModal = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedModal(true)
    setTimeout(() => setCopiedModal(false), 2000)
    toast('Copied', 'Export content copied to clipboard', 'info')
  }

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast('Download Started', `Saved file ${filename}`, 'info')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text">Reports & Regression Suites</h1>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-primary/15 text-primary border border-primary/30 rounded-full">
              Audit & Compliance
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Audit historical verification cycles, inspect plain-English invariant breaks, and export standalone pytest regressions and CI workflows.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Total Recorded Runs</div>
          <div className="text-2xl font-bold text-text font-mono mt-1">{runs.length}</div>
          <div className="text-[11px] text-muted mt-0.5">Historical verification cycles</div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Clean Passes</div>
          <div className="text-2xl font-bold text-success font-mono mt-1">{cleanRuns.length}</div>
          <div className="text-[11px] text-muted mt-0.5">0 invariant violations</div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Violations Intercepted</div>
          <div className="text-2xl font-bold text-danger font-mono mt-1">{runsWithViolations.length}</div>
          <div className="text-[11px] text-muted mt-0.5">Counterexamples generated</div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Pass Ratio</div>
          <div className="text-2xl font-bold text-primary font-mono mt-1">
            {runs.length > 0 ? `${Math.round((cleanRuns.length / runs.length) * 100)}%` : '—'}
          </div>
          <div className="text-[11px] text-muted mt-0.5">Clean execution rate</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by model name or keyword..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-elevated border border-border rounded-lg text-text placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Outcome Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted text-[11px]">Outcome:</span>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as any)}
              className="px-2.5 py-1 text-xs font-semibold bg-elevated border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">All Outcomes</option>
              <option value="passed">Passed (0 Violations)</option>
              <option value="failed">Violations Found</option>
            </select>
          </div>

          {/* Target Mode Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted text-[11px]">Mode:</span>
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value as any)}
              className="px-2.5 py-1 text-xs font-semibold bg-elevated border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">All Modes</option>
              <option value="buggy">Buggy (fixed=false)</option>
              <option value="fixed">Fixed (fixed=true)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Runs List Table with Plain-English Invariants and Export Buttons */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-elevated">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold text-text uppercase tracking-wider">
              Verification Runs ({filteredRuns.length})
            </h2>
          </div>
          <span className="text-[11px] text-muted">
            Export standalone pytest regression tests or complete CI suites
          </span>
        </div>

        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 bg-elevated/40 rounded-xl border border-border/40 animate-pulse space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-48 bg-elevated rounded" />
                    <div className="flex gap-2">
                      <div className="h-7 w-20 bg-elevated rounded-lg" />
                      <div className="h-7 w-20 bg-elevated rounded-lg" />
                    </div>
                  </div>
                  <div className="h-3 w-64 bg-elevated rounded" />
                  <div className="h-12 w-full bg-elevated/60 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted space-y-2">
              <Inbox className="w-8 h-8 mx-auto text-muted/40 mb-1" />
              <div className="font-semibold text-text text-sm">No verification runs found</div>
              <p className="text-[11px] text-muted max-w-sm mx-auto">
                No runs match your active filter criteria. Try clearing the search query or changing outcome and mode filters above.
              </p>
            </div>
          ) : (
            filteredRuns.map((run, idx) => {
              const viols = run.stats?.violations ?? run.counterexamples?.length ?? 0
              const passed = viols === 0
              const modelName = getModelName(run.model_id)
              const firstCx = run.counterexamples?.[0]
              const dateStr = run.created_at
                ? new Date(run.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent'

              const isTechExpanded = expandedTechRunId === run.id

              return (
                <div key={run.id || idx} className="p-4 hover:bg-elevated/40 transition-colors space-y-3">
                  {/* Row Top: Model, Outcome, Mode, Date, Export Buttons */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-sm text-text">{modelName}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                            passed
                              ? 'bg-success/15 border-success/30 text-success'
                              : 'bg-danger/15 border-danger/30 text-danger'
                          }`}
                        >
                          {passed ? 'Passed (0 Violations)' : `Failed (${viols} Violations)`}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                            run.fixed
                              ? 'bg-success/15 border-success/30 text-success'
                              : 'bg-warn/15 border-warn/30 text-warn'
                          }`}
                        >
                          {run.fixed ? 'fixed=true' : 'fixed=false'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted font-mono">
                        <span>States: {run.stats?.states_explored ?? 0}</span>
                        <span>&middot;</span>
                        <span>Duration: {run.stats?.duration_ms ? `${run.stats.duration_ms.toFixed(1)}ms` : '—'}</span>
                        <span>&middot;</span>
                        <span>{dateStr}</span>
                      </div>
                    </div>

                    {/* Direct Export Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Pytest Export Button */}
                      {firstCx ? (
                        <button
                          onClick={() => handleExportSingle(firstCx.id, 'pytest')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 shadow-xs cursor-pointer transition-colors"
                          title="Export self-contained pytest test file for this counterexample"
                        >
                          <FileCode className="w-3.5 h-3.5 text-primary" />
                          <span>Export Pytest</span>
                        </button>
                      ) : null}

                      {/* JSON Export Button */}
                      {firstCx ? (
                        <button
                          onClick={() => handleExportSingle(firstCx.id, 'json')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 shadow-xs cursor-pointer transition-colors"
                          title="Export JSON counterexample trace file"
                        >
                          <Download className="w-3.5 h-3.5 text-muted" />
                          <span>Export JSON</span>
                        </button>
                      ) : null}

                      {/* CI Suite Export Button */}
                      <button
                        onClick={() => handleExportSuite(run.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs cursor-pointer transition-colors"
                        title="Export complete GitHub Actions CI workflow and regression test suite"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Export CI Suite</span>
                      </button>
                    </div>
                  </div>

                  {/* Plain-English Invariant Violations List */}
                  {run.counterexamples && run.counterexamples.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-border/60">
                      <span className="text-[10px] font-mono font-bold uppercase text-muted tracking-wider block">
                        Detected Invariant Failures:
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {run.counterexamples.map((cx, cIdx) => {
                          const inv = getInvariantInfo(cx.invariant_id)
                          return (
                            <div
                              key={cIdx}
                              className="p-2.5 rounded-lg bg-danger/10 border border-danger/30 text-xs flex items-start gap-2.5"
                            >
                              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-text truncate">{inv.name}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${inv.badgeClass}`}
                                  >
                                    {inv.severity}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted leading-tight">{inv.explanation}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Collapsible Technical Details per run */}
                  <div className="pt-1">
                    <button
                      onClick={() =>
                        setExpandedTechRunId(isTechExpanded ? null : run.id)
                      }
                      className="text-[11px] text-muted hover:text-text inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isTechExpanded ? 'Hide Technical Details' : 'Show Technical Details'}</span>
                      {isTechExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>

                    {isTechExpanded && (
                      <div className="mt-2 p-3 rounded-lg bg-bg border border-border space-y-2 text-xs font-mono animate-in fade-in">
                        <div className="text-muted text-[11px]">
                          Internal Run ID: {run.id} &middot; Model ID: {run.model_id}
                        </div>
                        <pre className="p-2 rounded bg-surface border border-border text-[11px] text-text max-h-48 overflow-y-auto leading-relaxed">
                          {JSON.stringify(run, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Single Export Preview Modal */}
      {exportModalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-text">{exportModalFile.title}</h3>
                <span className="text-xs font-mono text-muted">{exportModalFile.filename}</span>
              </div>
              <button
                onClick={() => setExportModalFile(null)}
                className="p-1 text-muted hover:text-text rounded-md hover:bg-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-bg border border-border font-mono text-xs text-text max-h-96 overflow-y-auto leading-relaxed">
              {exportModalFile.content}
            </pre>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[11px] text-muted font-mono">Ready to commit to repository</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyModal(exportModalFile.content)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 cursor-pointer"
                >
                  {copiedModal ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedModal ? 'Copied!' : 'Copy Content'}</span>
                </button>
                <button
                  onClick={() => handleDownloadFile(exportModalFile.filename, exportModalFile.content)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CI Suite Modal */}
      {suiteModalFiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-3xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-base font-bold text-text">CI Test Suite & GitHub Actions Workflow</h3>
              </div>
              <button
                onClick={() => setSuiteModalFiles(null)}
                className="p-1 text-muted hover:text-text rounded-md hover:bg-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Selector */}
            <div className="flex items-center gap-2 border-b border-border pb-2 shrink-0">
              {suiteModalFiles.map((file, idx) => (
                <button
                  key={file.filename}
                  onClick={() => setActiveSuiteTab(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    activeSuiteTab === idx
                      ? 'bg-primary text-white'
                      : 'bg-elevated text-muted hover:text-text'
                  }`}
                >
                  {file.filename}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              <pre className="p-4 rounded-xl bg-bg border border-border font-mono text-xs text-text leading-relaxed overflow-x-auto">
                {suiteModalFiles[activeSuiteTab]?.content}
              </pre>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
              <span className="text-[11px] text-muted font-mono">
                {suiteModalFiles.length} files synthesized for CI pipeline
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(suiteModalFiles[activeSuiteTab]?.content || '')
                    setSuiteCopied(true)
                    setTimeout(() => setSuiteCopied(false), 2000)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 cursor-pointer"
                >
                  {suiteCopied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{suiteCopied ? 'Copied Tab' : 'Copy Tab Content'}</span>
                </button>
                <button
                  onClick={() => {
                    const f = suiteModalFiles[activeSuiteTab]
                    if (f) handleDownloadFile(f.filename, f.content)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Active File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
