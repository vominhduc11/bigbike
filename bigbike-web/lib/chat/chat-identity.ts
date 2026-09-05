// CHAT_RULE_049 (owner decision 2026-09-05): the assistant only remembers inside the browser
// session. The visitor identifier still exists — it is the key that proves a conversation and its
// images belong to this guest — but it lives in sessionStorage, is created only when the customer
// actually opens the chat panel, and disappears when the browser is closed.
const VISITOR_ID_KEY = "bb_chat_visitor_id_v1";
const VISITOR_TOKEN_KEY = "bb_chat_visitor_token_v1";
/** Written by earlier builds that offered a memory switch; cleared so nothing survives an upgrade. */
const LEGACY_MEMORY_ENABLED_KEY = "bb_chat_memory_enabled_v1";

export type ChatIdentity = {
  visitorId: string;
  visitorToken?: string;
};

function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

/** Removes anything a previous long-term-memory build left on this device. */
function dropLegacyLongTermMemory(): void {
  try {
    window.localStorage.removeItem(VISITOR_ID_KEY);
    window.localStorage.removeItem(VISITOR_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_MEMORY_ENABLED_KEY);
  } catch {
    // Private windows and blocked site data are expected; there is simply nothing to clean up.
  }
}

export function readOrCreateChatIdentity(): ChatIdentity {
  dropLegacyLongTermMemory();
  const existing = window.sessionStorage.getItem(VISITOR_ID_KEY)?.trim();
  const visitorId = existing || newUuid();
  if (!existing) window.sessionStorage.setItem(VISITOR_ID_KEY, visitorId);
  return {
    visitorId,
    visitorToken: window.sessionStorage.getItem(VISITOR_TOKEN_KEY)?.trim() || undefined,
  };
}

export function saveChatIdentityToken(token: string): void {
  if (token.trim()) window.sessionStorage.setItem(VISITOR_TOKEN_KEY, token.trim());
}

export function clearChatIdentity(): void {
  dropLegacyLongTermMemory();
  window.sessionStorage.removeItem(VISITOR_ID_KEY);
  window.sessionStorage.removeItem(VISITOR_TOKEN_KEY);
}
