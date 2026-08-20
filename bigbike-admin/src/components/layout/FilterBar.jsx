import { cn } from '@/lib/utils'

/** Shared operational filter surface for admin list screens. */
export function FilterBar({ children, className, ariaLabel }) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-4',
        className,
      )}
    >
      {children}
    </section>
  )
}
