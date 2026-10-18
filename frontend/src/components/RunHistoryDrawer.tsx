import { X, History, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'

export const RunHistoryDrawer: React.FC = () => {
  const { isHistoryOpen, setIsHistoryOpen, runHistory, currentRun, openRun, fetchHistory } = useApp()

  if (!isHistoryOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={() => setIsHistoryOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Run History</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold font-mono">
                {runHistory.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchHistory()}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-200 transition-colors"
                title="Refresh history"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Runs List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {runHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No past runs recorded. Run an exploration to see history.
              </div>
            ) : (
              runHistory.map((run) => {
                const isSelected = currentRun?.id === run.id
                const violationsCount = run.stats?.violations ?? run.counterexamples?.length ?? 0
                const statesCount = run.stats?.states_explored ?? 0
                const duration = run.stats?.duration_ms ? `${run.stats.duration_ms.toFixed(1)}ms` : '—'

                return (
                  <div
                    key={run.id}
                    onClick={() => openRun(run.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all shadow-xs ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-mono text-slate-500 text-[11px]">
                        {run.id.slice(0, 8)}...
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {new Date(run.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          run.status === 'done'
                            ? violationsCount === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                            : run.status === 'running'
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {run.status === 'done'
                          ? violationsCount === 0
                            ? '0 Violations'
                            : `${violationsCount} Violations`
                          : run.status}
                      </span>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          run.fixed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {run.fixed ? 'fixed=true' : 'fixed=false'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 text-[11px] text-slate-600 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      <div>States: <span className="font-bold text-slate-900">{statesCount}</span></div>
                      <div>Duration: <span className="font-bold text-slate-900">{duration}</span></div>
                    </div>

                    {run.counterexamples && run.counterexamples.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Array.from(new Set(run.counterexamples.map((c) => c.invariant_id))).map((inv) => (
                          <span
                            key={inv}
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                          >
                            {inv}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
