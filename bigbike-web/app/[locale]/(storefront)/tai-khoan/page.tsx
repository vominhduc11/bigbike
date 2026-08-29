import { AccountShell } from "@/components/layout/AccountShell";
import { DashboardContent } from "./DashboardContent";

/**
 * Tài khoản (bảng điều khiển) — port từ page-templates/page-profile.php.
 * Server component bọc AccountShell (header/footer/container WP) + nội dung client.
 */
export default function AccountIndexPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/">
      <DashboardContent />
    </AccountShell>
  );
}
