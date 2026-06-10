"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationNavProps = {
  page: number;
  totalPages: number;
  /** URL base for link-based pagination. Optional when `onPageChange` is used. */
  baseHref?: string;
  variant?: "default" | "archive";
  /**
   * When provided, the default variant renders buttons that call this instead
   * of navigating via URL — for paginating a section in place (e.g. reviews on
   * a product page) without changing the page URL.
   */
  onPageChange?: (page: number) => void;
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

export function PaginationNav({ page, totalPages, baseHref = "", variant = "default", onPageChange }: PaginationNavProps) {
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
    // Inline Tailwind port of the legacy .bb-archive-pagination rules. The unlayered
    // CSS set 20px/40px padding, beating the old (now-dropped) pb-40/pt-20 utilities,
    // so the effective rhythm is pt-5/pb-10. 1.5rem font + 1.2 line-height per WP parity.
    const itemCls = "inline-block px-2 text-ui-24 font-semibold";
    const linkBase =
      "inline-flex items-center justify-center px-2.5 py-[5px] text-ui-24 leading-[1.2] no-underline";
    // WP-parity: căn trái trên mobile (WP `.woocommerce-pagination` mobile), phải ở desktop.
    return (
      <nav className="m-0 pb-10 pt-5 text-left md:text-right" aria-label={t("paginationAria")}>
        <ul className="m-0 w-full list-none whitespace-nowrap p-0">
          {page > 1 && (
            <li className={itemCls}>
              <Link
                href={makeHref(page - 1)}
                className={`${linkBase} text-black hover:text-brand`}
                aria-label={t("previousPage")}
              >
                <ChevronLeft className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </li>
          )}
          {pages.map((p, i) => (
            <li key={p === "..." ? `ellipsis-${i}` : p} className={itemCls}>
              {p === "..." ? (
                <span className={`${linkBase} text-black`}>…</span>
              ) : p === page ? (
                <span className={`${linkBase} text-brand`}>{p}</span>
              ) : (
                <Link href={makeHref(p)} className={`${linkBase} text-black hover:text-brand`}>
                  {p}
                </Link>
              )}
            </li>
          ))}
          {page < totalPages && (
            <li className={itemCls}>
              <Link
                href={makeHref(page + 1)}
                className={`${linkBase} text-black hover:text-brand`}
                aria-label={t("nextPage")}
              >
                <ChevronRight className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </li>
          )}
        </ul>
      </nav>
    );
  }

  const pageClass = (isCurrent: boolean) =>
    isCurrent
      ? "bb-pagination-page inline-flex items-center justify-center no-underline"
      : "bb-pagination-page inline-flex items-center justify-center no-underline hover:text-brand";

  return (
    <nav className="mt-6 flex items-center justify-center gap-3 flex-wrap" aria-label={t("paginationAria")}>
      {page > 1 ? (
        onPageChange ? (
          <Button type="button" variant="secondary" size="icon" onClick={() => onPageChange(page - 1)} aria-label={t("previousPage")}><ChevronLeft className="w-4 h-4" /></Button>
        ) : (
          <Button asChild variant="secondary" size="icon">
            <Link href={makeHref(page - 1)} aria-label={t("previousPage")}><ChevronLeft className="w-4 h-4" /></Link>
          </Button>
        )
      ) : (
        <Button variant="secondary" size="icon" disabled aria-label={t("previousPage")}><ChevronLeft className="w-4 h-4" /></Button>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="inline-flex h-9 min-w-7 items-center justify-center text-sm text-muted-foreground">...</span>
          ) : onPageChange ? (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={pageClass(p === page)}
            >
              {p}
            </button>
          ) : (
            <Link
              key={p}
              href={makeHref(p)}
              aria-current={p === page ? "page" : undefined}
              className={pageClass(p === page)}
            >
              {p}
            </Link>
          )
        )}
      </div>

      {page < totalPages ? (
        onPageChange ? (
          <Button type="button" variant="secondary" size="icon" onClick={() => onPageChange(page + 1)} aria-label={t("nextPage")}><ChevronRight className="w-4 h-4" /></Button>
        ) : (
          <Button asChild variant="secondary" size="icon">
            <Link href={makeHref(page + 1)} aria-label={t("nextPage")}><ChevronRight className="w-4 h-4" /></Link>
          </Button>
        )
      ) : (
        <Button variant="secondary" size="icon" disabled aria-label={t("nextPage")}><ChevronRight className="w-4 h-4" /></Button>
      )}
    </nav>
  );
}
