import type { Metadata } from "next";
import { Suspense } from "react";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { VerifyEmailContent } from "./VerifyEmailContent";

const AUTH_CSS = "/wp-content/themes/bigbike/css/wp-theme-auth.css?v=1";

export const metadata: Metadata = buildPublicMetadata({
  title: "Xác nhận email",
  description: "Xác nhận địa chỉ email cho tài khoản BigBike.",
  canonicalPath: "/xac-nhan-email/",
  noIndex: true,
});

/**
 * Xác nhận email — khung WP `.user-activity > .container > .login` (canh giữa).
 * Server component bọc WpStaticShell + nội dung client (đọc token qua useSearchParams).
 */
export default function VerifyEmailPage() {
  return (
    <WpStaticShell title="" breadcrumb={[]} showHero={false} mainClassName="" cssHref={AUTH_CSS}>
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </WpStaticShell>
  );
}
