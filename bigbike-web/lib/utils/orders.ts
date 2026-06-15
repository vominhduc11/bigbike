import type { OrderDetail } from "@/lib/contracts/commerce";

// Trạng thái đơn (chưa giao) mà khách được phép tự huỷ khi chưa thanh toán.
const ACTIVE_CANCELLABLE_STATUSES = new Set(["PENDING", "ON_HOLD"]);

/**
 * Khách được tự huỷ đơn khi chưa thu tiền và hàng chưa rời kho.
 * Mirror chính xác backend `CustomerOrderCancelService.isCustomerCancellable` —
 * backend là nguồn chốt cuối; helper này chỉ để ẩn/hiện nút trên UI.
 */
export function isCustomerCancellable(
  order: Pick<OrderDetail, "status" | "paymentStatus" | "fulfillmentStatus">,
): boolean {
  if (order.paymentStatus !== "UNPAID") return false;
  if (ACTIVE_CANCELLABLE_STATUSES.has(order.status)) return true;
  if (order.status === "PROCESSING") {
    return order.fulfillmentStatus !== "SHIPPED" && order.fulfillmentStatus !== "DELIVERED";
  }
  return false;
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
  /** true khi admin đã nhập đủ chủ TK + số TK → hiển thị box; false → hiện fallback. */
  configured: boolean;
  holder: string;
  number: string;
  bankName: string;
  branch: string;
};

/**
 * Quyết định thông tin chuyển khoản hiển thị ở trang xác nhận đơn.
 * Trả null khi không phải đơn chuyển khoản (BACS) → không hiển thị gì.
 * Số tài khoản do admin tự nhập ở Cài đặt → Thanh toán (public settings).
 */
export function resolveBankTransfer(
  paymentMethod: string | null | undefined,
  settings: Map<string, string>,
): BankTransferInfo | null {
  if ((paymentMethod ?? "").trim().toUpperCase() !== "BACS") return null;
  const holder = settings.get("bank_account_holder")?.trim() ?? "";
  const number = settings.get("bank_account_number")?.trim() ?? "";
  return {
    configured: Boolean(holder && number),
    holder,
    number,
    bankName: settings.get("bank_name")?.trim() ?? "",
    branch: settings.get("bank_branch")?.trim() ?? "",
  };
}
