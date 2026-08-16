import type { ChatAction, ChatProductCard } from "@/lib/api/client-api";

export const CHAT_STORAGE_KEY = "bb_ai_chat_session_v1";
export const CHAT_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

const CHAT_SNAPSHOT_VERSION = 1 as const;
const MAX_MESSAGES = 64;
const MAX_CONTENT_LENGTH = 4000;
const MAX_PRODUCT_FIELDS_LENGTH = 500;
const MAX_ACTIONS = 3;

export type ChatPersistenceMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  products?: ChatProductCard[];
  actions?: ChatAction[];
  noResults?: boolean;
};

export type ChatPersistenceSnapshot = {
  version: typeof CHAT_SNAPSHOT_VERSION;
  expiresAt: number;
  locale: "vi" | "en";
  conversationId: string;
  messages: ChatPersistenceMessage[];
  remainingTurns: number;
  serviceMode: "AI" | "CONTACT";
  leadPrompt: boolean;
  leadCaptured: boolean;
  leadDeclined: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return undefined;
  return value;
}

function readProduct(value: unknown): ChatProductCard | undefined {
  if (!isRecord(value)) return undefined;
  const slug = boundedString(value.slug, MAX_PRODUCT_FIELDS_LENGTH);
  const name = boundedString(value.name, MAX_PRODUCT_FIELDS_LENGTH);
  if (!slug || !name) return undefined;

  const readNumber = (field: string): number | null | undefined => {
    if (value[field] == null) return null;
    return typeof value[field] === "number" && Number.isFinite(value[field]) ? value[field] : undefined;
  };
  const readOptionalString = (field: string): string | null | undefined => {
    if (value[field] == null) return null;
    return boundedString(value[field], MAX_PRODUCT_FIELDS_LENGTH);
  };

  const imageUrl = readOptionalString("imageUrl");
  const currency = readOptionalString("currency");
  const stockState = readOptionalString("stockState");
  if (imageUrl === undefined || currency === undefined || stockState === undefined) return undefined;

  const retailPrice = readNumber("retailPrice");
  const salePrice = readNumber("salePrice");
  if (retailPrice === undefined || salePrice === undefined) return undefined;

  return { slug, name, imageUrl, retailPrice, salePrice, currency, stockState };
}

function readAction(value: unknown): ChatAction | undefined {
  if (!isRecord(value)) return undefined;
  const type = value.type;
  return type === "LOGIN" || type === "ORDER_HISTORY" || type === "ORDER_LOOKUP" ? { type } : undefined;
}

function readMessage(value: unknown): ChatPersistenceMessage | undefined {
  if (!isRecord(value)) return undefined;
  const id = boundedString(value.id, 120);
  const content = boundedString(value.content, MAX_CONTENT_LENGTH);
  const role = value.role;
  if (!id || !content || (role !== "USER" && role !== "ASSISTANT")) return undefined;

  const message: ChatPersistenceMessage = { id, role, content };
  if (value.products != null) {
    if (!Array.isArray(value.products) || value.products.length > 3) return undefined;
    const products = value.products.map(readProduct);
    if (products.some((product) => !product)) return undefined;
    message.products = products as ChatProductCard[];
  }
  if (value.actions != null) {
    if (!Array.isArray(value.actions) || value.actions.length > MAX_ACTIONS) return undefined;
    const actions = value.actions.map(readAction);
    if (actions.some((action) => !action)) return undefined;
    message.actions = actions as ChatAction[];
  }
  if (value.noResults != null) {
    if (typeof value.noResults !== "boolean") return undefined;
    message.noResults = value.noResults;
  }
  return message;
}

function removeSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    /* Storage can be unavailable in private or restricted browser contexts. */
  }
}

export function readChatSnapshot(now = Date.now()): ChatPersistenceSnapshot | null {
  if (typeof window === "undefined") return null;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)
      || parsed.version !== CHAT_SNAPSHOT_VERSION
      || typeof parsed.expiresAt !== "number"
      || !Number.isFinite(parsed.expiresAt)
      || parsed.expiresAt <= now
      || (parsed.locale !== "vi" && parsed.locale !== "en")
      || typeof parsed.conversationId !== "string"
      || parsed.conversationId.length === 0
      || parsed.conversationId.length > 120
      || !Array.isArray(parsed.messages)
      || parsed.messages.length === 0
      || parsed.messages.length > MAX_MESSAGES
      || typeof parsed.remainingTurns !== "number"
      || !Number.isInteger(parsed.remainingTurns)
      || parsed.remainingTurns < 0
      || parsed.remainingTurns > 100
      || (parsed.serviceMode !== "AI" && parsed.serviceMode !== "CONTACT")
      || typeof parsed.leadPrompt !== "boolean"
      || typeof parsed.leadCaptured !== "boolean"
      || typeof parsed.leadDeclined !== "boolean") {
      removeSnapshot();
      return null;
    }

    const messages = parsed.messages.map(readMessage);
    if (messages.some((message) => !message)) {
      removeSnapshot();
      return null;
    }

    return {
      version: CHAT_SNAPSHOT_VERSION,
      expiresAt: parsed.expiresAt,
      locale: parsed.locale,
      conversationId: parsed.conversationId,
      messages: messages as ChatPersistenceMessage[],
      remainingTurns: parsed.remainingTurns,
      serviceMode: parsed.remainingTurns === 0 ? "CONTACT" : parsed.serviceMode,
      leadPrompt: parsed.leadPrompt,
      leadCaptured: parsed.leadCaptured,
      leadDeclined: parsed.leadDeclined,
    };
  } catch {
    removeSnapshot();
    return null;
  }
}

export function writeChatSnapshot(snapshot: ChatPersistenceSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* Storage can be unavailable or full; the live chat remains usable. */
  }
}

export function clearChatSnapshot(): void {
  removeSnapshot();
}
