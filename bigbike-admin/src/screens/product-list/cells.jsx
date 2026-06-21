import { useTranslation } from 'react-i18next'
import { StockStatusBadge } from '../../components/StatusBadge'

// Stock cell: prominent on-hand quantity (the number a shop manager actually
// scans for) plus the colour-coded state badge. Falls back to "—" when the
// product does not track inventory (stockQuantity === null).
export function StockCell({ quantity, state }) {
  const { t } = useTranslation()
  const hasQty = Number.isFinite(quantity)
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="font-semibold tabular-nums"
        style={{ minWidth: 26, textAlign: 'right' }}
        title={hasQty ? undefined : t('products.stockNotTracked')}
      >
        {hasQty ? quantity : '—'}
      </span>
      <StockStatusBadge value={state} />
    </span>
  )
}
