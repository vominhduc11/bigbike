"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { ImageAsset, Product, ProductCommitment, ProductPrice, ProductStockState, ProductVariant, VideoAsset } from "@/lib/contracts/public";
import { useCart } from "@/lib/cart-context";
import { derivePricing } from "@/lib/pricing";
import { formatVndNumber, resolveMediaUrl, safeText, toLegacyWpMediaUrl, zaloHref } from "@/lib/utils/format";
import {
  collectAttributeNames,
  findColorPreviewVariant,
  findMatchingVariant,
  getOptionValue,
  isColorAttribute,
} from "@/lib/utils/variant-match";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { hasApprovedReviews } from "@/lib/rating";
import { RatingStars } from "@/components/ui/RatingStars";
import { ZaloIcon } from "@/components/ui/ZaloIcon";
import { useLocalizedField, LHtml } from "@/components/i18n/LocalizedContent";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { parseSectionVisibility, isSectionVisible } from "@/lib/utils/section-visibility";
import { MobileStickyPurchaseBar } from "@/components/catalog/MobileStickyPurchaseBar";
import {
  Award,
  BadgeCheck,
  Clock,
  CreditCard,
  Gift,
  Headphones,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDetachWpHandlers } from "@/lib/hooks/useDetachWpHandlers";
import { openWriteReviewDialog } from "@/components/catalog/writeReviewBus";

// Bộ icon dựng sẵn cho khối cam kết (V232) — admin chọn theo key, web map ra lucide.
// Web KHÔNG nạp Font Awesome (fa-* vô hình) nên phải dùng lucide. Key lạ → ShieldCheck.
const COMMITMENT_ICON_MAP: Record<string, LucideIcon> = {
  truck: Truck,
  "refresh-cw": RefreshCw,
  "shield-check": ShieldCheck,
  "badge-check": BadgeCheck,
  "credit-card": CreditCard,
  headphones: Headphones,
  package: Package,
  gift: Gift,
  clock: Clock,
  "map-pin": MapPin,
  wrench: Wrench,
  award: Award,
};

