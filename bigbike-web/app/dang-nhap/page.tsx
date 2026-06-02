import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readSingleSearchParam } from "@/lib/utils/query";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { toAccountPath } from "@/lib/utils/routes";
import { authHeading, bbLink } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
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
      <Container>
        <div className="bb-auth-wrap">
          <div className="mb-5">
            <h1 className={cn(authHeading, "mb-2")}>Đăng nhập</h1>
            <p className="m-0 text-body text-foreground">
              Đăng ký thành viên mới tại{" "}
              <Link href="/dang-ky/" className={bbLink}>
                đây
              </Link>
            </p>
          </div>
          <LoginForm returnTo={returnTo} />
        </div>
      </Container>
    </section>
  );
}
