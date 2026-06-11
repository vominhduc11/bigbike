"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  addCartItem,
  applyCoupon,
  clearCart,
  createAddress,
  deleteAddress,
  fetchCart,
  fetchCheckoutOptions,
  fetchMe,
  fetchMyAddresses,
  fetchMyOrder,
  fetchMyOrders,
  fetchPublicSettings,
  fetchWishlistProducts,
  removeCartItem,
  removeCoupon,
  updateAddress,
  updateCartItem,
  updateCustomerProfile,
} from "@/lib/api/client-api";
import type { SaveAddressPayload, UpdateCustomerProfilePayload } from "@/lib/contracts/commerce";
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

export function useAddCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      quantity,
      variantId,
    }: {
      productId: string;
      quantity: number;
      variantId?: string;
    }) => addCartItem(productId, quantity, variantId),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart(), cart),
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

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearCart,
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart(), cart),
  });
}

export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => applyCoupon(code),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart(), cart),
  });
}

export function useRemoveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => removeCoupon(code),
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

export function usePublicSettings() {
  return useQuery({
    queryKey: queryKeys.publicSettings(),
    queryFn: fetchPublicSettings,
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

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCustomerProfilePayload) => updateCustomerProfile(payload),
    onSuccess: (profile) => qc.setQueryData(queryKeys.profile(), profile),
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: queryKeys.addresses(),
    queryFn: fetchMyAddresses,
    retry: false,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveAddressPayload) => createAddress(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.addresses() }),
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SaveAddressPayload }) =>
      updateAddress(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.addresses() }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.addresses() }),
  });
}

// ── Orders ──────────────────────────────────────────────────────────────────

// Trạng thái đơn không còn đổi nữa → ngừng polling để khỏi gọi API vô ích.
const ORDER_TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "REFUNDED", "FAILED"]);
// Khách theo dõi đơn đang chạy → làm mới trạng thái mỗi 15s (admin đổi trạng thái
// theo nhịp thao tác tay nên 15s là đủ; cần dưới-giây thật thì chuyển sang SSE).
const ORDER_POLL_INTERVAL_MS = 15_000;

export function useOrders(page = 1) {
  return useQuery({
    queryKey: queryKeys.orders(page),
    queryFn: () => fetchMyOrders(page),
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

// ── Wishlist ─────────────────────────────────────────────────────────────────

export function useWishlistProducts(page = 1) {
  return useQuery({
    queryKey: queryKeys.wishlistProducts(page),
    queryFn: () => fetchWishlistProducts(page),
    retry: false,
    // Wishlist có thể đổi từ thiết bị khác → đồng bộ khi quay lại tab.
    refetchOnWindowFocus: true,
  });
}
