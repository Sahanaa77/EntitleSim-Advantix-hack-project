import React from 'react'
import { X, ShieldAlert, Cpu, Layers } from 'lucide-react'

interface BoundariesDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const BoundariesDialog: React.FC<BoundariesDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-surface rounded-xl shadow-2xl border border-border max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-text">About & Verification Boundaries</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text p-1 rounded-md hover:bg-elevated transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-sm text-muted max-h-[70vh] overflow-y-auto pr-1">
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/30 text-xs text-text">
            <span className="font-semibold block text-primary mb-1">Differentiators</span>
            Systematic event exploration &middot; Counterexample minimization &middot; Entitlement-specific invariants as first-class rules &middot; Regression test generation.
            <div className="mt-1 text-muted italic">We do NOT claim to invent model checking or generic chaos testing.</div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="p-2 bg-primary/15 text-primary rounded-lg h-fit">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-text">Model Accuracy</h4>
                <p className="mt-0.5 text-xs text-muted leading-relaxed">
                  EntitleSim verifies the developer-defined state model or instrumented adapter, not arbitrary uninstrumented source code.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-primary/15 text-primary rounded-lg h-fit">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-text">Bounded Exploration</h4>
                <p className="mt-0.5 text-xs text-muted leading-relaxed">
                  Exploration is strictly bounded by configurable event depth, retry limits, concurrency levels, and state caps.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-warn/15 text-warn rounded-lg h-fit">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-text">Sandbox Environment</h4>
                <p className="mt-0.5 text-xs text-muted leading-relaxed">
                  All events, webhook deliveries, and tenant states are simulated locally. No real Stripe or external payment calls are made.
                </p>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-elevated rounded-lg border border-border text-xs text-muted">
            <span className="font-semibold text-text block mb-0.5">Out of Scope</span>
            Auth, multi-user, real Stripe, real source-code instrumentation, Rust engine.
          </div>

          <div className="text-center pt-1 text-xs font-medium text-primary">
            &ldquo;From a flaky production bug to a permanent regression test in one workflow.&rdquo;
          </div>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
