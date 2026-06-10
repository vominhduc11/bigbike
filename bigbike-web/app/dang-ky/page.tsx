import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readSingleSearchParam } from "@/lib/utils/query";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { toAccountPath } from "@/lib/utils/routes";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { RegisterForm } from "./RegisterForm";

const AUTH_CSS = "/wp-content/themes/bigbike/css/wp-theme-auth.css?v=1";

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = buildPublicMetadata({
  title: "Đăng ký tài khoản",
  description: "Tạo tài khoản BigBike để đặt hàng, theo dõi đơn hàng và tra cứu bảo hành sản phẩm.",
  canonicalPath: "/dang-ky/",
  noIndex: true,
});

/**
 * Đăng ký — port từ page-templates/page-register.php (KHÔNG hero):
 * `.user-activity > .container > .register > .user-activity-content > [title + form]`.
 * Server component bọc WpStaticShell (header/footer WP) + form client.
 */
export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const rawReturnTo = readSingleSearchParam(params.tiep) ?? "";
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : toAccountPath();

  return (
    <WpStaticShell title="" breadcrumb={[]} showHero={false} mainClassName="" cssHref={AUTH_CSS}>
      <div className="user-activity">
        <div className="container">
          <div className="register">
            <div className="user-activity-content">
              <div className="user-activity-content-title mb-[30px]">
                <h1 className="mb-2">Đăng ký</h1>
                <p className="m-0">
                  Nếu bạn đã có tài khoản, đăng nhập tại{" "}
                  <Link href="/dang-nhap/">đây</Link>
                </p>
                <p className="m-0 mt-1">Xin vui lòng điền chính xác các thông tin để tạo tài khoản Bigbike.</p>
              </div>
              <RegisterForm returnTo={returnTo} />
            </div>
          </div>
        </div>
      </div>
    </WpStaticShell>
  );
}
