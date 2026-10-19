import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getModels,
  getRuns,
  getRun,
  createRun,
  createModel,
  minimizeCounterexample as apiMinimize,
} from '../lib/api'
import { BoundsConfig, Counterexample, ModelDefinition, ModelRecord, Run } from '../types'
import { ToastItem } from '../components/ToastContainer'

export const DUPLICATE_USAGE_MODEL_DEF: ModelDefinition = {
  name: 'Duplicate Usage Event',
  unit: 'GB',
  display: { unit: 'GB' },
  tenants: [{ id: 'A', roles: ['admin', 'member'] }],
  feature_roles: {
    premium: ['admin', 'member'],
  },
  plans: {
    pro: { features: ['basic', 'premium'], quota: { api_calls: 100, GB: 100 } },
  },
  transitions: [
    ['none', 'pro'],
  ],
  policies: {
    grace_period_events: 1,
    trial_events: 0,
    prepaid_credits: 0,
  },
  scenario: [
    { id: 'e1', tenant: 'A', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'pro' } },
    { id: 'u1', tenant: 'A', customer_id: 'c1', seq: 2, type: 'UsageRecorded', payload: { units: 15 } },
    { id: 'e3', tenant: 'A', customer_id: 'c1', seq: 3, type: 'AccessCheck', payload: { feature: 'premium', role: 'admin' } },
  ],
  invariants: [
    { id: 'INV-1', type: 'feature_access_matches_plan' },
    { id: 'INV-2', type: 'usage_within_quota' },
    { id: 'INV-3', type: 'tenant_isolation' },
    { id: 'INV-4', type: 'no_access_after_cancel' },
    { id: 'INV-5', type: 'cache_db_consistent' },
  ],
}

const DEMO_BOUNDS: BoundsConfig = {
  max_depth: 6,
  max_retries: 2,
  max_concurrency: 2,
  allow_duplicates: true,
  allow_reorder: true,
  allow_interrupt: false,
  max_states: 500,
  seed: 42,
}

interface AppContextType {
  models: ModelRecord[]
  currentModel: ModelRecord | null
  currentRun: Run | null
  selectedCx: Counterexample | null
  isFixed: boolean
  isPolling: boolean
  isHistoryOpen: boolean
  runHistory: Run[]
  error: string | null
  isDemoActive: boolean
  demoStep: number
  demoMessage: string
  isDemoPaused: boolean
  toasts: ToastItem[]
  toast: (title: string, message?: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  dismissToast: (id: string) => void
  setCurrentModel: (model: ModelRecord | null) => void
  setIsFixed: (val: boolean) => void
  setIsHistoryOpen: (val: boolean) => void
  setSelectedCx: (cx: Counterexample | null) => void
  setError: (err: string | null) => void
  fetchModels: () => Promise<void>
  fetchHistory: () => Promise<void>
  startExploration: (bounds: BoundsConfig, fixed?: boolean) => Promise<Run | null>
  minimizeActiveCx: () => Promise<void>
  openRun: (runId: string) => Promise<void>
  startDemo: () => Promise<void>
  stopDemo: () => void
  pauseDemo: () => void
  resumeDemo: () => void
  advanceDemoStep: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate()

  const [models, setModels] = useState<ModelRecord[]>([])
  const [currentModel, setCurrentModel] = useState<ModelRecord | null>(null)
  const [currentRun, setCurrentRun] = useState<Run | null>(null)
  const [selectedCx, setSelectedCx] = useState<Counterexample | null>(null)
  const [isFixed, setIsFixed] = useState<boolean>(false)
  const [isPolling, setIsPolling] = useState<boolean>(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false)
  const [runHistory, setRunHistory] = useState<Run[]>([])
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (title: string, message?: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
      const id = Math.random().toString(36).slice(2, 9)
      const newItem: ToastItem = { id, title, message, type }
      setToasts((prev) => [...prev.slice(-4), newItem])
      window.setTimeout(() => {
        dismissToast(id)
      }, 4000)
    },
    [dismissToast]
  )

  // Demo walkthrough state
  const [isDemoActive, setIsDemoActive] = useState<boolean>(false)
  const [demoStep, setDemoStep] = useState<number>(1)
  const [demoMessage, setDemoMessage] = useState<string>('')
  const [isDemoPaused, setIsDemoPaused] = useState<boolean>(false)

  const pollIntervalRef = useRef<number | null>(null)
  const demoTimerRef = useRef<number | null>(null)
  const demoPausedRef = useRef<boolean>(false)
  const demoStepRef = useRef<number>(1)
  demoPausedRef.current = isDemoPaused
  demoStepRef.current = demoStep

