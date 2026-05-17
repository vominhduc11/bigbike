import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { LoginPageContent } from "./LoginForm";

export const metadata: Metadata = buildPublicMetadata({
  title: "Đăng nhập",
  description: "Đăng nhập vào tài khoản BigBike để xem đơn hàng, theo dõi bảo hành và quản lý thông tin cá nhân.",
  canonicalPath: "/dang-nhap/",
  noIndex: true,
});

export default function LoginPage() {
  return <LoginPageContent />;
}
