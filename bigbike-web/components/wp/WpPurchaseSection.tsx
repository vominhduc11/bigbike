"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ImageAsset, Product, ProductPrice, ProductStockState, ProductVariant, VideoAsset } from "@/lib/contracts/public";
import { useCart } from "@/lib/cart-context";
import { derivePricing } from "@/lib/pricing";
import { formatVndNumber, resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
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
import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { MobileStickyPurchaseBar } from "@/components/catalog/MobileStickyPurchaseBar";
import { QuickBuyModal } from "@/components/catalog/QuickBuyModal";
import { QuickBuySuccessModal } from "@/components/catalog/QuickBuySuccessModal";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDetachWpHandlers } from "@/lib/hooks/useDetachWpHandlers";

type Props = {
  product: Product;
  gallery: ImageAsset[];
  videos: VideoAsset[];
  shortDescriptionHtml: string;
  rating: number | null;
  ratingCount: number | null;
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
  shortDescriptionHtml,
  rating,
  ratingCount,
  previewMode = false,
}: Props) {
  const tb = useTranslations("PdpBuyBox");
  const { addToCart } = useCart();

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
    queryKey: ["product-snapshot", product.slug],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product.slug}/snapshot/`);
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
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{
    orderNumber: string;
    orderKey: string;
    paymentMethod: string;
  } | null>(null);

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

  const requiresSelection = hasVariants && !selectedVariant;

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
      document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  // Đổi ngôn ngữ ở CLIENT: tên + mô tả ngắn lấy bản EN từ LocalizedContentProvider nếu có,
  // fallback về bản `vi` (prop) — render đầu khớp server (giữ ISR/SEO).
  const enName = useLocalizedField<string>("name");
  const enShortDesc = useLocalizedField<string>("shortDescription");
  const name = safeText(
    typeof enName === "string" && enName.trim() ? enName : product.name,
    "",
  );
  const localizedShortDescriptionHtml =
    typeof enShortDesc === "string" && enShortDesc.trim()
      ? sanitizeRichHtml(enShortDesc)
      : shortDescriptionHtml;

  return (
    <>
    <div className="row bb-wp-pdp" itemProp="itemReviewed" itemScope itemType="https://schema.org/Product">
      {/* Gallery col — dùng ProductGallery (Swiper) y như PurchaseSectionClient.
          Ảnh chính + dải thumbnail là 2 Swiper liên kết qua module Thumbs; tập ảnh
          (cover-đầu + khử trùng + theo màu) do ProductGallery tự xử lý. Video được
          ghép thẳng vào dải gallery (sau ảnh) — đúng như code cũ, KHÔNG tách tab
          "Videos" riêng. ProductGallery chỉ hiện video khi chưa chọn biến thể. */}
      <div className="col-md-7 min-w-0 max-[1023px]:!flex-[0_0_100%] max-[1023px]:!max-w-full">
        <ProductGallery
          mainImage={product.image}
          gallery={gallery}
          videos={videos}
          altFallback={name}
          variantImage={colorVariant?.image ?? null}
          variantGallery={colorVariant?.gallery ?? undefined}
          variantKey={colorVariant?.id ?? null}
        />
      </div>

      {/* Info col */}
      <div className="col-md-5 bb-wp-pdp-info-col max-[1023px]:!flex-[0_0_100%] max-[1023px]:!max-w-full">
        <div className="product-information">
          <div className="title" itemProp="name">
            <h1 className="product_title entry-title">{name}</h1>
          </div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="price">
              <p className="price js-single-price">
                {formatVndNumber(current)} ₫
                {showOld ? <del> {formatVndNumber(compare!)} ₫</del> : null}
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
              </p>
            </div>
          ) : (
            <div className="rating">
              <p>
                {tb("noReviews")} —{" "}
                <a href="#reviews" onClick={scrollToReviews} className="text-brand underline-offset-2 hover:underline">
                  {tb("writeFirst")}
                </a>
              </p>
            </div>
          )}

          {localizedShortDescriptionHtml ? (
            <div className="desc wyswyg">
              <div
                className="woocommerce-product-details__short-description"
                dangerouslySetInnerHTML={{ __html: localizedShortDescriptionHtml }}
              />
            </div>
          ) : null}

          <div className="row mt-30">
            <div className="variations_form cart">
              {requiresSelection ? (
                <div className="alert alert-danger note-buy-product">
                  <p>{tb("pickVariant")}</p>
                </div>
              ) : null}

              {hasVariants
                ? attributeNames.map((attr) => {
                    const color = isColorAttribute(attr);
                    const opts = distinctOptions(variants, attr);
                    const slug = attr.toLowerCase().replace(/\s+/g, "-");
                    return (
                      <div key={attr} className={`options pa_${slug} ${slug} size`}>
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

                <div className="row bb-wp-buttons-row" style={{ marginTop: "20px", padding: "0px" }}>
                  <div className="add-to-cart col-md-6" style={{ padding: "0px" }}>
                    {/* Hook class React riêng (js-bb-add-to-cart), KHÔNG dùng
                        `js-add-to-cart-btn`: JS theme WP cũ (home.min.js) bám vào
                        class đó, khi chọn đủ biến thể sẽ ghi đè chữ nút thành "Đang
                        kiểm tra hàng..." rồi gọi AJAX find_variation_product về backend
                        WordPress (đã không còn) → nút kẹt vĩnh viễn. React tự quản nhãn
                        + add-to-cart nên cắt móc đó đi; nhãn luôn là "THÊM VÀO GIỎ HÀNG". */}
                    {/* Nút phụ: viền đỏ nền trắng (secondary). Override !important để
                        thắng `.add-to-cart .btn{background:#ff0c09;color:#fff;border:none}`
                        của theme; vẫn giữ shape/size 52px từ chính rule đó. */}
                    <button
                      type="button"
                      className={"single_add_to_cart_button button alt btn js-bb-add-to-cart !border-2 !border-brand !bg-white !text-brand transition-colors hover:!bg-brand-soft" + (canBuy ? "" : " disabled")}
                      disabled={!canBuy || adding}
                      onClick={handleAdd}
                    >
                      <i className="fal fa-shopping-cart" /> {adding ? tb("adding") : tb("addToCart")}
                    </button>
                  </div>
                  <div className="add-to-cart quick-add-to-cart col-md-6">
                    <button
                      type="button"
                      // KHÔNG dùng `js-quickby`: home.min.js bind click vào class đó
                      // (preventDefault + toggle `.js-quickbuy-box` không tồn tại). React
                      // tự mở QuickBuyModal qua onClick nên bỏ marker để theme JS không bắt.
                      className={"btn single_add_to_cart_button button btn-quick-buy js-buy-now-btn" + (canBuy ? "" : " disabled")}
                      disabled={!canBuy}
                      onClick={() => setQuickBuyOpen(true)}
                    >
                      <i className="fal fa-bolt" /> {tb("buyNow")}
                    </button>
                  </div>
                </div>
                {addError ? <p className="stock out-of-stock" style={{ color: "red" }}>{addError}</p> : null}

                {/* "Mua ngay" = mua nhanh: mở form nhập địa chỉ/giao hàng rồi tạo đơn
                    trực tiếp qua /orders/quick-buy (không qua giỏ). Khôi phục luồng cũ. */}
                <QuickBuyModal
                  open={quickBuyOpen}
                  onClose={() => setQuickBuyOpen(false)}
                  productId={product.id}
                  productName={name}
                  selectedVariantId={selectedVariant?.id ?? null}
                  variantLabel={selectedVariant?.name ?? null}
                  unitPrice={current}
                  onSuccess={(order) => {
                    setQuickBuyOpen(false);
                    setSuccessOrder(order);
                  }}
                />
                <QuickBuySuccessModal order={successOrder} onClose={() => setSuccessOrder(null)} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* Thanh mua dính đáy trên mobile: hiện khi hàng nút mua (.bb-wp-buttons-row)
        cuộn khỏi viewport. Bám DOM qua .js-bb-add-to-cart / .js-buy-now-btn —
        mirror trạng thái disabled và click lại nút gốc. Hết hàng thì không render
        (không có gì để mua). */}
    {!isOutOfStock ? (
      <MobileStickyPurchaseBar addToCartLabel={tb("mobileAddToCart")} buyNowLabel={tb("mobileBuyNow")} />
    ) : null}
    </>
  );
}
