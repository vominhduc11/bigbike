"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { applyCoupon, fetchCart, removeCoupon, removeCartItem, updateCartItem } from "@/lib/api/client-api";
import type { Cart, CartItem } from "@/lib/contracts/commerce";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toProductListPath, toCheckoutPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";

// Cart action links share the legacy `.cart-table .btn` base. The CTA font is set via an
// arbitrary `var(--bb-font-cta)` rather than the `.font-cta` utility so the global
// `a:not(.font-cta):hover { color: brand }` rule keeps matching these anchors (hover parity).
const cartBtnBase =
  "inline-block border-0 rounded-none font-[family-name:var(--bb-font-cta)] font-semibold no-underline uppercase";

const COPY = {
  title: "Giỏ hàng",
  home: "Bigbike.vn",
  emptyMessage: "Chưa có sản phẩm nào trong giỏ hàng.",
  returnToShop: "Quay trở lại cửa hàng",
  cartHeading: "GIỎ HÀNG CỦA BẠN",
  updateCart: "Cập nhật giỏ hàng",
  updating: "Đang cập nhật...",
  continueShopping: "TIẾP TỤC MUA HÀNG",
  checkoutShort: "THANH TOÁN",
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

function CartHeading() {
  return (
    <div className="bb-cart-heading-row">
      <div className="bb-cart-heading-col">
        <h1>{COPY.title}</h1>
        <nav className="bb-cart-breadcrumb" aria-label="Breadcrumb">
          <ul>
            <li>
              <Link href="/">{COPY.home}</Link>
            </li>
            <li aria-current="page">
              <span>{COPY.title}</span>
            </li>
          </ul>
        </nav>
      </div>
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
  const [cartUpdating, setCartUpdating] = useState(false);
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

  const handleQuantityStep = useCallback((itemId: string, direction: 1 | -1) => {
    setQuantityDrafts((p) => {
      const current = p[itemId] ?? 1;
      return { ...p, [itemId]: Math.max(1, current + direction) };
    });
  }, []);

  const handleUpdateCart = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart) return;

    const changedItems = cart.items
      .map((item) => ({
        item,
        quantity: Math.max(1, quantityDrafts[item.id] ?? item.quantity),
      }))
      .filter(({ item, quantity }) => item.quantity !== quantity);

    if (changedItems.length === 0) return;

    setCartUpdating(true);
    changedItems.forEach(({ item }) => setItemMutating(item.id, true));
    setError("");

    try {
      let updatedCart = cart;
      for (const { item, quantity } of changedItems) {
        updatedCart = await updateCartItem(item.id, quantity);
      }
      syncCart(updatedCart);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      changedItems.forEach(({ item }) => setItemMutating(item.id, false));
      setCartUpdating(false);
    }
  }, [cart, quantityDrafts, setItemMutating, syncCart]);

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

  const hasQuantityChanges = useMemo(() => {
    if (!cart) return false;
    return cart.items.some((item) => (quantityDrafts[item.id] ?? item.quantity) !== item.quantity);
  }, [cart, quantityDrafts]);

  if (loading) {
    return (
      <div id="main-content" className="bb-cart-page" aria-busy="true">
        <Container>
          <CartHeading />
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
          <CartHeading />
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
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  const hasUnavailable = cart.items.some((i) => !i.available);
  const continueHref = toProductListPath();

  return (
    <div id="main-content" className="bb-cart-page">
      <Container>
        <CartHeading />

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
            <form onSubmit={handleUpdateCart}>
              <div className="-mx-[15px] flex flex-wrap items-start">
                <div className="relative min-h-px w-full max-w-[66.666667%] basis-2/3 px-[15px] max-[991px]:max-w-full max-[991px]:basis-full">
                  <div className="mb-[30px] text-[1.714rem]">
                    <h3 className="relative m-0 inline-block pr-10 font-heading text-[1em] font-semibold leading-[1.2] text-black">
                      {COPY.cartHeading}{" "}
                      <span className="absolute right-0 top-1/2 inline-block h-5 w-5 text-center text-[1.175rem] leading-none [transform:translateY(-50%)] after:absolute after:right-0 after:top-1/2 after:block after:h-5 after:w-5 after:rounded-[2px] after:bg-brand after:content-[''] after:[box-shadow:0_3px_6px_rgba(0,0,0,0.16)] after:[transform:translateY(-50%)_rotate(45deg)]">
                        <b className="relative z-[2] inline-block pt-0.5 align-middle leading-none text-white">{itemCount}</b>
                      </span>
                    </h3>
                  </div>

                  <div className="mb-[30px]" role="list">
                    {cart.items.map((item) => {
                      const draftQuantity = quantityDrafts[item.id] ?? item.quantity;
                      const isMutating = mutating[item.id];

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "m-0 flex flex-nowrap items-center md:border-b md:border-[#cecece] md:py-[30px] md:[&:first-child]:pt-0 max-md:mb-[10px] max-md:grid-cols-[86px_minmax(0,1fr)] max-md:gap-3 max-md:border max-md:border-[var(--bb-border-subtle)] max-md:p-[10px] max-md:[&:first-child]:pt-[10px] max-[600px]:grid",
                            isMutating && "opacity-50",
                          )}
                          role="listitem"
                        >
                          <div className="min-w-0 max-w-[130px] basis-[130px] p-0 [&_img]:mr-[10px] max-[600px]:max-w-none max-[600px]:basis-auto">
                            <CartItemThumb item={item} />
                          </div>

                          <div className="min-w-0 flex-auto p-0 pl-10 max-[600px]:pl-0">
                            <h3 className="m-0 mb-2 font-heading text-[1rem] font-semibold leading-[1.25] text-[#3a3a3a] max-md:text-[15px] max-md:leading-[1.2]">{item.productName}</h3>
                            {item.variantName ? (
                              <p className="m-0 mb-2 text-[#3a3a3a]">{item.variantName}</p>
                            ) : (
                              <p aria-hidden="true" className="m-0 mb-2 text-[#3a3a3a]">&nbsp;</p>
                            )}
                            <p className="m-0 text-[#3a3a3a]">
                              <b>
                                {item.quantity} x {formatVnd(item.unitPrice)} = {formatVnd(item.lineTotal)}
                              </b>
                            </p>
                          </div>

                          <div className="min-w-0 max-w-[150px] basis-[150px] p-0 text-center max-[600px]:col-[1/2] max-[600px]:max-w-none max-[600px]:basis-auto max-[600px]:text-left">
                            <div>
                              <button
                                type="button"
                                className="inline-block h-5 w-6 border-0 bg-transparent p-0 align-top text-[1.714rem] leading-5 text-black disabled:cursor-not-allowed disabled:opacity-50 max-md:min-h-11 max-md:min-w-11"
                                onClick={() => handleQuantityStep(item.id, 1)}
                                disabled={isMutating || !item.available}
                                aria-label={`Tăng số lượng ${item.productName}`}
                              >
                                +
                              </button>
                              <div>
                                <input
                                  type="number"
                                  className="inline-block h-5 w-[50px] border-0 bg-transparent text-center align-top text-[1.429rem] font-semibold leading-5 text-black [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none max-md:min-h-11"
                                  min={1}
                                  step={1}
                                  value={draftQuantity}
                                  onChange={(e) => handleQuantityDraft(item.id, Number(e.target.value))}
                                  disabled={isMutating || !item.available}
                                  aria-label={`Số lượng ${item.productName}`}
                                  inputMode="numeric"
                                />
                              </div>
                              <button
                                type="button"
                                className="inline-block h-5 w-6 border-0 bg-transparent p-0 align-top text-[1.714rem] leading-5 text-black disabled:cursor-not-allowed disabled:opacity-50 max-md:min-h-11 max-md:min-w-11"
                                onClick={() => handleQuantityStep(item.id, -1)}
                                disabled={isMutating || !item.available || draftQuantity <= 1}
                                aria-label={`Giảm số lượng ${item.productName}`}
                              >
                                -
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

                  <div className="mt-0">
                    <div className="mb-[30px] text-right max-[600px]:text-left">
                      <button
                        type="submit"
                        className="h-[42px] min-w-[180px] border-0 bg-black px-5 font-cta text-[14px] font-semibold leading-[42px] text-white disabled:cursor-not-allowed disabled:opacity-50 max-[600px]:w-full"
                        name="update_cart"
                        value={COPY.updateCart}
                        disabled={!hasQuantityChanges || cartUpdating}
                      >
                        {cartUpdating ? COPY.updating : COPY.updateCart}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-[30px] max-[600px]:flex-col max-[600px]:items-stretch max-[600px]:gap-3">
                      <Link className={cn(cartBtnBase, "h-[62px] bg-black py-0 pl-2.5 pr-5 leading-[62px] text-white max-[600px]:w-full max-[600px]:text-center")} href={continueHref}>
                        <span aria-hidden="true">‹</span> {COPY.continueShopping}
                      </Link>
                      {/* On ≤767px the action-row "THANH TOÁN" is demoted to a secondary outline so it
                          does not compete with the solid-red "Tiến hành thanh toán" CTA in the totals. */}
                      {hasUnavailable ? (
                        <span className={cn(cartBtnBase, "h-[62px] min-w-[180px] bg-brand px-[30px] text-center leading-[62px] text-white opacity-50 pointer-events-none max-md:border max-md:border-[var(--bb-action-primary)] max-md:bg-transparent max-md:text-brand max-[600px]:w-full")} aria-disabled="true">
                          {COPY.checkoutShort}
                        </span>
                      ) : (
                        <Link className={cn(cartBtnBase, "h-[62px] min-w-[180px] bg-brand px-[30px] text-center leading-[62px] text-white max-md:border max-md:border-[var(--bb-action-primary)] max-md:bg-transparent max-md:text-brand max-[600px]:w-full")} href={toCheckoutPath()}>
                          {COPY.checkoutShort}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                <div className="relative min-h-px w-full max-w-[33.333333%] basis-1/3 px-[15px] max-[991px]:mt-9 max-[991px]:max-w-full max-[991px]:basis-full">
                  <div>
                    <div>
                      <h2 className="m-0 mb-5 font-heading text-[1.5rem] font-semibold leading-[1.25] text-black">{COPY.totalsHeading}</h2>

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
                        <p className="m-0 text-[12px] italic leading-[1.45] text-[#3a3a3a]">
                          {cart.totals.shippingAmount > 0 ? (
                            <>
                              {COPY.shipping}: <b>{formatVnd(cart.totals.shippingAmount)}</b>
                            </>
                          ) : (
                            COPY.shippingPending
                          )}
                        </p>
                      </div>

                      <div className="mt-5">
                        {hasUnavailable ? (
                          <span className="block min-h-[52px] w-full rounded-none border-0 bg-brand px-5 py-3.5 text-center font-[family-name:var(--bb-font-cta)] text-[14px] font-semibold leading-6 text-white no-underline opacity-50 pointer-events-none" aria-disabled="true">
                            {COPY.checkoutProceed}
                          </span>
                        ) : (
                          <Link href={toCheckoutPath()} className="block min-h-[52px] w-full rounded-none border-0 bg-brand px-5 py-3.5 text-center font-[family-name:var(--bb-font-cta)] text-[14px] font-semibold leading-6 text-white no-underline">
                            {COPY.checkoutProceed}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {cart.couponCodes && cart.couponCodes.length > 0 && (
                      <div className="mb-2.5">
                        {cart.couponCodes.map((code) => (
                          <p key={code} className="mb-2.5 ml-0 mr-2.5 mt-0 inline-flex items-center gap-[9px] bg-black px-5 py-[7px] font-semibold text-brand last:mr-0">
                            {code}
                            <button
                              type="button"
                              className="border-0 bg-transparent text-[18px] leading-none text-brand"
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
                      <div>
                        <fieldset className="m-0 border-0 p-0">
                          <legend className="mb-[13px] scale-100 text-[1.143rem] font-normal text-black">{COPY.couponLegend}</legend>
                        </fieldset>
                        <div className="relative m-0 pr-[70px]">
                          <input
                            type="text"
                            name="coupon_code"
                            className="h-[52px] w-full border border-[#cecece] px-5 text-black placeholder:text-[var(--bb-text-secondary)]"
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
                            className="absolute right-0 top-0 h-[52px] w-[70px] border-0 bg-brand text-[1.143rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                  </div>

                  <div className="mt-5 border-b border-t border-[#cecece] py-5">
                    <div className="flex flex-nowrap justify-between gap-4 max-md:gap-2.5">
                      <div>
                        <p className="m-0">{COPY.total}</p>
                      </div>
                      <div className="text-right">
                        <p className="m-0 text-[1.714rem] text-brand">
                          <strong>{formatVnd(cart.totals.totalAmount)}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </Container>
    </div>
  );
}
