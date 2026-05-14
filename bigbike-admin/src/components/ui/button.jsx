import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
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

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { buttonVariants }
