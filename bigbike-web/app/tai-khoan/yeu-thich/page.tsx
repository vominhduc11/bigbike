import { WpAccountShell } from "@/components/wp/WpAccountShell";
import { WishlistContent } from "./WishlistContent";

/**
 * Sản phẩm yêu thích — trang riêng của BigBike (WP gốc không có), dựng theo
 * phong cách WP: tiêu đề .account-title trong vùng nội dung tài khoản.
 * Server component bọc WpAccountShell (header/footer/sidebar WP) + nội dung client.
 */
export default function WishlistPage() {
  return (
    <WpAccountShell loginRedirect="/tai-khoan/yeu-thich/">
      <WishlistContent />
    </WpAccountShell>
  );
}
