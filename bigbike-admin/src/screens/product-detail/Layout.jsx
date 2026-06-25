import { cloneElement, isValidElement, useContext, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ChevronDown, GripVertical, ImageOff, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveDisplayUrl } from '@/lib/contracts'
import { AssignmentConfigContext } from './constants'

// Returns the configured role label for a role key, or the i18n default when the
// admin hasn't customised it (empty/missing value).
function useRoleLabel(role, t) {
  const cfg = useContext(AssignmentConfigContext)
  if (role === 'content') return cfg?.roleContent || t('products.detail.assign.roleContent', { defaultValue: 'Content' })
  if (role === 'seo') return cfg?.roleSeo || t('products.detail.assign.roleSeo', { defaultValue: 'SEO' })
  if (role === 'manager') return cfg?.roleManager || t('products.detail.assign.roleManager', { defaultValue: 'Quản lý' })
  return ''
}

// One row in the related-products list — draggable (dnd-kit) so the admin can curate the
// storefront carousel order, with a generous thumbnail and an icon remove button.
export function RelatedProductRow({ chip, canEdit, onRemove, t, sortable }) {
  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2 sm:gap-3 p-2 border border-border bg-background"
    >
      {canEdit && sortable && (
        <button
          type="button"
          {...sortable.handleProps}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground cursor-grab touch-none"
          aria-label={t('products.detail.relatedDragHint')}
        >
          <GripVertical size={16} />
        </button>
      )}
      {chip.imageUrl ? (
        <img
          src={resolveDisplayUrl(chip.imageUrl)}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-10 h-10 sm:w-12 sm:h-12 object-cover flex-shrink-0 border border-border"
        />
      ) : (
        <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 border border-border bg-muted flex items-center justify-center text-muted-foreground">
          <ImageOff size={16} />
        </div>
      )}
      <span className="flex-1 min-w-0 truncate text-sm font-medium" title={chip.name}>{chip.name}</span>
      {canEdit && (
        <button
          type="button"
          className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(chip.id)}
          aria-label={t('products.detail.relatedRemove', { name: chip.name })}
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}

export function RoleBadge({ role }) {
  const { t } = useTranslation()
  const label = useRoleLabel(role, t)
  if (role === 'content') {
    return (
      <span
        className="inline-flex items-center text-xs uppercase tracking-wide px-1.5 py-0.5 border rounded-xs"
        style={{ color: 'var(--admin-color-primary)', borderColor: 'var(--admin-color-primary)' }}
      >{label}</span>
    )
  }
  if (role === 'seo') {
    return (
      <span
        className="inline-flex items-center text-xs uppercase tracking-wide px-1.5 py-0.5 border rounded-xs"
        style={{ color: 'var(--admin-color-status-warning-text)', borderColor: 'var(--admin-color-status-warning-text)' }}
      >{label}</span>
    )
  }
  if (role === 'manager') {
    return (
      <span
        className="inline-flex items-center text-xs uppercase tracking-wide px-1.5 py-0.5 border rounded-xs"
        style={{ color: 'var(--admin-color-text-primary)', borderColor: 'var(--admin-color-text-primary)' }}
      >{label}</span>
    )
  }
  return null
}

// Section card wrapper — matches CategoryDetail/BrandDetail "card-head + card-body" pattern.
// Required sections get a subtle red asterisk after the title instead of a loud "BẮT BUỘC" badge.
export function SectionCard({ title, badge, required, children }) {
  return (
    <div className="bb-card">
      <div className="bb-card-header">
        <h3>
          {title}
          {required && (
            <span
              className="ml-1 text-[var(--admin-color-status-danger-text)]"
              aria-label="bắt buộc"
              title="Bắt buộc"
            >*</span>
          )}
        </h3>
        {badge}
      </div>
      <div className="bb-card-body">{children}</div>
    </div>
  )
}

// Inline assignment guide — replaces the icon-only Popover in the header.
// Text comes from the editable product-assignment config (context), falling back to
// the i18n defaults whenever the admin has left a field empty / config hasn't loaded.
export function AssignmentBanner({ t }) {
  const cfg = useContext(AssignmentConfigContext)
  const title = cfg?.title || t('products.detail.assign.title')
  const roleContent = cfg?.roleContent || t('products.detail.assign.roleContent')
  const itemsContent = cfg?.itemsContent || t('products.detail.assign.itemsContent')
  const roleSeo = cfg?.roleSeo || t('products.detail.assign.roleSeo')
  const itemsSeo = cfg?.itemsSeo || t('products.detail.assign.itemsSeo')
  const roleManager = cfg?.roleManager || t('products.detail.assign.roleManager')
  const itemsManager = cfg?.itemsManager || t('products.detail.assign.itemsManager')
  return (
    <div className="px-4 py-3 bg-surface-muted border-b border-border">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Users size={12} />
        <span>{title}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-primary)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {roleContent}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {itemsContent}
          </div>
        </div>
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-status-warning-text)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {roleSeo}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {itemsSeo}
          </div>
        </div>
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-text-primary)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {roleManager}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {itemsManager}
          </div>
        </div>
      </div>
    </div>
  )
}

