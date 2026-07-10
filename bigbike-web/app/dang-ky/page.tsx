import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { Tr } from "@/components/i18n/Tr";
import { RegisterForm } from "./RegisterForm";
import { RegisterFormIsland } from "./RegisterFormIsland";

const AUTH_CSS = "/wp-content/themes/bigbike/css/wp-theme-auth.css?v=1";

export const metadata: Metadata = buildPublicMetadata({
  title: "Đăng ký tài khoản",
  description: "Tạo tài khoản BigBike để đặt hàng, theo dõi đơn hàng và tra cứu bảo hành sản phẩm.",
  canonicalPath: "/dang-ky/",
  noIndex: true,
});

export default function RegisterPage() {
  return (
    <WpStaticShell title="" breadcrumb={[]} showHero={false} mainClassName="" cssHref={AUTH_CSS}>
      <div className="user-activity">
        <div className="container">
          <div className="register">
            <div className="user-activity-content">
              <div className="user-activity-content-title mb-[30px]">
                <h1 className="mb-2"><Tr ns="Auth" k="tabRegister" /></h1>
                <p className="m-0">
                  <Tr ns="Auth" k="haveAccountPrompt" />{" "}
                  <Link href="/dang-nhap/"><Tr ns="Auth" k="here" /></Link>
                </p>
                <p className="m-0 mt-1"><Tr ns="Auth" k="fillInfoPrompt" /></p>
              </div>
              <Suspense fallback={<RegisterForm />}>
                <RegisterFormIsland />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </WpStaticShell>
  );
}
