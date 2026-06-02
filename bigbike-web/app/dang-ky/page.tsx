import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readSingleSearchParam } from "@/lib/utils/query";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { toAccountPath } from "@/lib/utils/routes";
import { bbLink } from "@/lib/ui-classes";
import { Container } from "@/components/layout/Container";
import { RegisterForm } from "./RegisterForm";

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = buildPublicMetadata({
  title: "Đăng ký tài khoản",
  description: "Tạo tài khoản BigBike để đặt hàng, theo dõi đơn hàng và tra cứu bảo hành sản phẩm.",
  canonicalPath: "/dang-ky/",
  noIndex: true,
});

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const rawReturnTo = readSingleSearchParam(params.tiep) ?? "";
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : toAccountPath();

  return (
    <section className="bb-page bb-page--auth">
      <Container>
        <div className="bb-auth-wrap">
          <div className="mb-5">
            <h1 className="bb-auth-heading mb-2">Đăng ký</h1>
            <p className="m-0 text-body text-foreground">
              Nếu bạn đã có tài khoản, đăng nhập tại{" "}
              <Link href="/dang-nhap/" className={bbLink}>
                đây
              </Link>
            </p>
            <p className="m-0 mt-2 text-body text-foreground">
              Xin vui lòng điền chính xác các thông tin để tạo tài khoản Bigbike.
            </p>
          </div>
          <RegisterForm returnTo={returnTo} />
        </div>
      </Container>
    </section>
  );
}
