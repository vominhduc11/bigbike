"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  cancelMyOrder,
  fetchCart,
  fetchCheckoutOptions,
  fetchMe,
  fetchMyAddresses,
  fetchMyOrder,
  fetchMyOrders,
  removeCartItem,
  updateCartItem,
} from "@/lib/api/client-api";
import { queryKeys } from "./keys";

// ── Cart ────────────────────────────────────────────────────────────────────

export function useCartQuery() {
  return useQuery({
    queryKey: queryKeys.cart(),
    queryFn: fetchCart,
    staleTime: 30 * 1000,
    // Giỏ hàng nhạy thời gian (đổi tab/thiết bị, tồn kho thay đổi) → làm mới khi user
    // quay lại tab. Override global refetchOnWindowFocus:false cho riêng query này.
    refetchOnWindowFocus: true,
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(itemId, quantity),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart(), cart),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => removeCartItem(itemId),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart(), cart),
  });
}

// ── Checkout ────────────────────────────────────────────────────────────────

export function useCheckoutOptions() {
  const locale = useLocale();
  return useQuery({
    queryKey: queryKeys.checkoutOptions(locale),
    queryFn: () => fetchCheckoutOptions(locale),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Customer ────────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile(),
    queryFn: fetchMe,
    retry: false,
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: queryKeys.addresses(),
    queryFn: fetchMyAddresses,
    retry: false,
  });
}

// ── Orders ──────────────────────────────────────────────────────────────────

// Trạng thái đơn không còn đổi nữa → ngừng polling để khỏi gọi API vô ích.
const ORDER_TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "REFUNDED", "FAILED"]);
// Khách theo dõi đơn đang chạy → làm mới trạng thái mỗi 15s (admin đổi trạng thái
// theo nhịp thao tác tay nên 15s là đủ; cần dưới-giây thật thì chuyển sang SSE).
const ORDER_POLL_INTERVAL_MS = 15_000;

export function useOrders(page = 1, status?: string) {
  return useQuery({
    queryKey: queryKeys.orders(page, status),
    queryFn: () => fetchMyOrders(page, status),
    // Trạng thái đơn có thể đổi do admin trong lúc khách rời tab → làm mới khi quay lại.
    refetchOnWindowFocus: true,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => fetchMyOrder(id),
    enabled: Boolean(id),
    // Khách đang theo dõi 1 đơn → cập nhật trạng thái khi quay lại tab.
    refetchOnWindowFocus: true,
    // ...và poll nền khi đơn chưa kết thúc. Dừng hẳn khi đơn vào trạng thái cuối.
    // refetchIntervalInBackground để mặc định (false) → tự tạm dừng khi tab ẩn.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && ORDER_TERMINAL_STATUSES.has(status)) return false;
      return ORDER_POLL_INTERVAL_MS;
    },
  });
}

// Khách tự huỷ đơn khi chưa thanh toán và hàng chưa rời kho (backend chốt điều kiện
// trong CustomerOrderCancelService). Cập nhật lại cache chi tiết + danh sách đơn.
export function useCancelOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cancelMyOrder(id),
    onSuccess: (order) => {
      qc.setQueryData(queryKeys.order(id), order);
      qc.invalidateQueries({ queryKey: ["customer", "orders"] });
    },
  });
}
