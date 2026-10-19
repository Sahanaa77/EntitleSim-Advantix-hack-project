import React from 'react'
import { useLocation } from 'react-router-dom'
import { History, Sparkles, Menu, User } from 'lucide-react'
import { useApp } from '../context/AppContext'

interface TopBarProps {
  onToggleMobileMenu?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleMobileMenu }) => {
  const { setIsHistoryOpen, runHistory, startDemo, isDemoActive } = useApp()
  const location = useLocation()

  // Determine page title based on current route
  const getPageTitle = () => {
    const path = location.pathname
    if (path.startsWith('/dashboard')) {
      return { title: 'Dashboard', subtitle: 'Overview of entitlement models and verification state' }
    }
    if (path.startsWith('/models')) {
      return { title: 'Models & Definitions', subtitle: 'Define tenant hierarchy, plans, and invariants' }
    }
    if (path.startsWith('/simulator')) {
      return { title: 'Event Simulator', subtitle: 'Simulate out-of-order and concurrent webhook deliveries' }
    }
    if (path.startsWith('/verification')) {
      return { title: 'Verification Workbench', subtitle: 'Systematic bounded exploration and counterexample minimization' }
    }
    if (path.startsWith('/reports')) {
      return { title: 'Reports & Export', subtitle: 'Regression suites and compliance audit trail' }
    }
    return { title: 'EntitleSim Workbench', subtitle: 'Model-based entitlement verification' }
  }

  const { title, subtitle } = getPageTitle()

  return (
    <header className="h-16 bg-surface border-b border-border sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 text-muted hover:text-text rounded-lg hover:bg-elevated lg:hidden cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic Page Title */}
        <div>
          <h1 className="text-base font-bold text-text leading-tight">{title}</h1>
          <p className="text-[11px] text-muted hidden md:block">{subtitle}</p>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* Guided Tour button (formerly Run Demo) */}
        <button
          onClick={startDemo}
          disabled={isDemoActive}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-primary to-indigo-600 hover:brightness-110 disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer"
          title="Automatically walks through the 6-step verification flow"
        >
          <Sparkles className="w-3.5 h-3.5 text-warn" />
          <span>Guided Tour</span>
        </button>

        {/* Run History button */}
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text hover:text-text bg-elevated hover:bg-elevated/80 rounded-lg border border-border shadow-xs transition-colors cursor-pointer"
          title="View exploration run history"
        >
          <History className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">Run History</span>
          {runHistory.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-surface text-[10px] font-mono font-bold text-muted border border-border">
              {runHistory.length}
            </span>
          )}
        </button>

        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        {/* User Profile Avatar */}
        <div
          className="flex items-center gap-2 pl-1 cursor-pointer select-none"
          title="Logged in as SRE / Verification Engineer"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-elevated border border-border flex items-center justify-center text-text font-semibold text-xs shadow-xs hover:border-primary/50 transition-colors">
              <User className="w-4 h-4 text-primary" />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-surface" />
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-semibold text-text leading-tight">Dev Engineer</div>
            <div className="text-[10px] text-muted leading-none">Admin</div>
          </div>
        </div>
      </div>
    </header>
  )
}
