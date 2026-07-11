import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { AuthPageFrame, AuthTitleBlock } from "@/components/auth/AuthPageFrame";
import { Tr } from "@/components/i18n/Tr";
import { LoginForm } from "./LoginForm";
import { LoginFormIsland } from "./LoginFormIsland";

export const metadata: Metadata = buildPublicMetadata({
  title: "Đăng nhập",
  description: "Đăng nhập vào tài khoản BigBike để xem đơn hàng, theo dõi bảo hành và quản lý thông tin cá nhân.",
  canonicalPath: "/dang-nhap/",
  noIndex: true,
});

export default function LoginPage() {
  return (
    <AuthPageFrame>
      <AuthTitleBlock title={<Tr ns="Auth" k="tabLogin" />}>
        <p className="m-0 text-a4-content text-foreground">
          <Tr ns="Auth" k="newMemberPrompt" />{" "}
          <Link href="/dang-ky/" className="font-semibold text-foreground underline">
            <Tr ns="Auth" k="here" />
          </Link>
        </p>
      </AuthTitleBlock>
      <Suspense fallback={<LoginForm />}>
        <LoginFormIsland />
      </Suspense>
    </AuthPageFrame>
  );
}
