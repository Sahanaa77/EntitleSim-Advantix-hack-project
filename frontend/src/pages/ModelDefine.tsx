import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileCode,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Save,
  Check,
  ArrowRight,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
  Copy,
  Clock,
  ArrowUp,
  ArrowDown,
  Files,
  Zap,
  LayoutGrid,
  Dices,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { validateModel, createModel } from '../lib/api'
import { ModelDefinition, ModelRecord } from '../types'
import { TemplateGalleryModal, ModelTemplate } from '../components/TemplateGalleryModal'
import { GenerateTrafficModal } from '../components/GenerateTrafficModal'

const INVARIANTS_CATALOG = [
  {
    id: 'INV-1',
    type: 'feature_access_matches_plan',
    label: 'Feature access matches plan',
    description: 'Ensures members cannot access features above their active subscription tier.',
  },
  {
    id: 'INV-2',
    type: 'usage_within_quota',
    label: 'Usage within quota',
    description: 'Enforces that meter consumption cannot exceed plan limits.',
  },
  {
    id: 'INV-3',
    type: 'tenant_isolation',
    label: 'Tenant isolation',
    description: 'Guarantees state and events for Tenant A never leak to Tenant B.',
  },
  {
    id: 'INV-4',
    type: 'no_access_after_cancel',
    label: 'No access after cancellation',
    description: 'Revokes entitlement grants once cancellation is finalized.',
  },
  {
    id: 'INV-5',
    type: 'cache_db_consistent',
    label: 'Cache consistent with database',
    description: 'Checks that cache reads always match durable database records.',
  },
]

export const VALID_EVENT_TYPES = [
  'SubscriptionCreated',
  'PlanUpgraded',
  'PlanDowngraded',
  'SubscriptionCancelled',
  'PaymentSucceeded',
  'PaymentFailed',
  'UsageRecorded',
  'AccessCheck',
] as const

export type ValidEventType = (typeof VALID_EVENT_TYPES)[number]

/**
 * Deduplicates an array of string tags case-insensitively, trimming whitespace
 * and filtering empty/falsy values.
 */
export const dedupeCaseInsensitive = (items: (string | undefined | null)[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    if (!item || typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed) continue
    const lower = trimmed.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      result.push(lower)
    }
  }
  return result
}

/**
 * Shared keydown handler for tag inputs:
 * Handles Enter and comma once, prevents default & stops propagation,
 * ignores repeat events and IME composition.
 */
export const handleTagInputKeyDown = (
  e: React.KeyboardEvent<HTMLInputElement>,
  onAdd: () => void
) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    e.stopPropagation()
    if (e.repeat) return
    if (e.nativeEvent?.isComposing || (e as any).isComposing) return
    onAdd()
  }
}

const EVENT_TYPE_CONFIG: Record<
  ValidEventType,
  { label: string; badge: string; defaultPayload: (plans: string[], features: string[]) => Record<string, any> }
> = {
  SubscriptionCreated: {
    label: 'Subscription Created',
    badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    defaultPayload: (plans) => ({ plan: plans[0] || 'free' }),
  },
  PlanUpgraded: {
    label: 'Plan Upgraded',
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    defaultPayload: (plans) => ({ plan: plans[1] || plans[0] || 'pro' }),
  },
  PlanDowngraded: {
    label: 'Plan Downgraded',
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    defaultPayload: (plans) => ({ plan: plans[0] || 'free' }),
  },
  SubscriptionCancelled: {
    label: 'Subscription Cancelled',
    badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    defaultPayload: () => ({}),
  },
  PaymentSucceeded: {
    label: 'Payment Succeeded',
    badge: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',
    defaultPayload: () => ({ amount: 29 }),
  },
  PaymentFailed: {
    label: 'Payment Failed',
    badge: 'bg-red-500/15 text-red-400 border border-red-500/30',
    defaultPayload: () => ({ amount: 29 }),
  },
  UsageRecorded: {
    label: 'Usage Recorded',
    badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    defaultPayload: () => ({ units: 10 }),
  },
  AccessCheck: {
    label: 'Access Check',
    badge: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
    defaultPayload: (_, features) => ({ feature: features[features.length - 1] || 'premium', role: 'admin' }),
  },
}

const DEFAULT_SAMPLE_MODEL: ModelDefinition = {
  name: 'saas-upgrade-demo',
  unit: 'GB',
  display: { unit: 'GB' },
  tenants: [
    { id: 'A', roles: ['admin', 'member'] },
    { id: 'B', roles: ['admin', 'member'] },
  ],
  feature_roles: {
    premium: ['admin', 'member'],
  },
  plans: {
    free: { features: ['basic'], quota: { api_calls: 100 } },
    pro: { features: ['basic', 'premium'], quota: { api_calls: 1000 } },
  },
  transitions: [
    ['none', 'free'],
    ['free', 'pro'],
    ['pro', 'free'],
    ['free', 'cancelled'],
    ['pro', 'cancelled'],
  ],
  policies: {
    grace_period_events: 1,
    trial_events: 0,
    prepaid_credits: 0,
  },
  scenario: [
    { id: 'e1', tenant: 'A', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'free' } },
    { id: 'e2', tenant: 'A', customer_id: 'c1', seq: 2, type: 'PlanUpgraded', payload: { plan: 'pro' } },
    { id: 'e3', tenant: 'A', customer_id: 'c1', seq: 3, type: 'PlanDowngraded', payload: { plan: 'free' } },
    { id: 'e4', tenant: 'A', customer_id: 'c1', seq: 4, type: 'AccessCheck', payload: { feature: 'premium', role: 'admin' } },
    { id: 'e5', tenant: 'A', customer_id: 'c1', seq: 5, type: 'UsageRecorded', payload: { units: 10 } },
    { id: 'e6', tenant: 'A', customer_id: 'c1', seq: 6, type: 'PaymentSucceeded', payload: { amount: 29 } },
    { id: 'e7', tenant: 'B', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'free' } },
  ],
  invariants: [
    { id: 'INV-1', type: 'feature_access_matches_plan' },
    { id: 'INV-2', type: 'usage_within_quota' },
    { id: 'INV-3', type: 'tenant_isolation' },
    { id: 'INV-4', type: 'no_access_after_cancel' },
    { id: 'INV-5', type: 'cache_db_consistent' },
  ],
}

