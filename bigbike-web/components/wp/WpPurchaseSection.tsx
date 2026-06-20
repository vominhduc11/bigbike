"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { GalleryMedia, Product, ProductCommitment, ProductPrice, ProductStockState, ProductVariant } from "@/lib/contracts/public";
import { useCart } from "@/lib/cart-context";
import { derivePricing } from "@/lib/pricing";
import { formatVndNumber, safeText } from "@/lib/utils/format";
import { collectAttributeNames, findColorPreviewVariant, findMatchingVariant } from "@/lib/utils/variant-match";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { hasApprovedReviews } from "@/lib/rating";
import { useLocalizedField, LHtml } from "@/components/i18n/LocalizedContent";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { MobileStickyPurchaseBar } from "@/components/catalog/MobileStickyPurchaseBar";
import { openWriteReviewDialog } from "@/components/catalog/writeReviewBus";
import { VariantPicker } from "./purchase/VariantPicker";
import { QuantityStepper } from "./purchase/QuantityStepper";
import { CommitmentsList } from "./purchase/CommitmentsList";
import { RatingBlock } from "./purchase/RatingBlock";
import { BuyButtons } from "./purchase/BuyButtons";

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
  pricing: { retailPrice: number; compareAtPrice: number | null; salePrice: number | null; discountPercent: number; currency: string };
  stock: { stockState: string; label: string; forceOutOfStock: boolean; quantity?: number | null };
  variants: ProductVariant[];
};

