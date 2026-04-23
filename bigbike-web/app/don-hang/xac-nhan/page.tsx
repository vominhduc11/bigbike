import Link from "next/link";
import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toOrderHistoryPath, toProductListPath } from "@/lib/utils/routes";

export const metadata: Metadata = buildPublicMetadata({
  title: "Đặt hàng thành công",
  description: "Xác nhận đơn hàng BigBike.",
  canonicalPath: "/don-hang/xac-nhan",
  noIndex: true,
});

type Props = { searchParams: Promise<{ so?: string }> };

export default async function OrderConfirmPage({ searchParams }: Props) {
  const { so: orderNumber } = await searchParams;

  return (
    <section className="bb-page">
      <div className="bb-container">
        <div className="bb-confirm-wrap">
          <div className="bb-confirm-icon">✓</div>
          <h1>Đặt hàng thành công!</h1>
          <p className="bb-page-subtitle">
            Cảm ơn bạn đã mua hàng tại BigBike. Chúng tôi sẽ liên hệ xác nhận đơn hàng trong thời gian sớm nhất.
          </p>

          {orderNumber && (
            <div className="bb-card" style={{ padding: "var(--bb-space-5)", marginTop: "var(--bb-space-6)", textAlign: "left" }}>
              <p style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-sm)", marginBottom: "var(--bb-space-1)" }}>
                Mã đơn hàng
              </p>
              <p style={{ fontFamily: "monospace", fontSize: "var(--bb-text-lg)", fontWeight: 700, color: "var(--bb-text-brand)" }}>
                #{orderNumber}
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: "var(--bb-space-3)", marginTop: "var(--bb-space-6)", flexWrap: "wrap" }}>
            <Link href={toOrderHistoryPath()} className="bb-button bb-button-secondary">
              Xem đơn hàng của tôi
            </Link>
            <Link href={toProductListPath()} className="bb-button bb-button-primary">
              Tiếp tục mua hàng
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
