import type { CustomerAddress, ShippingMethodOption } from "@/lib/contracts/commerce";

export function pickDefaultAddress(addresses: CustomerAddress[] | undefined): CustomerAddress | null {
  if (!addresses?.length) return null;
  return addresses.find((a) => a.isDefault) ?? addresses[0];
}

export function normalizeMethodCode(code: string | null | undefined) {
  return (code ?? "").trim().toUpperCase();
}

export function effectiveMethodCost(method: ShippingMethodOption | undefined, cartSubtotal: number) {
  if (!method) return 0;
  const threshold = method.freeShippingThreshold ?? null;
  return threshold !== null && threshold > 0 && cartSubtotal >= threshold ? 0 : method.cost;
}

export function isZoneMismatch(method: ShippingMethodOption, userRegion: "MB" | "MT" | "MN" | null) {
  return !!method.zoneRegionCode && !!userRegion && method.zoneRegionCode !== userRegion;
}
