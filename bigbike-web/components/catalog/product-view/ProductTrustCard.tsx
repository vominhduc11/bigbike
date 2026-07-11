"use client";

import type { CSSProperties, ReactNode } from "react";
import { useLocale } from "next-intl";
import { BadgeCheck, ClipboardCheck, MapPin, MessageCircle, Package, Phone, Shield, Tag, type LucideIcon } from "lucide-react";
import { Tr } from "@/components/i18n/Tr";
import { Button } from "@/components/ui/button";
import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import { TrustLivePrice, TrustLiveStock } from "@/components/catalog/ProductTrustLive";
import { PdpSectionHeading } from "@/components/catalog/product-view/PdpSection";
import { COMMITMENT_ICON_MAP } from "@/components/catalog/purchase/CommitmentsList";
import { telHref, zaloHref } from "@/lib/utils/format";
import type { Product, ProductCommitment } from "@/lib/contracts/public";

type TrustItem = { key: "price" | "stock"; labelKey: string; value: ReactNode };

/**
 * Ô số liệu THỜI GIAN THỰC của khối "Mua tại BigBike.vn" (#12): Giá + Kho, cùng nguồn nút mua
 * (giảm giá + tắt-bán thủ công). Cam kết/Liên hệ render riêng trong <ProductTrustCard>.
 */
export function buildTrustItems({ product, previewMode }: { product: Product; previewMode: boolean }): TrustItem[] {
  const items: TrustItem[] = [];
  if (product.price?.retailPrice != null) {
    items.push({ key: "price", labelKey: "trustPrice", value: <TrustLivePrice product={product} previewMode={previewMode} /> });
  }
  if (product.stockState) {
    items.push({ key: "stock", labelKey: "trustStock", value: <TrustLiveStock product={product} previewMode={previewMode} /> });
  }
  return items;
}

type Cell = { key: string; icon: LucideIcon; tone: "red" | "dark"; value: ReactNode; label?: ReactNode };

type TrustContactProps = {
  hotline: string;
  zaloDisplay: string;
  zaloUrl: string;
  contactAddress: string;
  hoursWeekday: string;
  hoursWeekend: string;
};

/**
 * Thẻ trust "Mua tại BigBike.vn" — tiêu đề dùng CHUNG <PdpSectionHeading> như mọi section PDP khác
 * (vạch đỏ + chữ hoa 24px), huy hiệu "Chính hãng" đặt ở slot `end` cùng hàng. Bên dưới là lưới ô
 * Giá/Kho/Cam kết/Đồng kiểm co giãn 2→3→N cột, footer liên hệ (Hotline bấm gọi, giờ mở cửa, Zalo,
 * Địa chỉ) + CTA Zalo.
 *
 * Cam kết (Bảo hành/Giao hàng/Đổi trả…) đọc THẲNG từ `product.commitments` — CÙNG NGUỒN với khối
 * "Cam kết" render dưới nút mua (CommitmentsList, đầu trang, cùng COMMITMENT_ICON_MAP). Admin chỉ
 * sửa MỘT chỗ (tab Chi tiết sản phẩm), 2 nơi trên trang tự khớp nhau — không có ô nhập tay riêng ở
 * đây, tránh lệch nội dung như module purchaseLines cũ đã bỏ (V276).
 *
 * "Chính hãng" + "Đồng kiểm khi nhận" là chữ tĩnh (cam kết chung toàn shop, không phải dữ liệu
 * riêng từng SP) — cùng lý do tiêu đề khối cũng là chữ tĩnh.
 *
 * Cỡ chữ trong khối theo đúng thang PDP (`STYLEGUIDE.md` §Thang chữ trang chi tiết sản phẩm):
 * giá trị ô = "Nội dung" 18px (cam kết), nhãn ô = "Chữ nhỏ" 14px (nhãn số liệu), số hotline =
 * "Tiêu đề phụ" 20px (nút Gọi/Zalo) — trước đây lệch thang (16/12/18), đã chỉnh 2026-07-03.
 */
