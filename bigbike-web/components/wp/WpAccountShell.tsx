import { WpAccountNav } from "./WpAccountNav";
import { WpThemeStylesheet } from "./WpThemeStylesheet";

/**
 * Khung WP cho cụm TÀI KHOẢN — port từ page-templates/page-profile.php:
 * #main-content > .container > (breadcrumb + .account-dashboard). Header + footer
 * KHÔNG còn render ở đây — đã được layout chung render một lần cho mọi route WP
 * (xem app/layout.tsx). Bundle wp-theme-static.css (chứa rule
 * .account-dashboard/.account-nav/.account-loggin/.my-account-sidebar) vẫn nạp
 * tại đây vì là CSS riêng của cụm tài khoản. Sidebar + content (cần auth) do
 * client WpAccountNav render.
 */
export function WpAccountShell({
  children,
  loginRedirect,
}: {
  children: React.ReactNode;
  loginRedirect?: string;
}) {
  return (
    <>
      <WpThemeStylesheet href="/wp-content/themes/bigbike/css/wp-theme-static.css?v=1" />

      <div id="main-content" className="bb-wp-account-page">
        <div className="container">
          <WpAccountNav loginRedirect={loginRedirect}>{children}</WpAccountNav>
        </div>
      </div>
    </>
  );
}
