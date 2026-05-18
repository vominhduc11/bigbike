import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { AuthTabs } from "@/app/dang-nhap/AuthTabs";

export const metadata: Metadata = buildPublicMetadata({
  title: "Đăng ký tài khoản",
  description: "Tạo tài khoản BigBike để đặt hàng, theo dõi đơn hàng và tra cứu bảo hành sản phẩm.",
  canonicalPath: "/dang-ky/",
  noIndex: true,
});

export default function RegisterPage() {
  return <AuthTabs defaultTab="register" />;
}
