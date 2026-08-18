"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/MediaImage";
import { VariantPicker } from "@/components/catalog/purchase/VariantPicker";
import Link from "@/i18n/StorefrontLink";
import { fetchPublicProduct, type ChatProductCard } from "@/lib/api/client-api";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/contracts/public";
import { toProductPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";
import { collectAttributeNames, findMatchingVariant } from "@/lib/utils/variant-match";
import type { Locale } from "@/i18n/locale";

type BiProductCardProps = {
  product: ChatProductCard;
  locale: Locale;
  compact?: boolean;
  conversationId?: string;
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

export function BiProductCard({ product, locale, compact = false, conversationId }: BiProductCardProps) {
  const t = useTranslations("Support");
  const { addToCart } = useCart();
  const [detail, setDetail] = useState<Product | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"error" | "success" | "info">("info");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const name = product.name?.trim();
  const slug = product.slug?.trim();
  const variants = useMemo(() => detail?.variants ?? [], [detail?.variants]);
  const attributeNames = useMemo(() => Array.from(collectAttributeNames(variants)), [variants]);
  const selectedVariant = useMemo(
    () => findMatchingVariant(variants, selectedOptions, { requireAll: true }),
    [selectedOptions, variants],
  );

  if (!name || !slug) return null;

  async function loadDetail(): Promise<Product | null> {
    if (detail) return detail;
    setLoading(true);
    setNotice("");
    try {
      const loaded = await fetchPublicProduct(slug, locale);
      setDetail(loaded);
      return loaded;
    } catch {
      setNoticeKind("error");
      setNotice(t("productLoadError"));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function showVariantPicker() {
    setPickerOpen(true);
    const loaded = await loadDetail();
    if (loaded && (!loaded.variants || loaded.variants.length === 0)) {
      setNoticeKind("info");
      setNotice(t("noVariantNeeded"));
    }
  }

  function pick(attr: string, value: string) {
    setNotice("");
    setSelectedOptions((current) => ({ ...current, [attr]: value }));
  }

  async function handleAdd() {
    if (adding || loading) return;
    const loaded = await loadDetail();
    if (!loaded) return;
    const loadedVariants = loaded.variants ?? [];
    const loadedAttributes = Array.from(collectAttributeNames(loadedVariants));
    const variant = loadedVariants.length > 0
      ? findMatchingVariant(loadedVariants, selectedOptions, { requireAll: true })
      : null;
    if (loadedVariants.length > 0 && (loadedAttributes.some((attribute) => !selectedOptions[attribute]) || !variant)) {
      setPickerOpen(true);
      setNoticeKind("error");
      setNotice(t("selectVariantRequired"));
      return;
    }
    if (loaded.stockState === "OUT_OF_STOCK" || (variant && (!variant.isAvailable || variant.stockState === "OUT_OF_STOCK"))) {
      setNoticeKind("error");
      setNotice(t("selectedVariantOutOfStock"));
      return;
    }
    setAdding(true);
    setNotice("");
    try {
      await addToCart(loaded.id, 1, variant?.id, conversationId);
      setNoticeKind("success");
      setNotice(t("addedToCart"));
    } catch {
      setNoticeKind("error");
      setNotice(t("addToCartError"));
    } finally {
      setAdding(false);
    }
  }

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
        "group flex min-w-0 flex-col border border-border bg-background transition-colors hover:border-brand focus-within:border-brand",
        compact ? "w-72 shrink-0 snap-start" : "w-full",
      )}
    >
      <div className="flex min-w-0">
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
        </div>
      </div>
      <div className="grid gap-2 border-t border-border p-3">
        <Button asChild variant="primary" size="sm" className="min-h-11 w-full px-3">
          <Link href={toProductPath(slug, locale)}>{t("viewProduct")}</Link>
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" className="min-h-11 px-2" disabled={loading} onClick={() => void showVariantPicker()}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t("chooseVariant")}
          </Button>
          <Button type="button" size="sm" className="min-h-11 px-2" disabled={loading || adding || product.stockState === "OUT_OF_STOCK"} onClick={() => void handleAdd()}>
            {adding ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShoppingCart className="size-4" aria-hidden="true" />}
            {adding ? t("addingToCart") : t("addToCart")}
          </Button>
        </div>
        {pickerOpen && detail && variants.length > 0 ? (
          <div className="border-t border-border pt-3">
            <VariantPicker
              variants={variants}
              attributeNames={attributeNames}
              selectedOptions={selectedOptions}
              onPick={pick}
            />
            {selectedVariant && (!selectedVariant.isAvailable || selectedVariant.stockState === "OUT_OF_STOCK") ? (
              <p className="mt-3 font-body text-a5-meta font-semibold text-destructive">{t("selectedVariantOutOfStock")}</p>
            ) : null}
          </div>
        ) : null}
        {notice ? (
          <p
            role="status"
            className={cn(
              "font-body text-a5-meta",
              noticeKind === "error" && "font-semibold text-destructive",
              noticeKind === "success" && "font-semibold text-success",
              noticeKind === "info" && "text-muted-foreground",
            )}
          >
            {notice}
          </p>
        ) : null}
      </div>
    </article>
  );
}
