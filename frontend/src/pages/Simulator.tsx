import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Cpu,
  Zap,
  ArrowRight,
  RefreshCw,
  Play,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Shuffle,
  Plus,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Send,
  Sliders,
  Check,
  Sparkles,
} from 'lucide-react'
import { useApp, DUPLICATE_USAGE_MODEL_DEF } from '../context/AppContext'
import { simulateEvents, SimulateStepResult, getModels, createModel } from '../lib/api'
import { ModelRecord } from '../types'
import { VALID_EVENT_TYPES, ValidEventType } from './ModelDefine'

const EVENT_TYPE_BADGES: Record<ValidEventType, string> = {
  SubscriptionCreated: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  PlanUpgraded: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  PlanDowngraded: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  SubscriptionCancelled: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  PaymentSucceeded: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',
  PaymentFailed: 'bg-red-500/15 text-red-400 border border-red-500/30',
  UsageRecorded: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
  AccessCheck: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
}

const INVARIANT_EXPLANATIONS: Record<string, string> = {
  'INV-1': 'Unauthorized Feature Access: Member accessed a feature not included in their active subscription tier.',
  'INV-2': 'Usage Quota Exceeded: Consumption exceeded the maximum quota limit for the active plan.',
  'INV-3': 'Cross-Tenant Isolation Breach: State or cached entitlements leaked or mutated across tenants.',
  'INV-4': 'Post-Cancellation Access: Member accessed resources after subscription was cancelled.',
  'INV-5': 'Cache & Database Drift: In-memory entitlement permissions diverged from durable database state.',
}

interface QueuedEvent {
  id: string
  tenant: string
  customer_id: string
  seq: number
  type: ValidEventType
  payload: Record<string, any>
}

