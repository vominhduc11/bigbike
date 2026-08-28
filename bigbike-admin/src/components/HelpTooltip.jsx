import { CircleHelp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function HelpTooltip({ content, label, className, side = 'top' }) {
  const { t } = useTranslation()
  if (!content) return null

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground', className)}
            aria-label={label || t('common.moreInformation')}
          >
            <CircleHelp size={14} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-80 whitespace-normal leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
