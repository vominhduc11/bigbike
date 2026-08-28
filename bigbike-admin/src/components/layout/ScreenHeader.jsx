import { Children, Fragment, isValidElement } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { HelpTooltip } from '@/components/HelpTooltip'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMediaQuery } from '@/lib/useMediaQuery'

const SCREEN_GROUPS = ['sales', 'products', 'content', 'reports', 'system']

function normalizedText(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim().toLocaleLowerCase()
    : ''
}

function hasMobileHiddenClass(className) {
  const classes = String(className || '').split(/\s+/)
  return classes.includes('hidden') || classes.includes('max-sm:hidden')
}

function countVisibleActions(node, hiddenByParent = false) {
  return Children.toArray(node).reduce((count, child) => {
    if (!isValidElement(child)) return count
    const hidden = hiddenByParent || child.props.hidden || hasMobileHiddenClass(child.props.className)
    if (child.type === Fragment || child.type === 'div' || child.type === 'span') {
      return count + countVisibleActions(child.props.children, hidden)
    }
    if (hidden || child.props.type === 'file') return count
    return count + 1
  }, 0)
}

export function ScreenHeader({ group, eyebrow, title, description, help, helpLabel, actions, badge }) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 639px)')
  const groupLabel = group && SCREEN_GROUPS.includes(group) ? t(`nav.group.${group}`) : eyebrow
  const showGroupLabel = groupLabel && normalizedText(groupLabel) !== normalizedText(title)
  const collapseActions = isMobile && countVisibleActions(actions) > 1

  return (
    <header className="bb-screen-header">
      <div className="bb-screen-title">
        {showGroupLabel ? <p className="bb-screen-eyebrow">{groupLabel}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1>{title}</h1>
          {badge}
          {help ? <HelpTooltip content={help} label={helpLabel} /> : null}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? (
        <div className="bb-screen-actions">
          {collapseActions ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={t('common.moreActions')}
                >
                  <MoreHorizontal size={18} aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="flex max-h-[min(32rem,calc(100vh-var(--admin-space-8)))] w-72 flex-col gap-2 overflow-y-auto p-2 [&_.bb-seg]:grid [&_.bb-seg]:w-full [&_.bb-seg]:grid-cols-2 [&_button]:min-h-11 [&_button]:w-full [&_button]:justify-start [&_input]:min-h-11 [&_input]:w-full [&>div:not(.bb-seg)]:flex-col [&>div:not(.bb-seg)]:items-stretch [&>svg]:hidden"
              >
                {actions}
              </PopoverContent>
            </Popover>
          ) : actions}
        </div>
      ) : null}
    </header>
  )
}
