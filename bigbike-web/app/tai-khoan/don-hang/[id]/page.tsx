import { WpAccountShell } from "@/components/wp/WpAccountShell";
import { OrderDetailContent } from "./OrderDetailContent";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Chi tiết đơn hàng — port từ woocommerce/myaccount/view-order.php.
 * Server component await params (Next 15 Promise) rồi bọc WpAccountShell + nội dung client.
 */
export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <WpAccountShell loginRedirect={`/tai-khoan/don-hang/${id}/`}>
      <OrderDetailContent orderId={id} />
    </WpAccountShell>
  );
}
