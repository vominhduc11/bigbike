import type { Metadata } from "next";
import { Suspense } from "react";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toForgotPasswordPath } from "@/lib/utils/routes";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import ForgotPasswordFlow from "./ForgotPasswordFlow";
import { ForgotPasswordFlowIsland } from "./ForgotPasswordFlowIsland";

const AUTH_CSS = "/wp-content/themes/bigbike/css/wp-theme-auth.css?v=1";

export const metadata: Metadata = buildPublicMetadata({
  title: "Quên mật khẩu",
  description: "Gửi yêu cầu đặt lại mật khẩu cho tài khoản BigBike.",
  canonicalPath: toForgotPasswordPath(),
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <WpStaticShell title="" breadcrumb={[]} showHero={false} mainClassName="" cssHref={AUTH_CSS}>
      <div className="user-activity">
        <div className="container">
          <div className="login">
            <div className="user-activity-content">
              <Suspense fallback={<ForgotPasswordFlow />}>
                <ForgotPasswordFlowIsland />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </WpStaticShell>
  );
}
