export interface Tenant {
  id: string
  roles?: string[]
}

export interface Plan {
  features: string[]
  quota?: Record<string, number>
}

export interface Invariant {
  id: string
  type: string
  description?: string
}

export interface ModelDefinition {
  name: string
  tenants: Tenant[]
  feature_roles?: Record<string, string[]>
  plans: Record<string, Plan>
  transitions?: [string, string][]
  policies?: {
    grace_period_events?: number
    trial_events?: number
    prepaid_credits?: number
  }
  scenario: Array<{
    id: string
    tenant: string
    customer_id: string
    seq: number
    type: string
    payload: Record<string, any>
  }>
  invariants: Invariant[]
  unit?: string
  display?: { unit?: string }
}

export interface ModelRecord {
  id: string
  name: string
  definition: ModelDefinition
  created_at: string
}

export interface BoundsConfig {
  max_depth: number
  max_retries: number
  allow_duplicates: boolean
  allow_reorder: boolean
  allow_interrupt: boolean
  max_states: number
  max_concurrency: number
  seed: number
}

export interface RunProgress {
  states_explored: number
  violations: number
  elapsed_ms: number
  found: Array<{
    invariant_id: string
    tenant: string
    message: string
    step: number
  }>
}

export interface RunStats {
  states_explored: number
  violations: number
  duration_ms: number
  by_depth: Array<{ depth: number; states: number }>
  by_invariant: Record<string, number>
}

export interface StateDiff {
  step: number
  event: Record<string, any>
  expected: Record<string, any>
  observed: Record<string, any>
  is_offending?: boolean
  violation?: {
    id: string
    tenant?: string
    message: string
  }
}

export interface Counterexample {
  id: string
  run_id: string
  invariant_id: string
  original_trace: Array<Record<string, any>>
  minimal_trace?: Array<Record<string, any>>
  state_diffs?: StateDiff[]
  created_at: string
}

export interface Run {
  id: string
  run_id?: string
  model_id: string
  bounds: BoundsConfig
  fixed: boolean
  status: 'running' | 'done' | 'failed'
  progress?: RunProgress
  stats?: RunStats
  counterexamples: Counterexample[]
  created_at: string
}

export type StepId = 1 | 2 | 3 | 4 | 5 | 6

export interface StepInfo {
  id: StepId
  title: string
  path: string
}
