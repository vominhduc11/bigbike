/**
 * StickyActionBar — sticky bottom bar for primary/secondary actions.
 *
 * Used on detail screens and long forms. Sits at the bottom of the page-content
 * scroll container and stays visible as the user scrolls. On mobile, action
 * buttons stretch to full width.
 *
 * info: optional left-aligned status/info node (e.g., "Đã lưu lúc 10:23").
 * children: action buttons.
 */
export function StickyActionBar({ info, children }) {
  return (
    <div className="sticky-action-bar" role="toolbar">
      {info ? <div className="sticky-action-bar-info">{info}</div> : null}
      {children}
    </div>
  )
}
