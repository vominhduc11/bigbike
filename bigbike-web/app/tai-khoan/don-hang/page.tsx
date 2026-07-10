import { Suspense } from "react";
import { WpAccountShell } from "@/components/wp/WpAccountShell";
import { OrderHistoryContent } from "./OrderHistoryContent";

/**
 * Lịch sử đơn hàng — port từ woocommerce/myaccount/orders.php.
 * Server component bọc WpAccountShell (header/footer/sidebar WP) + nội dung client.
 */
export default function OrderHistoryPage() {
  return (
    <WpAccountShell loginRedirect="/tai-khoan/don-hang/">
      <Suspense fallback={null}>
        <OrderHistoryContent />
      </Suspense>
    </WpAccountShell>
  );
}
