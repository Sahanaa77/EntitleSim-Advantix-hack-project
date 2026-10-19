import React from 'react'
import { X, Sparkles, Layers, ArrowRight, ShieldCheck, Zap } from 'lucide-react'
import { ModelDefinition } from '../types'

export interface ModelTemplate {
  id: string
  name: string
  title: string
  description: string
  badge: string
  definition: ModelDefinition
}

export const STARTER_TEMPLATES: ModelTemplate[] = [
  {
    id: 'duplicate-usage-event',
    name: 'Duplicate Usage Event',
    title: 'Duplicate Usage Event',
    description: 'Idempotency and double-counting verification when metered usage webhook events are retried or duplicated.',
    badge: 'Guided Tour Default',
    definition: {
      name: 'Duplicate Usage Event',
      unit: 'GB',
      display: { unit: 'GB' },
      tenants: [
        { id: 'A', roles: ['admin', 'member'] },
      ],
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
    },
  },
  {
    id: 'upgrade-downgrade-race',
    name: 'upgrade-downgrade-race',
    title: 'Upgrade/Downgrade Race',
    description: 'Concurrent upgrade and downgrade webhook deliveries causing stale access rights and version regressions.',
    badge: 'Race Conditions',
    definition: {
      name: 'upgrade-downgrade-race',
      tenants: [
        { id: 'A', roles: ['admin', 'member'] },
        { id: 'B', roles: ['admin', 'member'] },
        { id: 'C', roles: ['admin', 'member'] },
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
        { id: 'e8', tenant: 'B', customer_id: 'c1', seq: 2, type: 'PlanUpgraded', payload: { plan: 'pro' } },
        { id: 'e9', tenant: 'B', customer_id: 'c1', seq: 3, type: 'AccessCheck', payload: { feature: 'premium', role: 'admin' } },
        { id: 'e10', tenant: 'B', customer_id: 'c1', seq: 4, type: 'PlanDowngraded', payload: { plan: 'free' } },
        { id: 'e11', tenant: 'C', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'free' } },
        { id: 'e12', tenant: 'C', customer_id: 'c1', seq: 2, type: 'UsageRecorded', payload: { units: 50 } },
        { id: 'e13', tenant: 'C', customer_id: 'c1', seq: 3, type: 'AccessCheck', payload: { feature: 'basic', role: 'member' } },
      ],
      invariants: [
        { id: 'INV-1', type: 'feature_access_matches_plan' },
        { id: 'INV-2', type: 'usage_within_quota' },
        { id: 'INV-3', type: 'tenant_isolation' },
        { id: 'INV-4', type: 'no_access_after_cancel' },
        { id: 'INV-5', type: 'cache_db_consistent' },
      ],
    },
  },
  {
    id: 'trial-to-paid-grace',
    name: 'trial-to-paid-grace',
    title: 'Trial to Paid with Grace Period',
    description: 'Trial expiration and payment failure transitions with grace period allowance verification.',
    badge: 'Billing & Grace',
    definition: {
      name: 'trial-to-paid-grace',
      tenants: [
        { id: 'acme', roles: ['admin', 'member'] },
        { id: 'globex', roles: ['admin'] },
        { id: 'initech', roles: ['member'] },
      ],
      feature_roles: {
        pro_features: ['admin', 'member'],
      },
      plans: {
        trial: { features: ['basic', 'pro_features'], quota: { api_calls: 500 } },
        starter: { features: ['basic'], quota: { api_calls: 100 } },
        business: { features: ['basic', 'pro_features'], quota: { api_calls: 2000 } },
      },
      transitions: [
        ['none', 'trial'],
        ['trial', 'business'],
        ['trial', 'starter'],
        ['business', 'cancelled'],
        ['starter', 'cancelled'],
      ],
      policies: {
        grace_period_events: 2,
        trial_events: 3,
        prepaid_credits: 50,
      },
      scenario: [
        { id: 'e1', tenant: 'acme', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'trial' } },
        { id: 'e2', tenant: 'acme', customer_id: 'c1', seq: 2, type: 'AccessCheck', payload: { feature: 'pro_features', role: 'admin' } },
        { id: 'e3', tenant: 'acme', customer_id: 'c1', seq: 3, type: 'PaymentFailed', payload: { amount: 99 } },
        { id: 'e4', tenant: 'acme', customer_id: 'c1', seq: 4, type: 'UsageRecorded', payload: { units: 20 } },
        { id: 'e5', tenant: 'acme', customer_id: 'c1', seq: 5, type: 'PaymentSucceeded', payload: { amount: 99 } },
        { id: 'e6', tenant: 'globex', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'starter' } },
        { id: 'e7', tenant: 'globex', customer_id: 'c1', seq: 2, type: 'AccessCheck', payload: { feature: 'pro_features', role: 'admin' } },
        { id: 'e8', tenant: 'globex', customer_id: 'c1', seq: 3, type: 'PlanUpgraded', payload: { plan: 'business' } },
        { id: 'e9', tenant: 'globex', customer_id: 'c1', seq: 4, type: 'UsageRecorded', payload: { units: 50 } },
        { id: 'e10', tenant: 'initech', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'trial' } },
        { id: 'e11', tenant: 'initech', customer_id: 'c1', seq: 2, type: 'SubscriptionCancelled', payload: {} },
        { id: 'e12', tenant: 'initech', customer_id: 'c1', seq: 3, type: 'AccessCheck', payload: { feature: 'pro_features', role: 'member' } },
      ],
      invariants: [
        { id: 'INV-1', type: 'feature_access_matches_plan' },
        { id: 'INV-2', type: 'usage_within_quota' },
        { id: 'INV-3', type: 'tenant_isolation' },
        { id: 'INV-4', type: 'no_access_after_cancel' },
        { id: 'INV-5', type: 'cache_db_consistent' },
      ],
    },
  },
  {
    id: 'multi-tenant-metering',
    name: 'multi-tenant-metering',
    title: 'Multi-Tenant Usage Metering',
    description: 'Cross-tenant meter deductions, double-counting idempotency checks, and shared customer key collisions.',
    badge: 'Metering & Isolation',
    definition: {
      name: 'multi-tenant-metering',
      tenants: [
        { id: 'tenant_alpha', roles: ['admin'] },
        { id: 'tenant_beta', roles: ['admin'] },
        { id: 'tenant_gamma', roles: ['admin'] },
      ],
      feature_roles: {
        analytics: ['admin'],
      },
      plans: {
        standard: { features: ['basic'], quota: { api_calls: 100 } },
        growth: { features: ['basic', 'analytics'], quota: { api_calls: 500 } },
      },
      transitions: [
        ['none', 'standard'],
        ['standard', 'growth'],
        ['growth', 'standard'],
        ['growth', 'cancelled'],
      ],
      policies: {
        grace_period_events: 1,
        trial_events: 0,
        prepaid_credits: 0,
      },
      scenario: [
        { id: 'e1', tenant: 'tenant_alpha', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'standard' } },
        { id: 'e2', tenant: 'tenant_alpha', customer_id: 'c1', seq: 2, type: 'UsageRecorded', payload: { units: 50 } },
        { id: 'e3', tenant: 'tenant_alpha', customer_id: 'c1', seq: 3, type: 'UsageRecorded', payload: { units: 60 } },
        { id: 'e4', tenant: 'tenant_alpha', customer_id: 'c1', seq: 4, type: 'AccessCheck', payload: { feature: 'basic', role: 'admin' } },
        { id: 'e5', tenant: 'tenant_beta', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'growth' } },
        { id: 'e6', tenant: 'tenant_beta', customer_id: 'c1', seq: 2, type: 'UsageRecorded', payload: { units: 200 } },
        { id: 'e7', tenant: 'tenant_beta', customer_id: 'c1', seq: 3, type: 'UsageRecorded', payload: { units: 250 } },
        { id: 'e8', tenant: 'tenant_beta', customer_id: 'c1', seq: 4, type: 'PlanDowngraded', payload: { plan: 'standard' } },
        { id: 'e9', tenant: 'tenant_gamma', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'standard' } },
        { id: 'e10', tenant: 'tenant_gamma', customer_id: 'c1', seq: 2, type: 'UsageRecorded', payload: { units: 30 } },
        { id: 'e11', tenant: 'tenant_gamma', customer_id: 'c1', seq: 3, type: 'PaymentSucceeded', payload: { amount: 49 } },
        { id: 'e12', tenant: 'tenant_gamma', customer_id: 'c1', seq: 4, type: 'AccessCheck', payload: { feature: 'analytics', role: 'admin' } },
      ],
      invariants: [
        { id: 'INV-1', type: 'feature_access_matches_plan' },
        { id: 'INV-2', type: 'usage_within_quota' },
        { id: 'INV-3', type: 'tenant_isolation' },
        { id: 'INV-4', type: 'no_access_after_cancel' },
        { id: 'INV-5', type: 'cache_db_consistent' },
      ],
    },
  },
  {
    id: 'enterprise-seat-downgrade',
    name: 'enterprise-seat-downgrade',
    title: 'Enterprise Seat Downgrade',
    description: 'Downgrading from enterprise seats to team tiers while enterprise features (SSO/Audit) remain active.',
    badge: 'Enterprise Tiers',
    definition: {
      name: 'enterprise-seat-downgrade',
      tenants: [
        { id: 'enterprise_corp', roles: ['admin', 'billing'] },
        { id: 'startup_labs', roles: ['admin'] },
        { id: 'scale_media', roles: ['member'] },
      ],
      feature_roles: {
        sso: ['admin'],
        audit: ['admin', 'billing'],
      },
      plans: {
        team: { features: ['basic', 'collab'], quota: { api_calls: 300 } },
        enterprise: { features: ['basic', 'collab', 'sso', 'audit'], quota: { api_calls: 5000 } },
      },
      transitions: [
        ['none', 'enterprise'],
        ['none', 'team'],
        ['enterprise', 'team'],
        ['team', 'enterprise'],
        ['team', 'cancelled'],
        ['enterprise', 'cancelled'],
      ],
      policies: {
        grace_period_events: 1,
        trial_events: 0,
        prepaid_credits: 100,
      },
      scenario: [
        { id: 'e1', tenant: 'enterprise_corp', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'enterprise' } },
        { id: 'e2', tenant: 'enterprise_corp', customer_id: 'c1', seq: 2, type: 'AccessCheck', payload: { feature: 'sso', role: 'admin' } },
        { id: 'e3', tenant: 'enterprise_corp', customer_id: 'c1', seq: 3, type: 'PlanDowngraded', payload: { plan: 'team' } },
        { id: 'e4', tenant: 'enterprise_corp', customer_id: 'c1', seq: 4, type: 'AccessCheck', payload: { feature: 'sso', role: 'admin' } },
        { id: 'e5', tenant: 'enterprise_corp', customer_id: 'c1', seq: 5, type: 'UsageRecorded', payload: { units: 150 } },
        { id: 'e6', tenant: 'startup_labs', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'team' } },
        { id: 'e7', tenant: 'startup_labs', customer_id: 'c1', seq: 2, type: 'PlanUpgraded', payload: { plan: 'enterprise' } },
        { id: 'e8', tenant: 'startup_labs', customer_id: 'c1', seq: 3, type: 'AccessCheck', payload: { feature: 'audit', role: 'admin' } },
        { id: 'e9', tenant: 'startup_labs', customer_id: 'c1', seq: 4, type: 'SubscriptionCancelled', payload: {} },
        { id: 'e10', tenant: 'startup_labs', customer_id: 'c1', seq: 5, type: 'AccessCheck', payload: { feature: 'audit', role: 'admin' } },
        { id: 'e11', tenant: 'scale_media', customer_id: 'c1', seq: 1, type: 'SubscriptionCreated', payload: { plan: 'team' } },
        { id: 'e12', tenant: 'scale_media', customer_id: 'c1', seq: 2, type: 'UsageRecorded', payload: { units: 400 } },
      ],
      invariants: [
        { id: 'INV-1', type: 'feature_access_matches_plan' },
        { id: 'INV-2', type: 'usage_within_quota' },
        { id: 'INV-3', type: 'tenant_isolation' },
        { id: 'INV-4', type: 'no_access_after_cancel' },
        { id: 'INV-5', type: 'cache_db_consistent' },
      ],
    },
  },
]

