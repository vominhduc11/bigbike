import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readSingleSearchParam } from "@/lib/utils/query";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { toAccountPath } from "@/lib/utils/routes";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { Tr } from "@/components/i18n/Tr";
import { LoginForm } from "./LoginForm";

const AUTH_CSS = "/wp-content/themes/bigbike/css/wp-theme-auth.css?v=1";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = buildPublicMetadata({
  title: "Đăng nhập",
  description: "Đăng nhập vào tài khoản BigBike để xem đơn hàng, theo dõi bảo hành và quản lý thông tin cá nhân.",
  canonicalPath: "/dang-nhap/",
  noIndex: true,
});

/**
 * Đăng nhập — port từ page-templates/page-login.php (KHÔNG hero):
 * `.user-activity > .container > .login > .user-activity-content > [title + form]`.
 * Server component bọc WpStaticShell (header/footer WP) + form client.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawReturnTo = readSingleSearchParam(params.tiep) ?? "";
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : toAccountPath();

  return (
    <WpStaticShell title="" breadcrumb={[]} showHero={false} mainClassName="" cssHref={AUTH_CSS}>
      <div className="user-activity">
        <div className="container">
          <div className="login">
            <div className="user-activity-content">
              <div className="user-activity-content-title mb-[30px]">
                <h1 className="mb-2"><Tr ns="Auth" k="tabLogin" /></h1>
                <p className="m-0">
                  <Tr ns="Auth" k="newMemberPrompt" />{" "}
                  <Link href="/dang-ky/"><Tr ns="Auth" k="here" /></Link>
                </p>
              </div>
              <LoginForm returnTo={returnTo} />
            </div>
          </div>
        </div>
      </div>
    </WpStaticShell>
  );
}
