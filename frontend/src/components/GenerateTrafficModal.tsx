import React, { useState } from 'react'
import { X, Dices, Sparkles, Plus } from 'lucide-react'
import { ValidEventType } from '../pages/ModelDefine'

interface GenerateTrafficModalProps {
  isOpen: boolean
  onClose: () => void
  availableTenants: string[]
  availablePlans: string[]
  availableFeatures: string[]
  currentEventCount: number
  onAppendEvents: (
    events: Array<{
      id: string
      tenant: string
      customer_id: string
      seq: number
      type: ValidEventType
      payload: Record<string, any>
    }>
  ) => void
}

// Simple Mulberry32 deterministic pseudo-random number generator
function createRng(seed: number) {
  let s = Math.floor(Math.abs(seed)) || 42
  return function () {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const GenerateTrafficModal: React.FC<GenerateTrafficModalProps> = ({
  isOpen,
  onClose,
  availableTenants,
  availablePlans,
  availableFeatures,
  currentEventCount,
  onAppendEvents,
}) => {
  const [eventCount, setEventCount] = useState<number>(10)
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(
    new Set(availableTenants.length > 0 ? availableTenants : ['A', 'B'])
  )
  const [seed, setSeed] = useState<number>(42)

  if (!isOpen) return null

  const toggleTenant = (tId: string) => {
    setSelectedTenants((prev) => {
      const next = new Set(prev)
      if (next.has(tId)) {
        if (next.size > 1) next.delete(tId) // keep at least one
      } else {
        next.add(tId)
      }
      return next
    })
  }

  const handleGenerate = () => {
    const rng = createRng(seed)
    const targetTenants = Array.from(selectedTenants)
    if (targetTenants.length === 0) return

    const plans = availablePlans.length > 0 ? availablePlans : ['free', 'pro']
    const features = availableFeatures.length > 0 ? availableFeatures : ['basic', 'premium']

    const generated: Array<{
      id: string
      tenant: string
      customer_id: string
      seq: number
      type: ValidEventType
      payload: Record<string, any>
    }> = []

    const tenantSeqCounters: Record<string, number> = {}
    targetTenants.forEach((t) => {
      tenantSeqCounters[t] = 1
    })

    const eventPool: ValidEventType[] = [
      'UsageRecorded',
      'UsageRecorded',
      'AccessCheck',
      'AccessCheck',
      'PlanUpgraded',
      'PlanDowngraded',
      'PaymentSucceeded',
      'PaymentFailed',
    ]

    for (let i = 0; i < eventCount; i++) {
      const tenant = targetTenants[Math.floor(rng() * targetTenants.length)]
      const seq = tenantSeqCounters[tenant]++
      const type = eventPool[Math.floor(rng() * eventPool.length)]
      const eventId = `e${currentEventCount + i + 1}`

      let payload: Record<string, any> = {}
      if (type === 'UsageRecorded') {
        payload = { units: Math.floor(rng() * 40) + 5 }
      } else if (type === 'AccessCheck') {
        const feat = features[Math.floor(rng() * features.length)]
        payload = { feature: feat, role: rng() > 0.4 ? 'admin' : 'member' }
      } else if (type === 'PlanUpgraded') {
        payload = { plan: plans[Math.min(plans.length - 1, 1)] }
      } else if (type === 'PlanDowngraded') {
        payload = { plan: plans[0] }
      } else if (type === 'PaymentSucceeded' || type === 'PaymentFailed') {
        payload = { amount: Math.floor(rng() * 80) + 19 }
      }

      generated.push({
        id: eventId,
        tenant,
        customer_id: 'c1',
        seq,
        type,
        payload,
      })
    }

    onAppendEvents(generated)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Dices className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Generate Synthetic Traffic</h2>
              <p className="text-xs text-muted">Append realistic events to the active scenario.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-text rounded-md hover:bg-elevated transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="space-y-4">
          {/* Event Count */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-text">
              <span>Events to Generate (N)</span>
              <span className="font-mono text-primary font-bold">{eventCount}</span>
            </div>
            <input
              type="range"
              min="5"
              max="40"
              step="5"
              value={eventCount}
              onChange={(e) => setEventCount(Number(e.target.value))}
              className="w-full h-1.5 bg-elevated rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted font-mono">
              <span>5 events</span>
              <span>20 events</span>
              <span>40 events</span>
            </div>
          </div>

          {/* Tenants Checklist */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-text block">Target Tenants</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {availableTenants.map((tId) => {
                const isChecked = selectedTenants.has(tId)
                return (
                  <label
                    key={tId}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-primary/15 border-primary/30 text-primary'
                        : 'bg-elevated border-border text-muted hover:text-text'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleTenant(tId)}
                      className="accent-primary rounded text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Tenant {tId}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Seed Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text flex items-center justify-between">
              <span>Deterministic Seed</span>
              <span className="text-[10px] text-muted font-normal">Controls pseudo-random order</span>
            </label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono bg-elevated border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="p-3 bg-primary/10 border border-primary/25 rounded-lg text-xs text-text flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-warn shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted leading-relaxed">
              Events are generated with valid plans, features, and auto-incrementing sequence numbers per tenant.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-text bg-elevated hover:bg-elevated/80 border border-border rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate & Append</span>
          </button>
        </div>
      </div>
    </div>
  )
}
