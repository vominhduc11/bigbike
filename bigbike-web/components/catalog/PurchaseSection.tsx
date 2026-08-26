"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { BrandSummary, CategorySummary, GalleryMedia, Product, ProductCommitment, ProductPrice, ProductStockState, ProductVariant } from "@/lib/contracts/public";
import { useCart } from "@/lib/cart-context";
import { derivePricing } from "@/lib/pricing";
import { queryKeys } from "@/lib/query/keys";
import { formatVndNumber, safeText } from "@/lib/utils/format";
import { collectAttributeNames, findColorPreviewVariant, findMatchingVariant } from "@/lib/utils/variant-match";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { useLocalizedField, LHtml } from "@/components/i18n/LocalizedContent";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { MobileStickyPurchaseBar } from "@/components/catalog/MobileStickyPurchaseBar";
import { openWriteReviewDialog } from "@/components/catalog/writeReviewBus";
import { VariantPicker } from "./purchase/VariantPicker";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { CommitmentsList } from "./purchase/CommitmentsList";
import { RatingBlock } from "./purchase/RatingBlock";
import { BuyButtons } from "./purchase/BuyButtons";
import { reportStorefrontFailure } from "@/lib/observability/storefront-error";

type Props = {
  product: Product;
  gallery: GalleryMedia[];
  rating: number | null;
  ratingCount: number | null;
  /** Zalo URL từ settings (zalo_url) — dùng cho nút tư vấn thay thế "Mua ngay". */
  zaloUrl?: string;
  /** Live admin preview: render straight from the postMessage draft, no client snapshot poll. */
  previewMode?: boolean;
};

/** Shape trả về của /api/products/[slug]/snapshot — chỉ phần cần freshness (giá/tồn/variants). */
type ProductSnapshot = {
  pricing: { retailPrice: number; salePrice: number | null; discountPercent: number; currency: string };
  stock: { stockState: string; label: string };
  variants: ProductVariant[];
};

