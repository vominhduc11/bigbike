import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Screen — page container with consistent vertical rhythm.
 * Replaces the ad-hoc <div className="page-inner"> wrapper.
 */
export const Screen = forwardRef(function Screen({ children, className, ...props }, ref) {
  return (
    <div ref={ref} className={cn('screen', className)} {...props}>
      {children}
    </div>
  )
})
