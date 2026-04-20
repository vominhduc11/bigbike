export function ReadOnlyBanner({ warning }) {
  return (
    <div className="read-only-banner" role="status">
      <strong>Read-only shell:</strong>{' '}
      {warning ||
        'Admin mutation API is not implemented in this phase. This screen is foundation-only.'}
    </div>
  )
}