export function PurchaseSection({
  product,
  gallery,
  rating,
  ratingCount,
  zaloUrl,
  previewMode = false,
}: Props) {
  const tb = useTranslations("PdpBuyBox");
  const locale = useLocale();
  const { addToCart } = useCart();

  // ISR + CSR hybrid: mô tả/ảnh/thông số render từ props (ISR — phần cần SEO). GIÁ + TỒN
  // Trạng thái Còn/Hết được fetch lại ở CLIENT sau khi load để luôn tươi
  // → tồn đổi liên tục, không cần SEO). Props ISR là giá trị ban đầu hợp lệ nên cập nhật
  // liền mạch, KHÔNG layout-shift/skeleton; refetch khi quay lại tab.
  const { data: snapshot } = useQuery<ProductSnapshot>({
    // locale trong key → đổi ngôn ngữ refetch lại để tên màu/size đổi theo.
    queryKey: queryKeys.productSnapshot(product.slug, locale),
    queryFn: async () => {
      const res = await fetch(`/api/products/${product.slug}/snapshot/?lang=${locale}`);
      if (!res.ok) throw new Error("snapshot");
      return res.json() as Promise<ProductSnapshot>;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
    // Admin live preview renders an unsaved draft (slug may not exist yet) and gets
    // its price/stock from the postMessage payload — there's nothing to poll.
    enabled: !previewMode,
  });

  // Override giá/tồn bằng snapshot khi đã có; ảnh/gallery/options GIỮ NGUYÊN từ props
  // ISR — snapshot là projection "listing" nhẹ, KHÔNG mang variant.image/gallery (xem
  // CatalogReadService.getProductSnapshotByIdOrSlug), nên không được thay hẳn cả mảng
  // variants kẻo ảnh màu ở VariantPicker biến mất ngay sau khi poll xong.
  const variants = useMemo<ProductVariant[]>(() => {
    const base = product.variants ?? [];
    if (!snapshot) return base;
    const freshById = new Map(snapshot.variants.map((v) => [v.id, v]));
    return base.map((v) => {
      const fresh = freshById.get(v.id);
      return fresh
        ? { ...v, price: fresh.price, stockState: fresh.stockState, isAvailable: fresh.isAvailable }
        : v;
    });
  }, [snapshot, product.variants]);
  const freshPrice: ProductPrice = snapshot
    ? {
        retailPrice: snapshot.pricing.retailPrice,
        salePrice: snapshot.pricing.salePrice,
        currency: "VND",
      }
    : product.price;
  const freshStockState = (snapshot?.stock.stockState as ProductStockState | undefined) ?? product.stockState;

  const hasVariants = variants.length > 0;
  const attributeNames = useMemo(() => Array.from(collectAttributeNames(variants)), [variants]);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const selectedVariant = useMemo(
    () => (hasVariants ? findMatchingVariant(variants, selectedOptions, { requireAll: true }) : null),
    [variants, hasVariants, selectedOptions],
  );

  // Gallery color-scoped: chọn màu mới đổi gallery; chọn size không đổi.
  const colorVariant = useMemo(
    () => findColorPreviewVariant(variants, selectedOptions),
    [variants, selectedOptions],
  );

  const priceSource = selectedVariant?.price ?? freshPrice;
  const { current, retail, isSale } = derivePricing(priceSource);
  const showOld = isSale;

  // STOCK_RULE_009 — hiển thị buy-box PDP (display-only, KHÔNG đổi điều kiện mua
  // ở STOCK_RULE_005/006). Mô hình tồn kho giờ là boolean Còn/Hết — KHÔNG hiển thị
  // số lượng, KHÔNG còn tầng "Sắp hết". Trạng thái lấy từ biến thể đã chọn (nếu có)
  // hoặc trạng thái tổng của sản phẩm.
  const unitState = selectedVariant?.stockState ?? freshStockState;
  const isOutOfStock = unitState === "OUT_OF_STOCK";
  // Ở chế độ xem trước (admin) luôn KHÔNG cho mua: sản phẩm nháp chưa có trong kho,
  // mọi thao tác mua sẽ vô nghĩa/đổ lỗi. canBuy=false vô hiệu hoá cả nút thêm giỏ,
  // mua ngay (disabled) lẫn thanh mua cố định trên mobile (mirror trạng thái nút gốc).
  const canBuy =
    !previewMode && !isOutOfStock && (!hasVariants || (!!selectedVariant && selectedVariant.isAvailable));

  // Đánh giá là section flat luôn hiển thị (không còn là tab) — cuộn thẳng tới #reviews.
  function scrollToReviews(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Viết đánh giá: mở modal (WriteReviewDialog) thay vì cuộn xuống khối đánh giá.
  // Khối đánh giá dưới chỉ để XEM; mọi thao tác viết đều qua modal này.
  function openWriteReview(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    openWriteReviewDialog();
  }

  function pick(attr: string, value: string) {
    setSelectedOptions((prev) => {
      const next = { ...prev };
      if (next[attr] === value) delete next[attr];
      else next[attr] = value;
      return next;
    });
  }

  async function handleAdd() {
    if (!canBuy || adding) return;
    setAddError("");
    setAdding(true);
    try {
      await addToCart(
        product.id,
        quantity,
        selectedVariant?.id || undefined,
        undefined,
        undefined,
        false,
        product.slug,
      );
    } catch (error) {
      reportStorefrontFailure("add_to_cart", error);
      setAddError(tb("addToCartFailed"));
    } finally {
      setAdding(false);
    }
  }

  // Đổi ngôn ngữ ở CLIENT: tên lấy bản EN từ LocalizedContentProvider nếu có, fallback bản `vi`
  // (render đầu khớp server, giữ ISR/SEO).
  const enName = useLocalizedField<string>("name");
  const name = safeText(
    locale === "en" ? enName : product.name,
    product.name,
  );

  // Dải tin cậy (V257) — HTML (EN override hoặc bản vi) là nguồn render duy nhất, sanitize
  // (cho phép CSS inline); không còn dải badge có cấu trúc để fallback.
  const enTrustHtml = useLocalizedField<string>("trustBadges");
  const trustBadgesResolvedHtml =
    locale === "en" ? enTrustHtml ?? product.trustBadges ?? "" : product.trustBadges ?? "";

  // Mô tả ngắn nằm trong khối mua hàng (dưới đánh giá, trên phần chọn biến thể) — vị trí gốc.
  // Đổi ngôn ngữ qua LHtml (field "shortDescription"); trống → không render.
  const shortDescriptionHtml = product.shortDescription
    ? sanitizeRichHtml(product.shortDescription, { allowInlineStyles: true })
    : "";

  // Eyebrow chỉ dành cho danh mục. Thương hiệu được tách thành một dòng có liên kết
  // riêng gần tên sản phẩm, không còn nằm trong breadcrumb.
  // category.name/brand.name/originBrandCountry resolve theo locale ở backend
  // (toCategorySummary/toBrandSummary/pick) — đọc qua useLocalizedField như commitments/
  // trustBadges ở trên (V319: originBrandCountry có cột *_en riêng).
  const enCategory = useLocalizedField<CategorySummary>("category");
  const activeCategory = locale === "en" ? enCategory ?? product.category : product.category;
  const eyebrowCategory =
    activeCategory?.slug === "chua-phan-loai" ||
    activeCategory?.slug === "uncategorized" ||
    activeCategory?.visible === false ||
    activeCategory?.deleted === true
      ? ""
      : safeText(activeCategory?.name, "");
  const enBrand = useLocalizedField<BrandSummary>("brand");
  const activeBrand = locale === "en" ? enBrand ?? product.brand : product.brand;
  const enOriginBrandCountry = useLocalizedField<string>("originBrandCountry");
  const activeOriginBrandCountry =
    locale === "en" ? enOriginBrandCountry ?? product.originBrandCountry : product.originBrandCountry;
  const originLabel = safeText(activeOriginBrandCountry, "");
  const brandLabel = safeText(activeBrand?.name, "");

  // Khối "cam kết" dưới nút mua (V232) — quản theo TỪNG sản phẩm; khối ngoài tab → rỗng thì ẩn cả khối.
  // Đổi ngôn ngữ qua LocalizedContentProvider (như enName/enTrustHtml ở trên) — bản EN nếu có, không thì fallback bản vi.
  const enCommitments = useLocalizedField<ProductCommitment[]>("commitments");
  const commitments: ProductCommitment[] =
    (locale === "en" ? enCommitments ?? product.commitments : product.commitments) ?? [];

  return (
    <>
    <div
      data-purchase-section
      className="grid items-start gap-8 min-[1024px]:grid-cols-12"
      itemProp="itemReviewed"
      itemScope
      itemType="https://schema.org/Product"
    >
      {/* Gallery col — dùng ProductGallery (Swiper) y như PurchaseSectionClient.
          Ảnh chính + dải thumbnail là 2 Swiper liên kết qua module Thumbs; tập media
          (ảnh + VIDEO, cover-đầu + khử trùng + theo màu) do ProductGallery tự xử lý.
          V248: video nằm NGAY TRONG dải gallery (admin đăng cùng ảnh, theo từng màu) —
          tách khỏi mục "Video" riêng phía dưới (product.videos). */}
      <div className="min-w-0 min-[1024px]:sticky min-[1024px]:top-[calc(var(--bb-header-height)+1rem)] min-[1024px]:z-20 min-[1024px]:col-span-7 min-[1024px]:self-start">
        <ProductGallery
          mainImage={product.image}
          gallery={gallery}
          altFallback={name}
          variantImage={colorVariant?.image ?? null}
          variantGallery={colorVariant?.gallery ?? undefined}
          variantKey={colorVariant?.id ?? null}
        />
      </div>

      {/* Info col */}
      <div data-purchase-info className="min-w-0 min-[1024px]:col-span-5">
        <div className="min-w-0">
          {/* Eyebrow + dải tin cậy: 2 dòng nhỏ trên tiêu đề. KHÔNG dùng <ul>/<li> để né
              dấu đầu dòng của theme WP; chấm phân cách tự vẽ, chỉ chen GIỮA các mục. */}
          {trustBadgesResolvedHtml.trim() ? (
            <div
              className="mb-10 leading-none max-md:hidden! [&_*]:leading-none [&_a]:text-inherit! [&_p]:mb-0"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(trustBadgesResolvedHtml, { allowInlineStyles: true }) }}
            />
          ) : null}
          {eyebrowCategory ? (
            <p className="mb-0 font-barlow text-pdp-eyebrow font-semibold uppercase leading-none tracking-display text-brand">
              {eyebrowCategory}
            </p>
          ) : null}
          {originLabel || brandLabel ? (
            <p className="mb-2 mt-2 font-body text-a5-meta text-muted-foreground">
              {originLabel ? `${originLabel}${brandLabel ? " / " : ""}` : null}
              {brandLabel && activeBrand?.slug ? (
                <LocalizedLink
                  kind="brand"
                  viSlug={activeBrand.slug}
                  className="font-semibold text-foreground underline-offset-4 hover:text-brand hover:underline"
                >
                  {brandLabel}
                </LocalizedLink>
              ) : brandLabel}
            </p>
          ) : null}
          <div itemProp="name">
            <h1
              data-bigbike-product-name
              className="mb-5 font-body text-a1-title font-semibold leading-title text-foreground"
            >
              {name}
            </h1>
          </div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="m-0 flex flex-wrap items-baseline gap-x-3">
                <span className="font-body text-a1-title font-bold leading-tight text-brand">{formatVndNumber(current)} ₫</span>
                {showOld ? <del className="font-body text-a4-content text-muted-foreground">{formatVndNumber(retail)} ₫</del> : null}
              </p>
            </div>
            <div className="status">
              <p
                className={[
                  "stock relative m-0 h-10.5 w-full max-w-47.5 border-0 bg-transparent px-8 text-center font-cta text-b4-action font-semibold uppercase leading-none text-white",
                  "after:absolute after:inset-0 after:z-0 after:h-10.5 after:w-full after:[transform:skewX(-20deg)] after:transition-colors after:duration-normal",
                  isOutOfStock ? "out-of-stock after:bg-brand" : "in-stock after:bg-foreground",
                ].join(" ")}
              >
                <span className="relative z-[2] inline-flex min-h-10.5 items-center justify-center leading-none">
                  {isOutOfStock ? tb("stockOut") : tb("stockIn")}
                </span>
              </p>
            </div>
          </div>
          <RatingBlock
            rating={rating}
            ratingCount={ratingCount}
            onScrollToReviews={scrollToReviews}
            onOpenWriteReview={openWriteReview}
            previewMode={previewMode}
          />

          {shortDescriptionHtml ? (
            <div className="mt-6 font-body text-a4-content leading-7 text-foreground [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6">
              <LHtml
                field="shortDescription"
                viHtml={shortDescriptionHtml}
                allowInlineStyles
                className=""
              />
            </div>
          ) : null}

          {/* Đường kẻ phân tách Mô tả ngắn với khu chọn biến thể (Màu sắc / Size),
              thay cho dòng nhắc "Vui lòng chọn size/màu sắc…" trước đây. */}
          {hasVariants ? <hr className="mb-2 mt-4 border-0 border-t border-border" /> : null}

          <div className="mt-8">
            <div>
              {hasVariants ? (
                <VariantPicker
                  variants={variants}
                  attributeNames={attributeNames}
                  selectedOptions={selectedOptions}
                  onPick={pick}
                />
              ) : null}

              <div className="mt-6">
                <div>
                  <div className="flex items-center gap-4">
                    <label htmlFor="bb-qty" className="min-w-24 font-cta text-b4-action font-semibold uppercase text-foreground">
                      {tb("quantity")}
                    </label>
                    <QuantityStepper
                      variant="pdp"
                      value={quantity}
                      onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
                      onIncrease={() => setQuantity((current) => current + 1)}
                      onValueChange={(next) => setQuantity(Math.max(1, next || 1))}
                      decreaseLabel={tb("decreaseQty")}
                      increaseLabel={tb("increaseQty")}
                      inputLabel={tb("quantity")}
                      inputId="bb-qty"
                      decreaseDisabled={quantity <= 1}
                    />
                  </div>
                </div>

                <BuyButtons
                  canBuy={canBuy}
                  adding={adding}
                  onAdd={handleAdd}
                  zaloUrl={zaloUrl}
                  previewMode={previewMode}
                />
                {addError ? <p className="mt-3 font-semibold text-destructive">{addError}</p> : null}

                <CommitmentsList commitments={commitments} />

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* Thanh dính đáy trên mobile: hiện khi hàng nút của khối mua cuộn khỏi
        viewport. Nút "Thêm vào giỏ" bám .js-bb-add-to-cart (mirror disabled + click
        lại nút gốc); nút "Tư vấn Zalo" mở link Zalo trực tiếp. Hết hàng vẫn render
        thanh — chỉ ẩn nút thêm giỏ, giữ nút Tư vấn Zalo để khách hỏi mua. */}
    <MobileStickyPurchaseBar
      addToCartLabel={tb("mobileAddToCart")}
      zaloLabel={tb("mobileZaloConsult")}
      zaloUrl={zaloUrl}
      outOfStock={isOutOfStock}
      previewMode={previewMode}
    />
    </>
  );
}