type Props = {
  product: Product;
  gallery: ImageAsset[];
  videos: VideoAsset[];
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

function imgUrl(a: ImageAsset | null | undefined): string {
  return toLegacyWpMediaUrl(resolveMediaUrl(a?.url?.trim())) || "";
}

/** Giá trị options duy nhất cho 1 attribute, kèm variant đại diện (để lấy ảnh swatch). */
function distinctOptions(variants: ProductVariant[], attrName: string) {
  const seen = new Map<string, { value: string; label: string; rep: ProductVariant }>();
  for (const v of variants) {
    const val = getOptionValue(v, attrName);
    if (!val) continue;
    if (!seen.has(val)) seen.set(val, { value: val, label: val, rep: v });
  }
  return Array.from(seen.values());
}

export function WpPurchaseSection({
  product,
  gallery,
  videos,
  rating,
  ratingCount,
  zaloUrl,
  previewMode = false,
}: Props) {
  const tb = useTranslations("PdpBuyBox");
  const locale = useLocale();
  const { addToCart } = useCart();

  // "Hiển thị trên web" (V245) — admin bật/tắt video / dải tin cậy / khối cam kết của khu mua hàng.
  const sectionVis = parseSectionVisibility(product.sectionVisibility);
  const vis = (key: string) => isSectionVisible(sectionVis, key);

  // home.min.js `choose_color_and_size()` bind change vào `.variations_form`
  // (delegated `.variation-radios input`) → khi chọn đủ biến thể bắn AJAX
  // find_variation_product về URL rỗng (backend WP đã bỏ), fail im lặng. React đã tự
  // quản chọn biến thể nên gỡ handler WP. Giữ class `.variations_form` cho CSS theme.
  useDetachWpHandlers([{ selector: ".variations_form", events: "change" }]);

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

  // Khối "cam kết" dưới nút mua (V232) — giờ quản theo TỪNG sản phẩm; rỗng/đã tắt → ẩn cả khối.
  const commitments: ProductCommitment[] = vis("commitments") ? (product.commitments ?? []) : [];

  // Dải tín hiệu tin cậy trên tên sản phẩm (V233) — admin quản theo TỪNG sản phẩm; nội dung đã
  // resolve theo ngôn ngữ ở backend. Rỗng/đã tắt → ẩn dải.
  const trustItems = (vis("trustBadges") ? (product.trustBadges ?? []) : [])
    .map((b) => safeText(b.content, ""))
    .filter(Boolean);

  return (
    <>
    <div className="row bb-wp-pdp" itemProp="itemReviewed" itemScope itemType="https://schema.org/Product">
      {/* Gallery col — dùng ProductGallery (Swiper) y như PurchaseSectionClient.
          Ảnh chính + dải thumbnail là 2 Swiper liên kết qua module Thumbs; tập ảnh
          (cover-đầu + khử trùng + theo màu) do ProductGallery tự xử lý. Video được
          ghép thẳng vào dải gallery (sau ảnh) — đúng như code cũ, KHÔNG tách tab
          "Videos" riêng. ProductGallery chỉ hiện video khi chưa chọn biến thể. */}
      <div className="col-md-7 min-w-0 max-[1023px]:!flex-[0_0_100%] max-[1023px]:!max-w-full lg:!sticky lg:z-20 lg:self-start lg:top-[calc(var(--bb-header-height)+1rem)]">
        <ProductGallery
          mainImage={product.image}
          gallery={gallery}
          videos={vis("videos") ? videos : []}
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
            <div className="mb-11 flex flex-wrap items-center gap-x-4 gap-y-2 text-ui-14 text-muted-foreground">
              {trustItems.map((item, i) => (
                <span key={`${item}-${i}`} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 bg-brand" aria-hidden />
                  <span>{item}</span>
                </span>
              ))}
            </div>
          ) : null}
          {eyebrow ? (
            <p className="mb-0 font-heading text-ui-14 font-medium uppercase tracking-wider text-brand">
              {eyebrow}
            </p>
          ) : null}
          <div className="title" itemProp="name">
            <h1 className="product_title entry-title">{name}</h1>
          </div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="price">
              <p className="price js-single-price flex flex-wrap items-baseline gap-x-3">
                <span>{formatVndNumber(current)} ₫</span>
                {showOld ? <del>{formatVndNumber(compare!)} ₫</del> : null}
              </p>
            </div>
            <div className="status">
              <p className={"stock " + (isOutOfStock ? "out-of-stock" : isLowStock ? "low-stock" : "in-stock")} style={{ paddingLeft: "2rem", paddingRight: "2rem" }}>
                <span>{isOutOfStock ? tb("stockOut") : isLowStock ? tb("stockLow") : tb("stockIn")}</span>
              </p>
            </div>
          </div>
          {hasReviews ? (
            <div className="rating" itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
              {/* Sao vẽ bằng React (RatingStars) — KHÔNG để rỗng chờ plugin home.min.js
                  vì script đó chỉ chạy lúc tải nguyên trang, điều hướng nội bộ vào PDP sẽ
                  mất sao. text-ui-18 = 18px khớp starSize cũ. Giống WpProductSwipeItem. */}
              <span className="text-ui-18">
                <RatingStars value={rating} />
              </span>
              <br />
              <p>
                {tb("ratingLabel")} <span itemProp="ratingValue">{rating}/</span>
                <span itemProp="reviewCount">{ratingCount}</span>
                {" — "}
                <a href="#reviews" onClick={scrollToReviews} className="text-brand underline-offset-2 hover:underline">
                  {tb("viewAllReviews")}
                </a>
                {" · "}
                <a href="#reviews" onClick={openWriteReview} className="text-brand underline-offset-2 hover:underline">
                  {tb("writeReview")}
                </a>
              </p>
            </div>
          ) : (
            <div className="rating">
              <p>
                {tb("noReviews")} —{" "}
                <a href="#reviews" onClick={openWriteReview} className="text-brand underline-offset-2 hover:underline">
                  {tb("writeFirst")}
                </a>
              </p>
            </div>
          )}

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
              {hasVariants
                ? attributeNames.map((attr) => {
                    const color = isColorAttribute(attr);
                    const opts = distinctOptions(variants, attr);
                    const slug = attr.toLowerCase().replace(/\s+/g, "-");
                    // CSS hook ổn định: theme dựa `.pa_color` để hiện ô màu dạng ẢNH-ONLY
                    // (ẩn chữ tên màu qua `.pa_color … label span{display:none}`). Slug lấy từ
                    // tên hiển thị giờ là "màu-sắc"/"color" tùy ngôn ngữ → không còn cố định
                    // "pa_color", nên gắn thêm class theo LOẠI thuộc tính (isColorAttribute).
                    const colorHook = color ? "pa_color" : "";
                    return (
                      <div key={attr} className={`options pa_${slug} ${colorHook} ${slug} size`}>
                        <div className="group">
                          <div className="group-label">
                            <label htmlFor={`pa_${slug}`}>{attr}</label>
                          </div>
                          <div className="variation-radios">
                            {opts.map((o) => {
                              const checked = selectedOptions[attr] === o.value;
                              const swatch = color ? imgUrl(o.rep.image ?? o.rep.gallery?.[0]) : "";
                              // STOCK_RULE_005: làm mờ option hết hàng (vẫn click được để
                              // xem ảnh màu), chỉ KHÓA option của biến thể không bán
                              // (isAvailable=false). Probe = lựa chọn hiện tại + option này.
                              const probe = { ...selectedOptions, [attr]: o.value };
                              const optInStock = Boolean(
                                findMatchingVariant(variants, probe, {
                                  onlyAvailable: true,
                                  inStockOnly: true,
                                }),
                              );
                              const optSelectable = Boolean(
                                (findMatchingVariant(variants, probe, { onlyAvailable: true }) ??
                                  findMatchingVariant(variants, probe))?.isAvailable,
                              );
                              return (
                                <div
                                  className={cn(
                                    "form-group",
                                    !optInStock && !checked && "opacity-45",
                                    !optSelectable && !checked && "cursor-not-allowed",
                                  )}
                                  key={o.value}
                                >
                                  <input
                                    type="radio"
                                    id={`${slug}-${o.value}`}
                                    className={(color ? " form-control js-change-color" : "form-control ")}
                                    name={`attribute_pa_${slug}`}
                                    value={o.value}
                                    checked={checked}
                                    disabled={!optSelectable && !checked}
                                    // Radio đã chọn thì bấm lại KHÔNG bắn onChange,
                                    // nên dùng onClick để bỏ chọn (toggle off) — giống
                                    // VariantSelector của code cũ. onChange vẫn lo việc
                                    // chọn option mới.
                                    onClick={() => {
                                      if (checked) pick(attr, o.value);
                                    }}
                                    onChange={() => pick(attr, o.value)}
                                  />
                                  <label
                                    htmlFor={`${slug}-${o.value}`}
                                    style={color && swatch ? { background: `url(${swatch})` } : undefined}
                                  >
                                    {color ? <span className="text">{o.label}</span> : o.label}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                : null}

              <div className="single_variation_wrap mt-6">
                {/* Chọn số lượng — wrapper .options.size để nhãn .group-label ăn đúng
                    rule `.product-information .size .group .group-label` của theme WP →
                    chữ "Số lượng" hiển thị y hệt nhãn SIZE/COLOR (Oswald 24px/600) và có
                    padding-right:25px tách khỏi stepper. Stepper cao 52px khớp ô biến thể. */}
                <div className="options size">
                  <div className="group flex items-center">
                    <div className="group-label">
                      <label htmlFor="bb-qty">{tb("quantity")}</label>
                    </div>
                    <div className="inline-flex items-stretch border border-border-control">
                      <button
                        type="button"
                        aria-label={tb("decreaseQty")}
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        className="flex h-[52px] w-11 items-center justify-center text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        id="bb-qty"
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                        aria-label={tb("quantity")}
                        className="h-[52px] w-16 border-x border-border-control bg-white text-center font-body text-2xl font-semibold text-foreground [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        aria-label={tb("increaseQty")}
                        onClick={() => setQuantity((q) => q + 1)}
                        className="flex h-[52px] w-11 items-center justify-center text-foreground transition-colors hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hàng nút mua: tỉ lệ 60/40 ở MỌI breakpoint (giỏ hàng flex-[3], Zalo
                    flex-[2] = 3:2). Bỏ lưới Bootstrap `col-md-6` vì nó xếp chồng dọc khi
                    <768px; flex-nowrap giữ 2 nút cạnh nhau cả trên mobile. Khớp thanh dính
                    đáy mobile (MobileStickyPurchaseBar). */}
                <div className="bb-wp-buttons-row flex flex-nowrap gap-2.5" style={{ marginTop: "20px" }}>
                  <div className="add-to-cart flex-[3] min-w-0" style={{ padding: "0px" }}>
                    {/* Hook class React riêng (js-bb-add-to-cart), KHÔNG dùng
                        `js-add-to-cart-btn`: JS theme WP cũ (home.min.js) bám vào
                        class đó, khi chọn đủ biến thể sẽ ghi đè chữ nút thành "Đang
                        kiểm tra hàng..." rồi gọi AJAX find_variation_product về backend
                        WordPress (đã không còn) → nút kẹt vĩnh viễn. React tự quản nhãn
                        + add-to-cart nên cắt móc đó đi; nhãn luôn là "THÊM VÀO GIỎ HÀNG". */}
                    {/* Nút chính: nền đỏ brand. Theme `.add-to-cart .btn` đã đỏ #ff0c09;
                        ép `!bg-brand !text-white` để khớp đúng tông đỏ AA của thanh dính đáy. */}
                    <button
                      type="button"
                      className={"single_add_to_cart_button button alt btn js-bb-add-to-cart !bg-brand !text-white transition-colors hover:!bg-brand-active disabled:!opacity-60 disabled:!cursor-not-allowed !flex !items-center !justify-center gap-2.5" + (canBuy ? "" : " disabled")}
                      disabled={!canBuy || adding}
                      onClick={handleAdd}
                    >
                      {/* lucide ShoppingCart: bigbike-web KHÔNG nạp Font Awesome (fa-* vô hình),
                          nên thay `<i fal fa-shopping-cart>` cũ. !flex + justify-center + gap-2.5
                          căn icon/chữ giống hệt nút Zalo để 2 nút thẳng hàng. */}
                      <ShoppingCart className="size-5 shrink-0" />
                      {adding ? tb("adding") : tb("addToCart")}
                    </button>
                  </div>
                  <div className="add-to-cart quick-add-to-cart flex-[2] min-w-0 !mt-0">
                    {/* <a> kế thừa `display:inline-block` của theme `.btn` → chữ dạt
                        góc; ép flex căn giữa cho khớp nút THÊM VÀO GIỎ (vốn là <button>
                        tự căn). gap-2.5 = 10px khớp khoảng cách icon nút trái.
                        Kiểu Zalo phụ: nền trắng + viền/chữ/LOGO xanh Zalo (text-zalo →
                        logo lấy currentColor). !border-2 !border-zalo thắng `border:none`
                        của theme `.add-to-cart .btn`. */}
                    <a
                      href={zaloUrl ? zaloHref(zaloUrl) : "#"}
                      target={zaloUrl ? "_blank" : undefined}
                      rel={zaloUrl ? "noopener noreferrer" : undefined}
                      className="btn single_add_to_cart_button button btn-quick-buy !bg-white !text-zalo !border-2 !border-zalo transition-colors hover:!bg-zalo-soft !flex !items-center !justify-center gap-2.5"
                    >
                      <ZaloIcon className="size-5 shrink-0" />
                      {tb("zaloConsult")}
                    </a>
                  </div>
                </div>
                {addError ? <p className="stock out-of-stock" style={{ color: "red" }}>{addError}</p> : null}

                {/* Khối "cam kết" dưới nút mua (V232) — admin quản theo TỪNG sản phẩm: thêm/bớt
                    dòng tùy ý, mỗi dòng tự chọn icon (key → lucide qua COMMITMENT_ICON_MAP).
                    Dòng không có tiêu đề thì bỏ qua; không dòng nào → ẩn cả khối. */}
                {commitments.some((c) => c.title) && (
                  <ul className="mt-5 divide-y divide-border border border-border">
                    {commitments.map((c, i) =>
                      c.title ? (
                        <li key={i} className="flex items-center gap-3.5 px-5 py-4">
                          {(() => {
                            const Icon = COMMITMENT_ICON_MAP[c.icon] ?? ShieldCheck;
                            return <Icon className="size-7 shrink-0 text-brand" strokeWidth={1.75} aria-hidden="true" />;
                          })()}
                          <div className="min-w-0">
                            <strong className="block font-body text-base font-semibold leading-snug text-foreground">{c.title}</strong>
                            {c.subtitle ? <span className="mt-1 block text-sm leading-snug text-muted-foreground">{c.subtitle}</span> : null}
                          </div>
                        </li>
                      ) : null,
                    )}
                  </ul>
                )}

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
