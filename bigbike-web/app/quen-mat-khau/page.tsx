import type { Metadata } from "next";
import { Suspense } from "react";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toForgotPasswordPath } from "@/lib/utils/routes";
import { AuthPageFrame } from "@/components/auth/AuthPageFrame";
import ForgotPasswordFlow from "./ForgotPasswordFlow";
import { ForgotPasswordFlowIsland } from "./ForgotPasswordFlowIsland";

export const metadata: Metadata = buildPublicMetadata({
  title: "Quên mật khẩu",
  description: "Gửi yêu cầu đặt lại mật khẩu cho tài khoản BigBike.",
  canonicalPath: toForgotPasswordPath(),
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <AuthPageFrame>
      <Suspense fallback={<ForgotPasswordFlow />}>
        <ForgotPasswordFlowIsland />
      </Suspense>
    </AuthPageFrame>
  );
}
