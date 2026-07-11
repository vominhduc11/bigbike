"use client";

import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { ZaloIcon } from "@/components/ui/ZaloIcon";
import { Button } from "@/components/ui/button";
import { zaloHref } from "@/lib/utils/format";

// Hàng nút mua: tỉ lệ 60/40 ở MỌI breakpoint (giỏ hàng flex-[3], Zalo flex-[2]).
// flex-nowrap giữ 2 nút cạnh nhau cả trên mobile. Khớp thanh dính đáy mobile.
export function BuyButtons({
  canBuy,
  adding,
  onAdd,
  zaloUrl,
}: {
  canBuy: boolean;
  adding: boolean;
  onAdd: () => void;
  zaloUrl?: string;
}) {
  const tb = useTranslations("PdpBuyBox");
  return (
    <div data-purchase-actions className="mt-5 flex flex-nowrap gap-2.5">
      <div className="min-w-0 flex-[3]">
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
          className="h-[52px] w-full rounded-none px-4 font-body text-caption"
          disabled={!canBuy || adding}
          onClick={onAdd}
        >
          {/* lucide ShoppingCart: bigbike-web KHÔNG nạp Font Awesome (fa-* vô hình),
              nên thay `<i fal fa-shopping-cart>` cũ. !flex + justify-center + gap-2.5
              căn icon/chữ giống hệt nút Zalo để 2 nút thẳng hàng. */}
          <ShoppingCart className="size-5 shrink-0" />
          {adding ? tb("adding") : tb("addToCart")}
        </Button>
      </div>
      <div className="min-w-0 flex-[2]">
        {/* <a> kế thừa `display:inline-block` của theme `.btn` → chữ dạt
            góc; ép flex căn giữa cho khớp nút THÊM VÀO GIỎ (vốn là <button>
            tự căn). gap-2.5 = 10px khớp khoảng cách icon nút trái.
            Kiểu Zalo phụ: nền trắng + viền/chữ/LOGO xanh Zalo (text-zalo →
            logo lấy currentColor). !border-2 !border-zalo thắng `border:none`
            của theme `.add-to-cart .btn`. */}
        <Button
          asChild
          variant="outline"
          className="h-[52px] w-full rounded-none border-2 border-zalo bg-white px-3 font-body text-caption text-zalo hover:bg-zalo-soft hover:text-zalo"
        >
          <a
            href={zaloUrl ? zaloHref(zaloUrl) : "#"}
            target={zaloUrl ? "_blank" : undefined}
            rel={zaloUrl ? "noopener noreferrer" : undefined}
          >
            <ZaloIcon className="size-5 shrink-0" />
            {tb("zaloConsult")}
          </a>
        </Button>
      </div>
    </div>
  );
}
