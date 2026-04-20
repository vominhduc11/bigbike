export function PaginationControls({ pagination, onPageChange }) {
  if (!pagination) {
    return null
  }

  const { page, totalPages, totalItems } = pagination

  return (
    <div className="pagination">
      <span>
        {totalItems} items · Page {page}/{totalPages}
      </span>
      <div className="pagination-buttons">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  )
}