interface TemplateGalleryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: ModelTemplate) => void
}

export const TemplateGalleryModal: React.FC<TemplateGalleryModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Starter Template Gallery</h2>
              <p className="text-xs text-muted">
                Pre-configured SaaS verification models with 3 tenants, realistic event traces, and invariant rules.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-text rounded-md hover:bg-elevated transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="py-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          {STARTER_TEMPLATES.map((tmpl) => {
            const tenantsCount = tmpl.definition.tenants.length
            const plansCount = Object.keys(tmpl.definition.plans).length
            const eventsCount = tmpl.definition.scenario.length

            return (
              <div
                key={tmpl.id}
                onClick={() => {
                  onSelectTemplate(tmpl)
                  onClose()
                }}
                className="p-5 rounded-xl bg-elevated border border-border hover:border-primary/50 shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-text group-hover:text-primary transition-colors">
                      {tmpl.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                      {tmpl.badge}
                    </span>
                  </div>

                  <p className="text-xs text-muted leading-relaxed">{tmpl.description}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-border/80 flex items-center justify-between text-[11px] font-mono text-muted">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-primary" />
                      <span>{tenantsCount} tenants</span>
                    </span>
                    <span>&middot;</span>
                    <span>{plansCount} tiers</span>
                    <span>&middot;</span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-warn" />
                      <span>{eventsCount} events</span>
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Load</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Note */}
        <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Templates are deterministic input definitions evaluated by the verification engine.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-text bg-elevated hover:bg-elevated/80 border border-border rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