export const Simulator: React.FC = () => {
  const navigate = useNavigate()
  const { models, currentModel, setCurrentModel, isFixed, setIsFixed, toast, fetchModels } = useApp()

  // Model Selection State
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [activeModel, setActiveModel] = useState<ModelRecord | null>(null)

  // Simulation State
  const [deliveredEvents, setDeliveredEvents] = useState<QueuedEvent[]>([])
  const [simulationSteps, setSimulationSteps] = useState<SimulateStepResult[]>([])
  const [isSimulating, setIsSimulating] = useState<boolean>(false)
  const [pendingQueue, setPendingQueue] = useState<QueuedEvent[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isDelayedFiring, setIsDelayedFiring] = useState<boolean>(false)

  // Builder Panel Form State
  const [eventType, setEventType] = useState<ValidEventType>('SubscriptionCreated')
  const [selectedTenant, setSelectedTenant] = useState<string>('A')
  const [customerId, setCustomerId] = useState<string>('c1')
  const [planInput, setPlanInput] = useState<string>('free')
  const [unitsInput, setUnitsInput] = useState<number>(10)
  const [featureInput, setFeatureInput] = useState<string>('basic')
  const [roleInput, setRoleInput] = useState<string>('admin')
  const [amountInput, setAmountInput] = useState<number>(29)

  // Toggles
  const [delayToggle, setDelayToggle] = useState<boolean>(false)
  const [duplicateToggle, setDuplicateToggle] = useState<boolean>(false)
  const [outOfOrderToggle, setOutOfOrderToggle] = useState<boolean>(false)

  // Load models or sync on mount
  useEffect(() => {
    if (models.length > 0) {
      const initial = currentModel || models[0]
      setSelectedModelId(initial.id)
      setActiveModel(initial)
    } else {
      getModels().then((data) => {
        if (data.length > 0) {
          setSelectedModelId(data[0].id)
          setActiveModel(data[0])
          setCurrentModel(data[0])
        }
      })
    }
  }, [models, currentModel, setCurrentModel])

  // Derive model metadata
  const availableTenants = useMemo(() => {
    return activeModel?.definition?.tenants?.map((t) => t.id) || ['A', 'B']
  }, [activeModel])

  const availablePlans = useMemo(() => {
    const plansObj = activeModel?.definition?.plans || {}
    const keys = Object.keys(plansObj)
    return keys.length > 0 ? keys : ['free', 'pro']
  }, [activeModel])

  const availableFeatures = useMemo(() => {
    const set = new Set<string>()
    const plansObj = activeModel?.definition?.plans || {}
    Object.values(plansObj).forEach((p: any) => {
      p.features?.forEach((f: string) => set.add(f))
    })
    return set.size > 0 ? Array.from(set) : ['basic', 'premium']
  }, [activeModel])

  // Reset defaults when model changes
  useEffect(() => {
    if (availableTenants.length > 0 && !availableTenants.includes(selectedTenant)) {
      setSelectedTenant(availableTenants[0])
    }
    if (availablePlans.length > 0 && !availablePlans.includes(planInput)) {
      setPlanInput(availablePlans[0])
    }
    if (availableFeatures.length > 0 && !availableFeatures.includes(featureInput)) {
      setFeatureInput(availableFeatures[0])
    }
  }, [availableTenants, availablePlans, availableFeatures, selectedTenant, planInput, featureInput])

  // Execute simulation against backend POST /api/simulate
  const runSimulation = useCallback(
    async (eventsToSimulate: QueuedEvent[], fixedMode: boolean) => {
      if (!activeModel?.definition) return
      setIsSimulating(true)
      try {
        const steps = await simulateEvents(activeModel.definition, eventsToSimulate, fixedMode)
        setSimulationSteps(steps)
        setDeliveredEvents(eventsToSimulate)
      } catch (err) {
        console.error('Simulation error:', err)
      } finally {
        setIsSimulating(false)
      }
    },
    [activeModel]
  )

  // Re-run simulation when fixed mode changes
  const handleToggleFixedMode = async () => {
    const nextFixed = !isFixed
    setIsFixed(nextFixed)
    if (deliveredEvents.length > 0) {
      await runSimulation(deliveredEvents, nextFixed)
    }
  }

  // Model switch handler
  const handleSelectModel = (modelId: string) => {
    const found = models.find((m) => m.id === modelId)
    if (found) {
      setSelectedModelId(found.id)
      setActiveModel(found)
      setCurrentModel(found)
      // Reset simulator
      setDeliveredEvents([])
      setSimulationSteps([])
      setPendingQueue([])
    }
  }

  // Build payload for event
  const buildPayload = () => {
    switch (eventType) {
      case 'SubscriptionCreated':
      case 'PlanUpgraded':
      case 'PlanDowngraded':
        return { plan: planInput }
      case 'UsageRecorded':
        return { units: Number(unitsInput) || 1 }
      case 'AccessCheck':
        return { feature: featureInput, role: roleInput }
      case 'PaymentSucceeded':
      case 'PaymentFailed':
        return { amount: Number(amountInput) || 29 }
      case 'SubscriptionCancelled':
      default:
        return {}
    }
  }

  // Next seq computation for tenant
  const getNextSeqForTenant = (tId: string) => {
    const tenantDelivered = deliveredEvents.filter((e) => e.tenant === tId)
    const tenantQueued = pendingQueue.filter((e) => e.tenant === tId)
    const maxDelivered = tenantDelivered.length > 0 ? Math.max(...tenantDelivered.map((e) => e.seq)) : 0
    const maxQueued = tenantQueued.length > 0 ? Math.max(...tenantQueued.map((e) => e.seq)) : 0
    return Math.max(maxDelivered, maxQueued) + 1
  }

  // Handle Event Creation
  const handleFireOrQueue = async () => {
    const newSeq = getNextSeqForTenant(selectedTenant)
    const newId = `e${deliveredEvents.length + pendingQueue.length + 1}`

    const newEvent: QueuedEvent = {
      id: newId,
      tenant: selectedTenant,
      customer_id: customerId.trim() || 'c1',
      seq: newSeq,
      type: eventType,
      payload: buildPayload(),
    }

    const eventsToAdd = [newEvent]
    if (duplicateToggle) {
      eventsToAdd.push({
        ...newEvent,
        id: newId, // Re-send the exact SAME event id
      })
    }

    if (outOfOrderToggle) {
      setPendingQueue((prev) => [...prev, ...eventsToAdd])
      return
    }

    // Direct firing (with optional delay simulation)
    if (delayToggle) {
      setIsDelayedFiring(true)
      setTimeout(async () => {
        setIsDelayedFiring(false)
        const updated = [...deliveredEvents, ...eventsToAdd]
        toast('Event Dispatched', `Fired ${newEvent.type} for Tenant ${newEvent.tenant} (delayed)`, 'info')
        await runSimulation(updated, isFixed)
      }, 700)
    } else {
      const updated = [...deliveredEvents, ...eventsToAdd]
      toast('Event Dispatched', `Fired ${newEvent.type} for Tenant ${newEvent.tenant}`, 'info')
      await runSimulation(updated, isFixed)
    }
  }

  // Deliver single item from pending queue
  const handleDeliverQueueItem = async (index: number) => {
    const item = pendingQueue[index]
    const nextQueue = pendingQueue.filter((_, i) => i !== index)
    setPendingQueue(nextQueue)
    const updated = [...deliveredEvents, item]
    toast('Queue Event Delivered', `Fired queued ${item.type} for Tenant ${item.tenant}`, 'info')
    await runSimulation(updated, isFixed)
  }

  // Deliver all items from pending queue (in their current drag-reordered sequence)
  const handleDeliverAllQueue = async () => {
    if (pendingQueue.length === 0) return
    const updated = [...deliveredEvents, ...pendingQueue]
    const count = pendingQueue.length
    setPendingQueue([])
    toast('Queue Flushed', `Delivered ${count} reordered events in sequence`, 'info')
    await runSimulation(updated, isFixed)
  }

  // Drag and drop reordering handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return
    setPendingQueue((prev) => {
      const updated = [...prev]
      const [moved] = updated.splice(draggedIndex, 1)
      updated.splice(index, 0, moved)
      return updated
    })
    setDraggedIndex(null)
  }

  // Button-based reordering handlers
  const handleMoveQueueItem = (index: number, direction: 'up' | 'down') => {
    setPendingQueue((prev) => {
      const targetIdx = direction === 'up' ? index - 1 : index + 1
      if (targetIdx < 0 || targetIdx >= prev.length) return prev
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[targetIdx]
      updated[targetIdx] = temp
      return updated
    })
  }

  // Reset simulator
  const handleReset = () => {
    setDeliveredEvents([])
    setSimulationSteps([])
    setPendingQueue([])
    toast('Simulator Reset', 'Cleared all simulated events and step states', 'info')
  }

  // Quick race preset
  const handleLoadRacePreset = async () => {
    const t = availableTenants[0] || 'A'
    const preset: QueuedEvent[] = [
      { id: 'e1', tenant: t, customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: availablePlans[0] || 'free' } },
      { id: 'e2', tenant: t, customer_id: 'c1', seq: 3, type: 'PlanDowngraded', payload: { plan: availablePlans[0] || 'free' } },
      { id: 'e3', tenant: t, customer_id: 'c1', seq: 2, type: 'PlanUpgraded', payload: { plan: availablePlans[1] || availablePlans[0] || 'pro' } },
      { id: 'e4', tenant: t, customer_id: 'c1', seq: 4, type: 'AccessCheck', payload: { feature: availableFeatures[1] || 'premium', role: 'admin' } },
    ]
    toast('Race Preset Loaded', 'Simulating out-of-order downgrade/upgrade sequence', 'info')
    await runSimulation(preset, isFixed)
  }

  // One-click duplicate usage demo preset: loads the template and fires 15 GB event twice
  const handleLoadDuplicateUsageDemo = async () => {
    let target = models.find((m) => m.name === 'Duplicate Usage Event')
    if (!target) {
      try {
        target = await createModel('Duplicate Usage Event', DUPLICATE_USAGE_MODEL_DEF)
        await fetchModels()
        if (target) {
          setSelectedModelId(target.id)
          setActiveModel(target)
          setCurrentModel(target)
        }
      } catch (err) {
        console.error('Failed to create Duplicate Usage Event model:', err)
      }
    } else {
      setSelectedModelId(target.id)
      setActiveModel(target)
      setCurrentModel(target)
    }

    const t = target?.definition?.tenants?.[0]?.id || 'A'
    const unit = target?.definition?.unit || target?.definition?.display?.unit || 'GB'

    // Fire SubscriptionCreated(pro) and the 15 GB UsageRecorded event twice with identical event id u1
    const preset: QueuedEvent[] = [
      {
        id: 'e1',
        tenant: t,
        customer_id: 'c1',
        seq: 1,
        type: 'SubscriptionCreated',
        payload: { plan: 'pro' },
      },
      {
        id: 'u1',
        tenant: t,
        customer_id: 'c1',
        seq: 2,
        type: 'UsageRecorded',
        payload: { units: 15, unit },
      },
      {
        id: 'u1', // EXACT SAME EVENT ID
        tenant: t,
        customer_id: 'c1',
        seq: 2,
        type: 'UsageRecorded',
        payload: { units: 15, unit },
      },
      {
        id: 'e3',
        tenant: t,
        customer_id: 'c1',
        seq: 3,
        type: 'AccessCheck',
        payload: { feature: 'premium', role: 'admin' },
      },
    ]

    toast('Duplicate Usage Demo Loaded', 'Fired 15 GB event twice with identical event ID u1', 'warning')
    await runSimulation(preset, isFixed)
  }

  // Send to Verification
  const handleSendToVerification = () => {
    if (!activeModel || deliveredEvents.length === 0) return

    const updatedModel: ModelRecord = {
      ...activeModel,
      definition: {
        ...activeModel.definition,
        scenario: deliveredEvents.map((ev, i) => ({
          id: ev.id || `e${i + 1}`,
          tenant: ev.tenant || 'A',
          customer_id: ev.customer_id || 'c1',
          seq: ev.seq || i + 1,
          type: ev.type,
          payload: { ...(ev.payload || {}) },
        })),
      },
    }

    setCurrentModel(updatedModel)
    toast('Sent to Verification', 'Loaded sandbox sequence into scenario for verification', 'success')
    navigate('/verification/explore')
  }

  // Latest step and violation analysis
  const latestStep = simulationSteps[simulationSteps.length - 1]
  const allViolations = useMemo(() => {
    const viols: Array<{ step: number; id: string; tenant: string; message: string }> = []
    simulationSteps.forEach((s) => {
      s.violations?.forEach((v) => {
        viols.push({ step: s.step, ...v })
      })
    })
    return viols
  }, [simulationSteps])

  const latestViolation = allViolations[allViolations.length - 1]

  // Tenant state snapshots (current state at latest step)
  const tenantStates = useMemo(() => {
    const result: Record<
      string,
      {
        expected: Record<string, any>
        observed: Record<string, any>
        isDiverged: boolean
      }
    > = {}

    availableTenants.forEach((tId) => {
      const exp = latestStep?.expected?.[tId] || {
        plan: 'none',
        status: 'none',
        features: [],
        usage: 0,
        last_access_granted: null,
      }
      const obs = latestStep?.observed?.[tId] || {
        plan: 'none',
        status: 'none',
        features: [],
        usage: 0,
        last_access_granted: null,
      }

      const planMismatch = exp.plan !== obs.plan
      const statusMismatch = exp.status !== obs.status
      const usageMismatch = exp.usage !== obs.usage
      const featuresMismatch =
        JSON.stringify([...(exp.features || [])].sort()) !==
        JSON.stringify([...(obs.features || [])].sort())
      const accessMismatch =
        exp.last_access_granted !== undefined &&
        obs.last_access_granted !== undefined &&
        exp.last_access_granted !== obs.last_access_granted

      const isDiverged =
        planMismatch || statusMismatch || usageMismatch || featuresMismatch || accessMismatch

      result[tId] = {
        expected: exp,
        observed: obs,
        isDiverged,
      }
    })

    return result
  }, [availableTenants, latestStep])

  return (
    <div className="space-y-6">
      {/* Top Header & Simulator Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text">Event & Webhook Simulator</h1>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-primary/15 text-primary border border-primary/30 rounded-full">
              POST /api/simulate
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Dispatch, delay, duplicate, and reorder webhook events interactively in an in-memory sandbox.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* SUT Target Toggle (Fixed vs Buggy) */}
          <button
            onClick={handleToggleFixedMode}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer shadow-xs ${
              isFixed
                ? 'bg-success/20 text-success border-success/40 hover:bg-success/30'
                : 'bg-warn/20 text-warn border-warn/40 hover:bg-warn/30'
            }`}
            title="Toggle between Buggy baseline and Fixed/Mitigated engine mode"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Target: {isFixed ? 'FIXED (fixed=true)' : 'BUGGY (fixed=false)'}</span>
          </button>

          {/* Duplicate usage demo preset button */}
          <button
            onClick={handleLoadDuplicateUsageDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/30 shadow-xs cursor-pointer transition-all"
            title="Load Duplicate Usage Event template and fire the 15 GB event twice"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            <span>Duplicate usage demo</span>
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 shadow-xs cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted" />
            <span>Reset Trace</span>
          </button>

          {/* Send to Verification */}
          <button
            onClick={handleSendToVerification}
            disabled={deliveredEvents.length === 0}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-40 ${
              allViolations.length > 0
                ? 'bg-danger hover:bg-danger/90 text-white animate-pulse'
                : 'bg-primary hover:bg-primary/90 text-white'
            }`}
            title="Export this simulated trace sequence directly into the Verification workflow"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send to Verification</span>
          </button>
        </div>
      </div>

      {/* Red Alert Banner in Plain English when Invariant Breaks */}
      {latestViolation && (
        <div className="bg-danger/15 border-2 border-danger/60 text-danger p-4 rounded-xl shadow-lg animate-in slide-in-from-top-2 duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-danger/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-danger/30 text-white uppercase tracking-wider">
                  {latestViolation.id} Broken
                </span>
                <span className="text-xs font-bold text-text">
                  Tenant {latestViolation.tenant} Diverged at Step {latestViolation.step}
                </span>
              </div>
              <p className="text-xs text-text/90 leading-relaxed font-medium">
                {latestViolation.id === 'INV-2'
                  ? `Counted twice: expected ${tenantStates[latestViolation.tenant]?.expected?.usage ?? 15}, observed ${tenantStates[latestViolation.tenant]?.observed?.usage ?? 30}`
                  : (INVARIANT_EXPLANATIONS[latestViolation.id] || latestViolation.message)}
              </p>
              <div className="text-[11px] text-danger/80 font-mono">
                &rarr; Raw: {latestViolation.message}
              </div>
            </div>
          </div>

          <button
            onClick={handleSendToVerification}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-danger hover:bg-danger/90 rounded-lg shrink-0 shadow-xs cursor-pointer transition-colors"
          >
            <span>Inspect in Verification</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 2-Column Grid: Left Controls | Right Live Tenant Cards & Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Model Picker + Manual Event Dispatcher */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Pick Saved Model */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-text uppercase tracking-wider">Active Model Spec</h2>
              </div>
              <button
                onClick={() => navigate('/models')}
                className="text-[11px] text-primary hover:underline cursor-pointer"
              >
                Model Builder &rarr;
              </button>
            </div>

            <select
              value={selectedModelId}
              onChange={(e) => handleSelectModel(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono font-bold bg-elevated border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.definition.tenants?.length || 0} tenants,{' '}
                  {Object.keys(m.definition.plans || {}).length} plans)
                </option>
              ))}
            </select>

            {/* Quick Preset Launcher */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] border-t border-border/60">
              <span className="text-muted font-medium">Quick presets:</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleLoadDuplicateUsageDemo}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/30 font-semibold cursor-pointer transition-colors"
                >
                  <Copy className="w-3 h-3 text-indigo-400" />
                  <span>Duplicate usage demo</span>
                </button>
                <button
                  onClick={handleLoadRacePreset}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-semibold cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-warn" />
                  <span>Race Preset</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Event Dispatcher Form */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-text uppercase tracking-wider">Fire Manual Event</h2>
              </div>
              <span className="text-[10px] font-mono text-muted uppercase">Stateless Dispatcher</span>
            </div>

            {/* Event Type & Tenant Selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as ValidEventType)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-elevated border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {VALID_EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Target Tenant</label>
                <select
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {availableTenants.map((tId) => (
                    <option key={tId} value={tId}>
                      Tenant {tId}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Customer ID & Conditional Parameters */}
            <div className="p-3.5 bg-elevated/70 border border-border rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-1/2 space-y-1">
                  <span className="text-[10px] text-muted uppercase font-bold">Customer ID</span>
                  <input
                    type="text"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-2 py-1 text-xs font-mono bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="c1"
                  />
                </div>

                {/* Plan Selector */}
                {(eventType === 'SubscriptionCreated' ||
                  eventType === 'PlanUpgraded' ||
                  eventType === 'PlanDowngraded') && (
                  <div className="w-1/2 space-y-1">
                    <span className="text-[10px] text-muted uppercase font-bold">Plan Tier</span>
                    <select
                      value={planInput}
                      onChange={(e) => setPlanInput(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold uppercase bg-surface border border-border rounded text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {availablePlans.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Units Input */}
                {eventType === 'UsageRecorded' && (
                  <div className="w-1/2 space-y-1">
                    <span className="text-[10px] text-muted uppercase font-bold">Units Recorded</span>
                    <input
                      type="number"
                      min="1"
                      value={unitsInput}
                      onChange={(e) => setUnitsInput(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs font-mono bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {/* Amount Input */}
                {(eventType === 'PaymentSucceeded' || eventType === 'PaymentFailed') && (
                  <div className="w-1/2 space-y-1">
                    <span className="text-[10px] text-muted uppercase font-bold">Amount ($)</span>
                    <input
                      type="number"
                      min="0"
                      value={amountInput}
                      onChange={(e) => setAmountInput(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs font-mono bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {/* AccessCheck feature + role */}
              {eventType === 'AccessCheck' && (
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/60">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted uppercase font-bold">Feature</span>
                    <select
                      value={featureInput}
                      onChange={(e) => setFeatureInput(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {availableFeatures.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted uppercase font-bold">Role</span>
                    <input
                      type="text"
                      value={roleInput}
                      onChange={(e) => setRoleInput(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="admin"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Chaos & Delivery Toggles */}
            <div className="space-y-2 pt-1 border-t border-border">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                Chaos & Delivery Injections
              </span>

              <div className="space-y-2 text-xs">
                {/* 1. Delay */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-elevated/70 border border-border cursor-pointer hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-warn" />
                    <span className="text-text font-medium">Delay Delivery</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={delayToggle}
                    onChange={(e) => setDelayToggle(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                </label>

                {/* 2. Duplicate */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-elevated/70 border border-border cursor-pointer hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-text font-medium">Duplicate Delivery (Webhook Re-delivery)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={duplicateToggle}
                    onChange={(e) => setDuplicateToggle(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                </label>

                {/* 3. Out of Order */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-elevated/70 border border-border cursor-pointer hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-3.5 h-3.5 text-primary" />
                    <span className="text-text font-medium">Deliver Out of Order (Queue & Reorder)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={outOfOrderToggle}
                    onChange={(e) => setOutOfOrderToggle(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Fire / Queue Button */}
            <button
              onClick={handleFireOrQueue}
              disabled={isDelayedFiring || isSimulating}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
                outOfOrderToggle
                  ? 'bg-elevated hover:bg-elevated/80 border border-primary/40 text-primary'
                  : 'bg-primary hover:bg-primary/90 text-white'
              }`}
            >
              {isDelayedFiring ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Simulating Network Latency...</span>
                </>
              ) : outOfOrderToggle ? (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Pending Queue (Out-of-Order)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Fire Event Directly</span>
                </>
              )}
            </button>
          </div>

          {/* 3. Pending Queue (when items are queued for out-of-order delivery) */}
          {pendingQueue.length > 0 && (
            <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold text-text uppercase tracking-wider">
                    Pending Queue ({pendingQueue.length})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPendingQueue([])}
                    className="text-[11px] text-muted hover:text-danger cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleDeliverAllQueue}
                    disabled={isSimulating}
                    className="px-2.5 py-1 text-xs font-bold text-white bg-primary rounded-md hover:bg-primary/90 cursor-pointer shadow-xs"
                  >
                    Deliver All
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-muted">
                Drag to reorder event delivery, or click &ldquo;Deliver&rdquo; to dispatch sequentially.
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pendingQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                    className={`flex items-center justify-between p-2.5 rounded-lg bg-elevated border transition-all cursor-move ${
                      draggedIndex === idx ? 'border-primary opacity-50' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-3.5 h-3.5 text-muted/60" />
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-surface border border-border text-primary">
                        #{idx + 1}
                      </span>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${
                              EVENT_TYPE_BADGES[item.type]
                            }`}
                          >
                            {item.type}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-text">
                            T-{item.tenant} (seq:{item.seq})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveQueueItem(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 hover:text-text disabled:opacity-20 cursor-pointer"
                        title="Move up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveQueueItem(idx, 'down')}
                        disabled={idx === pendingQueue.length - 1}
                        className="p-1 hover:text-text disabled:opacity-20 cursor-pointer"
                        title="Move down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeliverQueueItem(idx)}
                        className="px-2 py-0.5 text-[11px] font-bold text-white bg-primary rounded hover:bg-primary/90 ml-1 cursor-pointer"
                      >
                        Deliver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Per-Tenant State Cards + Event Log Feed */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Live Per-Tenant Cards (Expected vs Observed) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-text uppercase tracking-wider">
                  Live Per-Tenant State (Expected vs Observed)
                </h2>
              </div>
              <span className="text-[11px] font-mono text-muted">
                {deliveredEvents.length} events processed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableTenants.map((tId) => {
                const tData = tenantStates[tId]
                const exp = tData.expected
                const obs = tData.observed
                const isDiverged = tData.isDiverged

                const activePlanName = exp.plan !== 'none' ? exp.plan : (obs.plan !== 'none' ? obs.plan : 'pro')
                const planDef = activeModel?.definition?.plans?.[activePlanName]
                const quotaLimit =
                  planDef?.quota?.GB ??
                  planDef?.quota?.api_calls ??
                  (planDef?.quota ? Object.values(planDef.quota)[0] : 100) ??
                  100
                const unitLabel = activeModel?.definition?.unit || activeModel?.definition?.display?.unit || 'GB'
                const expUsage = exp.usage ?? 0
                const obsUsage = obs.usage ?? 0

                const hasInv2Failure =
                  expUsage !== obsUsage ||
                  latestStep?.violations?.some((v) => v.id === 'INV-2' && v.tenant === tId) ||
                  allViolations.some((v) => v.id === 'INV-2' && v.tenant === tId && v.step === latestStep?.step)

                return (
                  <div
                    key={tId}
                    className={`bg-surface p-4 rounded-xl border shadow-xs transition-all duration-300 space-y-3 ${
                      hasInv2Failure
                        ? 'border-danger/80 bg-danger/5 shadow-danger/10'
                        : isDiverged
                        ? 'border-danger/70 bg-danger/5 shadow-danger/10'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    {/* Tenant Card Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-border/80">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-primary/20 text-primary font-mono text-xs font-bold flex items-center justify-center">
                          {tId}
                        </span>
                        <div>
                          <span className="font-bold text-xs text-text">Tenant {tId}</span>
                          <span className="text-[10px] text-muted block font-mono">
                            Roles: admin, member
                          </span>
                        </div>
                      </div>

                      {hasInv2Failure ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-danger/20 text-danger border border-danger/30 uppercase animate-pulse">
                          <XCircle className="w-3 h-3" />
                          <span>INV-2 Violated</span>
                        </span>
                      ) : isDiverged ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-danger/20 text-danger border border-danger/30 uppercase animate-pulse">
                          <XCircle className="w-3 h-3" />
                          <span>Diverged</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-success/20 text-success border border-success/30 uppercase">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>In Sync</span>
                        </span>
                      )}
                    </div>

                    {/* Usage Meter per Tenant: Used vs Quota (Expected and Observed side by side) */}
                    <div
                      className={`p-3 rounded-lg border transition-all ${
                        hasInv2Failure
                          ? 'bg-danger/15 border-danger/80 text-danger ring-1 ring-danger/50'
                          : 'bg-elevated/70 border-border/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider">
                          Usage Meter ({unitLabel})
                        </span>
                        {hasInv2Failure ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-danger/25 text-danger border border-danger/40 animate-pulse">
                            Counted twice: expected {expUsage}, observed {obsUsage}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-muted">
                            Quota: {quotaLimit} {unitLabel}
                          </span>
                        )}
                      </div>

                      {/* Expected and Observed Side by Side */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {/* Expected Meter */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted font-mono">Expected:</span>
                            <span className="font-mono font-bold text-text">
                              {expUsage} / {quotaLimit} {unitLabel}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-border/60">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, (expUsage / quotaLimit) * 100))}%` }}
                            />
                          </div>
                        </div>

                        {/* Observed Meter */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className={`font-mono ${hasInv2Failure ? 'text-danger font-bold' : 'text-muted'}`}>
                              Observed:
                            </span>
                            <span className={`font-mono font-bold ${hasInv2Failure ? 'text-danger' : 'text-text'}`}>
                              {obsUsage} / {quotaLimit} {unitLabel}
                            </span>
                          </div>
                          <div className={`w-full h-2 bg-surface rounded-full overflow-hidden border ${hasInv2Failure ? 'border-danger/60' : 'border-border/60'}`}>
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                hasInv2Failure ? 'bg-danger' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, (obsUsage / quotaLimit) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Side-by-side Expected vs Observed Columns */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Left: Expected State (Oracle) */}
                      <div className="p-2.5 rounded-lg bg-elevated/70 border border-border/80 space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block">
                          Oracle (Expected)
                        </span>

                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-muted">Plan:</span>
                            <span className="font-mono font-bold uppercase text-primary">
                              {exp.plan || 'none'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted">Status:</span>
                            <span className="font-mono text-text">{exp.status || 'none'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted">Usage:</span>
                            <span className="font-mono text-text">{exp.usage ?? 0}</span>
                          </div>
                        </div>

                        {/* Features Tags */}
                        <div className="pt-1 border-t border-border/60">
                          <span className="text-[10px] text-muted block mb-1">Features:</span>
                          <div className="flex flex-wrap gap-1">
                            {exp.features && exp.features.length > 0 ? (
                              exp.features.map((f: string) => (
                                <span
                                  key={f}
                                  className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-surface border border-border text-text"
                                >
                                  {f}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-muted italic">none</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Observed State (SUT) */}
                      <div
                        className={`p-2.5 rounded-lg border transition-all ${
                          isDiverged
                            ? 'bg-danger/10 border-danger/40'
                            : 'bg-elevated/70 border-border/80'
                        } space-y-2`}
                      >
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider block ${
                            isDiverged ? 'text-danger' : 'text-muted'
                          }`}
                        >
                          SUT (Observed)
                        </span>

                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-muted">Plan:</span>
                            <span
                              className={`font-mono font-bold uppercase ${
                                exp.plan !== obs.plan ? 'text-danger underline' : 'text-primary'
                              }`}
                            >
                              {obs.plan || 'none'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted">Status:</span>
                            <span
                              className={`font-mono ${
                                exp.status !== obs.status ? 'text-danger font-bold' : 'text-text'
                              }`}
                            >
                              {obs.status || 'none'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted">Usage:</span>
                            <span
                              className={`font-mono ${
                                exp.usage !== obs.usage ? 'text-danger font-bold' : 'text-text'
                              }`}
                            >
                              {obs.usage ?? 0}
                            </span>
                          </div>
                        </div>

                        {/* Features Tags */}
                        <div className="pt-1 border-t border-border/60">
                          <span className="text-[10px] text-muted block mb-1">Features:</span>
                          <div className="flex flex-wrap gap-1">
                            {obs.features && obs.features.length > 0 ? (
                              obs.features.map((f: string) => {
                                const isUnexpected = !exp.features?.includes(f)
                                return (
                                  <span
                                    key={f}
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                                      isUnexpected
                                        ? 'bg-danger/20 border-danger text-danger font-bold'
                                        : 'bg-surface border-border text-text'
                                    }`}
                                  >
                                    {f}
                                  </span>
                                )
                              })
                            ) : (
                              <span className="text-[10px] text-muted italic">none</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 2. Event Log Feed */}
          <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-elevated">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-text uppercase tracking-wider">
                  Delivered Event Trace Feed ({deliveredEvents.length})
                </h3>
              </div>
              <span className="text-[11px] font-mono text-muted">Chronological Execution</span>
            </div>

            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {deliveredEvents.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  No events fired yet. Pick parameters on the left and click &ldquo;Fire Event Directly&rdquo; or load a preset.
                </div>
              ) : (
                simulationSteps.map((step) => {
                  const hasStepViolations = step.violations && step.violations.length > 0
                  const ev = step.event
                  const configBadge =
                    EVENT_TYPE_BADGES[ev.type as ValidEventType] ||
                    'bg-slate-500/15 text-slate-400 border border-slate-500/30'

                  return (
                    <div
                      key={step.step}
                      className={`p-3.5 hover:bg-elevated/50 transition-colors flex items-center justify-between gap-3 text-xs ${
                        hasStepViolations ? 'bg-danger/10 border-l-2 border-danger' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-elevated border border-border text-muted">
                          #{step.step}
                        </span>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${configBadge}`}>
                          {ev.type}
                        </span>

                        <span className="font-mono text-xs font-bold text-text">
                          Tenant {ev.tenant}
                        </span>

                        <span className="text-muted font-mono text-[11px]">
                          (id:{ev.id}, seq:{ev.seq})
                        </span>

                        {/* Payload details summary */}
                        <span className="text-[11px] text-muted truncate max-w-xs font-mono">
                          {JSON.stringify(ev.payload || {})}
                        </span>
                      </div>

                      {/* Step Result Status */}
                      <div>
                        {hasStepViolations ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-danger/20 text-danger border border-danger/30">
                            <XCircle className="w-3 h-3" />
                            <span>{step.violations[0].id}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-success/15 text-success border border-success/30">
                            <Check className="w-3 h-3" />
                            <span>OK</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
