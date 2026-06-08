"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { applyCoupon, fetchCart, removeCoupon, removeCartItem, updateCartItem } from "@/lib/api/client-api";
import type { Cart, CartItem } from "@/lib/contracts/commerce";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toProductListPath, toCheckoutPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";

const COPY = {
  title: "Giỏ hàng",
  emptyMessage: "Chưa có sản phẩm nào trong giỏ hàng.",
  returnToShop: "Quay trở lại cửa hàng",
  cartHeading: "GIỎ HÀNG CỦA BẠN",
  updateCart: "Cập nhật giỏ hàng",
  checkoutProceed: "Tiến hành thanh toán",
  totalsHeading: "Tổng cộng giỏ hàng",
  subtotal: "Tạm tính",
  discount: "Khuyến mãi",
  shipping: "Phí vận chuyển",
  shippingPending: "Phí vận chuyển là 35.000đ và miễn phí vận chuyển với đơn hàng từ 2.000.000đ",
  total: "Tổng",
  couponLegend: "Nhập mã khuyến mãi",
  couponPlaceholder: "Nhập mã giảm giá",
  couponApply: "Áp dụng",
  couponApplying: "...",
  loadFailed: "Không tải được giỏ hàng.",
  removeItem: "Xóa sản phẩm",
  removeCoupon: "Xóa mã",
};

function cartToDrafts(cart: Cart): Record<string, number> {
  return Object.fromEntries(cart.items.map((item) => [item.id, item.quantity]));
}

function CartPageHeading() {
  return (
    <div className="mt-5 max-md:mt-0">
      {/* WP-parity: page-title h1 = 24px (--fs-h1), Oswald, UPPERCASE, mọi viewport. */}
      <h1 className="m-0 font-heading text-h1 font-semibold uppercase leading-[1.1] text-black">
        {COPY.title}
      </h1>
      <Breadcrumb
        variant="onLight"
        className="!px-0"
        items={[{ label: "Bigbike.vn", href: "/" }, { label: COPY.title }]}
      />
    </div>
  );
}

function CartItemThumb({ item }: { item: CartItem }) {
  return (
    <div className="flex min-h-[100px] w-[120px] items-center justify-start [&_img]:h-auto [&_img]:max-h-[120px] [&_img]:w-auto [&_img]:max-w-[120px] [&_img]:object-contain max-md:max-w-[86px] max-md:[&_img]:max-w-[86px]">
      {item.image?.url ? (
        <MediaImage image={item.image} altFallback={item.productName} width={130} height={130} />
      ) : (
        <span className="bb-thumb-initials">{item.productName.slice(0, 2)}</span>
      )}
    </div>
  );
}

function RemoveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="15" fill="red" aria-hidden="true">
      <path d="M160 400C160 408.8 152.8 416 144 416C135.2 416 128 408.8 128 400V192C128 183.2 135.2 176 144 176C152.8 176 160 183.2 160 192V400zM240 400C240 408.8 232.8 416 224 416C215.2 416 208 408.8 208 400V192C208 183.2 215.2 176 224 176C232.8 176 240 183.2 240 192V400zM320 400C320 408.8 312.8 416 304 416C295.2 416 288 408.8 288 400V192C288 183.2 295.2 176 304 176C312.8 176 320 183.2 320 192V400zM317.5 24.94L354.2 80H424C437.3 80 448 90.75 448 104C448 117.3 437.3 128 424 128H416V432C416 476.2 380.2 512 336 512H112C67.82 512 32 476.2 32 432V128H24C10.75 128 0 117.3 0 104C0 90.75 10.75 80 24 80H93.82L130.5 24.94C140.9 9.357 158.4 0 177.1 0H270.9C289.6 0 307.1 9.358 317.5 24.94H317.5zM151.5 80H296.5L277.5 51.56C276 49.34 273.5 48 270.9 48H177.1C174.5 48 171.1 49.34 170.5 51.56L151.5 80zM80 432C80 449.7 94.33 464 112 464H336C353.7 464 368 449.7 368 432V128H80V432z" />
    </svg>
  );
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutating, setMutating] = useState<Record<string, boolean>>({});
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  const syncCart = useCallback((nextCart: Cart) => {
    setCart(nextCart);
    setQuantityDrafts(cartToDrafts(nextCart));
  }, []);

  useEffect(() => {
    fetchCart()
      .then((c) => {
        syncCart(c);
        pushDataLayer("view_cart", {
          currency: c.currency ?? "VND",
          value: c.totals.totalAmount,
          items: toGtmCartItems(c.items),
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [syncCart]);

  const setItemMutating = useCallback((id: string, val: boolean) => {
    setMutating((p) => ({ ...p, [id]: val }));
  }, []);

  const handleQuantityDraft = useCallback((itemId: string, qty: number) => {
    const nextQty = Number.isFinite(qty) ? Math.max(1, Math.trunc(qty)) : 1;
    setQuantityDrafts((p) => ({ ...p, [itemId]: nextQty }));
  }, []);

  const handleQuantityStep = useCallback(async (itemId: string, direction: 1 | -1) => {
    const current = quantityDrafts[itemId] ?? 1;
    const nextQty = Math.max(1, current + direction);
    setQuantityDrafts((p) => ({ ...p, [itemId]: nextQty }));
    setItemMutating(itemId, true);
    setError("");
    try {
      const updated = await updateCartItem(itemId, nextQty);
      syncCart(updated);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setItemMutating(itemId, false);
    }
  }, [quantityDrafts, setItemMutating, syncCart]);

  const handleQuantityBlur = useCallback(async (itemId: string, currentServerQty: number) => {
    const nextQty = quantityDrafts[itemId] ?? currentServerQty;
    if (nextQty === currentServerQty) return;
    setItemMutating(itemId, true);
    setError("");
    try {
      const updated = await updateCartItem(itemId, nextQty);
      syncCart(updated);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setItemMutating(itemId, false);
    }
  }, [quantityDrafts, setItemMutating, syncCart]);

  const handleRemove = useCallback(async (itemId: string) => {
    setItemMutating(itemId, true);
    setError("");
    try {
      const updated = await removeCartItem(itemId);
      syncCart(updated);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setItemMutating(itemId, false);
    }
  }, [setItemMutating, syncCart]);

  const handleApplyCoupon = useCallback(async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const code = couponInput.trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const updated = await applyCoupon(code);
      syncCart(updated);
      setCouponInput("");
    } catch (e: unknown) {
      setCouponError((e as Error).message);
    } finally {
      setCouponLoading(false);
    }
  }, [couponInput, syncCart]);

  const handleRemoveCoupon = useCallback(async (code: string) => {
    setCouponLoading(true);
    setCouponError("");
    try {
      const updated = await removeCoupon(code);
      syncCart(updated);
    } catch (e: unknown) {
      setCouponError((e as Error).message);
    } finally {
      setCouponLoading(false);
    }
  }, [syncCart]);

  if (loading) {
    return (
      <div id="main-content" className="bb-cart-page" aria-busy="true">
        <Container>
          <CartPageHeading />
          <div className="cart-table">
            <div className="woocommerce-notices-wrapper" />
          </div>
        </Container>
      </div>
    );
  }

  if (!cart) {
    return (
      <div id="main-content" className="bb-cart-page">
        <Container>
          <CartPageHeading />
          <div className="cart-table">
            <div className="woocommerce-notices-wrapper">
              <div className="woocommerce-error" role="alert">{error || COPY.loadFailed}</div>
            </div>
            <p className="return-to-shop">
              <Link className="button wc-backward" href="/gio-hang/">
                {COPY.updateCart}
              </Link>
            </p>
          </div>
        </Container>
      </div>
    );
  }

  const hasItems = cart.items.length > 0;
  const hasUnavailable = cart.items.some((i) => !i.available);
  const continueHref = toProductListPath();

  return (
    <div id="main-content" className="bb-cart-page">
      <Container>
        <CartPageHeading />

        <div className="cart-table">
          <div className="woocommerce-notices-wrapper">
            {error && <div className="woocommerce-error" role="alert">{error}</div>}
            {couponError && <div className="woocommerce-error" role="alert">{couponError}</div>}
          </div>

          {!hasItems ? (
            <>
              <div className="wc-empty-cart-message">
                <div className="cart-empty woocommerce-info" role="status">
                  {COPY.emptyMessage}
                </div>
              </div>
              <p className="return-to-shop">
                <Link className="button wc-backward" href={continueHref}>
                  {COPY.returnToShop}
                </Link>
              </p>
            </>
          ) : (
            <div>
              <div className="-mx-[15px] flex flex-wrap items-start">
                <div className="relative min-h-px w-full max-w-[66.666667%] basis-2/3 px-[15px] max-[991px]:max-w-full max-[991px]:basis-full">
                  <div className="mb-[30px] text-cart-total">
                    <h3 className="m-0 font-heading text-[1em] font-semibold leading-[1.2] text-black">
                      {COPY.cartHeading}
                    </h3>
                  </div>

                  <div className="mb-[30px] md:max-h-[560px] md:overflow-y-auto md:pr-2 md:[&::-webkit-scrollbar]:w-1 md:[&::-webkit-scrollbar-track]:bg-transparent md:[&::-webkit-scrollbar-thumb]:bg-border-control" role="list">
                    {cart.items.map((item) => {
                      const draftQuantity = quantityDrafts[item.id] ?? item.quantity;
                      const isMutating = mutating[item.id];

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "m-0 flex flex-nowrap items-center md:border-b md:border-border-default md:py-[30px] md:[&:first-child]:pt-0 max-md:mb-[10px] max-md:grid-cols-[86px_minmax(0,1fr)] max-md:gap-3 max-md:border max-md:border-[var(--bb-border-subtle)] max-md:p-[10px] max-md:[&:first-child]:pt-[10px] max-[600px]:grid",
                            isMutating && "opacity-50",
                          )}
                          role="listitem"
                        >
                          <div className="min-w-0 max-w-[130px] basis-[130px] p-0 [&_img]:mr-[10px] max-[600px]:max-w-none max-[600px]:basis-auto">
                            <CartItemThumb item={item} />
                          </div>

                          <div className="min-w-0 flex-auto p-0 pl-10 max-[600px]:pl-0">
                            <h3 className="m-0 mb-2 font-heading text-ui-16 font-semibold leading-[1.25] text-foreground max-md:text-ui-15 max-md:leading-[1.2]">{item.productName}</h3>
                            {item.variantName ? (
                              <p className="m-0 mb-2 text-foreground">{item.variantName}</p>
                            ) : (
                              <p aria-hidden="true" className="m-0 mb-2 text-foreground">&nbsp;</p>
                            )}
                            <p className="m-0 font-semibold text-foreground">
                              {formatVnd(item.lineTotal)}
                            </p>
                            {item.quantity > 1 && (
                              <p className="m-0 text-sm text-[var(--bb-text-secondary)]">
                                {formatVnd(item.unitPrice)} × {item.quantity}
                              </p>
                            )}
                          </div>

                          <div className="min-w-0 shrink-0 p-0 max-[600px]:col-[1/2]">
                            <div className={cn("inline-flex items-stretch border border-border-control bg-white", (isMutating || !item.available) && "opacity-60")}>
                              <button
                                type="button"
                                className="flex w-9 min-h-[44px] items-center justify-center text-lg leading-none text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
                                onClick={() => handleQuantityStep(item.id, -1)}
                                disabled={isMutating || !item.available || draftQuantity <= 1}
                                aria-label={`Giảm số lượng ${item.productName}`}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                step={1}
                                value={draftQuantity}
                                onChange={(e) => handleQuantityDraft(item.id, Number(e.target.value))}
                                onBlur={() => handleQuantityBlur(item.id, item.quantity)}
                                disabled={isMutating || !item.available}
                                aria-label={`Số lượng ${item.productName}`}
                                className="w-10 min-h-[44px] border-x border-border-control bg-transparent text-center font-bold text-sm text-foreground outline-none focus-visible:bg-secondary disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                className="flex w-9 min-h-[44px] items-center justify-center text-lg leading-none text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
                                onClick={() => handleQuantityStep(item.id, 1)}
                                disabled={isMutating || !item.available}
                                aria-label={`Tăng số lượng ${item.productName}`}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="min-w-0 max-w-[50px] basis-[50px] p-0 max-[600px]:col-[2/3] max-[600px]:max-w-none max-[600px]:basis-auto max-[600px]:text-right">
                            <div className="text-right">
                              <button
                                type="button"
                                className="inline-flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-brand max-md:min-h-11 max-md:min-w-11"
                                onClick={() => handleRemove(item.id)}
                                disabled={isMutating}
                                aria-label={COPY.removeItem}
                              >
                                <RemoveIcon />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>

                <div className="relative min-h-px w-full max-w-[33.333333%] basis-1/3 px-[15px] max-[991px]:mt-9 max-[991px]:max-w-full max-[991px]:basis-full md:sticky md:top-[calc(var(--bb-header-stack)+24px)] md:self-start">
                  <div>
                    <h2 className="m-0 mb-5 font-heading text-ui-24 font-semibold leading-[1.25] text-black">{COPY.totalsHeading}</h2>

                    <div className="mb-5 flex flex-nowrap justify-between gap-4 max-md:gap-2.5">
                      <div>
                        <p className="m-0">{COPY.subtotal}</p>
                      </div>
                      <div className="text-right">
                        <p className="m-0"><b>{formatVnd(cart.totals.subtotalAmount)}</b></p>
                      </div>
                    </div>

                    {cart.totals.discountAmount > 0 && (
                      <div className="mb-5 flex flex-nowrap justify-between gap-4 max-md:gap-2.5">
                        <div>
                          <p className="m-0">{COPY.discount}</p>
                        </div>
                        <div className="text-right">
                          <p className="m-0 text-discount"><b>-{formatVnd(cart.totals.discountAmount)}</b></p>
                        </div>
                      </div>
                    )}

                    <div className="mb-5">
                      <p className="m-0 text-ui-12 italic leading-[1.45] text-foreground">
                        {cart.totals.shippingAmount > 0 ? (
                          <>
                            {COPY.shipping}: <b>{formatVnd(cart.totals.shippingAmount)}</b>
                          </>
                        ) : (
                          COPY.shippingPending
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mb-5">
                    {cart.couponCodes && cart.couponCodes.length > 0 && (
                      <div className="mb-2.5">
                        {cart.couponCodes.map((code) => (
                          <p key={code} className="mb-2.5 ml-0 mr-2.5 mt-0 inline-flex items-center gap-[9px] bg-black px-5 py-[7px] font-semibold text-brand last:mr-0">
                            {code}
                            <button
                              type="button"
                              className="border-0 bg-transparent text-ui-18 leading-none text-brand"
                              onClick={() => handleRemoveCoupon(code)}
                              disabled={couponLoading}
                              aria-label={`${COPY.removeCoupon} ${code}`}
                            >
                              ×
                            </button>
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="border border-[#dfdfdf] p-5 max-md:p-3.5">
                      <fieldset className="m-0 border-0 p-0">
                        <legend className="mb-[13px] scale-100 text-base font-normal text-black">{COPY.couponLegend}</legend>
                      </fieldset>
                      <div className="relative m-0 pr-[70px]">
                        <input
                          type="text"
                          name="coupon_code"
                          className="h-[52px] w-full border border-border-default px-5 text-black placeholder:text-[var(--bb-text-secondary)]"
                          id="coupon_code"
                          value={couponInput}
                          placeholder={COPY.couponPlaceholder}
                          onChange={(e) => {
                            setCouponInput(e.target.value);
                            setCouponError("");
                          }}
                          disabled={couponLoading}
                        />
                        <button
                          type="button"
                          className="absolute right-0 top-0 h-[52px] w-[70px] border-0 bg-brand text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          name="apply_coupon"
                          value={COPY.couponApply}
                          disabled={couponLoading || !couponInput.trim()}
                          onClick={(e) => handleApplyCoupon(e)}
                        >
                          {couponLoading ? COPY.couponApplying : COPY.couponApply}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-t border-border-default py-5">
                    <div className="flex flex-nowrap justify-between gap-4 max-md:gap-2.5">
                      <div>
                        <p className="m-0">{COPY.total}</p>
                      </div>
                      <div className="text-right">
                        <p className="m-0 text-cart-total text-brand">
                          <strong>{formatVnd(cart.totals.totalAmount)}</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    {hasUnavailable ? (
                      <span className="block min-h-[52px] w-full rounded-none border-0 bg-brand px-5 py-3.5 text-center font-cta text-ui-14 font-semibold leading-6 [color:white]! no-underline opacity-50 pointer-events-none" aria-disabled="true">
                        {COPY.checkoutProceed}
                      </span>
                    ) : (
                      <Link href={toCheckoutPath()} className="block min-h-[52px] w-full rounded-none border-0 bg-brand px-5 py-3.5 text-center font-cta text-ui-14 font-semibold leading-6 [color:white]! no-underline">
                        {COPY.checkoutProceed}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
