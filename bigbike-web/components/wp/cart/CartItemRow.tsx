"use client";

import { useTranslations } from "next-intl";
import type { CartItem } from "@/lib/contracts/commerce";
import { formatVnd } from "@/lib/utils/format";
import { MediaImage } from "@/components/ui/MediaImage";

/* Icon xoá — SVG inline y hệt WP (woocommerce/cart/cart.php a.remove). */
function RemoveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="15" fill="red" aria-hidden="true">
      <path d="M160 400C160 408.8 152.8 416 144 416C135.2 416 128 408.8 128 400V192C128 183.2 135.2 176 144 176C152.8 176 160 183.2 160 192V400zM240 400C240 408.8 232.8 416 224 416C215.2 416 208 408.8 208 400V192C208 183.2 215.2 176 224 176C232.8 176 240 183.2 240 192V400zM320 400C320 408.8 312.8 416 304 416C295.2 416 288 408.8 288 400V192C288 183.2 295.2 176 304 176C312.8 176 320 183.2 320 192V400zM317.5 24.94L354.2 80H424C437.3 80 448 90.75 448 104C448 117.3 437.3 128 424 128H416V432C416 476.2 380.2 512 336 512H112C67.82 512 32 476.2 32 432V128H24C10.75 128 0 117.3 0 104C0 90.75 10.75 80 24 80H93.82L130.5 24.94C140.9 9.357 158.4 0 177.1 0H270.9C289.6 0 307.1 9.358 317.5 24.94H317.5zM151.5 80H296.5L277.5 51.56C276 49.34 273.5 48 270.9 48H177.1C174.5 48 171.1 49.34 170.5 51.56L151.5 80zM80 432C80 449.7 94.33 464 112 464H336C353.7 464 368 449.7 368 432V128H80V432z" />
    </svg>
  );
}

export function CartItemRow({
  item,
  draftQuantity,
  isMutating,
  onStep,
  onDraft,
  onBlur,
  onRemove,
}: {
  item: CartItem;
  draftQuantity: number;
  isMutating: boolean;
  onStep: (id: string, dir: 1 | -1) => void;
  onDraft: (id: string, qty: number) => void;
  onBlur: (id: string, serverQty: number) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("CartWp");
  return (
    <div className={`table--items row${isMutating ? " opacity-50" : ""}`} role="listitem">
      <div className="table--items-item col thumbnail">
        {item.image?.url ? (
          <MediaImage image={item.image} altFallback={item.productName} width={130} height={130} />
        ) : (
          <span className="bb-thumb-initials">{item.productName.slice(0, 2)}</span>
        )}
      </div>

      <div className="table--items-item col cart-information">
        <h3>{item.productName}</h3>
        {item.variantName ? <p>{item.variantName}</p> : null}
        <p className="price">
          <b>
            {item.quantity} x {formatVnd(item.unitPrice)} = {formatVnd(item.lineTotal)}
          </b>
        </p>
        {!item.available && <p className="backorder_notification">{t("backorderNotice")}</p>}
      </div>

      <div className="table--items-item col quantity">
        {/* Thứ tự chuẩn UX: [-] [ô số] [+] — giảm bên trái, tăng bên phải.
            KHÔNG dùng `js-quantity-wrap`/`js-plus`/`js-minus`: home.min.js
            (change_cart_quantity) bind trực tiếp vào các class đó và ghi `.val()`
            imperative đè input React-controlled. React đã drive +/- qua onClick nên bỏ
            marker; styling dựa `.quantity-form .minus/.plus` nên giữ nguyên giao diện. */}
        <div className="quantity-form">
          <button
            type="button"
            className="minus"
            onClick={() => onStep(item.id, -1)}
            disabled={isMutating || !item.available || draftQuantity <= 1}
            aria-label={t("decreaseQtyAria", { name: item.productName })}
          >
            -
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className="quantity-input"
            value={draftQuantity}
            onChange={(e) => onDraft(item.id, Number(e.target.value))}
            onBlur={() => onBlur(item.id, item.quantity)}
            disabled={isMutating || !item.available}
            aria-label={t("quantityAria", { name: item.productName })}
          />
          <button
            type="button"
            className="plus"
            onClick={() => onStep(item.id, 1)}
            disabled={isMutating || !item.available}
            aria-label={t("increaseQtyAria", { name: item.productName })}
          >
            +
          </button>
        </div>
      </div>

      <div className="table--items-item col action">
        <div className="delete text-right">
          <button
            type="button"
            className="remove"
            onClick={() => onRemove(item.id)}
            disabled={isMutating}
            aria-label={t("removeItem")}
          >
            <RemoveIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
