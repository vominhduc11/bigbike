import { StockStatusBadge } from '../../components/StatusBadge'

// Stock cell: the colour-coded Còn hàng / Hết hàng state badge. Inventory is now
// a simple availability toggle (no quantity number), so only the badge is shown.
export function StockCell({ state }) {
  return (
    <span className="inline-flex items-center gap-2">
      <StockStatusBadge value={state} />
    </span>
  )
}
