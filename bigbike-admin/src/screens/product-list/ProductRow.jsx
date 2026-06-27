import { useTranslation } from 'react-i18next'
import { Check, Copy, ExternalLink, MoreHorizontal, Package, Pencil, Trash2, Undo2 } from 'lucide-react'
import { PublishStatusBadge } from '../../components/StatusBadge'
import { formatCurrencyVnd, formatDateTime, formatText } from '../../lib/formatters'
import { StockCell } from './cells'
import { categoryLabel } from './constants'

// Desktop table row for ProductListScreen. Behaviour is identical to the inline
// markup it replaced; state lives in the parent and is threaded via props.
export function ProductRow({
  product,
  navigate,
  canUpdate,
  checked,
  isDeleting,
  isRestoring,
  isMenuOpen,
  onToggleSelect,
  onToggleMenu,
  onCloseMenu,
  onDuplicate,
  onRestore,
  onPermanentDelete,
  onDelete,
}) {
  const { t } = useTranslation()
  const isTrashed = product.publishStatus === 'TRASH'
  const isBusy = isDeleting || isRestoring
  const block = product.homepageBlock
  const catName = categoryLabel(product)
  const detailPath = `/admin/products/${product.id}`

  // Tên SP là <a> link thật để Ctrl/Cmd-click hoặc chuột-giữa mở tab mới (hành vi
  // trình duyệt). Click trái thường vẫn điều hướng trong cùng tab qua SPA navigate.
  const handleNameClick = (e) => {
    e.stopPropagation() // chặn onClick của <tr> để không điều hướng kép
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return // để trình duyệt mở tab mới
    e.preventDefault()
    navigate(detailPath)
  }

  return (
    <tr className={checked ? 'selected' : ''} onClick={() => navigate(detailPath)}>
      <td className="col-check" onClick={(e) => { e.stopPropagation(); onToggleSelect(product.id) }}>
        <span
          className={`bb-cb${checked ? ' checked' : ''}`}
          role="checkbox"
          aria-checked={checked}
          aria-label={t('products.selectRow', { name: product.name, defaultValue: `Chọn ${product.name}` })}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              onToggleSelect(product.id)
            }
          }}
        >
          {checked && <Check size={11} />}
        </span>
      </td>
      <td>
        <div className="bb-product-cell">
          <span className="bb-product-thumb" style={{ width: 40, height: 40 }}>
            {product.image?.url ? (
              <img
                src={product.image.url}
                alt={product.image.alt || product.name}
                referrerPolicy="no-referrer"
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Package size={22} />
            )}
          </span>
          <a
            href={detailPath}
            className="bb-product-name-link"
            onClick={handleNameClick}
            title={t('common.openInNewTab')}
          >
            {formatText(product.name)}
          </a>
        </div>
      </td>
      <td className="mono hidden lg:table-cell">{formatText(product.sku, 'SKU TBD')}</td>
      <td className="num" style={{ fontWeight: 700 }}>
        {formatCurrencyVnd(product.price?.retailPrice)}
        {product.price?.salePrice ? (
          <div className="bb-cell-sub" style={{ textDecoration: 'line-through' }}>
            {formatCurrencyVnd(product.price.salePrice)}
          </div>
        ) : null}
      </td>
      <td><StockCell state={product.stockState} /></td>
      <td className="hidden xl:table-cell">
        {catName ? formatText(catName) : <span className="bb-muted">—</span>}
      </td>
      <td className="hidden 2xl:table-cell">
        {product.brand?.name ? formatText(product.brand.name) : <span className="bb-muted">—</span>}
      </td>
      <td className="hidden xl:table-cell">
        {!block || block === 'NONE' ? (
          <span className="bb-muted">—</span>
        ) : (
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>
            {t('products.homepageFeatured')}
            {Number.isFinite(product.homepageOrder) ? ` · #${product.homepageOrder}` : ''}
          </span>
        )}
      </td>
      <td><PublishStatusBadge value={product.publishStatus} /></td>
      <td className="bb-muted hidden lg:table-cell">{formatDateTime(product.updatedAt)}</td>
      <td className="col-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="bb-icon-btn"
          title={t('common.edit')}
          onClick={() => navigate(`/admin/products/${product.id}`)}
        >
          <Pencil size={14} />
        </button>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            className="bb-icon-btn"
            data-row-menu-trigger
            title={t('common.actions')}
            onClick={() => onToggleMenu(product.id)}
          >
            <MoreHorizontal size={15} />
          </button>
          {isMenuOpen && (
            <div className="bb-row-menu">
              <button type="button" onClick={() => { onCloseMenu(); navigate(detailPath) }}>
                <Pencil size={13} />{t('common.edit')}
              </button>
              <button type="button" onClick={() => { onCloseMenu(); window.open(detailPath, '_blank', 'noopener') }}>
                <ExternalLink size={13} />{t('common.openInNewTab')}
              </button>
              {canUpdate && (
                <button type="button" onClick={() => { onCloseMenu(); onDuplicate(product) }}>
                  <Copy size={13} />{t('products.duplicate')}
                </button>
              )}
              {canUpdate && isTrashed && (
                <>
                  <button type="button" disabled={isBusy} onClick={() => { onCloseMenu(); onRestore(product) }}>
                    <Undo2 size={13} />{isRestoring ? t('products.restoringLabel') : t('products.restore')}
                  </button>
                  <hr />
                  <button type="button" className="danger" disabled={isBusy} onClick={() => { onCloseMenu(); onPermanentDelete(product) }}>
                    <Trash2 size={13} />{t('common.permanentDelete', { defaultValue: 'Xóa vĩnh viễn' })}
                  </button>
                </>
              )}
              {canUpdate && !isTrashed && (
                <>
                  <hr />
                  <button type="button" className="danger" disabled={isBusy} onClick={() => { onCloseMenu(); onDelete(product) }}>
                    <Trash2 size={13} />{isDeleting ? t('products.deletingLabel') : t('common.delete')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
