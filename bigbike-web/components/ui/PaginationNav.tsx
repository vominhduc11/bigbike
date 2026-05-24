"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationNavProps = {
  page: number;
  totalPages: number;
  baseHref: string;
  variant?: "default" | "archive";
};

function buildPageList(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (page > 3) pages.push("...");
  for (let p = Math.max(2, page - 2); p <= Math.min(totalPages - 1, page + 2); p++) {
    pages.push(p);
  }
  if (page < totalPages - 2) pages.push("...");
  pages.push(totalPages);
  return pages;
}

export function PaginationNav({ page, totalPages, baseHref, variant = "default" }: PaginationNavProps) {
  const makeDefaultHref = (p: number) =>
    `${baseHref}${baseHref.includes("?") ? "&" : "?"}page=${p}`;
  const makeArchiveHref = (p: number) => {
    if (p <= 1) return baseHref;
    return `${baseHref}${baseHref.includes("?") ? "&" : "?"}paged=${p}`;
  };
  const makeHref = variant === "archive" ? makeArchiveHref : makeDefaultHref;
  const t = useTranslations("Catalog");
  if (totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages);

  if (variant === "archive") {
    return (
      <nav className="pagination pb-40 pt-20 text-right bb-archive-pagination" aria-label={t("paginationAria")}>
        <div className="text-right">
          <div className="paginate-links">
            <ul className="page-numbers">
              {page > 1 && (
                <li>
                  <Link href={makeHref(page - 1)} className="prev page-numbers" aria-label={t("previousPage")}>
                    <i className="fal fa-angle-left bb-archive-page-icon" aria-hidden="true" />
                  </Link>
                </li>
              )}
              {pages.map((p, i) => (
                <li key={p === "..." ? `ellipsis-${i}` : p}>
                  {p === "..." ? (
                    <span className="page-numbers dots">…</span>
                  ) : p === page ? (
                    <span className="page-numbers current">{p}</span>
                  ) : (
                    <Link href={makeHref(p)} className="page-numbers">
                      {p}
                    </Link>
                  )}
                </li>
              ))}
              {page < totalPages && (
                <li>
                  <Link href={makeHref(page + 1)} className="next page-numbers" aria-label={t("nextPage")}>
                    <i className="fal fa-angle-right bb-archive-page-icon" aria-hidden="true" />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="mt-6 flex items-center justify-center gap-3 flex-wrap" aria-label={t("paginationAria")}>
      {page > 1 ? (
        <Button asChild variant="secondary" size="icon">
          <Link href={makeHref(page - 1)} aria-label={t("previousPage")}><ChevronLeft className="w-4 h-4" /></Link>
        </Button>
      ) : (
        <Button variant="secondary" size="icon" disabled aria-label={t("previousPage")}><ChevronLeft className="w-4 h-4" /></Button>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="inline-flex h-9 min-w-7 items-center justify-center text-sm text-muted-foreground">...</span>
          ) : (
            <Link
              key={p}
              href={makeHref(p)}
              aria-current={p === page ? "page" : undefined}
              className={
                p === page
                  ? "bb-pagination-page inline-flex items-center justify-center no-underline"
                  : "bb-pagination-page inline-flex items-center justify-center no-underline hover:text-brand"
              }
            >
              {p}
            </Link>
          )
        )}
      </div>

      {page < totalPages ? (
        <Button asChild variant="secondary" size="icon">
          <Link href={makeHref(page + 1)} aria-label={t("nextPage")}><ChevronRight className="w-4 h-4" /></Link>
        </Button>
      ) : (
        <Button variant="secondary" size="icon" disabled aria-label={t("nextPage")}><ChevronRight className="w-4 h-4" /></Button>
      )}
    </nav>
  );
}
