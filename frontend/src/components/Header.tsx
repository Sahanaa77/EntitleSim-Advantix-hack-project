import React from 'react'
import { ShieldCheck, History, Info, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'

interface HeaderProps {
  onOpenBoundaries: () => void
}

export const Header: React.FC<HeaderProps> = ({ onOpenBoundaries }) => {
  const { setIsHistoryOpen, runHistory, startDemo, isDemoActive } = useApp()

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-lg tracking-tight">EntitleSim</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-md uppercase tracking-wider">
                Workbench
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Model-based verification & counterexample engine for SaaS entitlements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startDemo}
            disabled={isDemoActive}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer"
            title="Automatically walks through steps 1 to 6 using the sample SaaS scenario"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Run Demo</span>
          </button>

          <button
            onClick={onOpenBoundaries}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>Boundaries</span>
          </button>

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-xs transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Run History</span>
            {runHistory.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] font-mono font-bold text-slate-600">
                {runHistory.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
