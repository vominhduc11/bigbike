import Link from "next/link";

type PaginationNavProps = {
  page: number;
  totalPages: number;
  makeHref: (nextPage: number) => string;
};

function buildPageList(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "…")[] = [1];
  if (page > 3) pages.push("…");
  for (let p = Math.max(2, page - 2); p <= Math.min(totalPages - 1, page + 2); p++) {
    pages.push(p);
  }
  if (page < totalPages - 2) pages.push("…");
  pages.push(totalPages);
  return pages;
}

export function PaginationNav({ page, totalPages, makeHref }: PaginationNavProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages);

  return (
    <nav className="bb-pagination" aria-label="Phân trang">
      {page > 1 ? (
        <Link href={makeHref(page - 1)} className="bb-button bb-button-secondary">
          Trang trước
        </Link>
      ) : (
        <button disabled className="bb-button bb-button-secondary">
          Trang trước
        </button>
      )}

      <div className="bb-pagination-pages">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="bb-pagination-ellipsis">…</span>
          ) : (
            <Link
              key={p}
              href={makeHref(p)}
              className={`bb-pagination-page${p === page ? " active" : ""}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Link>
          )
        )}
      </div>

      {page < totalPages ? (
        <Link href={makeHref(page + 1)} className="bb-button bb-button-secondary">
          Trang sau
        </Link>
      ) : (
        <button disabled className="bb-button bb-button-secondary">
          Trang sau
        </button>
      )}
    </nav>
  );
}
