import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

// `headingLevel` (2|3|4, mặc định 2) cho phép cấp tiêu đề khớp ngữ cảnh phân cấp.
// CSS `.detail-section-header :is(h2,h3,h4)` giữ nguyên style ở mọi cấp.
export const DetailSection = forwardRef(function DetailSection({
  title,
  description,
  badge,
  action,
  required = false,
  headingLevel = 2,
  children,
  className,
  contentClassName,
  headerClassName,
  noPadding = false,
  ...props
}, ref) {
  const { t } = useTranslation()
  const Heading = `h${headingLevel}`
  const hasHeader = Boolean(title || description || badge || action || required)
  return (
    <section ref={ref} className={cn('detail-section', className)} {...props}>
      {hasHeader ? <header className={cn('detail-section-header', headerClassName)}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {title ? <Heading>
              {title}
              {required ? (
                <span className="ml-1 text-danger" aria-label={t('common.required')} title={t('common.required')}>*</span>
              ) : null}
            </Heading> : null}
            {badge}
          </div>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header> : null}
      {children !== undefined && children !== null ? (
        <div className={cn('detail-section-content', noPadding && '!p-0', contentClassName)}>{children}</div>
      ) : null}
    </section>
  )
})
