import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPublicMetadata({
  title: "Giỏ hàng",
  description: "Xem và quản lý giỏ hàng của bạn tại BigBike - đồ bảo hộ mô tô chính hãng.",
  canonicalPath: "/gio-hang/",
  noIndex: true,
});

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
