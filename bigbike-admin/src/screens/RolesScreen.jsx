import { Fragment } from 'react'
import { Check, Minus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'SHOP_MANAGER', 'EDITOR', 'AUTHOR', 'CONTRIBUTOR', 'SEO_EDITOR']

const PERMISSION_GROUPS = [
  {
    labelKey: 'roles.groupProducts',
    permissions: [
      { key: 'products.read',   labelKey: 'roles.permProductsRead' },
      { key: 'products.update', labelKey: 'roles.permProductsUpdate' },
      { key: 'catalog.read',    labelKey: 'roles.permCatalogRead' },
      { key: 'catalog.update',  labelKey: 'roles.permCatalogUpdate' },
    ],
  },
  {
    labelKey: 'roles.groupOrders',
    permissions: [
      { key: 'orders.read',      labelKey: 'roles.permOrdersRead' },
      { key: 'orders.write',     labelKey: 'roles.permOrdersWrite' },
      { key: 'customers.read',   labelKey: 'roles.permCustomersRead' },
      { key: 'customers.write',  labelKey: 'roles.permCustomersWrite' },
    ],
  },
  {
    labelKey: 'roles.groupContent',
    permissions: [
      { key: 'content.read',    labelKey: 'roles.permContentRead' },
      { key: 'content.update',  labelKey: 'roles.permContentUpdate' },
      { key: 'media.read',      labelKey: 'roles.permMediaRead' },
      { key: 'media.write',     labelKey: 'roles.permMediaWrite' },
      { key: 'menus.read',      labelKey: 'roles.permMenusRead' },
      { key: 'menus.write',     labelKey: 'roles.permMenusWrite' },
      { key: 'sliders.read',    labelKey: 'roles.permSlidersRead' },
      { key: 'sliders.write',   labelKey: 'roles.permSlidersWrite' },
      { key: 'home_videos.read',  labelKey: 'roles.permHomeVideosRead' },
      { key: 'home_videos.write', labelKey: 'roles.permHomeVideosWrite' },
      { key: 'redirects.read',  labelKey: 'roles.permRedirectsRead' },
      { key: 'redirects.write', labelKey: 'roles.permRedirectsWrite' },
    ],
  },
  {
    labelKey: 'roles.groupCommerce',
    permissions: [
      { key: 'coupons.read',    labelKey: 'roles.permCouponsRead' },
      { key: 'coupons.write',   labelKey: 'roles.permCouponsWrite' },
      { key: 'shipping.read',   labelKey: 'roles.permShippingRead' },
      { key: 'shipping.write',  labelKey: 'roles.permShippingWrite' },
      { key: 'reviews.read',    labelKey: 'roles.permReviewsRead' },
      { key: 'reviews.write',   labelKey: 'roles.permReviewsWrite' },
    ],
  },
  {
    labelKey: 'roles.groupSystem',
    permissions: [
      { key: 'settings.read',       labelKey: 'roles.permSettingsRead' },
      { key: 'settings.write',      labelKey: 'roles.permSettingsWrite' },
      { key: 'admin-users.read',    labelKey: 'roles.permAdminUsersRead' },
      { key: 'admin-users.write',   labelKey: 'roles.permAdminUsersWrite' },
      { key: 'audit-logs.read',     labelKey: 'roles.permAuditLogsRead' },
    ],
  },
]

// Mirrors AdminRolePermissions.MAP (backend single source of truth)
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: new Set(['*']),
  ADMIN: new Set([
    'products.read', 'products.update', 'catalog.read', 'catalog.update',
    'content.read', 'content.update',
    'orders.read', 'orders.write', 'customers.read', 'customers.write',
    'media.read', 'media.write', 'menus.read', 'menus.write',
    'sliders.read', 'sliders.write', 'home_videos.read', 'home_videos.write',
    'redirects.read', 'redirects.write',
    'coupons.read', 'coupons.write', 'shipping.read', 'shipping.write',
    'reviews.read', 'reviews.write',
    'settings.read', 'settings.write',
    'admin-users.read', 'admin-users.write', 'audit-logs.read',
  ]),
  SHOP_MANAGER: new Set([
    'products.read', 'products.update', 'catalog.read',
    'orders.read', 'orders.write', 'customers.read', 'customers.write',
    'coupons.read', 'coupons.write', 'shipping.read',
    'reviews.read', 'reviews.write',
  ]),
  EDITOR: new Set([
    'products.read', 'catalog.read',
    'content.read', 'content.update',
    'media.read', 'media.write', 'menus.read', 'menus.write',
    'sliders.read', 'sliders.write', 'redirects.read', 'redirects.write',
  ]),
  AUTHOR: new Set(['content.read', 'content.update', 'media.read', 'media.write']),
  CONTRIBUTOR: new Set(['content.read', 'media.read']),
  SEO_EDITOR: new Set(['content.read', 'content.update', 'redirects.read', 'redirects.write']),
}

function hasPermission(role, perm) {
  const set = ROLE_PERMISSIONS[role]
  if (!set) return false
  return set.has('*') || set.has(perm)
}

export function RolesScreen() {
  const { t } = useTranslation()

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('roles.eyebrow')}</p>
          <h1>{t('roles.title')}</h1>
          <p>{t('roles.description')}</p>
        </div>
      </header>

      <div style={{ marginBottom: 24 }}>
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>{t('roles.colPermission')}</th>
                {ROLES.map((role) => (
                  <th key={role} style={{ textAlign: 'center', minWidth: 110, fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 700 }}>{role.replace(/_/g, ' ')}</div>
                    <div style={{ fontWeight: 400, color: 'var(--admin-color-text-muted)', marginTop: 2 }}>
                      {t(`roles.roleDesc_${role}`)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <Fragment key={group.labelKey}>
                  <tr>
                    <td colSpan={ROLES.length + 1}
                        style={{ background: 'var(--admin-color-surface-2, #f7f8fa)', fontWeight: 600,
                                 fontSize: '0.75rem', color: 'var(--admin-color-text-muted)',
                                 letterSpacing: '0.05em', textTransform: 'uppercase', padding: '8px 16px' }}>
                      {t(group.labelKey)}
                    </td>
                  </tr>
                  {group.permissions.map((perm) => (
                    <tr key={perm.key}>
                      <td style={{ fontSize: '0.85rem' }}>
                        <div>{t(perm.labelKey)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', fontFamily: 'monospace' }}>{perm.key}</div>
                      </td>
                      {ROLES.map((role) => (
                        <td key={role} style={{ textAlign: 'center' }}>
                          {hasPermission(role, perm.key)
                            ? <Check size={16} style={{ color: '#16a34a' }} />
                            : <Minus size={14} style={{ color: '#d1d5db' }} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: '0.8rem', color: 'var(--admin-color-text-muted)', padding: '0 4px' }}>
        {t('roles.superAdminNote', { code: '*' })}
        {' '}{t('roles.assignNote')}
      </div>
    </section>
  )
}
