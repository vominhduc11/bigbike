import { Fragment } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function availableActions(actions) {
  return (actions || []).filter(Boolean)
}

export function TableRowActions({ primaryActions, menuActions, className }) {
  const { t } = useTranslation()
  const primary = availableActions(primaryActions)
  const menu = availableActions(menuActions)
  const menuLabel = t('common.actions', { defaultValue: 'Thao tác' })

  if (!primary.length && !menu.length) return null

  return (
    <div
      className={cn('flex items-center justify-end gap-1', className)}
      onClick={(event) => event.stopPropagation()}
    >
      {primary.map((action) => {
        const Icon = action.icon
        return (
          <Button
            key={action.key}
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'min-h-11 min-w-11',
              action.tone === 'danger' && 'text-destructive hover:text-destructive',
            )}
            title={action.label}
            aria-label={action.ariaLabel || action.label}
            aria-busy={action.busy || undefined}
            loading={action.loading}
            disabled={action.disabled}
            onClick={action.onSelect}
          >
            {Icon ? <Icon size={16} aria-hidden="true" /> : null}
          </Button>
        )
      })}

      {menu.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              title={menuLabel}
              aria-label={menuLabel}
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menu.map((action, index) => {
              const Icon = action.icon
              const itemContent = (
                <>
                  {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                  {action.label}
                </>
              )
              return (
                <Fragment key={action.key}>
                  {action.separatorBefore && index > 0 ? <DropdownMenuSeparator /> : null}
                  {action.href && !action.disabled ? (
                    <DropdownMenuItem asChild className={cn(action.tone === 'danger' && 'text-danger focus:text-danger')}>
                      <a href={action.href} target={action.target} rel={action.rel} aria-label={action.ariaLabel}>{itemContent}</a>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={action.disabled}
                      aria-label={action.ariaLabel}
                      className={cn(action.tone === 'danger' && 'text-danger focus:text-danger')}
                      onSelect={action.onSelect}
                    >
                      {itemContent}
                    </DropdownMenuItem>
                  )}
                </Fragment>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
