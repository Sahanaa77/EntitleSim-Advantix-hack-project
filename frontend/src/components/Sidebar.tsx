import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ShieldCheck,
  LayoutDashboard,
  FileCode,
  Cpu,
  Compass,
  BarChart3,
  Info,
} from 'lucide-react'
import { cn } from '../lib/utils'

interface SidebarProps {
  onOpenBoundaries: () => void
  isMobileOpen?: boolean
  onCloseMobile?: () => void
}

interface NavItem {
  title: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { title: 'Models', path: '/models', icon: FileCode },
  { title: 'Simulator', path: '/simulator', icon: Cpu, badge: 'Sandbox' },
  { title: 'Verification', path: '/verification', icon: Compass },
  { title: 'Reports', path: '/reports', icon: BarChart3 },
]

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenBoundaries,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const location = useLocation()

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-border flex flex-col transition-transform duration-200 lg:static lg:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo Section */}
        <div className="h-16 px-5 border-b border-border flex items-center justify-between shrink-0">
          <NavLink to="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-text text-lg tracking-tight">EntitleSim</span>
                <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-primary/20 text-primary border border-primary/30 rounded uppercase tracking-wider">
                  SaaS
                </span>
              </div>
              <p className="text-[10px] text-muted">Verification Workbench</p>
            </div>
          </NavLink>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Navigation
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group',
                  isActive
                    ? 'bg-primary/15 text-primary border border-primary/30 shadow-xs'
                    : 'text-muted hover:text-text hover:bg-elevated border border-transparent'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-colors',
                      isActive ? 'text-primary' : 'text-muted group-hover:text-text'
                    )}
                  />
                  <span>{item.title}</span>
                </div>

                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-elevated border border-border text-muted">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Bottom Section */}
        <div className="p-3 border-t border-border shrink-0 space-y-2">
          <div className="p-2.5 rounded-lg bg-elevated border border-border">
            <div className="flex items-center justify-between text-[11px] font-semibold text-text mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span>Engine Active</span>
              </span>
              <span className="text-[10px] font-mono text-muted">In-Memory</span>
            </div>
            <p className="text-[10px] text-muted leading-relaxed">
              Model-based counterexample verification
            </p>
          </div>

          <button
            onClick={onOpenBoundaries}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-text bg-surface hover:bg-elevated rounded-lg border border-border transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Boundaries & Scope</span>
          </button>
        </div>
      </aside>
    </>
  )
}
