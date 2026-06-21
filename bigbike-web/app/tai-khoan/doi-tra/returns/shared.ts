import type { StatusTone } from "@/components/ui/StatusBadge";

export const RETURN_STATUS_KEYS = ["PENDING", "APPROVED", "REJECTED", "RECEIVED", "INSPECTING", "COMPLETED", "REFUNDED"] as const;
export const RETURN_REASON_KEYS = ["DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED", "CHANGED_MIND", "OTHER"] as const;
export type ReturnStatusKey = (typeof RETURN_STATUS_KEYS)[number];
export type ReturnReasonKey = (typeof RETURN_REASON_KEYS)[number];

export const RETURNABLE_STATUSES = ["COMPLETED"];
export const RETURNS_PAGE_SIZE = 10;

export function isReturnStatus(s: string): s is ReturnStatusKey {
  return (RETURN_STATUS_KEYS as readonly string[]).includes(s);
}

export function isReturnReason(s: string): s is ReturnReasonKey {
  return (RETURN_REASON_KEYS as readonly string[]).includes(s);
}

export function returnStatusTone(status: string): StatusTone {
  const map: Record<string, StatusTone> = {
    COMPLETED: "success",
    REFUNDED: "success",
    APPROVED: "warning",
    RECEIVED: "warning",
    INSPECTING: "warning",
    REJECTED: "danger",
  };
  return map[status] ?? "neutral";
}
