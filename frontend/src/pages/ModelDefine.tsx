import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCode, CheckCircle2, AlertCircle, Sparkles, Save, Check, ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { validateModel, createModel } from '../lib/api'

const DEFAULT_SAMPLE_MODEL = {
  name: "saas-upgrade-demo",
  tenants: [
    { id: "A", roles: ["admin", "member"] },
    { id: "B", roles: ["admin", "member"] }
  ],
  feature_roles: {
    premium: ["admin", "member"]
  },
  plans: {
    free: { features: ["basic"], quota: { api_calls: 100 } },
    pro: { features: ["basic", "premium"], quota: { api_calls: 1000 } }
  },
  transitions: [
    ["none", "free"],
    ["free", "pro"],
    ["pro", "free"],
    ["free", "cancelled"],
    ["pro", "cancelled"]
  ],
  policies: {
    grace_period_events: 1,
    trial_events: 0,
    prepaid_credits: 0
  },
  scenario: [
    { id: "e1", tenant: "A", customer_id: "c1", seq: 1, type: "SubscriptionCreated", payload: { plan: "free" } },
    { id: "e2", tenant: "A", customer_id: "c1", seq: 2, type: "PlanUpgraded", payload: { plan: "pro" } },
    { id: "e3", tenant: "A", customer_id: "c1", seq: 3, type: "PlanDowngraded", payload: { plan: "free" } },
    { id: "e4", tenant: "A", customer_id: "c1", seq: 4, type: "AccessCheck", payload: { feature: "premium", role: "admin" } },
    { id: "e5", tenant: "A", customer_id: "c1", seq: 5, type: "UsageRecorded", payload: { units: 10 } },
    { id: "e6", tenant: "A", customer_id: "c1", seq: 6, type: "PaymentSucceeded", payload: { amount: 29 } },
    { id: "e7", tenant: "B", customer_id: "c1", seq: 1, type: "SubscriptionCreated", payload: { plan: "free" } }
  ],
  invariants: [
    { id: "INV-1", type: "feature_access_matches_plan" },
    { id: "INV-2", type: "usage_within_quota" },
    { id: "INV-3", type: "tenant_isolation" },
    { id: "INV-4", type: "no_access_after_cancel" },
    { id: "INV-5", type: "cache_db_consistent" }
  ]
}

export const ModelDefine: React.FC = () => {
  const navigate = useNavigate()
  const { currentModel, setCurrentModel, fetchModels, models } = useApp()

  const [modelJson, setModelJson] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors?: string[]
    summary?: any
  } | null>(null)

  useEffect(() => {
    if (currentModel) {
      setModelJson(JSON.stringify(currentModel.definition, null, 2))
    } else {
      setModelJson(JSON.stringify(DEFAULT_SAMPLE_MODEL, null, 2))
    }
  }, [currentModel])

  const handleValidate = async () => {
    setIsValidating(true)
    setValidationResult(null)
    try {
      const parsed = JSON.parse(modelJson)
      const res = await validateModel(parsed)
      setValidationResult(res)
    } catch (err: any) {
      setValidationResult({
        valid: false,
        errors: [err.message || 'Invalid JSON format'],
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const parsed = JSON.parse(modelJson)
      const name = parsed.name || 'custom-model'
      const newRec = await createModel(name, parsed)
      await fetchModels()
      setCurrentModel(newRec)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
    } catch (err: any) {
      setValidationResult({
        valid: false,
        errors: [err.message || 'Failed to save model'],
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleLoadSample = () => {
    const sample = models.find((m) => m.name === 'saas-upgrade-demo')
    if (sample) {
      setCurrentModel(sample)
      setModelJson(JSON.stringify(sample.definition, null, 2))
    } else {
      setModelJson(JSON.stringify(DEFAULT_SAMPLE_MODEL, null, 2))
    }
    setValidationResult({
      valid: true,
      summary: {
        name: 'saas-upgrade-demo',
        tenants: ['A', 'B'],
        plans: ['free', 'pro'],
        invariants: ['INV-1', 'INV-2', 'INV-3', 'INV-4', 'INV-5'],
        event_count: 7,
      },
    })
  }

  // Parse summary for right-hand cards
  let parsedData: any = null
  try {
    parsedData = JSON.parse(modelJson)
  } catch {
    parsedData = null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Step 1: Model & Define</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define tenant hierarchy, subscription tiers, allowed transitions, and verification invariants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Load Sample</span>
          </button>
          <button
            onClick={handleValidate}
            disabled={isValidating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isValidating ? 'Validating...' : 'Validate'}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedSuccess ? 'Saved!' : isSaving ? 'Saving...' : 'Save Model'}</span>
          </button>
          <button
            onClick={() => navigate('/explore')}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs cursor-pointer"
          >
            <span>Proceed to Explore</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Validation banner */}
      {validationResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            validationResult.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {validationResult.valid ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-semibold">
              {validationResult.valid ? 'Model Definition Validated' : 'Validation Errors Detected'}
            </div>
            {validationResult.valid ? (
              <p className="mt-0.5 text-emerald-700">
                Ready for bounded exploration. {validationResult.summary?.tenants?.length || 2} tenants,{' '}
                {validationResult.summary?.plans?.length || 2} plans,{' '}
                {validationResult.summary?.invariants?.length || 5} invariants declared.
              </p>
            ) : (
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-rose-700">
                {validationResult.errors?.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: JSON Editor */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-700">model_definition.json</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">JSON format</span>
          </div>
          <div className="p-2 flex-1">
            <textarea
              value={modelJson}
              onChange={(e) => setModelJson(e.target.value)}
              rows={22}
              className="w-full h-full font-mono text-xs text-slate-800 bg-slate-900 text-slate-100 p-4 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none selection:bg-blue-800"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right: Summary cards */}
        <div className="lg:col-span-5 space-y-4">
          {/* Tenants Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenants & Roles</div>
            <div className="flex flex-wrap gap-2 pt-1">
              {parsedData?.tenants ? (
                parsedData.tenants.map((t: any) => (
                  <div key={t.id || t} className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-bold text-slate-900">Tenant {t.id || t}</span>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Roles: {t.roles?.join(', ') || 'member, admin'}
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-xs text-slate-400">No tenants parsed</span>
              )}
            </div>
          </div>

          {/* Plans Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscription Plans</div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {parsedData?.plans ? (
                Object.entries(parsedData.plans).map(([pName, p]: [string, any]) => (
                  <div key={pName} className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 text-xs">
                    <span className="font-bold text-blue-900 uppercase">{pName}</span>
                    <div className="text-[10px] text-slate-600 mt-1">
                      Features: {p.features?.join(', ') || '—'}
                    </div>
                    {p.quota && (
                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        Quota: {JSON.stringify(p.quota)}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-xs text-slate-400">No plans parsed</span>
              )}
            </div>
          </div>

          {/* Transitions Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Allowed Transitions</div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {parsedData?.transitions ? (
                parsedData.transitions.map(([from, to]: [string, string], i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 text-[11px] font-mono font-medium"
                  >
                    <span>{from}</span>
                    <span className="text-slate-400">&rarr;</span>
                    <span className="font-bold text-blue-700">{to}</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">No transitions parsed</span>
              )}
            </div>
          </div>

          {/* Invariants Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verification Invariants</div>
            <div className="space-y-1.5 pt-1">
              {parsedData?.invariants ? (
                parsedData.invariants.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                  >
                    <span className="font-mono font-bold text-blue-700 text-[11px]">{inv.id}</span>
                    <span className="text-slate-600 font-mono text-[11px] truncate">{inv.type}</span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-slate-400">No invariants parsed</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