export function ProductTrustCard({
  items,
  viCommitments,
  hotline,
  zaloDisplay,
  zaloUrl,
  contactAddress,
  hoursWeekday,
  hoursWeekend,
}: { items: TrustItem[]; viCommitments: ProductCommitment[] } & TrustContactProps) {
  const locale = useLocale();
  const enCommitments = useLocalizedField<ProductCommitment[]>("commitments");
  const commitments = (locale === "en" ? enCommitments ?? viCommitments : viCommitments).filter((c) => c.title);

  const cells: Cell[] = items.map((item) => ({
    key: item.key,
    icon: item.key === "price" ? Tag : Package,
    tone: item.key === "price" ? "red" : "dark",
    value: item.value,
    label: <Tr ns="Product" k={item.labelKey} />,
  }));
  commitments.forEach((c, i) => {
    cells.push({
      key: `commitment-${i}`,
      icon: COMMITMENT_ICON_MAP[c.icon] ?? Shield,
      tone: "dark",
      value: c.title,
      label: c.subtitle || undefined,
    });
  });
  if (cells.length > 0) {
    // Ô "Đồng kiểm khi nhận" — cam kết chung MỌI đơn COD (không phải dữ liệu riêng từng SP).
    cells.push({
      key: "inspection",
      icon: ClipboardCheck,
      tone: "dark",
      value: <Tr ns="Product" k="trustInspectionValue" />,
      label: <Tr ns="Product" k="trustInspectionLabel" />,
    });
  }

  const hoursLine = [hoursWeekday, hoursWeekend].filter(Boolean).join(" · ");
  const hasContact = Boolean(hotline || contactAddress || hoursLine || zaloDisplay);
  const zaloLink = zaloUrl || zaloDisplay;
  if (cells.length === 0 && !hasContact) return null;

  return (
    <>
      <PdpSectionHeading
        title={<Tr ns="Product" k="trustBlockTitle" />}
        end={
          <div className="inline-flex shrink-0 items-center gap-1.5 text-ui-14 font-semibold text-success">
            <BadgeCheck className="size-4" strokeWidth={2} aria-hidden="true" />
            <Tr ns="Product" k="trustVerified" />
          </div>
        }
      />

      {cells.length > 0 ? (
        <div
          className="grid grid-cols-2 border-l border-t border-border sm:grid-cols-3 lg:[grid-template-columns:repeat(var(--bb-trust-cols),minmax(0,1fr))]"
          style={{ "--bb-trust-cols": cells.length } as CSSProperties}
        >
          {cells.map((cell) => {
            const Icon = cell.icon;
            return (
              <div
                key={cell.key}
                className="flex min-h-[88px] flex-col gap-2 border-r border-b border-border p-3 transition-colors hover:bg-secondary"
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center ${cell.tone === "red" ? "bg-brand-soft" : "bg-secondary"}`}
                  aria-hidden="true"
                >
                  <Icon className={`size-3.5 ${cell.tone === "red" ? "text-brand" : "text-foreground"}`} strokeWidth={1.8} />
                </span>
                <span
                  className={`font-body text-ui-18 max-md:text-ui-16 font-semibold ${cell.tone === "red" ? "text-brand" : "text-foreground"}`}
                >
                  {cell.value}
                </span>
                {cell.label ? (
                  <span className="text-ui-14 max-md:text-ui-12 uppercase tracking-wide text-muted-foreground">{cell.label}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {hasContact ? (
        <div className="flex flex-col gap-4 border border-t-0 border-border bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
            {hotline ? (
              // Quy tắc liên kết cũ không được làm đổi màu nút hành động này.
              // nằm trong @layer → thắng mọi utility Tailwind bất kể specificity trên MỌI <a> của trang
              // (xem [[project_bigbike_web_wp_css_overrides_tailwind_layer]]). Phải ép !important.
              <a
                href={telHref(hotline)}
                className="inline-flex items-center gap-2 font-body text-ui-20 max-md:text-ui-18 font-semibold !text-brand transition-colors hover:!text-brand-hover"
              >
                <Phone className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                {hotline}
              </a>
            ) : null}
            {hoursLine || zaloDisplay ? (
              <span className="text-ui-14 leading-snug text-muted-foreground">
                {hoursLine}
                {hoursLine && zaloDisplay ? <br /> : null}
                {zaloDisplay ? (
                  <>
                    <Tr ns="Product" k="trustZaloLabel" /> {zaloDisplay}
                  </>
                ) : null}
              </span>
            ) : null}
            {contactAddress ? (
              <span className="inline-flex items-start gap-2 text-ui-14 text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                {contactAddress}
              </span>
            ) : null}
          </div>
          {zaloLink ? (
            // Cùng lý do !important như nút "Thêm vào giỏ" trong BuyButtons.tsx.
            <Button
              asChild
              variant="primary"
              className="w-full shrink-0 !border-primary !bg-primary !text-primary-foreground transition-colors hover:!border-brand-hover hover:!bg-brand-hover sm:w-auto"
            >
              <a href={zaloHref(zaloLink)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                <Tr ns="PdpBuyBox" k="zaloConsult" />
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
