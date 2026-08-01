import { Suspense } from "react";
import { AccountShell } from "@/components/layout/AccountShell";
import { OrderHistoryContent } from "./OrderHistoryContent";

/**
 * Lịch sử đơn hàng — port từ woocommerce/myaccount/orders.php.
 * Server component bọc AccountShell (header/footer/sidebar WP) + nội dung client.
 */
export default function OrderHistoryPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/don-hang/">
      <Suspense fallback={null}>
        <OrderHistoryContent />
      </Suspense>
    </AccountShell>
  );
}
