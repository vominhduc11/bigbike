import { useContext, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, GripVertical, ImageOff, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveDisplayUrl } from '@/lib/contracts'
import { AssignmentBanner as AssignmentBannerView } from '@/components/AssignmentBanner'
import { AssignmentConfigContext } from './constants'

// Returns the configured role label for a role key, or the i18n default when the admin hasn't
// customised it / has deleted the original dynamic role entirely (kept as a graceful fallback
// rather than disappearing — the ~20 RoleBadge call sites throughout ProductDetailScreen still
// need SOME label for content/seo/manager regardless of what Super Admin does to the roles list
// in Settings → Phân công).
function useRoleLabel(role, t) {
  const cfg = useContext(AssignmentConfigContext)
  const match = cfg?.roles?.find((r) => r.id === role)
  if (match) return match.name
  if (role === 'content') return t('products.detail.assign.roleContent', { defaultValue: 'Content' })
  if (role === 'seo') return t('products.detail.assign.roleSeo', { defaultValue: 'SEO' })
  if (role === 'manager') return t('products.detail.assign.roleManager', { defaultValue: 'Quản lý' })
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

// SectionCard đã chuyển sang component dùng chung: src/components/SectionCard.jsx

// Inline assignment guide — replaces the icon-only Popover in the header.
// Thin adapter over the shared, purely-presentational AssignmentBanner (same component the
// content/article editor's banner renders — both read the SAME product-assignment config, just
// via different mount points/contexts). Falls back to the i18n title default whenever the admin
// hasn't set a custom title / config hasn't loaded; `roles` defaults to `[]` so a stale-frontend
// deploy against a not-yet-migrated backend degrades instead of crashing on `.map()`.
export function AssignmentBanner({ t }) {
  const cfg = useContext(AssignmentConfigContext)
  return (
    <AssignmentBannerView
      title={cfg?.title || t('products.detail.assign.title')}
      roles={cfg?.roles ?? []}
    />
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
