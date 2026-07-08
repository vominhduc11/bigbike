"use client";

import { useEffect, useState } from "react";

import { ProductView } from "@/components/catalog/ProductView";
import { PreviewGuard } from "@/components/preview/PreviewGuard";
import { fetchPublicSettings } from "@/lib/api/client-api";
import type { Product, PublicSiteSetting } from "@/lib/contracts/public";
import { withFlatHighlights } from "@/lib/contracts/public";
import { env } from "@/env";

// Origin của app admin — chỉ nhận postMessage từ đây (chống frame lạ chèn dữ liệu).
// Header `frame-ancestors` ở next.config cũng chỉ cho admin nhúng route /preview/*.
const ADMIN_ORIGIN = env.NEXT_PUBLIC_ADMIN_ORIGIN?.replace(/\/$/, "") ?? "";

type PreviewInbound = { type: "bigbike-preview"; data: Product };

/**
 * Khung xem trước "sống" cho admin editor: KHÔNG tự fetch sản phẩm. Nhận dữ liệu
 * bản nháp (đã được backend dry-run map sang public Product shape) qua postMessage
 * từ app admin rồi render bằng đúng <ProductView> của PDP thật. Route này noindex
 * (X-Robots-Tag ở next.config) và chỉ cho phép admin origin nhúng iframe.
 */
export default function ProductPreviewPage() {
  const [product, setProduct] = useState<Product | null>(null);
  // NAP toàn site (Hotline / Địa chỉ / Zalo) dùng cho khối "Mua tại BigBike.vn" + dải
  // liên hệ chân trang. PDP công khai lấy từ server; route preview là client nên tự gọi
  // endpoint public (không cần đăng nhập) để khung xem trước KHỚP web thật — trước đây
  // truyền [] nên 2 ô Hotline/Địa chỉ bị trống. Lỗi/đang tải → giữ [] (ô rỗng tự ẩn,
  // không chặn preview).
  const [settings, setSettings] = useState<PublicSiteSetting[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicSettings()
      .then((list) => {
        if (cancelled) return;
        // Client API trả {settingKey,settingValue}; ProductView nhận PublicSiteSetting
        // (thêm settingGroup) — chỉ đọc key/value nên gán group = null là đủ.
        setSettings(list.map((s) => ({ ...s, settingGroup: null })));
      })
      .catch(() => {
        /* settings lỗi → preview vẫn chạy, chỉ thiếu NAP như trước */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Chỉ nhận từ origin admin đã cấu hình. Khi chưa set (dev local) thì bỏ qua
      // kiểm tra để vẫn chạy được giữa localhost:3000 ↔ localhost:5173.
      if (ADMIN_ORIGIN && event.origin !== ADMIN_ORIGIN) return;
      const inbound = event.data as PreviewInbound | undefined;
      if (!inbound || inbound.type !== "bigbike-preview" || !inbound.data) return;
      setProduct(withFlatHighlights(inbound.data));
    }

    window.addEventListener("message", handleMessage);
    // Bắt tay: báo cho frame cha (admin) biết iframe đã sẵn sàng nhận dữ liệu, để
    // admin gửi ngay payload hiện tại mà không phải chờ lần gõ kế tiếp.
    window.parent?.postMessage({ type: "bigbike-preview-ready" }, ADMIN_ORIGIN || "*");

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!product) {
    return (
      <div className="container py-20 text-center text-muted-foreground">
        Đang chờ dữ liệu xem trước…
      </div>
    );
  }

  return (
    <>
      <PreviewGuard />
      <ProductView product={product} settings={settings} previewMode />
    </>
  );
}
