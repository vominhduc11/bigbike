import { cn } from '@/lib/utils'

export function Table({ className, containerClassName, ...props }) {
  return (
    <div className={cn('relative w-full overflow-auto', containerClassName)}>
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }) {
  return <thead className={cn('border-b border-border', className)} {...props} />
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableFooter({ className, ...props }) {
  return (
    <tfoot
      className={cn(
        'border-t border-border bg-surface-muted font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

export function TableRow({ className, ...props }) {
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors hover:bg-surface-hover data-[state=selected]:bg-surface-selected',
        className,
      )}
      {...props}
    />
  )
}

export function TableHead({ className, scope = 'col', ...props }) {
  return (
    <th
      scope={scope}
      className={cn(
        'h-11 px-3 text-left align-middle text-xs font-semibold text-muted-foreground sticky top-0 z-10 bg-surface-muted [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }) {
  return (
    <td
      className={cn(
        'px-3 py-3 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

export function TableCaption({ className, ...props }) {
  return <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
}
