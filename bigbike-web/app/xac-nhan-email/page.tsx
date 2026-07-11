import type { Metadata } from "next";
import { Suspense } from "react";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { AuthPageFrame } from "@/components/auth/AuthPageFrame";
import { VerifyEmailContent } from "./VerifyEmailContent";

export const metadata: Metadata = buildPublicMetadata({
  title: "Xác nhận email",
  description: "Xác nhận địa chỉ email cho tài khoản BigBike.",
  canonicalPath: "/xac-nhan-email/",
  noIndex: true,
});

/**
 * Xác nhận email — khung WP `.user-activity > .container > .login` (canh giữa).
 * Server component bọc StaticPageShell + nội dung client (đọc token qua useSearchParams).
 */
export default function VerifyEmailPage() {
  return (
    <AuthPageFrame>
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </AuthPageFrame>
  );
}
