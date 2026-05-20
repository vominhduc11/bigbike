"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const t = useTranslations("Catalog");
  if (totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages);

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
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="inline-flex h-9 min-w-7 items-center justify-center text-sm text-muted-foreground">…</span>
          ) : (
            <Link
              key={p}
              href={makeHref(p)}
              aria-current={p === page ? "page" : undefined}
              className={
                p === page
                  ? "bb-pagination-page inline-flex items-center justify-center min-w-9 h-9 px-[6px] border text-sm no-underline bg-brand border-brand text-white pointer-events-none"
                  : "bb-pagination-page inline-flex items-center justify-center min-w-9 h-9 px-[6px] border border-border text-muted-foreground text-sm no-underline transition-all duration-[var(--bb-duration-fast)] hover:border-[var(--bb-border-brand)] hover:text-brand"
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
