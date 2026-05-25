import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readSingleSearchParam } from "@/lib/utils/query";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { toAccountPath } from "@/lib/utils/routes";
import { LoginForm } from "./LoginForm";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = buildPublicMetadata({
  title: "Đăng nhập",
  description: "Đăng nhập vào tài khoản BigBike để xem đơn hàng, theo dõi bảo hành và quản lý thông tin cá nhân.",
  canonicalPath: "/dang-nhap/",
  noIndex: true,
});

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawReturnTo = readSingleSearchParam(params.tiep) ?? "";
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : toAccountPath();

  return (
    <section className="bb-page bb-page--auth">
      <div className="bb-container">
        <div className="bb-auth-wrap">
          <div className="mb-5">
            <h1 className="mb-2 text-base font-semibold normal-case">Đăng nhập</h1>
            <p className="m-0 text-sm text-foreground">
              Đăng ký thành viên mới tại{" "}
              <Link href="/dang-ky/" className="bb-link font-normal">
                đây
              </Link>
            </p>
          </div>
          <LoginForm returnTo={returnTo} />
        </div>
      </div>
    </section>
  );
}
