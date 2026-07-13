/**
 * StickyActionBar — sticky bottom bar for primary/secondary actions.
 *
 * Used on detail screens and long forms. Sits at the bottom of the page-content
 * scroll container and stays visible as the user scrolls. On mobile, action
 * buttons stretch to full width.
 *
 * ariaLabel: accessible name for the toolbar (screen readers).
 * info: optional left-aligned status/info node (e.g., "Đã lưu lúc 10:23"). Rendered
 *       as a polite live region so autosave status is announced.
 * children: action buttons.
 */
export function StickyActionBar({ info, children, ariaLabel }) {
  return (
    <div className="sticky-action-bar" role="toolbar" aria-label={ariaLabel}>
      {info ? (
        <div className="sticky-action-bar-info" role="status" aria-live="polite">
          {info}
        </div>
      ) : null}
      {children}
    </div>
  )
}
