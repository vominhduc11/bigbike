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

export type BankTransferInfo = {
  /** Chỉ hiển thị tài khoản khi đủ ngân hàng, chủ tài khoản và số tài khoản. */
  configured: boolean;
  holder: string;
  number: string;
  bankName: string;
  branch: string;
};

/**
 * Quyết định thông tin chuyển khoản hiển thị ở trang xác nhận đơn.
 * Hỗ trợ BANK_TRANSFER mới và BACS cũ; không suy diễn trạng thái đã thanh toán.
 * Số tài khoản do admin tự nhập ở Cài đặt → Thanh toán (public settings).
 */
export function resolveBankTransfer(
  paymentMethod: string | null | undefined,
  settings: Map<string, string>,
): BankTransferInfo | null {
  if (!["BANK_TRANSFER", "BACS"].includes((paymentMethod ?? "").trim().toUpperCase())) return null;
  const holder = settings.get("bank_account_holder")?.trim() ?? "";
  const number = settings.get("bank_account_number")?.trim() ?? "";
  const bankName = settings.get("bank_name")?.trim() ?? "";
  return {
    configured: Boolean(holder && number && bankName),
    holder,
    number,
    bankName,
    branch: settings.get("bank_branch")?.trim() ?? "",
  };
}

export function orderPaymentMethod(order: Pick<OrderDetail, "paymentMethod" | "payments">): string {
  return (order.paymentMethod ?? order.payments[0]?.paymentMethod ?? "").trim().toUpperCase();
}

/** Match the backend's single full-amount receipt, never infer success from order status. */
export function bankTransferStatus(order: OrderDetail): "PENDING" | "SUCCEEDED" | "UNKNOWN" | null {
  if (orderPaymentMethod(order) !== "BANK_TRANSFER") return null;
  const payment = order.payments[0];
  if (
    order.payments.length !== 1 ||
    payment?.paymentMethod !== "BANK_TRANSFER" ||
    payment.amount !== order.totalAmount ||
    payment.currency !== order.currency
  )
    return "UNKNOWN";
  return payment.status === "PENDING" || payment.status === "SUCCEEDED"
    ? payment.status
    : "UNKNOWN";
}
