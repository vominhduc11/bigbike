import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical, ImageOff, X } from 'lucide-react'
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
      style={sortable?.style}
      className={cn('bb-related-row', sortable?.isDragging && 'is-dragging')}
    >
      {canEdit && sortable && (
        <button
          type="button"
          {...sortable.handleProps}
          className="bb-related-grip"
          aria-label={t('products.detail.relatedDragHint')}
        >
          <GripVertical size={16} />
        </button>
      )}
      {chip.imageUrl ? (
        <span className="bb-related-thumb">
          <img
            src={resolveDisplayUrl(chip.imageUrl)}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </span>
      ) : (
        <div className="bb-related-thumb">
          <ImageOff size={16} />
        </div>
      )}
      <span className="bb-related-title" title={chip.name}>{chip.name}</span>
      {canEdit && (
        <button
          type="button"
          className="bb-related-remove"
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
  const tone = {
    content: 'bb-role-badge--content',
    seo: 'bb-role-badge--seo',
    manager: 'bb-role-badge--manager',
  }[role]
  if (!tone) return null
  return <span className={cn('bb-role-badge', tone)}>{label}</span>
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

// (Đã gỡ CollapsibleGroup — tab sản phẩm nay gấp/mở TỪNG thẻ qua prop `collapsible` của SectionCard,
// không còn bọc nhóm. Xem ProductDetailScreen openSections + components/SectionCard.jsx.)
