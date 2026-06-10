import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readSingleSearchParam } from "@/lib/utils/query";
import { toForgotPasswordPath } from "@/lib/utils/routes";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import ForgotPasswordFlow from "./ForgotPasswordFlow";

const AUTH_CSS = "/wp-content/themes/bigbike/css/wp-theme-auth.css?v=1";

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ForgotPasswordPageProps): Promise<Metadata> {
  const params = await searchParams;
  const hasToken = Boolean(readSingleSearchParam(params.token));

  return buildPublicMetadata({
    title: hasToken ? "Đặt lại mật khẩu" : "Quên mật khẩu",
    description: hasToken
      ? "Đặt lại mật khẩu BigBike bằng liên kết xác thực."
      : "Gửi yêu cầu đặt lại mật khẩu cho tài khoản BigBike.",
    canonicalPath: toForgotPasswordPath(),
    noIndex: true,
  });
}

/**
 * Quên / đặt lại mật khẩu — khung WP `.user-activity > .container > .login`
 * (cùng khung đăng nhập). Server component bọc WpStaticShell + flow client (2 mode).
 */
export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const token = readSingleSearchParam(params.token);

  return (
    <WpStaticShell title="" breadcrumb={[]} showHero={false} mainClassName="" cssHref={AUTH_CSS}>
      <div className="user-activity">
        <div className="container">
          <div className="login">
            <div className="user-activity-content">
              <ForgotPasswordFlow token={token} />
            </div>
          </div>
        </div>
      </div>
    </WpStaticShell>
  );
}
