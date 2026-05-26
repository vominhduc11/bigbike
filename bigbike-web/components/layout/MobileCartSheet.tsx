"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2 } from "lucide-react";
import { MediaImage } from "@/components/ui/MediaImage";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart-context";
import type { CartItem } from "@/lib/contracts/commerce";
import { useCartQuery, useRemoveCartItem, useUpdateCartItem } from "@/lib/query/hooks";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toCheckoutPath, toProductListPath } from "@/lib/utils/routes";
import { useHeaderUi } from "./HeaderUiContext";

function CartSheetThumb({ item }: { item: CartItem }) {
  return (
    <div className="bb-mobile-cart-thumb">
      {item.image?.url ? (
        <MediaImage image={item.image} altFallback={item.productName} width={96} height={96} />
      ) : (
        <span className="bb-thumb-initials">{item.productName.slice(0, 2)}</span>
      )}
    </div>
  );
}

export function MobileCartSheet() {
  const { isPanelOpen, openPanel, closePanel } = useHeaderUi();
  const { refreshCount } = useCart();
  const open = isPanelOpen("cart");
  const {
    data: cart,
    error: cartError,
    isFetching,
    isLoading,
    refetch,
  } = useCartQuery();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    void refetch();
  }, [open, refetch]);

  async function setQuantity(item: CartItem, quantity: number) {
    if (quantity < 1 || updateItem.isPending || removeItem.isPending) return;
    setErrorMessage("");

    try {
      await updateItem.mutateAsync({ itemId: item.id, quantity });
      refreshCount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể cập nhật giỏ hàng.");
    }
  }

  async function removeLine(item: CartItem) {
    if (updateItem.isPending || removeItem.isPending) return;
    setErrorMessage("");

    try {
      await removeItem.mutateAsync(item.id);
      refreshCount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể xóa sản phẩm.");
    }
  }

  const items = cart?.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const loading = isLoading || (open && isFetching && !cart);
  const queryError = cartError instanceof Error ? cartError.message : "";
  const unavailable = items.some((item) => !item.available);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setErrorMessage("");
          openPanel("cart");
        } else {
          closePanel();
        }
      }}
    >
      <SheetContent side="bottom" className="bb-mobile-cart-sheet md:hidden">
        <div className="bb-mobile-cart-grabber" aria-hidden="true" />
        <div className="bb-mobile-cart-head">
          <div>
            <p>GIỎ HÀNG</p>
            <SheetTitle className="bb-mobile-cart-title">
              {itemCount > 0 ? `${itemCount} sản phẩm` : "Giỏ hàng trống"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Xem nhanh và cập nhật sản phẩm trong giỏ hàng.
            </SheetDescription>
          </div>
        </div>

        <div className="bb-mobile-cart-body">
          {loading ? (
            <div className="bb-mobile-cart-state" role="status">
              Đang tải giỏ hàng...
            </div>
          ) : queryError || errorMessage ? (
            <div className="bb-mobile-cart-state is-error" role="alert">
              {errorMessage || queryError}
            </div>
          ) : items.length === 0 ? (
            <div className="bb-mobile-cart-empty">
              <span className="bb-mobile-cart-empty-icon" aria-hidden="true">
                <ShoppingCart size={28} />
              </span>
              <h3>Giỏ hàng trống</h3>
              <p>Thêm sản phẩm để bắt đầu mua sắm.</p>
              <Link href={toProductListPath()} onClick={closePanel}>
                Mua sắm ngay
              </Link>
            </div>
          ) : (
            <div className="bb-mobile-cart-list" role="list">
              {items.map((item) => {
                const mutating = updateItem.isPending || removeItem.isPending;
                return (
                  <article key={item.id} className="bb-mobile-cart-line" role="listitem">
                    <CartSheetThumb item={item} />
                    <div className="bb-mobile-cart-line-copy">
                      <p className="bb-mobile-cart-line-sku">{item.sku || "BIGBIKE"}</p>
                      <h3>{item.productName}</h3>
                      {item.variantName ? <p className="bb-mobile-cart-line-variant">{item.variantName}</p> : null}
                      {!item.available ? (
                        <p className="bb-mobile-cart-line-warning">Sản phẩm tạm thời không khả dụng.</p>
                      ) : null}
                      <div className="bb-mobile-cart-line-bottom">
                        <div className="bb-mobile-cart-qty" aria-label={`Số lượng ${item.productName}`}>
                          <button
                            type="button"
                            onClick={() => setQuantity(item, item.quantity - 1)}
                            disabled={mutating || item.quantity <= 1 || !item.available}
                            aria-label={`Giảm số lượng ${item.productName}`}
                          >
                            -
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity(item, item.quantity + 1)}
                            disabled={mutating || !item.available}
                            aria-label={`Tăng số lượng ${item.productName}`}
                          >
                            +
                          </button>
                        </div>
                        <strong>{formatVnd(item.lineTotal)}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="bb-mobile-cart-remove"
                      onClick={() => removeLine(item)}
                      disabled={mutating}
                      aria-label={`Xóa ${item.productName}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="bb-mobile-cart-foot">
          <div className="bb-mobile-cart-total">
            <span>TỔNG TẠM TÍNH</span>
            <strong>{formatVnd(cart?.totals.totalAmount ?? 0)}</strong>
          </div>
          <div className="bb-mobile-cart-actions">
            <Link href={toCartPath()} className="bb-mobile-cart-secondary" onClick={closePanel}>
              Xem giỏ hàng
            </Link>
            {items.length === 0 || unavailable ? (
              <span className="bb-mobile-cart-primary is-disabled" aria-disabled="true">
                Thanh toán
              </span>
            ) : (
              <Link href={toCheckoutPath()} className="bb-mobile-cart-primary" onClick={closePanel}>
                Thanh toán
              </Link>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
