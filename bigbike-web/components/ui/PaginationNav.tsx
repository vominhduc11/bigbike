import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        <Button asChild variant="secondary" size="sm">
          <Link href={makeHref(page - 1)}>Trang trước</Link>
        </Button>
      ) : (
        <Button variant="secondary" size="sm" disabled>Trang trước</Button>
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
        <Button asChild variant="secondary" size="sm">
          <Link href={makeHref(page + 1)}>Trang sau</Link>
        </Button>
      ) : (
        <Button variant="secondary" size="sm" disabled>Trang sau</Button>
      )}
    </nav>
  );
}
