"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  return useQuery({
    queryKey: queryKeys.checkoutOptions(),
    queryFn: fetchCheckoutOptions,
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

export function useOrders(page = 1) {
  return useQuery({
    queryKey: queryKeys.orders(page),
    queryFn: () => fetchMyOrders(page),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => fetchMyOrder(id),
    enabled: Boolean(id),
  });
}
