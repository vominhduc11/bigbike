import { useTranslation } from 'react-i18next'
import { Copy, ExternalLink, Package, Pencil, Trash2, Undo2 } from 'lucide-react'
import { PublishStatusBadge } from '../../components/StatusBadge'
import { MobileCard } from '../../components/layout/MobileCardList'
import { formatCurrencyVnd, formatDateTime, formatText } from '../../lib/formatters'
import { StockCell } from './cells'
import { categoryLabel } from './constants'

// Mobile card variant of a product row for ProductListScreen.
export function ProductMobileCard({
  product,
  navigate,
  canUpdate,
  isDeleting,
  isRestoring,
  onDuplicate,
  onRestore,
  onPermanentDelete,
  onDelete,
}) {
  const { t } = useTranslation()
  const isTrashed = product.publishStatus === 'TRASH'
  const isBusy = isDeleting || isRestoring
  const block = product.homepageBlock
  const detailPath = `/admin/products/${product.id}`

  return (
    <MobileCard
      title={(
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="bb-product-thumb" style={{ width: 32, height: 32, flexShrink: 0 }}>
            {product.image?.url ? (
              <img
                src={product.image.url}
                alt={product.image.alt || product.name}
                referrerPolicy="no-referrer"
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Package size={18} />
            )}
          </span>
          {formatText(product.name)}
        </span>
      )}
      subtitle={formatText(product.sku, 'SKU TBD')}
      status={<PublishStatusBadge value={product.publishStatus} />}
      meta={[
        {
          label: t('products.colPrice'),
          value: product.price?.salePrice ? (
            <span>
              {formatCurrencyVnd(product.price?.retailPrice)}
              <span style={{ textDecoration: 'line-through', marginLeft: 8 }}>
                {formatCurrencyVnd(product.price.salePrice)}
              </span>
            </span>
          ) : (
            formatCurrencyVnd(product.price?.retailPrice)
          ),
          tone: 'strong',
        },
        { label: t('products.colStock'), value: <StockCell state={product.stockState} /> },
        { label: t('products.colCategory'), value: categoryLabel(product) ? formatText(categoryLabel(product)) : <span className="bb-muted">—</span> },
        { label: t('products.colBrand'), value: product.brand?.name ? formatText(product.brand.name) : <span className="bb-muted">—</span> },
        {
          label: t('products.colHomepage'),
          value: (!block || block === 'NONE') ? (
            <span className="bb-muted">—</span>
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>
              {t('products.homepageFeatured')}
              {Number.isFinite(product.homepageOrder) ? ` · #${product.homepageOrder}` : ''}
            </span>
          ),
        },
        { label: t('products.colUpdated'), value: formatDateTime(product.updatedAt) },
      ]}
      actions={(
        <div onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="bb-icon-btn"
            title={t('common.edit')}
            onClick={() => navigate(detailPath)}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="bb-icon-btn"
            title={t('common.openInNewTab')}
            onClick={() => window.open(detailPath, '_blank', 'noopener')}
          >
            <ExternalLink size={14} />
          </button>
          {canUpdate && (
            <button
              type="button"
              className="bb-icon-btn"
              title={t('products.duplicate')}
              onClick={() => onDuplicate(product)}
            >
              <Copy size={14} />
            </button>
          )}
          {canUpdate && isTrashed && (
            <>
              <button
                type="button"
                className="bb-icon-btn"
                disabled={isBusy}
                title={isRestoring ? t('products.restoringLabel') : t('products.restore')}
                onClick={() => onRestore(product)}
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                className="bb-icon-btn danger"
                disabled={isBusy}
                title={t('common.permanentDelete', { defaultValue: 'Xóa vĩnh viễn' })}
                onClick={() => onPermanentDelete(product)}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          {canUpdate && !isTrashed && (
            <button
              type="button"
              className="bb-icon-btn"
              disabled={isBusy}
              title={isDeleting ? t('products.deletingLabel') : t('common.delete')}
              onClick={() => onDelete(product)}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
      onClick={() => navigate(detailPath)}
    />
  )
}
