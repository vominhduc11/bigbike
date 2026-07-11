import { AccountShell } from "@/components/layout/AccountShell";
import { EditAccountContent } from "./EditAccountContent";

/**
 * Sửa thông tin tài khoản — port từ woocommerce/myaccount/form-edit-account.php.
 * Server component bọc AccountShell (header/footer/sidebar WP) + nội dung client.
 */
export default function EditAccountPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/edit-account/">
      <EditAccountContent />
    </AccountShell>
  );
}
