export interface InvariantInfo {
  id: string
  name: string
  severity: 'Critical' | 'High' | 'Medium'
  explanation: string
  badgeClass: string
}

export const INVARIANTS_INFO: Record<string, InvariantInfo> = {
  'INV-1': {
    id: 'INV-1',
    name: 'Feature Access Matches Plan',
    severity: 'Critical',
    explanation: 'Member accessed features not included in their active subscription tier.',
    badgeClass: 'bg-danger/15 text-danger border-danger/30',
  },
  'INV-2': {
    id: 'INV-2',
    name: 'Usage Within Quota',
    severity: 'High',
    explanation: 'Metered consumption exceeded the maximum quota units allowed for the tier.',
    badgeClass: 'bg-warn/15 text-warn border-warn/30',
  },
  'INV-3': {
    id: 'INV-3',
    name: 'Tenant Isolation Guarantee',
    severity: 'Critical',
    explanation: 'Tenant state mutation leaked across shared cache keys or customer scopes.',
    badgeClass: 'bg-danger/15 text-danger border-danger/30',
  },
  'INV-4': {
    id: 'INV-4',
    name: 'No Access After Cancellation',
    severity: 'High',
    explanation: 'Entitlement operations were permitted after cancellation was finalized.',
    badgeClass: 'bg-warn/15 text-warn border-warn/30',
  },
  'INV-5': {
    id: 'INV-5',
    name: 'Cache & Database Consistency',
    severity: 'Medium',
    explanation: 'In-memory cached permissions drifted from durable database records.',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
}

export function getInvariantInfo(id: string): InvariantInfo {
  return (
    INVARIANTS_INFO[id] || {
      id,
      name: id,
      severity: 'High',
      explanation: 'State divergence detected against verification oracle.',
      badgeClass: 'bg-danger/15 text-danger border-danger/30',
    }
  )
}

export function formatEventSummary(ev: {
  tenant?: string
  type?: string
  payload?: Record<string, any>
}): string {
  const tenant = ev.tenant ? `Tenant ${ev.tenant}` : 'Tenant'
  const p = ev.payload || {}
  switch (ev.type) {
    case 'SubscriptionCreated':
      return `${tenant}: Created ${p.plan ? p.plan.toUpperCase() : 'Free'} plan subscription`
    case 'PlanUpgraded':
      return `${tenant}: Upgraded to ${p.plan ? p.plan.toUpperCase() : 'Pro'}`
    case 'PlanDowngraded':
      return `${tenant}: Downgraded to ${p.plan ? p.plan.toUpperCase() : 'Free'}`
    case 'SubscriptionCancelled':
      return `${tenant}: Cancelled subscription`
    case 'PaymentSucceeded':
      return `${tenant}: Payment of $${p.amount ?? 29} succeeded`
    case 'PaymentFailed':
      return `${tenant}: Payment of $${p.amount ?? 29} failed (Grace period active)`
    case 'UsageRecorded':
      return `${tenant}: Recorded ${p.units ?? 1} units of metered usage`
    case 'AccessCheck':
      return `${tenant}: Checked access for ${p.feature || 'premium'} feature as ${p.role || 'member'}`
    default:
      return `${tenant}: ${ev.type || 'Event'}`
  }
}
