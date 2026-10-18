import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { Header } from './components/Header'
import { Stepper } from './components/Stepper'
import { BoundariesDialog } from './components/BoundariesDialog'
import { RunHistoryDrawer } from './components/RunHistoryDrawer'
import { DemoController } from './components/DemoController'
import { ModelDefine } from './pages/ModelDefine'
import { BoundedExploration } from './pages/BoundedExploration'
import { ViolationMinimization } from './pages/ViolationMinimization'
import { InspectStateDiff } from './pages/InspectStateDiff'
import { FixRetest } from './pages/FixRetest'
import { RegressionExport } from './pages/RegressionExport'

export const AppContent: React.FC = () => {
  const [isBoundariesOpen, setIsBoundariesOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header onOpenBoundaries={() => setIsBoundariesOpen(true)} />
      <Stepper />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<ModelDefine />} />
          <Route path="/explore" element={<BoundedExploration />} />
          <Route path="/minimize" element={<ViolationMinimization />} />
          <Route path="/diff" element={<InspectStateDiff />} />
          <Route path="/fix" element={<FixRetest />} />
          <Route path="/export" element={<RegressionExport />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>EntitleSim &copy; 2026 &middot; Model-Based Verification Workbench</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsBoundariesOpen(true)}
              className="hover:text-blue-600 transition-colors underline-offset-2 hover:underline cursor-pointer"
            >
              Verification Boundaries & Constraints
            </button>
            <span>&middot;</span>
            <span>Fixed Stack: React 19 + Vite + Tailwind v4 + FastAPI</span>
          </div>
        </div>
      </footer>

      <BoundariesDialog
        isOpen={isBoundariesOpen}
        onClose={() => setIsBoundariesOpen(false)}
      />

      <DemoController onOpenBoundaries={() => setIsBoundariesOpen(true)} />
      <RunHistoryDrawer />
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
