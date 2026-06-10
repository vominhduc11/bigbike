import { WpAccountShell } from "@/components/wp/WpAccountShell";
import { DashboardContent } from "./DashboardContent";

/**
 * Tài khoản (bảng điều khiển) — port từ page-templates/page-profile.php.
 * Server component bọc WpAccountShell (header/footer/container WP) + nội dung client.
 */
export default function AccountIndexPage() {
  return (
    <WpAccountShell loginRedirect="/tai-khoan/">
      <DashboardContent />
    </WpAccountShell>
  );
}
