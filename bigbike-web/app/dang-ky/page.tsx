import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { AuthPageFrame, AuthTitleBlock } from "@/components/auth/AuthPageFrame";
import { Tr } from "@/components/i18n/Tr";
import { RegisterForm } from "./RegisterForm";
import { RegisterFormIsland } from "./RegisterFormIsland";

export const metadata: Metadata = buildPublicMetadata({
  title: "Đăng ký tài khoản",
  description: "Tạo tài khoản BigBike để đặt hàng, theo dõi đơn hàng và tra cứu bảo hành sản phẩm.",
  canonicalPath: "/dang-ky/",
  noIndex: true,
});

export default function RegisterPage() {
  return (
    <AuthPageFrame wide>
      <AuthTitleBlock title={<Tr ns="Auth" k="tabRegister" />}>
        <p className="m-0 text-a4-content text-foreground">
          <Tr ns="Auth" k="haveAccountPrompt" />{" "}
          <Link href="/dang-nhap/" className="font-semibold text-foreground underline">
            <Tr ns="Auth" k="here" />
          </Link>
        </p>
        <p className="m-0 mt-1 text-a4-content text-foreground"><Tr ns="Auth" k="fillInfoPrompt" /></p>
      </AuthTitleBlock>
      <Suspense fallback={<RegisterForm />}>
        <RegisterFormIsland />
      </Suspense>
    </AuthPageFrame>
  );
}
