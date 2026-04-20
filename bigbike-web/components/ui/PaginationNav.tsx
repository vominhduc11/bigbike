import Link from "next/link";

type PaginationNavProps = {
  page: number;
  totalPages: number;
  makeHref: (nextPage: number) => string;
};

export function PaginationNav({ page, totalPages, makeHref }: PaginationNavProps) {
  if (totalPages <= 1) {
    return null;
  }

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  return (
    <nav className="bb-pagination" aria-label="Phan trang">
      {canGoPrevious ? (
        <Link href={makeHref(page - 1)} className="bb-button bb-button-secondary">
          Trang truoc
        </Link>
      ) : (
        <span className="bb-pagination-disabled">Trang truoc</span>
      )}

      <span className="bb-pagination-status">
        Trang {page} / {totalPages}
      </span>

      {canGoNext ? (
        <Link href={makeHref(page + 1)} className="bb-button bb-button-secondary">
          Trang sau
        </Link>
      ) : (
        <span className="bb-pagination-disabled">Trang sau</span>
      )}
    </nav>
  );
}

