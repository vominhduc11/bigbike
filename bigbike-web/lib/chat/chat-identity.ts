const VISITOR_ID_KEY = "bb_chat_visitor_id_v1";
const VISITOR_TOKEN_KEY = "bb_chat_visitor_token_v1";
const MEMORY_ENABLED_KEY = "bb_chat_memory_enabled_v1";

export type ChatIdentity = {
  visitorId: string;
  visitorToken?: string;
  memoryEnabled: boolean;
};

function identityStorage(memoryEnabled: boolean): Storage {
  return memoryEnabled ? window.localStorage : window.sessionStorage;
}

function otherIdentityStorage(memoryEnabled: boolean): Storage {
  return memoryEnabled ? window.sessionStorage : window.localStorage;
}

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

export function readOrCreateChatIdentity(): ChatIdentity {
  const memoryEnabled = window.localStorage.getItem(MEMORY_ENABLED_KEY) !== "false";
  const storage = identityStorage(memoryEnabled);
  const existing = storage.getItem(VISITOR_ID_KEY)?.trim();
  const visitorId = existing || newUuid();
  if (!existing) storage.setItem(VISITOR_ID_KEY, visitorId);
  return {
    visitorId,
    visitorToken: storage.getItem(VISITOR_TOKEN_KEY)?.trim() || undefined,
    memoryEnabled,
  };
}

export function saveChatIdentityToken(token: string): void {
  const memoryEnabled = window.localStorage.getItem(MEMORY_ENABLED_KEY) !== "false";
  if (token.trim()) identityStorage(memoryEnabled).setItem(VISITOR_TOKEN_KEY, token.trim());
}

export function setChatMemoryPreference(enabled: boolean): void {
  const source = otherIdentityStorage(enabled);
  const target = identityStorage(enabled);
  const visitorId = source.getItem(VISITOR_ID_KEY);
  const visitorToken = source.getItem(VISITOR_TOKEN_KEY);
  if (visitorId) target.setItem(VISITOR_ID_KEY, visitorId);
  if (visitorToken) target.setItem(VISITOR_TOKEN_KEY, visitorToken);
  source.removeItem(VISITOR_ID_KEY);
  source.removeItem(VISITOR_TOKEN_KEY);
  window.localStorage.setItem(MEMORY_ENABLED_KEY, enabled ? "true" : "false");
}

export function clearChatIdentity(): void {
  window.localStorage.removeItem(VISITOR_ID_KEY);
  window.localStorage.removeItem(VISITOR_TOKEN_KEY);
  window.localStorage.removeItem(MEMORY_ENABLED_KEY);
  window.sessionStorage.removeItem(VISITOR_ID_KEY);
  window.sessionStorage.removeItem(VISITOR_TOKEN_KEY);
}
