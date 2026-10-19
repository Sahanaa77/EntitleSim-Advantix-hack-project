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
  { number: 1, title: 'Model & Define', path: '/verification/model', icon: FileCode2 },
  { number: 2, title: 'Bounded Exploration', path: '/verification/explore', icon: Compass },
  { number: 3, title: 'Violation & Minimization', path: '/verification/minimize', icon: AlertTriangle },
  { number: 4, title: 'Inspect State Diff', path: '/verification/diff', icon: GitCompare },
  { number: 5, title: 'Fix & Retest', path: '/verification/fix', icon: CheckCircle2 },
  { number: 6, title: 'Regression Export', path: '/verification/export', icon: Download },
]

export const Stepper: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // Find active step matching current path or default to Step 1
  const getActiveStep = () => {
    const p = location.pathname
    if (p.includes('/explore')) return STEPS[1]
    if (p.includes('/minimize')) return STEPS[2]
    if (p.includes('/diff')) return STEPS[3]
    if (p.includes('/fix')) return STEPS[4]
    if (p.includes('/export')) return STEPS[5]
    return STEPS[0]
  }

  const activeStep = getActiveStep()

  return (
    <nav aria-label="Verification Workflow" className="w-full bg-surface border border-border rounded-xl p-1.5 shadow-xs">
      <ol className="flex items-center justify-between overflow-x-auto gap-1.5 no-scrollbar">
        {STEPS.map((step) => {
          const isActive = activeStep.number === step.number
          const isCompleted = activeStep.number > step.number
          const Icon = step.icon

          return (
            <li key={step.number} className="flex-1 min-w-[150px]">
              <button
                onClick={() => navigate(step.path)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-xs font-medium border cursor-pointer',
                  isActive
                    ? 'bg-primary/15 text-primary border-primary/30 shadow-xs'
                    : isCompleted
                    ? 'text-text border-transparent hover:bg-elevated'
                    : 'text-muted border-transparent hover:bg-elevated hover:text-text'
                )}
              >
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-semibold',
                    isActive
                      ? 'bg-primary text-white'
                      : isCompleted
                      ? 'bg-success/20 text-success border border-success/30'
                      : 'bg-elevated text-muted border border-border'
                  )}
                >
                  {isCompleted ? '✓' : step.number}
                </div>
                <div className="truncate flex items-center gap-1.5">
                  <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-primary' : 'text-muted')} />
                  <span className="truncate">{step.title}</span>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
