"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/MediaImage";
import { VariantPicker } from "@/components/catalog/purchase/VariantPicker";
import Link from "@/i18n/StorefrontLink";
import {
  attachCartAssistantAttribution,
  fetchPublicProduct,
  recordChatInteraction,
  type ChatProductCard,
} from "@/lib/api/client-api";
import { saveChatAttributionProof } from "@/lib/chat/chat-attribution";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/contracts/public";
import { toCartPath, toCheckoutPath, toProductPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";
import { collectAttributeNames, findMatchingVariant } from "@/lib/utils/variant-match";
import type { Locale } from "@/i18n/locale";

type BigBikeProductCardProps = {
  product: ChatProductCard;
  locale: Locale;
  conversationId?: string;
  assistantMessageId?: string;
  visitorToken?: string;
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

export function BigBikeProductCard({
  product,
  locale,
  conversationId,
  assistantMessageId,
  visitorToken,
}: BigBikeProductCardProps) {
  const t = useTranslations("Support");
  const { addToCart } = useCart();
  const [detail, setDetail] = useState<Product | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"error" | "success" | "info">("info");
  const [cartCount, setCartCount] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const attributionRequestRef = useRef<Promise<string | null> | null>(null);
  const name = product.name?.trim();
  const slug = product.slug?.trim();
  const variants = useMemo(() => detail?.variants ?? [], [detail?.variants]);
  const attributeNames = useMemo(() => Array.from(collectAttributeNames(variants)), [variants]);
  const selectedVariant = useMemo(
    () => findMatchingVariant(variants, selectedOptions, { requireAll: true }),
    [selectedOptions, variants],
  );

  if (!name || !slug) return null;

  async function ensureAttribution(): Promise<string | null> {
    if (!conversationId || !assistantMessageId) return null;
    if (attributionRequestRef.current) return attributionRequestRef.current;
    attributionRequestRef.current = (async () => {
      try {
        const interaction = await recordChatInteraction({
          clientEventId: crypto.randomUUID(),
          conversationId,
          assistantMessageId,
          type: "PRODUCT_VIEWED",
          productSlug: slug,
          visitorToken,
        });
        const token = interaction.attributionToken?.trim();
        const expiresAt = interaction.attributionExpiresAt
          ? new Date(interaction.attributionExpiresAt).getTime()
          : Number.NaN;
        if (!token || !Number.isFinite(expiresAt)) return null;
        saveChatAttributionProof({ productSlug: slug, token, expiresAt });

        // If this product was already in the current cart, attach the new last touch without
        // changing its quantity or price. A missing cart line is expected and safely ignored.
        try {
          const loaded = detail ?? await fetchPublicProduct(slug, locale);
          if (!detail) setDetail(loaded);
          await attachCartAssistantAttribution(loaded.id, token);
        } catch {
          // The normal add-to-cart path will apply the proof later.
        }
        return token;
      } catch {
        return null;
      } finally {
        attributionRequestRef.current = null;
      }
    })();
    return attributionRequestRef.current;
  }

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

  function pick(attr: string, value: string) {
    setNotice("");
    setSelectedOptions((current) => ({ ...current, [attr]: value }));
  }

  async function handleAdd(loadedOverride?: Product) {
    if (adding || loading) return;
    const loaded = loadedOverride ?? await loadDetail();
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
      const attributionToken = await ensureAttribution();
      const cart = await addToCart(
        loaded.id,
        1,
        variant?.id,
        conversationId,
        undefined,
        true,
        slug,
        attributionToken ?? undefined,
      );
      setNoticeKind("success");
      const selection = variant?.name?.trim() || Object.values(selectedOptions).filter(Boolean).join(" / ");
      setNotice(selection
        ? t("addedToCartDetailWithVariant", { name, variant: selection })
        : t("addedToCartDetail", { name }));
      setCartCount(cart.items.reduce((sum, item) => sum + item.quantity, 0));
    } catch {
      setNoticeKind("error");
      setNotice(t("addToCartError"));
    } finally {
      setAdding(false);
    }
  }

  async function handleChooseBuy() {
    if (adding || loading) return;
    const loaded = await loadDetail();
    if (!loaded) return;
    const loadedVariants = loaded.variants ?? [];
    if (loadedVariants.length > 0 && !pickerOpen) {
      setPickerOpen(true);
      return;
    }
    await handleAdd(loaded);
  }

  const price = formatPrice(product, locale);
  const stock = product.stockState === "IN_STOCK"
    ? { label: t("inStock"), className: "text-success", dotClassName: "bg-success" }
    : product.stockState === "OUT_OF_STOCK"
      ? { label: t("outOfStock"), className: "text-destructive", dotClassName: "bg-destructive" }
      : { label: t("stockUnconfirmed"), className: "text-muted-foreground", dotClassName: "bg-muted-foreground" };

  return (
    <article
      data-bigbike-product-card
      className="group flex w-full min-w-0 max-w-full flex-col overflow-hidden border border-border bg-background transition-colors hover:border-brand focus-within:border-brand"
    >
      <Link
        href={toProductPath(slug, locale)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 text-inherit no-underline"
        onClick={() => void ensureAttribution()}
      >
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden border-r border-border bg-secondary">
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
      </Link>
      <div className="grid gap-2 border-t border-border p-3">
        {pickerOpen && detail && variants.length > 0 ? (
          <div className="min-w-0 max-w-full overflow-hidden border-b border-border pb-3">
            <VariantPicker
              variants={variants}
              attributeNames={attributeNames}
              selectedOptions={selectedOptions}
              onPick={pick}
              disableUnavailableOptions
            />
            {selectedVariant && (!selectedVariant.isAvailable || selectedVariant.stockState === "OUT_OF_STOCK") ? (
              <p className="mt-3 font-body text-a5-meta font-semibold text-destructive">{t("selectedVariantOutOfStock")}</p>
            ) : null}
          </div>
        ) : null}
        {noticeKind !== "success" ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 w-full px-3"
            disabled={loading || adding || product.stockState === "OUT_OF_STOCK"}
            onClick={() => void handleChooseBuy()}
          >
            {adding || loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShoppingCart className="size-4" aria-hidden="true" />}
            {adding || loading ? t("addingToCart") : t("chooseBuy")}
          </Button>
        ) : null}
        {notice ? (
          <div
            role="status"
            className={cn(
              "min-w-0 border p-3 font-body text-a5-meta",
              noticeKind === "error" && "font-semibold text-destructive",
              noticeKind === "success" && "border-success bg-background text-foreground",
              noticeKind === "info" && "text-muted-foreground",
            )}
          >
            {noticeKind === "success" ? (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold leading-relaxed">{notice}</p>
                  {cartCount != null ? <p className="mt-1 text-muted-foreground">{t("cartItemCount", { count: cartCount })}</p> : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm" className="min-h-11 min-w-0 px-2">
                      <Link href={toCartPath(locale)}>{t("viewCart")}</Link>
                    </Button>
                    <Button asChild size="sm" className="min-h-11 min-w-0 px-2">
                      <Link href={toCheckoutPath(locale)}>{t("checkout")}</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : notice}
          </div>
        ) : null}
      </div>
    </article>
  );
}
