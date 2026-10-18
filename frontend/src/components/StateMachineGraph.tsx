import React from 'react'

interface StateMachineGraphProps {
  currentPlan?: string
  expectedPlan?: string
  isOffending?: boolean
  offendingReason?: string
}

export const StateMachineGraph: React.FC<StateMachineGraphProps> = ({
  currentPlan = 'free',
  expectedPlan = 'free',
  isOffending = false,
  offendingReason,
}) => {
  const normCurrent = (currentPlan || 'none').toLowerCase()
  const normExpected = (expectedPlan || 'none').toLowerCase()

  // Node definitions
  const nodes = [
    { id: 'none', label: 'None', x: 60, y: 90, r: 24 },
    { id: 'free', label: 'Free', x: 200, y: 90, r: 28 },
    { id: 'pro', label: 'Pro', x: 360, y: 90, r: 28 },
    { id: 'cancelled', label: 'Cancelled', x: 280, y: 190, r: 26 },
  ]

  const getNodeColor = (id: string) => {
    const isObserved = normCurrent === id
    const isExp = normExpected === id

    if (isObserved && isOffending) {
      return { fill: '#FEE2E2', stroke: '#EF4444', text: '#991B1B', strokeWidth: 3 }
    }
    if (isObserved) {
      return { fill: '#DBEAFE', stroke: '#2563EB', text: '#1E40AF', strokeWidth: 3 }
    }
    if (isExp) {
      return { fill: '#D1FAE5', stroke: '#10B981', text: '#065F46', strokeWidth: 2 }
    }
    return { fill: '#F8FAFC', stroke: '#CBD5E1', text: '#64748B', strokeWidth: 1.5 }
  }

  // Highlight offending transition if observed went to pro unexpectedly
  const isOffendingTransition = isOffending && normCurrent === 'pro' && normExpected === 'free'

  return (
    <div className="w-full bg-slate-900 text-white rounded-xl p-4 shadow-xs border border-slate-800">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
        <span className="font-semibold text-slate-300">Subscription State Machine</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-400/50" />
            <span className="text-slate-400 text-[11px]">Observed: <strong className="text-slate-200 uppercase">{normCurrent}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-400 text-[11px]">Expected: <strong className="text-slate-200 uppercase">{normExpected}</strong></span>
          </div>
        </div>
      </div>

      <div className="py-2 flex justify-center">
        <svg viewBox="0 0 440 230" className="w-full max-w-md h-auto overflow-visible select-none">
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B" />
            </marker>
            <marker
              id="arrow-red"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
            </marker>
          </defs>

          {/* Transitions */}
          {/* none -> free */}
          <path
            d="M 85 90 L 170 90"
            stroke="#64748B"
            strokeWidth="1.5"
            markerEnd="url(#arrow)"
            fill="none"
          />

          {/* free -> pro (highlight red if offending transition) */}
          <path
            d="M 230 80 Q 280 60 330 80"
            stroke={isOffendingTransition ? '#EF4444' : '#64748B'}
            strokeWidth={isOffendingTransition ? 3 : 1.5}
            strokeDasharray={isOffendingTransition ? '4 2' : 'none'}
            markerEnd={isOffendingTransition ? 'url(#arrow-red)' : 'url(#arrow)'}
            fill="none"
          />

          {/* pro -> free */}
          <path
            d="M 330 100 Q 280 120 230 100"
            stroke="#64748B"
            strokeWidth="1.5"
            markerEnd="url(#arrow)"
            fill="none"
          />

          {/* free -> cancelled */}
          <path
            d="M 215 115 L 265 170"
            stroke="#64748B"
            strokeWidth="1.5"
            markerEnd="url(#arrow)"
            fill="none"
          />

          {/* pro -> cancelled */}
          <path
            d="M 345 115 L 295 170"
            stroke="#64748B"
            strokeWidth="1.5"
            markerEnd="url(#arrow)"
            fill="none"
          />

          {/* Nodes */}
          {nodes.map((node) => {
            const style = getNodeColor(node.id)
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                <circle
                  r={node.r}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                />
                <text
                  textAnchor="middle"
                  dy=".3em"
                  fontSize="11"
                  fontWeight="bold"
                  fill={style.text}
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {isOffending && (
        <div className="mt-2 p-2 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
          <span className="font-semibold">Offending Transition Detected:</span>
          <span className="text-[11px] text-rose-200 font-mono">
            {offendingReason || 'Unexpected transition occurred without proper version verification'}
          </span>
        </div>
      )}
    </div>
  )
}
