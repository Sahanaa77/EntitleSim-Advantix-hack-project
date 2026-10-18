import React from 'react'
import { X, ShieldAlert, Cpu, Layers } from 'lucide-react'

interface BoundariesDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const BoundariesDialog: React.FC<BoundariesDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">About & Verification Boundaries</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-sm text-slate-600 max-h-[70vh] overflow-y-auto pr-1">
          <div className="p-3 bg-blue-50/80 rounded-lg border border-blue-100 text-xs text-blue-900">
            <span className="font-semibold block text-blue-950 mb-1">Differentiators</span>
            Systematic event exploration &middot; Counterexample minimization &middot; Entitlement-specific invariants as first-class rules &middot; Regression test generation.
            <div className="mt-1 text-slate-500 italic">We do NOT claim to invent model checking or generic chaos testing.</div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-lg h-fit">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">Model Accuracy</h4>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                  EntitleSim verifies the developer-defined state model or instrumented adapter, not arbitrary uninstrumented source code.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg h-fit">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">Bounded Exploration</h4>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                  Exploration is strictly bounded by configurable event depth, retry limits, concurrency levels, and state caps.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-amber-50 text-amber-700 rounded-lg h-fit">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">Sandbox Environment</h4>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                  All events, webhook deliveries, and tenant states are simulated locally. No real Stripe or external payment calls are made.
                </p>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
            <span className="font-semibold text-slate-700 block mb-0.5">Out of Scope</span>
            Auth, multi-user, real Stripe, real source-code instrumentation, Rust engine.
          </div>

          <div className="text-center pt-1 text-xs font-medium text-blue-700">
            &ldquo;From a flaky production bug to a permanent regression test in one workflow.&rdquo;
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
