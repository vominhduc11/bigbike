"use client";

import { useMemo, useState } from "react";
import type { ImageAsset, Product, ProductVariant } from "@/lib/contracts/public";
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
import { WishlistButton } from "@/components/catalog/WishlistButton";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { MobileStickyPurchaseBar } from "@/components/catalog/MobileStickyPurchaseBar";

type Props = {
  product: Product;
  gallery: ImageAsset[];
  shortDescriptionHtml: string;
  rating: number;
  ratingCount: number;
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
  shortDescriptionHtml,
  rating,
  ratingCount,
}: Props) {
  const { addToCart } = useCart();
  const variants = product.variants ?? [];
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

  const priceSource = selectedVariant?.price ?? product.price;
  const { current, compare, isSale } = derivePricing(priceSource);
  const showOld = compare != null && compare > current;

  const requiresSelection = hasVariants && !selectedVariant;
  const isOutOfStock = hasVariants
    ? variants.every((v) => v.stockState === "OUT_OF_STOCK")
    : product.stockState === "OUT_OF_STOCK";
  const canBuy = !isOutOfStock && (!hasVariants || (!!selectedVariant && selectedVariant.isAvailable));

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
      setAddError(e instanceof Error ? e.message : "Không thêm được vào giỏ");
    } finally {
      setAdding(false);
    }
  }

  const name = safeText(product.name, "");

  return (
    <>
    <div className="row bb-wp-pdp" itemProp="itemReviewed" itemScope itemType="https://schema.org/Product">
      {/* Gallery col — dùng ProductGallery (Swiper) y như PurchaseSectionClient.
          Ảnh chính + dải thumbnail là 2 Swiper liên kết qua module Thumbs; tập ảnh
          (cover-đầu + khử trùng + theo màu) do ProductGallery tự xử lý. Video KHÔNG
          đẩy vào đây vì PDP WP đã có tab "Videos" riêng. */}
      <div className="col-md-7 min-w-0 max-[1023px]:!flex-[0_0_100%] max-[1023px]:!max-w-full">
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
      <div className="col-md-5 bb-wp-pdp-info-col max-[1023px]:!flex-[0_0_100%] max-[1023px]:!max-w-full">
        <div className="product-information">
          <div className="title" itemProp="name">
            <h1 className="product_title entry-title">{name}</h1>
          </div>
          <div className="row">
            <div className="col-5">
              <div className="price">
                <p className="price js-single-price">
                  {formatVndNumber(current)} ₫
                  {showOld ? <del> {formatVndNumber(compare!)} ₫</del> : null}
                </p>
              </div>
              <div className="rating" itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
                {/* Để RỖNG + data-rating: JS theme WP (home.min.js qua WpThemeScripts,
                    chạy mọi route WP gồm PDP) tự inject 5 sao (có nửa sao). Trước đây nhét
                    thêm 5 SVG vào trong → "2 lần 5 sao". Giống WpProductSwipeItem. */}
                <div className="rating-star" data-rating={rating} />
                <br />
                <p>
                  Đánh giá: <span itemProp="ratingValue">{rating}/</span>
                  <span itemProp="reviewCount">{ratingCount}</span>
                </p>
              </div>
            </div>
            <div className="col-7 text-right">
              <div className="status">
                <p className={"stock " + (isOutOfStock ? "out-of-stock" : "in-stock")}>
                  <span>{isOutOfStock ? "HẾT HÀNG" : "CÒN HÀNG"}</span>
                </p>
              </div>
            </div>
          </div>

          {shortDescriptionHtml ? (
            <div className="desc wyswyg">
              <div
                className="woocommerce-product-details__short-description"
                dangerouslySetInnerHTML={{ __html: shortDescriptionHtml }}
              />
            </div>
          ) : null}

          <div className="row mt-30">
            <div className="variations_form cart">
              {requiresSelection ? (
                <div className="alert alert-danger note-buy-product">
                  <p>Vui lòng chọn size/màu sắc để mua hàng:</p>
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
                              return (
                                <div className="form-group" key={o.value}>
                                  <input
                                    type="radio"
                                    id={`${slug}-${o.value}`}
                                    className={(color ? " form-control js-change-color" : "form-control ")}
                                    name={`attribute_pa_${slug}`}
                                    value={o.value}
                                    checked={checked}
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

              <div className="single_variation_wrap">
                <div className="woocommerce-variation single_variation" />
                <div className="row woocommerce-variation-add-to-cart variations_button js-add-to-cart-wrap">
                  <div className="col-md-5" style={{ padding: "0px" }}>
                    <div className="quantity-group js-quantity-wrap">
                      <div className="quantity">
                        <input
                          type="number"
                          className="qty"
                          min={1}
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>
                      <div className="button">
                        <button type="button" className="minus js-plus" onClick={() => setQuantity((q) => q + 1)}>
                          <i className="far fa-chevron-up" />
                        </button>
                        <button type="button" className="plus js-minus" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                          <i className="far fa-chevron-down" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-7" />
                </div>

                <div className="row bb-wp-buttons-row" style={{ marginTop: "20px", padding: "0px" }}>
                  <div className="add-to-cart col-md-6" style={{ padding: "0px" }}>
                    <button
                      type="button"
                      className={"single_add_to_cart_button button alt btn js-add-to-cart-btn" + (canBuy ? "" : " disabled")}
                      disabled={!canBuy || adding}
                      onClick={handleAdd}
                    >
                      <i className="fal fa-shopping-cart" /> {adding ? "ĐANG THÊM..." : "THÊM VÀO GIỎ HÀNG"}
                    </button>
                  </div>
                  <div className="add-to-cart quick-add-to-cart col-md-6">
                    <button
                      type="button"
                      className={"btn single_add_to_cart_button button btn-quick-buy js-quickby js-buy-now-btn" + (canBuy ? "" : " disabled")}
                      disabled={!canBuy}
                      onClick={handleAdd}
                    >
                      <i className="fal fa-shopping-cart" /> Mua ngay
                    </button>
                  </div>
                </div>
                {addError ? <p className="stock out-of-stock" style={{ color: "red" }}>{addError}</p> : null}
              </div>
            </div>
          </div>

          <div className="social text-left mt-30">
            <WishlistButton productId={product.id} />
          </div>
        </div>
      </div>
    </div>

    {/* Thanh mua dính đáy trên mobile: hiện khi hàng nút mua (.bb-wp-buttons-row)
        cuộn khỏi viewport. Bám DOM qua .js-add-to-cart-btn / .js-buy-now-btn —
        mirror trạng thái disabled và click lại nút gốc. Hết hàng thì không render
        (không có gì để mua). */}
    {!isOutOfStock ? (
      <MobileStickyPurchaseBar addToCartLabel="Thêm vào giỏ" buyNowLabel="Mua ngay" />
    ) : null}
    </>
  );
}
