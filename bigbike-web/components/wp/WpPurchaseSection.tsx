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
  const [activeIndex, setActiveIndex] = useState(0);
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

  const galleryImages: ImageAsset[] = useMemo(() => {
    const colorGallery = colorVariant?.gallery?.length ? colorVariant.gallery : null;
    const base = colorGallery ?? (gallery.length ? gallery : product.image ? [product.image] : []);
    return base;
  }, [colorVariant, gallery, product.image]);

  const resolvedImages = useMemo(
    () => galleryImages.map((g) => imgUrl(g)).filter(Boolean),
    [galleryImages],
  );
  const mainSrc = resolvedImages[Math.min(activeIndex, resolvedImages.length - 1)] || imgUrl(product.image);

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
    if (isColorAttribute(attr)) setActiveIndex(0);
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
    <div className="row" itemProp="itemReviewed" itemScope itemType="https://schema.org/Product">
      {/* Gallery col */}
      <div className="col-md-7">
        <div className="thumbnail-slider js-thumbnail-slider">
          <div className="row">
            <div className="col-md-3">
              <div className="slider-thumbnail active">
                <div className="gallery-thumbs swiper-container js-thumbs-gallery active">
                  <div className="swiper-wrapper">
                    {resolvedImages.map((src, i) => (
                      <div
                        key={src + i}
                        className={"woocommerce-product-gallery__image swiper-slide" + (i === activeIndex ? " swiper-slide-active" : "")}
                        data-thumb={src}
                        onClick={() => setActiveIndex(i)}
                        role="button"
                        tabIndex={0}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="thum-bigbike" src={src} alt={name} />
                      </div>
                    ))}
                  </div>
                  <div className="swiper-button-prev" onClick={() => setActiveIndex((i) => Math.max(0, i - 1))} />
                  <div className="swiper-button-next" onClick={() => setActiveIndex((i) => Math.min(resolvedImages.length - 1, i + 1))} />
                </div>
              </div>
            </div>
            <div className="col-md-9">
              <div className="slider">
                <div className="swiper-container gallery-top js-top-gallery">
                  <div className="swiper-wrapper">
                    <div className="woocommerce-product-gallery__image swiper-slide swiper-slide-active" data-thumb={mainSrc}>
                      {mainSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="thum-bigbike" src={mainSrc} alt={name} />
                      ) : null}
                    </div>
                  </div>
                  <div className="swiper-button-prev swiper-button" onClick={() => setActiveIndex((i) => Math.max(0, i - 1))} />
                  <div className="swiper-button-next swiper-button" onClick={() => setActiveIndex((i) => Math.min(resolvedImages.length - 1, i + 1))} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info col */}
      <div className="col-md-5">
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
                <div className="rating-star" data-rating={rating}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      style={{ display: "inline-block", marginRight: 2 }}
                      fill={i < Math.round(rating) ? "#fbbf24" : "#d8d8d8"}
                      aria-hidden="true"
                    >
                      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.401 8.168L12 18.896l-7.335 3.871 1.401-8.168L.132 9.21l8.2-1.192z" />
                    </svg>
                  ))}
                </div>
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

                <div className="row" style={{ marginTop: "20px", padding: "0px" }}>
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
                      className={"btn single_add_to_cart_button button btn-quick-buy js-quickby" + (canBuy ? "" : " disabled")}
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
  );
}
