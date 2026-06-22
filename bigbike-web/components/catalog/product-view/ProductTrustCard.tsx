import type { CSSProperties, ReactNode } from "react";
import { Tr } from "@/components/i18n/Tr";
import { TrustLivePrice, TrustLiveStock } from "@/components/catalog/ProductTrustLive";
import type { Product } from "@/lib/contracts/public";
import { safeArray, safeText } from "@/lib/utils/format";

type TrustItem = { key: string; labelKey?: string; label?: string; value: ReactNode };

type BuildTrustItemsArgs = {
  product: Product;
  previewMode: boolean;
  hotline: string;
  zaloDisplay: string;
  contactAddress: string;
};

/**
 * Dựng danh sách ô của khối "Mua tại BigBike.vn" (#11): Giá/Kho THỜI GIAN THỰC ở đầu
 * (cùng nguồn nút mua, có giảm giá + tắt-bán thủ công), giữa là các dòng admin tự thêm
 * theo từng sản phẩm (purchaseLines — nhãn raw, không qua i18n), Liên hệ (Hotline + Zalo)
 * và Địa chỉ từ site settings ở cuối (rỗng trong preview). Mỗi item có `labelKey` (i18n)
 * HOẶC `label` (raw).
 */
export function buildTrustItems({ product, previewMode, hotline, zaloDisplay, contactAddress }: BuildTrustItemsArgs): TrustItem[] {
  const retailPrice = product.price?.retailPrice ?? null;
  const trustItems: TrustItem[] = [];
  if (retailPrice != null) {
    trustItems.push({ key: "price", labelKey: "trustPrice", value: <TrustLivePrice product={product} previewMode={previewMode} /> });
  }
  if (product.stockState) {
    trustItems.push({ key: "stock", labelKey: "trustStock", value: <TrustLiveStock product={product} previewMode={previewMode} /> });
  }
  // Dòng admin tự thêm (không giới hạn). Nhãn + giá trị là text admin nhập → render THẲNG, không i18n.
  safeArray(product.purchaseLines).forEach((line, index) => {
    const label = safeText(line?.label, "");
    const value = safeText(line?.value, "");
    if (!label && !value) return;
    trustItems.push({ key: `pl-${index}`, label, value });
  });
  // Liên hệ = Hotline + Zalo gộp một ô (mẫu "J. TRUST BLOCK"). Zalo lùi về rỗng khi chưa cấu hình.
  const contactValue = [hotline, zaloDisplay].filter(Boolean).join(" · ");
  if (contactValue) {
    trustItems.push({ key: "contact", labelKey: "trustContact", value: contactValue });
  }
  if (contactAddress) {
    trustItems.push({ key: "address", labelKey: "trustAddress", value: contactAddress });
  }
  return trustItems;
}

/**
 * Thẻ trust "cam kết" (chỉ lưới ô số liệu, KHÔNG tiêu đề bên trong). Tiêu đề mục đặt NGOÀI thẻ qua
 * <PdpSectionHeading> — DÙNG CHUNG desktop + mobile: khối này là section xếp chồng độc lập ở cả hai.
 */
export function ProductTrustCard({ items }: { items: TrustItem[] }) {
  // Số cột lưới ô trust tự khít theo SỐ ô: chia thành các hàng tối đa 4 ô, cân đều — tránh hàng cuối lẻ
  // 1 ô để hở 2 ô trống (VD 4 ô → 1 hàng 4; 7 ô → 4+3; 5 ô → 3+2; 6 ô → 3+3). Cột desktop truyền qua
  // biến CSS --bb-trust-cols. Mobile luôn 2 cột; nếu tổng ô lẻ thì ô cuối kéo rộng cả hàng cho gọn.
  const trustCols = (() => {
    const n = items.length;
    if (n <= 1) return 1;
    const rows = Math.ceil(n / 4);
    return Math.ceil(n / rows);
  })();

  return (
    <div className="bg-secondary p-6 text-foreground">
      <dl
        className={`grid grid-cols-2 gap-3 sm:[grid-template-columns:repeat(var(--bb-trust-cols),minmax(0,1fr))] ${
          items.length % 2 === 1 ? "max-sm:[&>:last-child]:col-span-2" : ""
        }`}
        style={{ "--bb-trust-cols": trustCols } as CSSProperties}
      >
        {items.map((item) => (
          <div key={item.key} className="border border-border bg-background p-3">
            <dd className="m-0 font-barlow text-18 max-md:text-ui-16 font-semibold">{item.value}</dd>
            <dt className="mt-1 text-ui-14 max-md:text-ui-12 uppercase tracking-wide text-muted-foreground">
              {item.labelKey ? <Tr ns="Product" k={item.labelKey} /> : item.label}
            </dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
