"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/MediaImage";
import Link from "@/i18n/StorefrontLink";
import type { ChatProductCard } from "@/lib/api/client-api";
import { toProductPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/locale";

type BiProductCardProps = {
  product: ChatProductCard;
  locale: Locale;
  compact?: boolean;
};

function effectivePrice(product: ChatProductCard): number | null {
  const salePrice = Number(product.salePrice);
  if (Number.isFinite(salePrice) && salePrice > 0) return salePrice;
  const retailPrice = Number(product.retailPrice);
  return Number.isFinite(retailPrice) && retailPrice > 0 ? retailPrice : null;
}

function formatPrice(product: ChatProductCard, locale: Locale): string | null {
  const price = effectivePrice(product);
  if (price == null || (product.currency && product.currency !== "VND")) return null;
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);
}

export function BiProductCard({ product, locale, compact = false }: BiProductCardProps) {
  const t = useTranslations("Support");
  const name = product.name?.trim();
  const slug = product.slug?.trim();
  if (!name || !slug) return null;

  const price = formatPrice(product, locale);
  const stock = product.stockState === "IN_STOCK"
    ? { label: t("inStock"), className: "text-success", dotClassName: "bg-success" }
    : product.stockState === "OUT_OF_STOCK"
      ? { label: t("outOfStock"), className: "text-destructive", dotClassName: "bg-destructive" }
      : { label: t("stockUnconfirmed"), className: "text-muted-foreground", dotClassName: "bg-muted-foreground" };

  return (
    <article
      data-bi-product-card
      className={cn(
        "group flex min-w-0 border border-border bg-background transition-colors hover:border-brand focus-within:border-brand",
        compact ? "w-72 shrink-0 snap-start" : "w-full",
      )}
    >
      <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden border-r border-border bg-secondary md:size-30">
        <MediaImage
          image={product.imageUrl ? { url: product.imageUrl } : null}
          altFallback={name}
          width={240}
          height={240}
          className="size-full! min-h-0! border-0! object-contain p-2"
          sizes="120px"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="min-w-0">
          <h4 className="line-clamp-2 font-body text-product-card font-semibold leading-title text-foreground">
            {name}
          </h4>
          <p className="mt-2 font-body text-a5-meta font-semibold text-primary">
            {price ?? t("priceUnavailable")}
          </p>
          <p className={cn("mt-2 flex items-center gap-2 font-cta text-b5-label font-semibold uppercase tracking-wide", stock.className)}>
            <span className={cn("size-2 shrink-0 rounded-full!", stock.dotClassName)} aria-hidden="true" />
            {stock.label}
          </p>
        </div>
        <Button asChild variant="primary" size="sm" className="mt-4 w-full min-h-11 px-3">
          <Link href={toProductPath(slug, locale)}>{t("viewProduct")}</Link>
        </Button>
      </div>
    </article>
  );
}