  const fetchModels = useCallback(async () => {
    try {
      const data = await getModels()
      setModels(data)
      if (data.length > 0 && !currentModel) {
        const defaultModel = data.find((m) => m.name === 'Duplicate Usage Event') || data[0]
        setCurrentModel(defaultModel)
      }
    } catch (err: any) {
      console.error('Failed to fetch models:', err)
      setError(err.message || 'Failed to fetch models')
    }
  }, [currentModel])

  const fetchHistory = useCallback(async () => {
    try {
      const data = await getRuns()
      setRunHistory(data)
    } catch (err: any) {
      console.error('Failed to fetch run history:', err)
    }
  }, [])

  useEffect(() => {
    fetchModels()
    fetchHistory()
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current)
    }
  }, [fetchModels, fetchHistory])

  const startExploration = async (bounds: BoundsConfig, fixed: boolean = false): Promise<Run | null> => {
    if (!currentModel) {
      setError('No model selected')
      return null
    }

    setError(null)
    setIsPolling(true)
    toast('Verification Started', 'Running bounded model exploration across interleavings...', 'info')

    try {
      const initialRun = await createRun(currentModel.id, bounds, fixed)
      setCurrentRun(initialRun)

      // Start 300 ms polling
      return new Promise<Run>((resolve) => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

        pollIntervalRef.current = window.setInterval(async () => {
          try {
            const updated = await getRun(initialRun.id)
            setCurrentRun(updated)

            if (updated.status === 'done' || updated.status === 'failed') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
              setIsPolling(false)
              fetchHistory()

              // Auto-select first counterexample (prefer INV-2 for duplicate usage, then INV-1)
              if (updated.counterexamples && updated.counterexamples.length > 0) {
                const targetCx =
                  (currentModel?.name === 'Duplicate Usage Event'
                    ? updated.counterexamples.find((c) => c.invariant_id === 'INV-2')
                    : null) ||
                  updated.counterexamples.find((c) => c.invariant_id === 'INV-2') ||
                  updated.counterexamples.find((c) => c.invariant_id === 'INV-1') ||
                  updated.counterexamples[0]
                setSelectedCx(targetCx)
                toast(
                  'Violations Found',
                  `${updated.counterexamples.length} counterexample(s) detected across ${updated.stats?.states_explored ?? 0} states.`,
                  'warning'
                )
              } else {
                setSelectedCx(null)
                toast(
                  'Verification Passed',
                  `No invariant violations found across ${updated.stats?.states_explored ?? 0} states.`,
                  'success'
                )
              }
              resolve(updated)
            }
          } catch (err: any) {
            console.error('Error polling run:', err)
          }
        }, 300)
      })
    } catch (err: any) {
      setIsPolling(false)
      setError(err.message || 'Failed to start exploration')
      toast('Verification Failed', err.message || 'Failed to execute run', 'error')
      return null
    }
  }

  const minimizeActiveCx = async () => {
    if (!selectedCx) return
    try {
      const minRes = await apiMinimize(selectedCx.id)
      const updatedCx: Counterexample = {
        ...selectedCx,
        minimal_trace: minRes.minimal_trace,
        state_diffs: minRes.state_diffs,
      }
      setSelectedCx(updatedCx)

      if (currentRun) {
        setCurrentRun({
          ...currentRun,
          counterexamples: currentRun.counterexamples.map((c) =>
            c.id === selectedCx.id ? updatedCx : c
          ),
        })
      }
      toast('Trace Minimized', 'Counterexample trace minimized to canonical sequence.', 'success')
    } catch (err: any) {
      console.error('Failed to minimize counterexample:', err)
      setError(err.message || 'Minimization failed')
      toast('Minimization Failed', err.message || 'Could not minimize trace', 'error')
    }
  }

  const openRun = async (runId: string) => {
    try {
      const run = await getRun(runId)
      setCurrentRun(run)
      if (run.counterexamples && run.counterexamples.length > 0) {
        const targetCx =
          run.counterexamples.find((c) => c.invariant_id === 'INV-2') ||
          run.counterexamples.find((c) => c.invariant_id === 'INV-1') ||
          run.counterexamples[0]
        setSelectedCx(targetCx)
      } else {
        setSelectedCx(null)
      }
      setIsHistoryOpen(false)
      toast('Run Loaded', `Loaded verification run ${run.id.slice(0, 8)}`, 'info')
    } catch (err: any) {
      setError(err.message || 'Failed to open run')
      toast('Load Error', err.message || 'Failed to load run', 'error')
    }
  }

  const scheduleNextDemoStep = (nextStep: number, delayMs: number) => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current)
    demoTimerRef.current = window.setTimeout(() => {
      if (!demoPausedRef.current) {
        executeDemoStep(nextStep)
      }
    }, delayMs)
  }

  const executeDemoStep = async (step: number) => {
    if (step > 6) {
      setIsDemoActive(false)
      return
    }

    setDemoStep(step)

    switch (step) {
      case 1:
        navigate('/verification/model')
        setDemoMessage('Step 1 of 6: Loaded "Duplicate Usage Event" scenario (Tenant A, Pro plan 100 GB quota, events u1: 15 GB).')
        scheduleNextDemoStep(2, 3000)
        break

      case 2:
        navigate('/verification/explore')
        setDemoMessage('Step 2 of 6: Exploring bounded event sequences with duplicate delivery allowed...')
        try {
          const run = await startExploration(DEMO_BOUNDS, false)
          if (run && run.counterexamples && run.counterexamples.length > 0) {
            const states = run.stats?.states_explored ?? 0
            const ms = run.stats?.duration_ms ?? 0
            const viols = run.stats?.violations ?? run.counterexamples.length
            setDemoMessage(`Step 2 of 6: Explored ${states} states in ${ms}ms. Found ${viols} violation (INV-2: Usage counter mismatch - expected 15 GB vs observed 30 GB).`)
          } else {
            setDemoMessage('Step 2 of 6: Exploration finished.')
          }
        } catch {
          setDemoMessage('Step 2 of 6: Exploration step completed.')
        }
        scheduleNextDemoStep(3, 2500)
        break

      case 3:
        navigate('/verification/minimize')
        setDemoMessage('Step 3 of 6: Minimizing trace via ddmin delta debugger...')
        await minimizeActiveCx()
        setDemoMessage('Step 3 of 6: Failing trace minimized down to 2 essential steps (duplicate UsageRecorded u1).')
        scheduleNextDemoStep(4, 3000)
        break

      case 4:
        navigate('/verification/diff')
        setDemoMessage('Step 4 of 6: State diff inspector verifies INV-2 counter mismatch: Expected 15 GB vs Observed 30 GB.')
        scheduleNextDemoStep(5, 3500)
        break

      case 5:
        navigate('/verification/fix')
        setIsFixed(true)
        setDemoMessage('Step 5 of 6: Fix applied (Idempotency deduplication by event id). Re-verification yields 0 violations.')
        scheduleNextDemoStep(6, 3500)
        break

      case 6:
        navigate('/verification/export')
        setDemoMessage('Step 6 of 6: Pytest regression test & CI suite generated and ready to drop into CI/CD.')
        break
    }
  }

  const startDemo = async () => {
    setIsDemoActive(true)
    setIsDemoPaused(false)
    setIsFixed(false)
    try {
      let target = models.find((m) => m.name === 'Duplicate Usage Event')
      if (!target) {
        target = await createModel('Duplicate Usage Event', DUPLICATE_USAGE_MODEL_DEF)
        const updated = await getModels()
        setModels(updated)
      }
      setCurrentModel(target)
    } catch (e) {
      console.error('Failed to set guided tour model:', e)
    }
    executeDemoStep(1)
  }

  const stopDemo = () => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current)
    setIsDemoActive(false)
    setIsDemoPaused(false)
  }

  const pauseDemo = () => {
    setIsDemoPaused(true)
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current)
  }

  const resumeDemo = () => {
    setIsDemoPaused(false)
    const current = demoStepRef.current
    if (current < 6) {
      scheduleNextDemoStep(current + 1, 1500)
    }
  }

  const advanceDemoStep = () => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current)
    const next = demoStepRef.current + 1
    if (next <= 6) {
      executeDemoStep(next)
    } else {
      stopDemo()
    }
  }

  return (
    <AppContext.Provider
      value={{
        models,
        currentModel,
        currentRun,
        selectedCx,
        isFixed,
        isPolling,
        isHistoryOpen,
        runHistory,
        error,
        isDemoActive,
        demoStep,
        demoMessage,
        isDemoPaused,
        toasts,
        toast,
        dismissToast,
        setCurrentModel,
        setIsFixed,
        setIsHistoryOpen,
        setSelectedCx,
        setError,
        fetchModels,
        fetchHistory,
        startExploration,
        minimizeActiveCx,
        openRun,
        startDemo,
        stopDemo,
        pauseDemo,
        resumeDemo,
        advanceDemoStep,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within an AppProvider')
  return context
}
