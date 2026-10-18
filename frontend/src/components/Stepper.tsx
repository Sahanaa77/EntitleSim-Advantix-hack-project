import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  FileCode2, 
  Compass, 
  AlertTriangle, 
  GitCompare, 
  CheckCircle2, 
  Download 
} from 'lucide-react'
import { cn } from '../lib/utils'

export interface StepItem {
  number: number
  title: string
  path: string
  icon: React.ComponentType<{ className?: string }>
}

export const STEPS: StepItem[] = [
  { number: 1, title: 'Model & Define', path: '/', icon: FileCode2 },
  { number: 2, title: 'Bounded Exploration', path: '/explore', icon: Compass },
  { number: 3, title: 'Violation & Minimization', path: '/minimize', icon: AlertTriangle },
  { number: 4, title: 'Inspect State Diff', path: '/diff', icon: GitCompare },
  { number: 5, title: 'Fix & Retest', path: '/fix', icon: CheckCircle2 },
  { number: 6, title: 'Regression Export', path: '/export', icon: Download },
]

export const Stepper: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // Find active step
  const activeStep = STEPS.find((s) => s.path === location.pathname) || STEPS[0]

  return (
    <nav aria-label="Verification Workflow" className="w-full bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ol className="flex items-center justify-between overflow-x-auto py-2.5 gap-2 no-scrollbar">
          {STEPS.map((step) => {
            const isActive = activeStep.number === step.number
            const isCompleted = activeStep.number > step.number
            const Icon = step.icon

            return (
              <li key={step.number} className="flex-1 min-w-[150px]">
                <button
                  onClick={() => navigate(step.path)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-xs font-medium border',
                    isActive
                      ? 'bg-blue-50 text-blue-800 border-blue-200 shadow-xs'
                      : isCompleted
                      ? 'text-slate-700 border-transparent hover:bg-slate-50'
                      : 'text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600'
                  )}
                >
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-semibold',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {isCompleted ? '✓' : step.number}
                  </div>
                  <div className="truncate flex items-center gap-1.5">
                    <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-blue-600' : 'text-slate-400')} />
                    <span className="truncate">{step.title}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
