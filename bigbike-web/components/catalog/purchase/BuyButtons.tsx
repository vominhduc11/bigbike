"use client";

import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { ZaloIcon } from "@/components/ui/ZaloIcon";
import { Button } from "@/components/ui/button";
import { zaloHref } from "@/lib/utils/format";

// Hàng nút mua: tỉ lệ 60/40 ở MỌI breakpoint (grid 5 cột: giỏ hàng 3, Zalo 2),
// 2 nút luôn cạnh nhau cả trên mobile. Khớp thanh dính đáy mobile.
// (Nút "Mua nhanh" đã gỡ theo quyết định owner — khách đặt hàng qua giỏ.)
export function BuyButtons({
  canBuy,
  adding,
  onAdd,
  zaloUrl,
  previewMode = false,
}: {
  canBuy: boolean;
  adding: boolean;
  onAdd: () => void;
  zaloUrl?: string;
  /** Khung xem trước admin: nút "Tư vấn Zalo" mở link ngoài → khóa bấm + làm mờ
      (nút "Thêm vào giỏ" đã bị vô hiệu qua canBuy=false). */
  previewMode?: boolean;
}) {
  const tb = useTranslations("PdpBuyBox");
  return (
    <div data-purchase-actions className="mt-6 grid grid-cols-5 gap-2.5">
      <div className="col-span-3 min-w-0">
        {/* Hook class React riêng (js-bb-add-to-cart), KHÔNG dùng
            `js-add-to-cart-btn`: JS theme WP cũ (home.min.js) bám vào
            class đó, khi chọn đủ biến thể sẽ ghi đè chữ nút thành "Đang
            kiểm tra hàng..." rồi gọi AJAX find_variation_product về backend
            WordPress (đã không còn) → nút kẹt vĩnh viễn. React tự quản nhãn
            + add-to-cart nên cắt móc đó đi; nhãn luôn là "THÊM VÀO GIỎ HÀNG". */}
        {/* Nút chính: nền đỏ brand. Theme `.add-to-cart .btn` đã đỏ #ff0c09;
            ép `!bg-brand !text-white` để khớp đúng tông đỏ AA của thanh dính đáy. */}
        <Button
          type="button"
          variant="primary"
          data-purchase-add
          className="h-13 w-full whitespace-nowrap rounded-none px-4 font-cta text-b4-action uppercase"
          disabled={!canBuy || adding}
          onClick={onAdd}
        >
          {/* lucide ShoppingCart: bigbike-web KHÔNG nạp Font Awesome (fa-* vô hình),
              nên thay `<i fal fa-shopping-cart>` cũ. !flex + justify-center + gap-2.5
              căn icon/chữ giống hệt nút Zalo để 2 nút thẳng hàng. */}
          <ShoppingCart className="size-5 shrink-0" />
          {/* Nút chiếm 60% ngang → nhãn đầy đủ "THÊM VÀO GIỎ HÀNG" tràn/rớt 2 dòng
              trên mobile hẹp. whitespace-nowrap giữ 1 dòng; nhãn rút gọn "THÊM VÀO
              GIỎ" dưới sm, nhãn đầy đủ từ sm+ (nút đủ rộng). */}
          {adding ? (
            tb("adding")
          ) : (
            <>
              <span className="sm:hidden">{tb("addToCartShort")}</span>
              <span className="hidden sm:inline">{tb("addToCart")}</span>
            </>
          )}
        </Button>
      </div>
      <div className="col-span-2 min-w-0">
        {/* <a> kế thừa `display:inline-block` của theme `.btn` → chữ dạt
            góc; ép flex căn giữa cho khớp nút THÊM VÀO GIỎ (vốn là <button>
            tự căn). gap-2.5 = 10px khớp khoảng cách icon nút trái.
            Kiểu Zalo phụ: nền trắng + viền/chữ/LOGO xanh Zalo (text-zalo →
            logo lấy currentColor). !border-2 !border-zalo thắng `border:none`
            của theme `.add-to-cart .btn`. */}
        {previewMode ? (
          // Xem trước: giữ đúng bố cục nút nhưng mờ + khóa bấm (span, không href).
          <span
            aria-disabled="true"
            className="flex h-13 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-none border-2 border-zalo bg-white px-3 font-cta text-b4-action uppercase text-zalo opacity-50 cursor-not-allowed"
          >
            <ZaloIcon className="size-5 shrink-0" />
            {tb("mobileZaloConsult")}
          </span>
        ) : (
          <Button
            asChild
            variant="outline"
            className="h-13 w-full whitespace-nowrap rounded-none border-2 border-zalo bg-white px-3 font-cta text-b4-action uppercase text-zalo hover:bg-zalo-soft hover:text-zalo"
          >
            <a
              href={zaloUrl ? zaloHref(zaloUrl) : "#"}
              target={zaloUrl ? "_blank" : undefined}
              rel={zaloUrl ? "noopener noreferrer" : undefined}
            >
              <ZaloIcon className="size-5 shrink-0" />
              {tb("mobileZaloConsult")}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
