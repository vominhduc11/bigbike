import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-body font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
  {
    variants: {
      variant: {
        default:   'bg-primary text-primary-foreground hover:opacity-90 active:opacity-80',
        secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-surface-hover',
        danger:    'bg-destructive text-destructive-foreground hover:opacity-90',
        success:   'bg-success text-primary-foreground hover:opacity-90',
        ghost:     'bg-transparent text-foreground hover:bg-surface-hover',
        link:      'text-primary underline-offset-4 hover:underline bg-transparent',
        outline:   'border border-border bg-transparent text-foreground hover:bg-surface-hover',
      },
      size: {
        sm:   'h-7 px-3 text-xs rounded-[var(--admin-radius-xs)]',
        md:   'h-9 px-4 text-sm rounded-[var(--admin-radius-xs)]',
        lg:   'h-10 px-6 text-base rounded-[var(--admin-radius-sm)]',
        icon: 'h-9 w-9 rounded-[var(--admin-radius-xs)]',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}) {
  const Comp = asChild ? Slot : 'button'
  // asChild forwards to a single child element (Radix Slot) — Slot rejects
  // multiple children, so we can't inject a sibling spinner. Pass children
  // through untouched there; the loading affordance only applies to real buttons.
  const showSpinner = loading && !asChild
  // Icon buttons are a fixed square: swap the icon for the spinner instead of
  // showing both side by side.
  const hideChildren = showSpinner && size === 'icon'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? children : (
        <>
          {showSpinner && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {!hideChildren && children}
        </>
      )}
    </Comp>
  )
}

export { buttonVariants }
