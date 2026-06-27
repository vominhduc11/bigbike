import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPublicMetadata({
  title: "Đặt hàng",
  description: "Hoàn tất đơn hàng đồ bảo hộ mô tô chính hãng tại BigBike.",
  canonicalPath: "/dat-hang/",
  noIndex: true,
});

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
