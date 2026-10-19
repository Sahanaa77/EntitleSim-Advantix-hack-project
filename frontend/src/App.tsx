import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { BoundariesDialog } from './components/BoundariesDialog'
import { RunHistoryDrawer } from './components/RunHistoryDrawer'
import { DemoController } from './components/DemoController'
import { ToastContainer } from './components/ToastContainer'
import { Dashboard } from './pages/Dashboard'
import { ModelDefine } from './pages/ModelDefine'
import { Simulator } from './pages/Simulator'
import { Verification } from './pages/Verification'
import { Reports } from './pages/Reports'
import { BoundedExploration } from './pages/BoundedExploration'
import { ViolationMinimization } from './pages/ViolationMinimization'
import { InspectStateDiff } from './pages/InspectStateDiff'
import { FixRetest } from './pages/FixRetest'
import { RegressionExport } from './pages/RegressionExport'

export const AppContent: React.FC = () => {
  const [isBoundariesOpen, setIsBoundariesOpen] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const location = useLocation()
  const { toasts, dismissToast } = useApp()

  useEffect(() => {
    const path = location.pathname
    let title = 'EntitleSim — Model-Based Verification Workbench'
    if (path.startsWith('/dashboard')) title = 'Dashboard — EntitleSim'
    else if (path.startsWith('/models')) title = 'Model Builder — EntitleSim'
    else if (path.startsWith('/simulator')) title = 'Event Simulator — EntitleSim'
    else if (path.startsWith('/verification')) {
      if (path.includes('explore')) title = 'Bounded Exploration — EntitleSim'
      else if (path.includes('minimize')) title = 'Violation Minimization — EntitleSim'
      else if (path.includes('diff')) title = 'Inspect State Diff — EntitleSim'
      else if (path.includes('fix')) title = 'Fix & Retest — EntitleSim'
      else if (path.includes('export')) title = 'Regression Export — EntitleSim'
      else title = 'Verification — EntitleSim'
    } else if (path.startsWith('/reports')) title = 'Reports & Runs — EntitleSim'
    document.title = title
  }, [location.pathname])

  return (
    <div className="min-h-screen flex bg-bg text-text">
      {/* Left Sidebar */}
      <Sidebar
        onOpenBoundaries={() => setIsBoundariesOpen(true)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Bar */}
        <TopBar onToggleMobileMenu={() => setIsMobileNavOpen((prev) => !prev)} />

        {/* Dynamic Route View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/models" element={<ModelDefine />} />
            <Route path="/simulator" element={<Simulator />} />

            {/* Verification 6-step flow nested under /verification/* */}
            <Route path="/verification" element={<Verification />}>
              <Route index element={<Navigate to="/verification/model" replace />} />
              <Route path="model" element={<ModelDefine />} />
              <Route path="explore" element={<BoundedExploration />} />
              <Route path="minimize" element={<ViolationMinimization />} />
              <Route path="diff" element={<InspectStateDiff />} />
              <Route path="fix" element={<FixRetest />} />
              <Route path="export" element={<RegressionExport />} />
            </Route>

            <Route path="/reports" element={<Reports />} />

            {/* Backward-compatible route aliases */}
            <Route path="/explore" element={<Navigate to="/verification/explore" replace />} />
            <Route path="/minimize" element={<Navigate to="/verification/minimize" replace />} />
            <Route path="/diff" element={<Navigate to="/verification/diff" replace />} />
            <Route path="/fix" element={<Navigate to="/verification/fix" replace />} />
            <Route path="/export" element={<Navigate to="/verification/export" replace />} />

            {/* Default root navigation */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>

        {/* Footer without "Fixed Stack..." */}
        <footer className="border-t border-border bg-surface py-3 text-xs text-muted">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span>EntitleSim &copy; 2026 &middot; Model-Based Verification Workbench</span>
            </div>
            <div>
              <button
                onClick={() => setIsBoundariesOpen(true)}
                className="hover:text-primary transition-colors underline-offset-2 hover:underline cursor-pointer"
              >
                Verification Boundaries & Constraints
              </button>
            </div>
          </div>
        </footer>
      </div>

      <BoundariesDialog
        isOpen={isBoundariesOpen}
        onClose={() => setIsBoundariesOpen(false)}
      />

      <DemoController onOpenBoundaries={() => setIsBoundariesOpen(true)} />
      <RunHistoryDrawer />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </BrowserRouter>
  )
}

export default App
