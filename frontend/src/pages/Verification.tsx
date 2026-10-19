import React from 'react'
import { Outlet } from 'react-router-dom'
import { Stepper } from '../components/Stepper'

export const Verification: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* 6-step flow tabs */}
      <Stepper />

      {/* Active step content */}
      <div className="animate-in fade-in duration-150">
        <Outlet />
      </div>
    </div>
  )
}
