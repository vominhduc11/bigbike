import { Search } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchCopy = {
  action: string;
  fieldName: string;
  formLabel: string;
  inputId: string;
  inputLabel: string;
  placeholder: string;
  searchLabel: string;
};

type NotFoundRecoveryProps = {
  title: string;
  description: string;
  search: SearchCopy;
  navigationLabel: string;
  homeLink: ReactElement;
  productsLink: ReactElement;
  articlesLink: ReactElement;
};

/**
 * Shared 404 recovery block for both the localized storefront and the root
 * fallback that sits outside next-intl. Link elements stay caller-owned so the
 * storefront can preserve locale while the root fallback can use full reloads.
 */
export function NotFoundRecovery({
  title,
  description,
  search,
  navigationLabel,
  homeLink,
  productsLink,
  articlesLink,
}: NotFoundRecoveryProps) {
  return (
    <section
      data-not-found-recovery
      className="mx-auto flex w-full max-w-180 flex-col items-center py-6 text-center md:py-8"
    >
      <div className="relative select-none" aria-hidden="true">
        {/* Nhóm D: ngoại lệ trang trí nền duy nhất được dùng clamp(). */}
        <span
          data-typography-decorative
          className="font-body text-[clamp(6rem,18vw,11rem)] font-bold leading-none tracking-normal text-foreground/[0.07]"
        >
          404
        </span>
        <span className="absolute inset-0 flex items-center justify-center font-cta text-b1-display font-bold uppercase leading-none tracking-normal text-brand">
          404
        </span>
      </div>

      <h1 className="mt-4 font-body text-a1-title font-bold leading-title text-foreground">
        {title}
      </h1>
      <p className="mt-2 max-w-prose text-a4-content leading-body text-muted-foreground">
        {description}
      </p>

      <form
        action={search.action}
        method="get"
        role="search"
        aria-label={search.formLabel}
        className="mx-auto mt-6 flex w-full max-w-140 items-stretch overflow-hidden border border-border bg-card focus-within:border-ring focus-within:shadow-[var(--bb-focus-ring)]"
      >
        <label htmlFor={search.inputId} className="sr-only">
          {search.inputLabel}
        </label>
        <Input
          id={search.inputId}
          type="search"
          name={search.fieldName}
          required
          maxLength={100}
          placeholder={search.placeholder}
          className="h-12 min-w-0 flex-1 border-0 bg-transparent text-left text-a4-content focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Button
          type="submit"
          variant="primary"
          className="h-12 shrink-0 rounded-none px-4 py-0 sm:px-6"
          aria-label={search.searchLabel}
        >
          <Search className="size-5" aria-hidden />
          <span className="max-sm:sr-only">{search.searchLabel}</span>
        </Button>
      </form>

      <nav
        className="mt-4 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center"
        aria-label={navigationLabel}
      >
        <Button asChild variant="primary" className="w-full sm:w-auto">
          {homeLink}
        </Button>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          {productsLink}
        </Button>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          {articlesLink}
        </Button>
      </nav>
    </section>
  );
}
