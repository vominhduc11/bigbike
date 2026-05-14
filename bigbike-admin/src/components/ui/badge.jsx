import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold border transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border-transparent',
        secondary: 'bg-secondary text-secondary-foreground border-border',
        success: 'bg-success-bg text-success border-success-border',
        warning: 'bg-warning-bg text-warning border-warning-border',
        danger: 'bg-danger-bg text-danger border-danger-border',
        info: 'bg-info-bg text-info border-info-border',
        muted: 'bg-surface-raised text-muted-foreground border-border',
      },
      rounded: {
        sm: 'rounded-[var(--admin-radius-xs)]',
        full: 'rounded-full',
      },
    },
    defaultVariants: { variant: 'default', rounded: 'sm' },
  }
)

export function Badge({ className, variant, rounded, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant, rounded }), className)} {...props} />
  )
}

export { badgeVariants }
