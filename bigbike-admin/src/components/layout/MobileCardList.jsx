import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

/**
 * MobileCardList — list-as-cards layout for narrow screens.
 *
 * The wrapper itself is .show-on-mobile, so on desktop and tablet it is
 * hidden and the table view shows instead. Use alongside an AdminTable
 * wrapped in .hide-on-mobile.
 */
export function MobileCardList({ children, className }) {
  const cls = ['mobile-card-list', 'show-on-mobile', className].filter(Boolean).join(' ')
  return <ul className={cls}>{children}</ul>
}

/**
 * MobileCard — single card representing one row.
 *
 * Slots:
 *  - title / subtitle: head row
 *  - status: rendered on the right of the head row (typically a status badge)
 *  - meta: array of { label, value, tone? } pairs rendered as a 2-column grid
 *  - actions: action button row (rendered with top border)
 *  - selectable/selected/onSelectChange: khi selectable, hiện Checkbox chọn dòng ở đầu card
 *    (khôi phục năng lực bulk trên mobile — desktop dùng cột checkbox trong bảng)
 */
export function MobileCard({
  title,
  subtitle,
  status,
  meta = [],
  actions,
  onClick,
  selectable = false,
  selected = false,
  onSelectChange,
  selectionLabel = 'Chọn hàng',
}) {
  // `meta` sai kiểu (chuỗi thay vì mảng) từng làm sập nguyên màn hình qua ErrorBoundary.
  // Bỏ qua giá trị không hợp lệ: thẻ mất phần meta, phần còn lại vẫn xem được.
  const metaRows = Array.isArray(meta) ? meta : []

  function valueClass(tone) {
    if (tone === 'strong') return 'mobile-card-meta-value mobile-card-meta-value--strong'
    if (tone === 'danger') return 'mobile-card-meta-value mobile-card-meta-value--danger'
    return 'mobile-card-meta-value'
  }

  // Body = head + meta. Khi có onClick, chỉ bọc PHẦN BODY trong <button> để
  // tránh nút lồng nút (actions chứa <button> riêng) — DOM hợp lệ + a11y đúng.
  const body = (
    <>
      {(title || subtitle || status) && (
        <div className="mobile-card-head">
          <div className="min-w-0 flex-1">
            {title ? <div className="mobile-card-title break-words">{title}</div> : null}
            {subtitle ? (
              <div className="mobile-card-subtitle break-words [overflow-wrap:anywhere]">
                {subtitle}
              </div>
            ) : null}
          </div>
          {status ? <div className="shrink-0">{status}</div> : null}
        </div>
      )}
      {metaRows.length > 0 && (
        <div className="mobile-card-meta">
          {metaRows.map((m, i) => (
            <div key={i} className="mobile-card-meta-row">
              <span className="mobile-card-meta-label">{m.label}</span>
              <span className={valueClass(m.tone)}>{m.value ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const main = onClick ? (
    <Button
      variant="unstyled"
      onClick={onClick}
      className="mobile-card-main block w-full cursor-pointer border-0 bg-transparent p-0 text-left text-inherit [font:inherit]"
    >
      {body}
    </Button>
  ) : (
    body
  )

  return (
    <li className="mobile-card">
      {selectable ? (
        <div className="flex items-start gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelectChange}
            aria-label={selectionLabel}
            className="mt-0.5 shrink-0"
          />
          <div className="min-w-0 flex-1">{main}</div>
        </div>
      ) : (
        main
      )}
      {actions ? <div className="mobile-card-actions">{actions}</div> : null}
    </li>
  )
}
