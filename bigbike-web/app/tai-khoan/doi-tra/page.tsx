import { WpAccountShell } from "@/components/wp/WpAccountShell";
import { ReturnsContent } from "./ReturnsContent";

/**
 * Đổi/trả hàng — trang riêng của BigBike (WP gốc không có), dựng theo phong cách WP:
 * tiêu đề .account-title trong vùng nội dung tài khoản.
 * Server component bọc WpAccountShell (header/footer/sidebar WP) + nội dung client.
 */
export default function ReturnsPage() {
  return (
    <WpAccountShell loginRedirect="/tai-khoan/doi-tra/">
      <ReturnsContent />
    </WpAccountShell>
  );
}