// Field shell — pass `full` to span both grid columns.
// `required` thêm dấu * đỏ sau nhãn + gắn aria-required vào control.
// Liên kết label↔control và gắn aria-invalid + aria-describedby khi có lỗi.
export function Field({ label, hint, error, count, countWarn, full, required, children }) {
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || fieldId,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        'aria-required': required ? true : children.props['aria-required'],
        'aria-describedby': cn(children.props['aria-describedby'], describedBy) || undefined,
      })
    : children

  return (
    <div className={cn('flex flex-col gap-1.5', full && 'md:col-span-2')}>
      {(label || count != null) && (
        <div className="flex justify-between items-baseline text-sm font-medium text-foreground/80">
          {label && (
            <label htmlFor={fieldId}>
              {label}
              {required && (
                <span
                  className="ml-1 text-[var(--admin-color-status-danger-text)]"
                  aria-label="bắt buộc"
                  title="Bắt buộc"
                >*</span>
              )}
            </label>
          )}
          {count != null && (
            <span
              className={cn(
                'text-xs tabular-nums text-muted-foreground',
                countWarn && 'text-[var(--admin-color-status-warning-text)] font-semibold',
              )}
            >
              {count}
            </span>
          )}
        </div>
      )}
      {control}
      {error
        ? (
          <span id={errorId} className="flex items-center gap-1 text-xs text-[var(--admin-color-status-danger-text)] font-semibold" role="alert">
            <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
            {error}
          </span>
        )
        : hint
          ? <span id={hintId} className="text-xs text-muted-foreground">{hint}</span>
          : null}
    </div>
  )
}

// Collapsible group header that wraps a run of SectionCards inside the "product" tab.
// Controlled (open/onToggle). Shows an inline hint (Bắt buộc / Tùy chọn) after the
// title and a danger-coloured error count on the right when a contained section fails
// validation. Children are unmounted while collapsed to keep the form light.
export function CollapsibleGroup({ title, hint, open, onToggle, errorCount = 0, children }) {
  const panelId = useId()
  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 border bg-surface-muted hover:bg-muted/60 transition-colors"
        style={errorCount ? { borderColor: 'var(--admin-color-status-danger-border)' } : undefined}
      >
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
        />
        <span className="font-semibold uppercase tracking-wide text-sm text-foreground">{title}</span>
        {hint && (
          <span className="text-xs font-normal normal-case text-muted-foreground hidden sm:inline">· {hint}</span>
        )}
        {errorCount > 0 && (
          <span className="ml-auto text-xs font-bold" style={{ color: 'var(--admin-color-status-danger-text)' }}>
            <span aria-hidden="true">{errorCount} lỗi</span>
            <span className="sr-only">{errorCount} lỗi cần sửa</span>
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} className="flex flex-col gap-6">
          {children}
        </div>
      )}
    </section>
  )
}