export function WpPurchaseSection({
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
  // KHO fetch lại ở CLIENT sau khi load để luôn tươi (shop bán cả online lẫn walk-in/POS
  // → tồn đổi liên tục, không cần SEO). Props ISR là giá trị ban đầu hợp lệ nên cập nhật
  // liền mạch, KHÔNG layout-shift/skeleton; refetch khi quay lại tab.
  const { data: snapshot } = useQuery<ProductSnapshot>({
    // locale trong key → đổi ngôn ngữ refetch lại để tên màu/size đổi theo.
    queryKey: ["product-snapshot", product.slug, locale],
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

  // Override giá/tồn/variants bằng snapshot khi đã có; props ISR làm fallback.
  const variants = useMemo<ProductVariant[]>(
    () => snapshot?.variants ?? product.variants ?? [],
    [snapshot?.variants, product.variants],
  );
  const freshPrice: ProductPrice = snapshot
    ? {
        retailPrice: snapshot.pricing.retailPrice,
        compareAtPrice: snapshot.pricing.compareAtPrice,
        salePrice: snapshot.pricing.salePrice,
        currency: "VND",
      }
    : product.price;
  const freshStockState = (snapshot?.stock.stockState as ProductStockState | undefined) ?? product.stockState;
  const freshStockQty = snapshot ? (snapshot.stock.quantity ?? null) : product.stockQuantity;
  const freshForceOutOfStock = snapshot ? snapshot.stock.forceOutOfStock : product.forceOutOfStock;

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
  const { current, compare } = derivePricing(priceSource);
  const showOld = compare != null && compare > current;

  // STOCK_RULE_009 — hiển thị buy-box PDP (display-only, KHÔNG đổi điều kiện mua
  // ở STOCK_RULE_005/006):
  //  • Sản phẩm CÓ biến thể, khách CHƯA chọn → chỉ "Còn hàng" / "Hết hàng" theo
  //    product.stockState (aggregate STOCK_RULE_008). KHÔNG hiện "Sắp hết".
  //    (product.stockQuantity là null/0 cho hàng có biến thể nên không phân tầng được.)
  //  • Đã xác định 1 đơn vị tồn cụ thể (biến thể đã chọn → variant.stockQuantity,
  //    hoặc sản phẩm không biến thể → product.stockQuantity): phân tầng theo SỐ
  //    SERIAL còn lại — >=10 "Còn hàng", 1..9 "Sắp hết", <=0 "Hết hàng". Ngưỡng 10
  //    là hằng số hiển thị riêng của PDP, độc lập với low_stock_threshold (mặc
  //    định 5) vốn chỉ chi phối checkout/cảnh báo admin.
  const PDP_LOW_STOCK_CUTOFF = 10;
  const stockUnitKnown = !hasVariants || !!selectedVariant;
  const unitQty = selectedVariant ? selectedVariant.stockQuantity : freshStockQty;
  const unitState = selectedVariant?.stockState ?? freshStockState;
  // Tồn của đơn vị đang xét: ưu tiên số serial; thiếu số thì suy từ stockState.
  const unitOut = typeof unitQty === "number" ? unitQty <= 0 : unitState === "OUT_OF_STOCK";
  const unitLow =
    !unitOut &&
    (typeof unitQty === "number" ? unitQty < PDP_LOW_STOCK_CUTOFF : unitState === "LOW_STOCK");

  const isOutOfStock =
    Boolean(freshForceOutOfStock) ||
    (stockUnitKnown ? unitOut : freshStockState === "OUT_OF_STOCK");
  // "Sắp hết" chỉ khi đã xác định đơn vị tồn cụ thể (chưa chọn biến thể → bỏ qua).
  const isLowStock = !isOutOfStock && stockUnitKnown && unitLow;
  // Ở chế độ xem trước (admin) luôn KHÔNG cho mua: sản phẩm nháp chưa có trong kho,
  // mọi thao tác mua sẽ vô nghĩa/đổ lỗi. canBuy=false vô hiệu hoá cả nút thêm giỏ,
  // mua ngay (disabled) lẫn thanh mua cố định trên mobile (mirror trạng thái nút gốc).
  const canBuy =
    !previewMode && !isOutOfStock && (!hasVariants || (!!selectedVariant && selectedVariant.isAvailable));

  // Chỉ hiện sao + microdata aggregateRating khi có đánh giá thật; tránh số ảo
  // (REVIEW_RULE_003 — gate theo ratingCount, dùng chung toàn app).
  const hasReviews = hasApprovedReviews(rating, ratingCount);

  // Đánh giá giờ là một tab. Kích hoạt tab Đánh giá (desktop ẩn panel khi không
  // active) rồi cuộn mượt tới — chờ một frame để panel hiện ra trước khi cuộn.
  function scrollToReviews(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("bb:pdp-activate-tab", { detail: "reviews" }));
    requestAnimationFrame(() => {
      // Đánh giá hiện 2 bản theo breakpoint (desktop = khối riêng, mobile = trong tab) — cùng
      // id="reviews". Cuộn tới bản đang HIỂN THỊ (offsetParent != null = không bị display:none).
      const targets = Array.from(document.querySelectorAll<HTMLElement>('[id="reviews"]'));
      const visible = targets.find((el) => el.offsetParent !== null) ?? targets[0];
      visible?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
      await addToCart(product.id, quantity, selectedVariant?.id || undefined);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : tb("addToCartFailed"));
    } finally {
      setAdding(false);
    }
  }

  // Đổi ngôn ngữ ở CLIENT: tên lấy bản EN từ LocalizedContentProvider nếu có, fallback bản `vi`
  // (render đầu khớp server, giữ ISR/SEO).
  const enName = useLocalizedField<string>("name");
  const name = safeText(
    typeof enName === "string" && enName.trim() ? enName : product.name,
    "",
  );

  // Mô tả ngắn nằm trong khối mua hàng (dưới đánh giá, trên phần chọn biến thể) — vị trí gốc.
  // Đổi ngôn ngữ qua LHtml (field "shortDescription"); trống → không render.
  const shortDescriptionHtml = product.shortDescription
    ? sanitizeRichHtml(product.shortDescription)
    : "";

  // Eyebrow (danh mục / thương hiệu·xuất xứ) ngay trên tiêu đề — port mockup PDP. GIỮ design
  // system web (text-brand + font-heading uppercase), KHÔNG dùng đỏ/Barlow của mockup.
  // Eyebrow lấy từ dữ liệu sản phẩm sẵn có.
  const eyebrowCategory =
    product.category?.slug === "chua-phan-loai" ? "" : safeText(product.category?.name, "");
  const eyebrowBrand = safeText(product.originBrandCountry, "") || safeText(product.brand?.name, "");
  const eyebrow = [eyebrowCategory, eyebrowBrand].filter(Boolean).join(" / ");

  // Khối "cam kết" dưới nút mua (V232) — quản theo TỪNG sản phẩm; khối ngoài tab → rỗng thì ẩn cả khối.
  const commitments: ProductCommitment[] = product.commitments ?? [];

  // Dải tín hiệu tin cậy trên tên sản phẩm (V233) — admin quản theo TỪNG sản phẩm; nội dung đã
  // resolve theo ngôn ngữ ở backend. Khối ngoài tab → rỗng thì ẩn dải.
  const trustItems = (product.trustBadges ?? [])
    .map((b) => safeText(b.content, ""))
    .filter(Boolean);

  return (
    <>
    <div className="row bb-wp-pdp" itemProp="itemReviewed" itemScope itemType="https://schema.org/Product">
      {/* Gallery col — dùng ProductGallery (Swiper) y như PurchaseSectionClient.
          Ảnh chính + dải thumbnail là 2 Swiper liên kết qua module Thumbs; tập media
          (ảnh + VIDEO, cover-đầu + khử trùng + theo màu) do ProductGallery tự xử lý.
          V248: video nằm NGAY TRONG dải gallery (admin đăng cùng ảnh, theo từng màu) —
          tách khỏi mục "Video" riêng phía dưới (product.videos). */}
      <div className="col-md-7 min-w-0 max-[1023px]:!flex-[0_0_100%] max-[1023px]:!max-w-full lg:!sticky lg:z-20 lg:self-start lg:top-[calc(var(--bb-header-height)+1rem)]">
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
      <div className="col-md-5 bb-wp-pdp-info-col max-[1023px]:!flex-[0_0_100%] max-[1023px]:!max-w-full max-[1023px]:mt-6">
        <div className="product-information">
          {/* Eyebrow + dải tin cậy: 2 dòng nhỏ trên tiêu đề. KHÔNG dùng <ul>/<li> để né
              dấu đầu dòng của theme WP; chấm phân cách tự vẽ, chỉ chen GIỮA các mục. */}
          {trustItems.length > 0 ? (
            <div className="mb-11 flex flex-wrap items-center gap-x-4 gap-y-2 text-ui-14 max-md:text-ui-12 text-muted-foreground">
              {trustItems.map((item, i) => (
                <span key={`${item}-${i}`} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 bg-brand" aria-hidden />
                  <span>{item}</span>
                </span>
              ))}
            </div>
          ) : null}
          {eyebrow ? (
            <p className="mb-0 font-heading text-ui-14 max-md:text-ui-12 font-medium uppercase tracking-wider text-brand">
              {eyebrow}
            </p>
          ) : null}
          <div className="title" itemProp="name">
            <h1 className="product_title entry-title">{name}</h1>
          </div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="price">
              <p className="price js-single-price flex flex-wrap items-baseline gap-x-3">
                <span className="!text-ui-32 max-md:!text-ui-30 !leading-tight !text-brand !font-bold">{formatVndNumber(current)} ₫</span>
                {showOld ? <del>{formatVndNumber(compare!)} ₫</del> : null}
              </p>
            </div>
            <div className="status">
              <p className={"stock " + (isOutOfStock ? "out-of-stock" : isLowStock ? "low-stock" : "in-stock")} style={{ paddingLeft: "2rem", paddingRight: "2rem" }}>
                <span>{isOutOfStock ? tb("stockOut") : isLowStock ? tb("stockLow") : tb("stockIn")}</span>
              </p>
            </div>
          </div>
          <RatingBlock
            hasReviews={hasReviews}
            rating={rating}
            ratingCount={ratingCount}
            onScrollToReviews={scrollToReviews}
            onOpenWriteReview={openWriteReview}
          />

          {shortDescriptionHtml ? (
            <div className="desc wyswyg">
              <LHtml
                field="shortDescription"
                viHtml={shortDescriptionHtml}
                className="woocommerce-product-details__short-description"
              />
            </div>
          ) : null}

          {/* Đường kẻ phân tách Mô tả ngắn với khu chọn biến thể (Màu sắc / Size),
              thay cho dòng nhắc "Vui lòng chọn size/màu sắc…" trước đây. */}
          {hasVariants ? <hr className="variation-divider" /> : null}

          <div className="row mt-30">
            <div className="variations_form cart">
              {hasVariants ? (
                <VariantPicker
                  variants={variants}
                  attributeNames={attributeNames}
                  selectedOptions={selectedOptions}
                  onPick={pick}
                />
              ) : null}

              <div className="single_variation_wrap mt-6">
                <QuantityStepper quantity={quantity} setQuantity={setQuantity} />

                <BuyButtons canBuy={canBuy} adding={adding} onAdd={handleAdd} zaloUrl={zaloUrl} />
                {addError ? <p className="stock out-of-stock" style={{ color: "red" }}>{addError}</p> : null}

                <CommitmentsList commitments={commitments} />

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* Thanh dính đáy trên mobile: hiện khi hàng nút (.bb-wp-buttons-row) cuộn khỏi
        viewport. Nút "Thêm vào giỏ" bám .js-bb-add-to-cart (mirror disabled + click
        lại nút gốc); nút "Tư vấn Zalo" mở link Zalo trực tiếp. Hết hàng vẫn render
        thanh — chỉ ẩn nút thêm giỏ, giữ nút Tư vấn Zalo để khách hỏi mua. */}
    <MobileStickyPurchaseBar
      addToCartLabel={tb("mobileAddToCart")}
      zaloLabel={tb("mobileZaloConsult")}
      zaloUrl={zaloUrl}
      outOfStock={isOutOfStock}
    />
    </>
  );
}