interface TenantItem {
  id: string
  roles: string[]
  newRole: string
}

interface PlanItem {
  name: string
  features: string[]
  quota: number
  newFeature: string
}

interface ScenarioEventItem {
  id: string
  tenant: string
  customer_id: string
  seq: number
  type: ValidEventType
  payload: Record<string, any>
}

export const ModelDefine: React.FC = () => {
  const navigate = useNavigate()
  const { currentModel, setCurrentModel, fetchModels, models, toast } = useApp()

  // Form State
  const [modelName, setModelName] = useState('saas-upgrade-demo')
  const [tenants, setTenants] = useState<TenantItem[]>([
    { id: 'A', roles: ['admin', 'member'], newRole: '' },
    { id: 'B', roles: ['admin', 'member'], newRole: '' },
  ])
  const [plans, setPlans] = useState<PlanItem[]>([
    { name: 'free', features: ['basic'], quota: 100, newFeature: '' },
    { name: 'pro', features: ['basic', 'premium'], quota: 1000, newFeature: '' },
  ])
  const [transitionPairs, setTransitionPairs] = useState<Set<string>>(
    new Set(['none->free', 'free->pro', 'pro->free', 'free->cancelled', 'pro->cancelled'])
  )
  const [policies, setPolicies] = useState({
    grace_period_events: 1,
    trial_events: 0,
    prepaid_credits: 0,
  })
  const [selectedInvariants, setSelectedInvariants] = useState<Set<string>>(
    new Set(['INV-1', 'INV-2', 'INV-3', 'INV-4', 'INV-5'])
  )

  // Scenario Builder State
  const [scenario, setScenario] = useState<ScenarioEventItem[]>(
    DEFAULT_SAMPLE_MODEL.scenario.map((s) => ({
      id: s.id,
      tenant: s.tenant,
      customer_id: s.customer_id,
      seq: s.seq,
      type: s.type as ValidEventType,
      payload: { ...s.payload },
    }))
  )

  // Status & UI state
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [isJsonOpen, setIsJsonOpen] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false)
  const [isGenerateTrafficOpen, setIsGenerateTrafficOpen] = useState(false)
  const [featureRoles, setFeatureRoles] = useState<Record<string, string[]>>({
    premium: ['admin', 'member'],
  })
  const [displayUnit, setDisplayUnit] = useState<string>('GB')
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors?: string[]
    summary?: any
  } | null>(null)

  // Load a model definition into builder state
  const loadDefinitionIntoState = useCallback((def: ModelDefinition, name?: string) => {
    setModelName(name || def.name || 'custom-model')
    setDisplayUnit(def.unit || def.display?.unit || 'GB')

    if (def.feature_roles && typeof def.feature_roles === 'object') {
      const cleanFR: Record<string, string[]> = {}
      Object.entries(def.feature_roles).forEach(([feat, rList]) => {
        cleanFR[feat.trim().toLowerCase()] = dedupeCaseInsensitive(rList)
      })
      setFeatureRoles(cleanFR)
    }

    if (def.tenants && Array.isArray(def.tenants)) {
      setTenants(
        def.tenants.map((t) => ({
          id: t.id || 'A',
          roles: dedupeCaseInsensitive(t.roles || ['member']),
          newRole: '',
        }))
      )
    }

    if (def.plans && typeof def.plans === 'object') {
      const pItems: PlanItem[] = Object.entries(def.plans).map(([pName, pVal]) => ({
        name: pName,
        features: dedupeCaseInsensitive(pVal.features || []),
        quota: pVal.quota?.GB ?? pVal.quota?.api_calls ?? 100,
        newFeature: '',
      }))
      setPlans(pItems)
    }

    if (def.transitions && Array.isArray(def.transitions)) {
      const set = new Set<string>()
      def.transitions.forEach(([from, to]) => set.add(`${from}->${to}`))
      setTransitionPairs(set)
    }

    if (def.policies) {
      setPolicies({
        grace_period_events: def.policies.grace_period_events ?? 1,
        trial_events: def.policies.trial_events ?? 0,
        prepaid_credits: def.policies.prepaid_credits ?? 0,
      })
    }

    if (def.invariants && Array.isArray(def.invariants)) {
      setSelectedInvariants(new Set(def.invariants.map((inv) => inv.id)))
    }

    if (def.scenario && Array.isArray(def.scenario)) {
      setScenario(
        def.scenario.map((s) => ({
          id: s.id,
          tenant: s.tenant,
          customer_id: s.customer_id,
          seq: s.seq,
          type: (VALID_EVENT_TYPES.includes(s.type as any) ? s.type : 'SubscriptionCreated') as ValidEventType,
          payload: { ...(s.payload || {}) },
        }))
      )
    } else {
      setScenario(
        DEFAULT_SAMPLE_MODEL.scenario.map((s) => ({
          id: s.id,
          tenant: s.tenant,
          customer_id: s.customer_id,
          seq: s.seq,
          type: s.type as ValidEventType,
          payload: { ...s.payload },
        }))
      )
    }
  }, [])

  // Sync from context currentModel on mount or selection change
  useEffect(() => {
    if (currentModel?.definition) {
      loadDefinitionIntoState(currentModel.definition, currentModel.name)
    } else {
      loadDefinitionIntoState(DEFAULT_SAMPLE_MODEL)
    }
  }, [currentModel, loadDefinitionIntoState])

  // Derive all feature names from current plans
  const allFeatures = useMemo(() => {
    const set = new Set<string>()
    plans.forEach((p) => p.features.forEach((f) => set.add(f)))
    if (set.size === 0) set.add('basic')
    return Array.from(set)
  }, [plans])

  const planNames = useMemo(() => plans.map((p) => p.name.trim()).filter(Boolean), [plans])

  // Build canonical ModelDefinition object
  const builtDefinition: ModelDefinition = useMemo(() => {
    const plansObj: Record<string, { features: string[]; quota: Record<string, number> }> = {}
    plans.forEach((p) => {
      const pName = p.name.trim() || 'unnamed'
      plansObj[pName] = {
        features: dedupeCaseInsensitive(p.features),
        quota: { api_calls: Number(p.quota) || 0, [displayUnit]: Number(p.quota) || 0 },
      }
    })

    const transitionsArr: [string, string][] = Array.from(transitionPairs).map((pair) => {
      const [from, to] = pair.split('->')
      return [from, to] as [string, string]
    })

    const invariantsArr = INVARIANTS_CATALOG.filter((inv) => selectedInvariants.has(inv.id)).map(
      (inv) => ({
        id: inv.id,
        type: inv.type,
      })
    )

    const cleanFeatureRoles: Record<string, string[]> = {}
    if (featureRoles && typeof featureRoles === 'object') {
      Object.entries(featureRoles).forEach(([feat, rList]) => {
        cleanFeatureRoles[feat.trim().toLowerCase()] = dedupeCaseInsensitive(rList)
      })
    }

    return {
      name: modelName.trim() || 'custom-model',
      unit: displayUnit,
      display: { unit: displayUnit },
      tenants: tenants.map((t) => ({
        id: t.id.trim() || 'T',
        roles: dedupeCaseInsensitive(t.roles),
      })),
      feature_roles: cleanFeatureRoles,
      plans: plansObj,
      transitions: transitionsArr,
      policies: {
        grace_period_events: Number(policies.grace_period_events) || 0,
        trial_events: Number(policies.trial_events) || 0,
        prepaid_credits: Number(policies.prepaid_credits) || 0,
      },
      scenario: scenario.map((e) => ({
        id: e.id.trim() || 'e',
        tenant: e.tenant.trim() || 'A',
        customer_id: e.customer_id.trim() || 'c1',
        seq: Number(e.seq) || 1,
        type: e.type,
        payload: { ...e.payload },
      })),
      invariants: invariantsArr,
    }
  }, [modelName, tenants, plans, transitionPairs, policies, selectedInvariants, scenario, featureRoles, displayUnit])

  // Live debounced validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await validateModel(builtDefinition)
        setValidationResult(res)
      } catch (err: any) {
        setValidationResult({
          valid: false,
          errors: [err.message || 'Validation request failed'],
        })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [builtDefinition])

  // Tenant handlers
  const handleAddTenant = () => {
    const nextId = String.fromCharCode(65 + tenants.length) // A, B, C...
    setTenants((prev) => [...prev, { id: nextId, roles: ['admin', 'member'], newRole: '' }])
  }

  const handleRemoveTenant = (index: number) => {
    setTenants((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateTenantId = (index: number, val: string) => {
    const oldId = tenants[index].id
    setTenants((prev) => {
      const updated = [...prev]
      updated[index].id = val
      return updated
    })
    // Also update events using old tenant id
    if (oldId && val) {
      setScenario((prev) =>
        prev.map((ev) => (ev.tenant === oldId ? { ...ev, tenant: val } : ev))
      )
    }
  }

  const handleAddRoleTag = (index: number) => {
    const rawVal = tenants[index]?.newRole ?? ''
    const val = rawVal.trim().toLowerCase()
    if (!val) return
    setTenants((prev) => {
      const target = prev[index]
      if (!target) return prev
      const currentRoles = target.roles || []
      const alreadyHas = currentRoles.some((r) => r.trim().toLowerCase() === val)
      return prev.map((t, i) =>
        i === index
          ? {
              ...t,
              roles: alreadyHas ? dedupeCaseInsensitive(t.roles) : dedupeCaseInsensitive([...t.roles, val]),
              newRole: '',
            }
          : t
      )
    })
  }

  const handleRemoveRoleTag = (tenantIdx: number, roleIdx: number) => {
    setTenants((prev) =>
      prev.map((t, i) =>
        i === tenantIdx ? { ...t, roles: t.roles.filter((_, idx) => idx !== roleIdx) } : t
      )
    )
  }

  // Plan handlers
  const handleAddPlan = () => {
    setPlans((prev) => [
      ...prev,
      { name: `tier_${prev.length + 1}`, features: ['basic'], quota: 500, newFeature: '' },
    ])
  }

  const handleRemovePlan = (index: number) => {
    const planToRemove = plans[index]?.name
    setPlans((prev) => prev.filter((_, i) => i !== index))
    // Also clean up transitions referencing this removed plan
    if (planToRemove) {
      setTransitionPairs((prev) => {
        const next = new Set<string>()
        prev.forEach((pair) => {
          const [from, to] = pair.split('->')
          if (from !== planToRemove && to !== planToRemove) {
            next.add(pair)
          }
        })
        return next
      })
    }
  }

  const handleUpdatePlanName = (index: number, val: string) => {
    const oldName = plans[index].name
    const newName = val.trim().toLowerCase()
    setPlans((prev) => {
      const updated = [...prev]
      updated[index].name = newName
      return updated
    })
    // Update transitions matching old plan name
    if (oldName && newName && oldName !== newName) {
      setTransitionPairs((prev) => {
        const next = new Set<string>()
        prev.forEach((pair) => {
          const [from, to] = pair.split('->')
          const f = from === oldName ? newName : from
          const t = to === oldName ? newName : to
          next.add(`${f}->${t}`)
        })
        return next
      })
      // Update scenario event payloads referencing old plan
      setScenario((prev) =>
        prev.map((ev) =>
          ev.payload?.plan === oldName ? { ...ev, payload: { ...ev.payload, plan: newName } } : ev
        )
      )
    }
  }

  const handleUpdatePlanQuota = (index: number, val: number) => {
    setPlans((prev) => {
      const updated = [...prev]
      updated[index].quota = val
      return updated
    })
  }

  const handleAddFeatureTag = (index: number) => {
    const rawVal = plans[index]?.newFeature ?? ''
    const val = rawVal.trim().toLowerCase()
    if (!val) return
    setPlans((prev) => {
      const target = prev[index]
      if (!target) return prev
      const currentFeatures = target.features || []
      const alreadyHas = currentFeatures.some((f) => f.trim().toLowerCase() === val)
      return prev.map((p, i) =>
        i === index
          ? {
              ...p,
              features: alreadyHas ? dedupeCaseInsensitive(p.features) : dedupeCaseInsensitive([...p.features, val]),
              newFeature: '',
            }
          : p
      )
    })
  }

  const handleRemoveFeatureTag = (planIdx: number, featIdx: number) => {
    setPlans((prev) =>
      prev.map((p, i) =>
        i === planIdx ? { ...p, features: p.features.filter((_, idx) => idx !== featIdx) } : p
      )
    )
  }

  // Transitions Grid
  const transitionStates = useMemo(() => {
    return ['none', ...planNames, 'cancelled']
  }, [planNames])

  const toggleTransition = (from: string, to: string) => {
    const key = `${from}->${to}`
    setTransitionPairs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Invariant checklist handler
  const toggleInvariant = (id: string) => {
    setSelectedInvariants((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Scenario Builder Handlers
  const handleAddEvent = (type?: ValidEventType) => {
    const eventType = type || 'SubscriptionCreated'
    const targetTenant = tenants[0]?.id || 'A'
    const tenantEvents = scenario.filter((e) => e.tenant === targetTenant)
    const nextSeq = tenantEvents.length > 0 ? Math.max(...tenantEvents.map((e) => e.seq)) + 1 : 1
    const nextId = `e${scenario.length + 1}`
    const defaultPayload = EVENT_TYPE_CONFIG[eventType].defaultPayload(planNames, allFeatures)

    const newEv: ScenarioEventItem = {
      id: nextId,
      tenant: targetTenant,
      customer_id: 'c1',
      seq: nextSeq,
      type: eventType,
      payload: defaultPayload,
    }

    setScenario((prev) => [...prev, newEv])
  }

  const handleDeleteEvent = (index: number) => {
    setScenario((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDuplicateEvent = (index: number) => {
    const source = scenario[index]
    const tenantEvents = scenario.filter((e) => e.tenant === source.tenant)
    const nextSeq = tenantEvents.length > 0 ? Math.max(...tenantEvents.map((e) => e.seq)) + 1 : source.seq + 1
    const cloned: ScenarioEventItem = {
      ...source,
      id: `e${scenario.length + 1}`,
      seq: nextSeq,
      payload: { ...source.payload },
    }

    setScenario((prev) => [...prev.slice(0, index + 1), cloned, ...prev.slice(index + 1)])
  }

  const handleReorderEvent = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === scenario.length - 1) return

    setScenario((prev) => {
      const updated = [...prev]
      const targetIdx = direction === 'up' ? index - 1 : index + 1
      const temp = updated[index]
      updated[index] = updated[targetIdx]
      updated[targetIdx] = temp
      return updated
    })
  }

  const handleUpdateEventField = (
    index: number,
    field: keyof ScenarioEventItem,
    value: any
  ) => {
    setScenario((prev) => {
      const updated = [...prev]
      const current = { ...updated[index] }

      if (field === 'type') {
        const newType = value as ValidEventType
        current.type = newType
        current.payload = EVENT_TYPE_CONFIG[newType].defaultPayload(planNames, allFeatures)
      } else if (field === 'tenant') {
        current.tenant = value
        // Auto-assign next seq for the selected tenant
        const tenantEvents = prev.filter((e, i) => i !== index && e.tenant === value)
        current.seq = tenantEvents.length > 0 ? Math.max(...tenantEvents.map((e) => e.seq)) + 1 : 1
      } else {
        ;(current as any)[field] = value
      }

      updated[index] = current
      return updated
    })
  }

  const handleUpdatePayloadField = (index: number, key: string, value: any) => {
    setScenario((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        payload: {
          ...updated[index].payload,
          [key]: value,
        },
      }
      return updated
    })
  }

  const handleNormalizeSeqs = () => {
    setScenario((prev) => {
      const tenantCounters: Record<string, number> = {}
      return prev.map((ev) => {
        tenantCounters[ev.tenant] = (tenantCounters[ev.tenant] || 0) + 1
        return {
          ...ev,
          seq: tenantCounters[ev.tenant],
        }
      })
    })
  }

  // Scenario Stats
  const coveredTenants = useMemo(() => new Set(scenario.map((e) => e.tenant)), [scenario])
  const tenantCoveredCount = coveredTenants.size

  // Save handler
  const handleSave = async () => {
    setIsSaving(true)
    try {
      setTenants((prev) =>
        prev.map((t) => ({
          ...t,
          roles: dedupeCaseInsensitive(t.roles),
        }))
      )
      setPlans((prev) =>
        prev.map((p) => ({
          ...p,
          features: dedupeCaseInsensitive(p.features),
        }))
      )
      const name = modelName.trim() || 'custom-model'
      const newRec = await createModel(name, builtDefinition)
      await fetchModels()
      setCurrentModel(newRec)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
      toast('Model Saved', `Model "${name}" saved to database`, 'success')
    } catch (err: any) {
      setValidationResult({
        valid: false,
        errors: [err.message || 'Failed to save model'],
      })
      toast('Save Failed', err.message || 'Failed to save model', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Load sample model
  const handleLoadSample = () => {
    loadDefinitionIntoState(DEFAULT_SAMPLE_MODEL)
    toast('Sample Loaded', 'Loaded default SaaS subscription model with 2 tenants and 5 invariants', 'info')
  }

  // Copy raw JSON
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(builtDefinition, null, 2))
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Model & Scenario Builder</h1>
          <p className="text-sm text-muted mt-1">
            Build and validate multi-tenant subscription tiers, state transitions, scenario event schedules, and first-class invariant rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTemplateGalleryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 shadow-xs cursor-pointer transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-primary" />
            <span>Template Gallery</span>
          </button>
          <button
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text bg-elevated border border-border rounded-lg hover:bg-elevated/80 shadow-xs cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Load Sample</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedSuccess ? 'Saved!' : isSaving ? 'Saving...' : 'Save Model'}</span>
          </button>
          <button
            onClick={() => navigate('/verification/explore')}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs cursor-pointer transition-colors"
          >
            <span>Proceed to Explore</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Validation Alert Banner */}
      {validationResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
            validationResult.valid
              ? 'bg-success/15 border-success/30 text-success'
              : 'bg-danger/15 border-danger/30 text-danger'
          }`}
        >
          {validationResult.valid ? (
            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-text">
              {validationResult.valid ? 'Model & Scenario Validated & Ready' : 'Validation Errors Detected'}
            </div>
            {validationResult.valid ? (
              <p className="mt-0.5 text-muted">
                Engine ready for bounded exploration: {tenants.length} tenants, {plans.length} tiers,{' '}
                {transitionPairs.size} allowed transitions, {scenario.length} scenario events ({tenantCoveredCount} tenants covered), {selectedInvariants.size} active invariants.
              </p>
            ) : (
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-danger font-mono">
                {validationResult.errors?.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Main 2-Column Grid: Left Builder Form | Right Summary & Saved Models */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Builder Sections */}
        <div className="lg:col-span-8 space-y-5">
          {/* Model Name Card */}
          <div className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-2">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
              Model Name / Identifier
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. saas-upgrade-demo"
              className="w-full px-3 py-2 text-xs font-mono bg-elevated border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Section 1: Tenants */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-sm font-bold text-text">1. Tenants & Roles</h2>
                <p className="text-[11px] text-muted">Define tenant identifiers and associated access roles.</p>
              </div>
              <button
                onClick={handleAddTenant}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tenant</span>
              </button>
            </div>

            <div className="space-y-3">
              {tenants.map((tenant, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-elevated border border-border flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted">ID:</span>
                    <input
                      type="text"
                      value={tenant.id}
                      onChange={(e) => handleUpdateTenantId(idx, e.target.value)}
                      className="w-20 px-2 py-1 text-xs font-mono font-bold bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Roles as tags */}
                  <div className="flex-1 flex flex-wrap items-center gap-1.5">
                    {tenant.roles.map((role, rIdx) => (
                      <span
                        key={rIdx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-mono text-text"
                      >
                        <span>{role}</span>
                        <button
                          onClick={() => handleRemoveRoleTag(idx, rIdx)}
                          className="hover:text-danger text-muted ml-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}

                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Add role + enter"
                        value={tenant.newRole}
                        onChange={(e) => {
                          const val = e.target.value
                          setTenants((prev) =>
                            prev.map((t, i) => (i === idx ? { ...t, newRole: val } : t))
                          )
                        }}
                        onKeyDown={(e) => handleTagInputKeyDown(e, () => handleAddRoleTag(idx))}
                        className="w-28 px-2 py-1 text-[11px] bg-surface border border-border rounded text-text placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {tenants.length > 1 && (
                    <button
                      onClick={() => handleRemoveTenant(idx)}
                      className="p-1.5 text-muted hover:text-danger rounded-md hover:bg-surface transition-colors cursor-pointer shrink-0"
                      title="Remove tenant"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Plans & Quotas */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-sm font-bold text-text">2. Subscription Plans & Quotas</h2>
                <p className="text-[11px] text-muted">Configure plan names, feature entitlement tags, and API-call quota caps.</p>
              </div>
              <button
                onClick={handleAddPlan}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Plan</span>
              </button>
            </div>

            <div className="space-y-3">
              {plans.map((plan, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-elevated border border-border space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted">Tier:</span>
                      <input
                        type="text"
                        value={plan.name}
                        onChange={(e) => handleUpdatePlanName(idx, e.target.value)}
                        className="w-28 px-2 py-1 text-xs font-mono font-bold uppercase bg-surface border border-border rounded text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted">Quota ({displayUnit}):</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={plan.quota}
                        onChange={(e) => handleUpdatePlanQuota(idx, Number(e.target.value))}
                        className="w-24 px-2 py-1 text-xs font-mono bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    {plans.length > 1 && (
                      <button
                        onClick={() => handleRemovePlan(idx)}
                        className="p-1.5 text-muted hover:text-danger rounded-md hover:bg-surface transition-colors cursor-pointer"
                        title="Remove plan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Features tags */}
                  <div>
                    <span className="text-[11px] text-muted block mb-1.5">Entitled Features:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {plan.features.map((feat, fIdx) => (
                        <span
                          key={fIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/15 border border-primary/25 text-[11px] font-mono text-primary font-semibold"
                        >
                          <span>{feat}</span>
                          <button
                            onClick={() => handleRemoveFeatureTag(idx, fIdx)}
                            className="hover:text-danger text-primary/70 ml-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}

                      <input
                        type="text"
                        placeholder="Add feature + enter"
                        value={plan.newFeature}
                        onChange={(e) => {
                          const val = e.target.value
                          setPlans((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, newFeature: val } : p))
                          )
                        }}
                        onKeyDown={(e) => handleTagInputKeyDown(e, () => handleAddFeatureTag(idx))}
                        className="w-32 px-2 py-1 text-[11px] bg-surface border border-border rounded text-text placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Allowed Transitions Grid */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
            <div className="pb-3 border-b border-border">
              <h2 className="text-sm font-bold text-text">3. Allowed State Transitions Matrix</h2>
              <p className="text-[11px] text-muted">
                Check the allowed transitions between initial (none), subscription plans, and cancelled status.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2.5 font-semibold text-muted bg-elevated rounded-tl-lg font-mono">
                      From \ To
                    </th>
                    {transitionStates.map((toState) => (
                      <th key={toState} className="p-2.5 text-center font-bold text-primary font-mono uppercase bg-elevated">
                        {toState}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {transitionStates.map((fromState) => (
                    <tr key={fromState} className="hover:bg-elevated/40 transition-colors">
                      <td className="p-2.5 font-bold text-text bg-elevated/60 uppercase">
                        {fromState}
                      </td>
                      {transitionStates.map((toState) => {
                        const isSelf = fromState === toState
                        const isChecked = transitionPairs.has(`${fromState}->${toState}`)

                        return (
                          <td key={toState} className="p-2.5 text-center">
                            {isSelf ? (
                              <span className="text-muted/40 select-none">&mdash;</span>
                            ) : (
                              <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleTransition(fromState, toState)}
                                  className="w-4 h-4 rounded accent-primary text-primary focus:ring-primary cursor-pointer"
                                />
                              </label>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Policies */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
            <div className="pb-3 border-b border-border">
              <h2 className="text-sm font-bold text-text">4. Entitlement Policies</h2>
              <p className="text-[11px] text-muted">Configurable grace periods, trial event allowances, and prepaid credit pools.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 bg-elevated rounded-lg border border-border space-y-1.5">
                <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Grace Period Events</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={policies.grace_period_events}
                  onChange={(e) =>
                    setPolicies((prev) => ({ ...prev, grace_period_events: Number(e.target.value) }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] text-muted block">Events allowed after billing lapse</span>
              </div>

              <div className="p-3.5 bg-elevated rounded-lg border border-border space-y-1.5">
                <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-warn" />
                  <span>Trial Length Events</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={policies.trial_events}
                  onChange={(e) =>
                    setPolicies((prev) => ({ ...prev, trial_events: Number(e.target.value) }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] text-muted block">Trial sequence headroom</span>
              </div>

              <div className="p-3.5 bg-elevated rounded-lg border border-border space-y-1.5">
                <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-success" />
                  <span>Prepaid Credits</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={policies.prepaid_credits}
                  onChange={(e) =>
                    setPolicies((prev) => ({ ...prev, prepaid_credits: Number(e.target.value) }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] text-muted block">Upfront quota units granted</span>
              </div>
            </div>
          </div>

          {/* Section 5: Invariants Checklist */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
            <div className="pb-3 border-b border-border">
              <h2 className="text-sm font-bold text-text">5. Verification Invariants (Safety Rules)</h2>
              <p className="text-[11px] text-muted">
                Select the safety invariants that the bounded exploration engine must mathematically verify.
              </p>
            </div>

            <div className="space-y-2.5">
              {INVARIANTS_CATALOG.map((inv) => {
                const isChecked = selectedInvariants.has(inv.id)

                return (
                  <label
                    key={inv.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-primary/10 border-primary/30 shadow-xs'
                        : 'bg-elevated border-border hover:border-border/80'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleInvariant(inv.id)}
                      className="mt-0.5 rounded accent-primary text-primary focus:ring-primary w-4 h-4 cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-surface border border-border text-primary">
                          {inv.id}
                        </span>
                        <span className="text-xs font-bold text-text">{inv.label}</span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{inv.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Section 6: Scenario Builder (Table of Events) */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold text-text">6. Scenario Event Sequence</h2>
                </div>
                <p className="text-[11px] text-muted mt-0.5">
                  Ordered event trace evaluated by the bounded exploration engine.
                </p>
              </div>

              {/* Live Counters */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-elevated border border-border text-text text-xs font-mono font-semibold">
                  {scenario.length} Events
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${
                    tenantCoveredCount === tenants.length && tenants.length > 0
                      ? 'bg-success/15 border-success/30 text-success'
                      : 'bg-primary/15 border-primary/30 text-primary'
                  }`}
                >
                  {tenantCoveredCount} / {tenants.length} Tenants Covered
                </span>
                <button
                  type="button"
                  onClick={() => setIsGenerateTrafficOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-colors cursor-pointer"
                  title="Generate realistic traffic events based on tenants, event count, and seed"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>Generate Traffic</span>
                </button>
                <button
                  onClick={handleNormalizeSeqs}
                  className="px-2.5 py-1 text-xs font-medium text-muted hover:text-text bg-elevated hover:bg-elevated/80 border border-border rounded-lg transition-colors cursor-pointer"
                  title="Renumber seq per-tenant (1, 2, 3...) sequentially based on row order"
                >
                  Renumber Seqs
                </button>
              </div>
            </div>

            {/* Quick Add Buttons Per Type */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">
                Quick Add Event by Type:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-elevated/60 border border-border rounded-lg">
                {VALID_EVENT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleAddEvent(type)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-all hover:brightness-125 cursor-pointer shadow-xs ${EVENT_TYPE_CONFIG[type].badge}`}
                    title={`Add a new ${type} event to the end of the sequence`}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Events Table */}
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-elevated border-b border-border text-[11px] text-muted font-mono uppercase">
                    <th className="py-2.5 px-3 text-center w-12">#</th>
                    <th className="py-2.5 px-2 w-14 text-center">Seq</th>
                    <th className="py-2.5 px-2 w-16">ID</th>
                    <th className="py-2.5 px-3 w-24">Tenant</th>
                    <th className="py-2.5 px-3 w-20">Customer</th>
                    <th className="py-2.5 px-3 w-48">Event Type</th>
                    <th className="py-2.5 px-3">Payload Parameters</th>
                    <th className="py-2.5 px-3 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {scenario.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-muted">
                        No events in scenario. Click any &ldquo;+ Quick Add&rdquo; button above to create events.
                      </td>
                    </tr>
                  ) : (
                    scenario.map((ev, idx) => {
                      const isFirst = idx === 0
                      const isLast = idx === scenario.length - 1
                      const config = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.SubscriptionCreated

                      return (
                        <tr key={idx} className="hover:bg-elevated/40 transition-colors">
                          {/* Order Buttons */}
                          <td className="py-2 px-1 text-center font-mono text-[11px] text-muted select-none">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                onClick={() => handleReorderEvent(idx, 'up')}
                                disabled={isFirst}
                                className="p-1 hover:text-text disabled:opacity-20 transition-colors cursor-pointer"
                                title="Move event up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleReorderEvent(idx, 'down')}
                                disabled={isLast}
                                className="p-1 hover:text-text disabled:opacity-20 transition-colors cursor-pointer"
                                title="Move event down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Seq */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={ev.seq}
                              onChange={(e) => handleUpdateEventField(idx, 'seq', Number(e.target.value))}
                              className="w-12 px-1.5 py-1 text-center font-mono font-bold text-xs bg-elevated border border-border rounded text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              title="Tenant event sequence order number"
                            />
                          </td>

                          {/* Event ID */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={ev.id}
                              onChange={(e) => handleUpdateEventField(idx, 'id', e.target.value)}
                              className="w-14 px-1.5 py-1 font-mono text-xs bg-elevated border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                              title="Event identifier"
                            />
                          </td>

                          {/* Tenant dropdown */}
                          <td className="py-2 px-3">
                            <select
                              value={ev.tenant}
                              onChange={(e) => handleUpdateEventField(idx, 'tenant', e.target.value)}
                              className="w-full px-2 py-1 text-xs font-mono font-bold bg-elevated border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                              {tenants.map((t) => (
                                <option key={t.id} value={t.id}>
                                  Tenant {t.id}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Customer ID */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={ev.customer_id}
                              onChange={(e) => handleUpdateEventField(idx, 'customer_id', e.target.value)}
                              className="w-16 px-1.5 py-1 font-mono text-xs bg-elevated border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder="c1"
                            />
                          </td>

                          {/* Event Type dropdown + badge */}
                          <td className="py-2 px-3">
                            <div className="flex flex-col gap-1">
                              <select
                                value={ev.type}
                                onChange={(e) => handleUpdateEventField(idx, 'type', e.target.value)}
                                className="w-full px-2 py-1 text-xs font-semibold bg-elevated border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                              >
                                {VALID_EVENT_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-center font-semibold ${config.badge}`}
                              >
                                {config.label}
                              </span>
                            </div>
                          </td>

                          {/* Conditional Payload Inputs */}
                          <td className="py-2 px-3">
                            {/* Plan-based events */}
                            {(ev.type === 'SubscriptionCreated' ||
                              ev.type === 'PlanUpgraded' ||
                              ev.type === 'PlanDowngraded') && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted uppercase font-semibold">Plan:</span>
                                <select
                                  value={ev.payload?.plan || planNames[0] || 'free'}
                                  onChange={(e) => handleUpdatePayloadField(idx, 'plan', e.target.value)}
                                  className="px-2 py-1 text-xs font-mono font-bold uppercase bg-elevated border border-border rounded text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                >
                                  {planNames.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* AccessCheck event */}
                            {ev.type === 'AccessCheck' && (
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted uppercase font-semibold">Feature:</span>
                                  <select
                                    value={ev.payload?.feature || allFeatures[0] || 'premium'}
                                    onChange={(e) => handleUpdatePayloadField(idx, 'feature', e.target.value)}
                                    className="px-2 py-1 text-xs font-mono bg-elevated border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                  >
                                    {allFeatures.map((f) => (
                                      <option key={f} value={f}>
                                        {f}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted uppercase font-semibold">Role:</span>
                                  <input
                                    type="text"
                                    value={ev.payload?.role || 'admin'}
                                    onChange={(e) => handleUpdatePayloadField(idx, 'role', e.target.value)}
                                    className="w-16 px-1.5 py-1 text-xs font-mono bg-elevated border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                              </div>
                            )}

                            {/* UsageRecorded event */}
                            {ev.type === 'UsageRecorded' && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted uppercase font-semibold">Units:</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={ev.payload?.units ?? 10}
                                  onChange={(e) =>
                                    handleUpdatePayloadField(idx, 'units', Number(e.target.value))
                                  }
                                  className="w-20 px-2 py-1 text-xs font-mono bg-elevated border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            )}

                            {/* Payment events */}
                            {(ev.type === 'PaymentSucceeded' || ev.type === 'PaymentFailed') && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted uppercase font-semibold">Amount:</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-muted text-xs">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={ev.payload?.amount ?? 29}
                                    onChange={(e) =>
                                      handleUpdatePayloadField(idx, 'amount', Number(e.target.value))
                                    }
                                    className="w-16 px-2 py-1 text-xs font-mono bg-elevated border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                              </div>
                            )}

                            {/* SubscriptionCancelled event */}
                            {ev.type === 'SubscriptionCancelled' && (
                              <span className="text-[11px] text-muted italic">No payload parameters required</span>
                            )}
                          </td>

                          {/* Row Actions */}
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleDuplicateEvent(idx)}
                                className="p-1.5 text-muted hover:text-primary rounded-md hover:bg-elevated transition-colors cursor-pointer"
                                title="Duplicate this event"
                              >
                                <Files className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(idx)}
                                className="p-1.5 text-muted hover:text-danger rounded-md hover:bg-elevated transition-colors cursor-pointer"
                                title="Delete this event"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Add Event Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleAddEvent()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Event to Sequence</span>
              </button>
            </div>
          </div>

          {/* Advanced (JSON Definition) Collapsed Section */}
          <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
            <button
              onClick={() => setIsJsonOpen(!isJsonOpen)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-semibold text-muted hover:text-text hover:bg-elevated/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-primary" />
                <span>Advanced (JSON Definition)</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span>{isJsonOpen ? 'Collapse' : 'Expand'}</span>
                {isJsonOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </button>

            {isJsonOpen && (
              <div className="p-4 border-t border-border bg-bg space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted font-mono">
                    Synchronized in real-time from the Model & Scenario Builder above
                  </span>
                  <button
                    onClick={handleCopyJson}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-text bg-elevated border border-border rounded hover:bg-elevated/80 transition-colors cursor-pointer"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedJson ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-lg bg-surface border border-border font-mono text-xs text-text leading-relaxed overflow-x-auto max-h-96">
                  {JSON.stringify(builtDefinition, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Model Summary & Saved Models */}
        <div className="lg:col-span-4 space-y-5">
          {/* Live Summary Panel */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-xs font-bold text-text uppercase tracking-wider">Live Model Summary</h3>
              <span className="text-[10px] font-mono text-muted uppercase">Active Spec</span>
            </div>

            {/* Quick Stat Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-elevated border border-border">
                <span className="text-muted block text-[10px] uppercase">Tenants</span>
                <span className="font-bold text-text text-base">{tenants.length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-elevated border border-border">
                <span className="text-muted block text-[10px] uppercase">Plans</span>
                <span className="font-bold text-primary text-base">{plans.length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-elevated border border-border">
                <span className="text-muted block text-[10px] uppercase">Scenario</span>
                <span className="font-bold text-warn text-base">{scenario.length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-elevated border border-border">
                <span className="text-muted block text-[10px] uppercase">Invariants</span>
                <span className="font-bold text-success text-base">{selectedInvariants.size}</span>
              </div>
            </div>

            {/* Scenario Breakdown */}
            <div className="p-3 bg-elevated rounded-lg border border-border space-y-1 text-xs">
              <div className="flex items-center justify-between text-muted text-[11px]">
                <span>Tenants In Scenario:</span>
                <span className="font-mono font-bold text-text">
                  {tenantCoveredCount} of {tenants.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted text-[11px]">
                <span>Transitions Allowed:</span>
                <span className="font-mono font-bold text-primary">{transitionPairs.size}</span>
              </div>
              <div className="flex items-center justify-between text-muted text-[11px]">
                <span>Policies Defined:</span>
                <span className="font-mono font-bold text-text">
                  grace={policies.grace_period_events}, trial={policies.trial_events}
                </span>
              </div>
            </div>

            {/* Invariants Summary list */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-muted block uppercase tracking-wider">
                Active Verification Rules
              </span>
              <div className="space-y-1">
                {Array.from(selectedInvariants).map((invId) => (
                  <div
                    key={invId}
                    className="flex items-center justify-between p-2 rounded-lg bg-elevated border border-border text-xs"
                  >
                    <span className="font-mono font-bold text-primary text-[11px]">{invId}</span>
                    <span className="text-muted text-[11px] truncate max-w-[170px]">
                      {INVARIANTS_CATALOG.find((i) => i.id === invId)?.label || invId}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Saved Models List */}
          <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-elevated">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-text uppercase tracking-wider">Saved Models ({models.length})</h3>
              </div>
              <button
                onClick={() => fetchModels()}
                className="text-[11px] text-primary hover:underline cursor-pointer"
                title="Refresh models list"
              >
                Refresh
              </button>
            </div>

            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {models.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted">
                  No saved custom models recorded. Click &ldquo;Save Model&rdquo; above to persist your model.
                </div>
              ) : (
                models.map((m: ModelRecord) => {
                  const isCurrent = currentModel?.id === m.id || modelName === m.name
                  const tenantsCount = m.definition?.tenants?.length || 0
                  const plansCount = Object.keys(m.definition?.plans || {}).length
                  const eventsCount = m.definition?.scenario?.length || 0

                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setCurrentModel(m)
                        loadDefinitionIntoState(m.definition, m.name)
                      }}
                      className={`p-3.5 hover:bg-elevated transition-colors cursor-pointer text-xs space-y-1 ${
                        isCurrent ? 'bg-primary/10 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text truncate max-w-[180px]">{m.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted font-mono">
                        <span>{tenantsCount} tenants</span>
                        <span>&middot;</span>
                        <span>{plansCount} tiers</span>
                        <span>&middot;</span>
                        <span>{eventsCount} events</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Template Gallery Modal */}
      <TemplateGalleryModal
        isOpen={isTemplateGalleryOpen}
        onClose={() => setIsTemplateGalleryOpen(false)}
        onSelectTemplate={(tmpl: ModelTemplate) => {
          loadDefinitionIntoState(tmpl.definition, tmpl.title)
          toast('Template Loaded', `Applied starter template: ${tmpl.title}`, 'info')
        }}
      />

      {/* Generate Traffic Modal */}
      <GenerateTrafficModal
        isOpen={isGenerateTrafficOpen}
        onClose={() => setIsGenerateTrafficOpen(false)}
        availableTenants={tenants.map((t) => t.id)}
        availablePlans={plans.map((p) => p.name)}
        availableFeatures={allFeatures}
        currentEventCount={scenario.length}
        onAppendEvents={(newEvents) => {
          setScenario((prev) => [...prev, ...newEvents])
          toast('Traffic Generated', `Appended ${newEvents.length} events to scenario`, 'info')
        }}
      />
    </div>
  )
}
