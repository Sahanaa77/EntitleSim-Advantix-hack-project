import { BoundsConfig, ModelDefinition, ModelRecord, Run } from '../types'

const API_BASE = '/api'

export async function checkHealth(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`)
  return res.json()
}

export async function getModels(): Promise<ModelRecord[]> {
  const res = await fetch(`${API_BASE}/models`)
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`)
  return res.json()
}

export async function createModel(name: string, definition: ModelDefinition): Promise<ModelRecord> {
  const res = await fetch(`${API_BASE}/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, definition }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail?.errors?.join(', ') || 'Failed to create model')
  }
  return res.json()
}

export async function validateModel(definition: ModelDefinition): Promise<{
  valid: boolean
  errors: string[]
  summary?: {
    tenants: string[]
    plans: string[]
    invariants: string[]
    event_count: number
  }
}> {
  const res = await fetch(`${API_BASE}/models/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition }),
  })
  if (!res.ok) throw new Error(`Validation request failed: ${res.statusText}`)
  return res.json()
}

export async function getRuns(): Promise<Run[]> {
  const res = await fetch(`${API_BASE}/runs`)
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.statusText}`)
  return res.json()
}

export async function createRun(modelId: string, bounds: BoundsConfig, fixed: boolean = false): Promise<Run> {
  const res = await fetch(`${API_BASE}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId, bounds, fixed }),
  })
  if (!res.ok) throw new Error(`Failed to create run: ${res.statusText}`)
  return res.json()
}

export async function getRun(runId: string): Promise<Run> {
  const res = await fetch(`${API_BASE}/runs/${runId}`)
  if (!res.ok) throw new Error(`Failed to fetch run: ${res.statusText}`)
  return res.json()
}

export async function minimizeCounterexample(cxId: string): Promise<{
  id: string
  original_len: number
  minimal_len: number
  minimal_trace: Record<string, any>[]
  state_diffs: any[]
  replays: number
  duration_ms: number
}> {
  const res = await fetch(`${API_BASE}/counterexamples/${cxId}/minimize`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Minimization failed: ${res.statusText}`)
  return res.json()
}

export async function rerunCounterexample(cxId: string, fixed: boolean = true): Promise<{
  passed: boolean
  trace_results: any[]
  message?: string
}> {
  const res = await fetch(`${API_BASE}/counterexamples/${cxId}/rerun`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fixed }),
  })
  if (!res.ok) throw new Error(`Rerun failed: ${res.statusText}`)
  return res.json()
}

export async function exportCounterexample(cxId: string, format: 'pytest' | 'json' = 'pytest'): Promise<{
  filename: string
  content: string
  format: string
}> {
  const res = await fetch(`${API_BASE}/counterexamples/${cxId}/export?format=${format}`)
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`)
  return res.json()
}

export async function exportSuite(runId: string): Promise<{
  files: Array<{ filename: string; content: string }>
}> {
  const res = await fetch(`${API_BASE}/runs/${runId}/export-suite`)
  if (!res.ok) throw new Error(`Suite export failed: ${res.statusText}`)
  return res.json()
}

export interface SimulateStepResult {
  step: number
  event: Record<string, any>
  expected: Record<string, any>
  observed: Record<string, any>
  violations: Array<{ id: string; tenant: string; message: string }>
}

export async function simulateEvents(
  model: ModelDefinition,
  events: Array<Record<string, any>>,
  fixed: boolean = false
): Promise<SimulateStepResult[]> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, events, fixed }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Simulation failed: ${res.statusText}`)
  }
  return res.json()
}

export async function getHandlerSource(bug: string = 'B2'): Promise<{
  bug: string
  file: string
  start_line: number
  end_line: number
  source: string
  code: string
  lines: string[]
  guard_lines?: number[]
}> {
  const res = await fetch(`${API_BASE}/handlers/source?bug=${encodeURIComponent(bug)}`)
  if (!res.ok) throw new Error(`Failed to fetch handler source: ${res.statusText}`)
  return res.json()
}

export async function resetDemoData(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/admin/reset`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Reset demo data failed: ${res.statusText}`)
  }
  return res.json()
}

