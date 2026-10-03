import type { OrderDetail } from "@/lib/contracts/commerce";

// ORDER_RULE_002: khách được huỷ đơn đang chờ xác nhận hoặc đang xử lý.
const ACTIVE_CANCELLABLE_STATUSES = new Set(["PENDING", "PROCESSING"]);

/**
 * Quyền huỷ hiện có chỉ phụ thuộc trạng thái đơn, không phụ thuộc việc đã nhận tiền.
 * Mirror chính xác backend `CustomerOrderCancelService.isCustomerCancellable` —
 * backend là nguồn chốt cuối; helper này chỉ để ẩn/hiện nút trên UI.
 */
export function isCustomerCancellable(order: Pick<OrderDetail, "status">): boolean {
  return ACTIVE_CANCELLABLE_STATUSES.has(order.status);
}

/**
 * Dựng href cho bộ lọc đơn theo trạng thái. Không truyền status → về trang gốc
 * (tab "Tất cả"). PaginationNav sẽ tự gắn `&page=` lên href này.
 */
export function orderFilterHref(basePath: string, status?: string): string {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export function orderPaymentMethod(order: Pick<OrderDetail, "paymentMethod" | "payments">): string {
  return (order.paymentMethod ?? order.payments[0]?.paymentMethod ?? "").trim().toUpperCase();
}
