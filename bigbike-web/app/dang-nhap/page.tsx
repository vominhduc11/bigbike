import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { Tr } from "@/components/i18n/Tr";
import { LoginForm } from "./LoginForm";
import { LoginFormIsland } from "./LoginFormIsland";

const AUTH_CSS = "/wp-content/themes/bigbike/css/wp-theme-auth.css?v=1";

export const metadata: Metadata = buildPublicMetadata({
  title: "Đăng nhập",
  description: "Đăng nhập vào tài khoản BigBike để xem đơn hàng, theo dõi bảo hành và quản lý thông tin cá nhân.",
  canonicalPath: "/dang-nhap/",
  noIndex: true,
});

export default function LoginPage() {
  return (
    <WpStaticShell title="" breadcrumb={[]} showHero={false} mainClassName="" cssHref={AUTH_CSS}>
      <div className="user-activity">
        <div className="container">
          <div className="login">
            <div className="user-activity-content">
              <div className="user-activity-content-title mb-[30px]">
                <h1 className="mb-2"><Tr ns="Auth" k="tabLogin" /></h1>
                <p className="m-0">
                  <Tr ns="Auth" k="newMemberPrompt" />{" "}
                  <Link href="/dang-ky/"><Tr ns="Auth" k="here" /></Link>
                </p>
              </div>
              <Suspense fallback={<LoginForm />}>
                <LoginFormIsland />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </WpStaticShell>
  );
}
