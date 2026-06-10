import { WpAccountShell } from "@/components/wp/WpAccountShell";
import { EditAccountContent } from "./EditAccountContent";

/**
 * Sửa thông tin tài khoản — port từ woocommerce/myaccount/form-edit-account.php.
 * Server component bọc WpAccountShell (header/footer/sidebar WP) + nội dung client.
 */
export default function EditAccountPage() {
  return (
    <WpAccountShell loginRedirect="/tai-khoan/edit-account/">
      <EditAccountContent />
    </WpAccountShell>
  );
}
