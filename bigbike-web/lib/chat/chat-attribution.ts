export const CHAT_ATTRIBUTION_STORAGE_KEY = "bb_chat_attribution_v1";

export type ChatAttributionProof = {
  productSlug: string;
  token: string;
  expiresAt: number;
};

const MAX_PROOFS = 20;

function validProof(value: unknown): value is ChatAttributionProof {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productSlug === "string" &&
    item.productSlug.length > 0 &&
    item.productSlug.length <= 255 &&
    typeof item.token === "string" &&
    item.token.length > 0 &&
    item.token.length <= 2048 &&
    typeof item.expiresAt === "number" &&
    Number.isFinite(item.expiresAt)
  );
}

function readAll(): ChatAttributionProof[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CHAT_ATTRIBUTION_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validProof).filter((item) => item.expiresAt > Date.now()).slice(0, MAX_PROOFS);
  } catch {
    return [];
  }
}

function writeAll(items: ChatAttributionProof[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_ATTRIBUTION_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_PROOFS)));
  } catch {
    // Attribution must never block browsing or cart actions when storage is unavailable.
  }
}

export function saveChatAttributionProof(proof: ChatAttributionProof): void {
  if (!validProof(proof) || proof.expiresAt <= Date.now()) return;
  const remaining = readAll().filter((item) => item.productSlug !== proof.productSlug);
  writeAll([proof, ...remaining]);
}

export function readChatAttributionProof(productSlug: string): ChatAttributionProof | null {
  const items = readAll();
  writeAll(items);
  return items.find((item) => item.productSlug === productSlug) ?? null;
}

