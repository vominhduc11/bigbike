import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readSingleSearchParam } from "@/lib/utils/query";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { toAccountPath } from "@/lib/utils/routes";
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
      <div className="bb-container">
        <div className="bb-auth-wrap">
          <div className="mb-5">
            <h1 className="mb-2 text-base font-semibold normal-case">Đăng ký</h1>
            <p className="m-0 text-sm text-foreground">
              Nếu bạn đã có tài khoản, đăng nhập tại{" "}
              <Link href="/dang-nhap/" className="bb-link font-normal">
                đây
              </Link>
            </p>
            <p className="m-0 mt-2 text-sm text-foreground">
              Xin vui lòng điền chính xác các thông tin để tạo tài khoản Bigbike.
            </p>
          </div>
          <RegisterForm returnTo={returnTo} />
        </div>
      </div>
    </section>
  );
}
