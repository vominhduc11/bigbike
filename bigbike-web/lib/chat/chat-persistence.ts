import type {
  ChatAction,
  ChatClarification,
  ChatClarificationSelection,
  ChatProductCard,
  ChatHandoffStatus,
  ChatImage,
  ChatLeadOffer,
  ChatNextStep,
  ChatSalesStage,
} from "@/lib/api/client-api";

export const CHAT_STORAGE_KEY = "bb_ai_chat_session_v1";
// The authoritative 30-day memory is server-side. The browser keeps only a short
// display cache so a reopened tab is quick without turning UI text into a hidden profile.
export const CHAT_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

const CHAT_SNAPSHOT_VERSION = 3 as const;
const MAX_MESSAGES = 64;
const MAX_CONTENT_LENGTH = 4000;
const MAX_PRODUCT_FIELDS_LENGTH = 500;
const MAX_ACTIONS = 3;
const MAX_CLARIFICATION_OPTIONS = 12;

export type ChatPersistenceMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "STAFF" | "SYSTEM";
  content: string;
  sequenceNo?: number;
  staffDisplayName?: string;
  products?: ChatProductCard[];
  crossSellProducts?: ChatProductCard[];
  salesStage?: ChatSalesStage;
  nextStep?: ChatNextStep;
  handoff?: ChatHandoffStatus;
  leadOffer?: ChatLeadOffer;
  clarification?: ChatClarification;
  clarificationSelection?: ChatClarificationSelection;
  actions?: ChatAction[];
  noResults?: boolean;
  answerFormat?: "PLAIN_TEXT" | "MARKDOWN";
  resultKind?: string;
  requestId?: string;
  originInteractionId?: string;
  failed?: boolean;
  images?: ChatImage[];
};

export type ChatPersistenceSnapshot = {
  version: typeof CHAT_SNAPSHOT_VERSION;
  expiresAt: number;
  locale: "vi" | "en";
  conversationId: string;
  messages: ChatPersistenceMessage[];
  remainingTurns: number;
  serviceMode: "AI" | "CONTACT";
  leadPromptSequence: 0 | 1 | 2;
  leadPromptMessageId?: string;
  viewedLeadSequences: Array<1 | 2>;
  leadCaptured: boolean;
  leadDeclined: boolean;
  pendingRequestId?: string;
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
    return typeof value[field] === "number" && Number.isFinite(value[field])
      ? value[field]
      : undefined;
  };
  const readOptionalString = (field: string): string | null | undefined => {
    if (value[field] == null) return null;
    return boundedString(value[field], MAX_PRODUCT_FIELDS_LENGTH);
  };

  const imageUrl = readOptionalString("imageUrl");
  const currency = readOptionalString("currency");
  const stockState = readOptionalString("stockState");
  if (imageUrl === undefined || currency === undefined || stockState === undefined)
    return undefined;

  const retailPrice = readNumber("retailPrice");
  const salePrice = readNumber("salePrice");
  if (retailPrice === undefined || salePrice === undefined) return undefined;

  return { slug, name, imageUrl, retailPrice, salePrice, currency, stockState };
}

function readAction(value: unknown): ChatAction | undefined {
  if (!isRecord(value)) return undefined;
  const type = value.type;
  const allowed = new Set([
    "COMPARE_PRODUCTS",
    "CHECK_SIZE",
    "CHECK_STOCK",
    "CHANGE_BUDGET",
    "FIND_SIMILAR",
    "VIEW_POLICY",
    "FIND_PRODUCTS",
    "RELATED_ARTICLE_QUESTION",
    "CHANGE_NEEDS",
    "CONTACT_STAFF",
    "LOGIN",
    "ORDER_HISTORY",
    "ORDER_LOOKUP",
    "CALL_HOTLINE",
    "OPEN_ZALO",
    "OPEN_MESSENGER",
  ]);
  return typeof type === "string" && allowed.has(type)
    ? { type: type as ChatAction["type"] }
    : undefined;
}

function readImage(value: unknown): ChatImage | undefined {
  if (!isRecord(value)) return undefined;
  const id = boundedString(value.id, 120);
  const contentPath = boundedString(value.contentPath, 500);
  const mimeType = boundedString(value.mimeType, 80);
  const status = boundedString(value.status, 40);
  const createdAt = boundedString(value.createdAt, 80);
  if (
    !id ||
    !contentPath ||
    !mimeType ||
    !status ||
    !createdAt ||
    typeof value.width !== "number" ||
    !Number.isSafeInteger(value.width) ||
    value.width < 0 ||
    typeof value.height !== "number" ||
    !Number.isSafeInteger(value.height) ||
    value.height < 0 ||
    typeof value.sizeBytes !== "number" ||
    !Number.isSafeInteger(value.sizeBytes) ||
    value.sizeBytes < 0
  ) return undefined;
  return {
    id,
    contentPath,
    mimeType,
    width: value.width,
    height: value.height,
    sizeBytes: value.sizeBytes,
    status,
    createdAt,
  };
}

function readClarification(value: unknown): ChatClarification | undefined {
  if (!isRecord(value)) return undefined;
  const id = boundedString(value.id, 120);
  const criterion = boundedString(value.criterion, 40);
  const allowedCriteria = new Set([
    "GROUP",
    "USE_CASE",
    "PRICE",
    "TYPE",
    "SIZE",
    "COLOR",
    "MEASUREMENT",
    "REFERENCE",
    "INTERPRETATION",
  ]);
  if (
    !id ||
    !criterion ||
    !allowedCriteria.has(criterion) ||
    !Array.isArray(value.options) ||
    value.options.length === 0 ||
    value.options.length > MAX_CLARIFICATION_OPTIONS
  )
    return undefined;
  const seen = new Set<string>();
  const options = value.options.map((item) => {
    if (!isRecord(item)) return undefined;
    const optionId = boundedString(item.id, 80);
    const label = boundedString(item.label, 240);
    const count = item.count == null ? null : item.count;
    if (
      !optionId ||
      !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(optionId) ||
      seen.has(optionId) ||
      !label ||
      (count !== null &&
        (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)) ||
      (item.kind !== "FILTER" && item.kind !== "BYPASS")
    )
      return undefined;
    seen.add(optionId);
    return { id: optionId, label, count, kind: item.kind };
  });
  if (options.some((option) => !option)) return undefined;
  return {
    id,
    criterion: criterion as ChatClarification["criterion"],
    options: options as ChatClarification["options"],
  };
}

function readClarificationSelection(value: unknown): ChatClarificationSelection | undefined {
  if (!isRecord(value)) return undefined;
  const clarificationId = boundedString(value.clarificationId, 120);
  const optionId = boundedString(value.optionId, 80);
  if (!clarificationId || !optionId || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(optionId))
    return undefined;
  return { clarificationId, optionId };
}

function readMessage(value: unknown): ChatPersistenceMessage | undefined {
  if (!isRecord(value)) return undefined;
  const id = boundedString(value.id, 120);
  const content = boundedString(value.content, MAX_CONTENT_LENGTH);
  const role = value.role;
  if (!id || !content || !["USER", "ASSISTANT", "STAFF", "SYSTEM"].includes(String(role))) return undefined;

  const message: ChatPersistenceMessage = {
    id,
    role: role as ChatPersistenceMessage["role"],
    content,
  };
  if (value.sequenceNo != null) {
    if (typeof value.sequenceNo !== "number" || !Number.isSafeInteger(value.sequenceNo) || value.sequenceNo < 0) return undefined;
    message.sequenceNo = value.sequenceNo;
  }
  if (value.staffDisplayName != null) {
    const staffDisplayName = boundedString(value.staffDisplayName, 160);
    if (!staffDisplayName) return undefined;
    message.staffDisplayName = staffDisplayName;
  }
  if (value.products != null) {
    if (!Array.isArray(value.products) || value.products.length > 8) return undefined;
    const products = value.products.map(readProduct);
    if (products.some((product) => !product)) return undefined;
    message.products = products as ChatProductCard[];
  }
  if (value.crossSellProducts != null) {
    if (!Array.isArray(value.crossSellProducts) || value.crossSellProducts.length > 2) return undefined;
    const products = value.crossSellProducts.map(readProduct);
    if (products.some((product) => !product)) return undefined;
    message.crossSellProducts = products as ChatProductCard[];
  }
  if (["BROWSING", "CHOOSING", "DECIDING", "POST_PURCHASE"].includes(String(value.salesStage))) {
    message.salesStage = value.salesStage as ChatSalesStage;
  }
  if (isRecord(value.nextStep)) {
    const type = boundedString(value.nextStep.type, 48);
    const productSlug = value.nextStep.productSlug == null
      ? null : boundedString(value.nextStep.productSlug, 255);
    const clarificationId = value.nextStep.clarificationId == null
      ? null : boundedString(value.nextStep.clarificationId, 120);
    if (!type || productSlug === undefined || clarificationId === undefined) return undefined;
    message.nextStep = { type, productSlug, clarificationId };
  }
  if (isRecord(value.handoff)) {
    const id = boundedString(value.handoff.id, 120);
    const requestedAt = boundedString(value.handoff.requestedAt, 80);
    if (!id || !requestedAt || !["WAITING", "ACTIVE", "RETURNED_TO_AI", "CLOSED"].includes(String(value.handoff.status))) return undefined;
    message.handoff = { id, status: value.handoff.status as ChatHandoffStatus["status"], requestedAt };
  }
  if (isRecord(value.leadOffer)) {
    const presentation = boundedString(value.leadOffer.presentation, 500);
    const allowedReasons = new Set(["HOLD_STOCK", "RESTOCK_ALERT", "SIZE_ADVICE", "QUOTE", "STAFF_CONFIRMATION"]);
    if ((value.leadOffer.sequence !== 1 && value.leadOffer.sequence !== 2)
      || !allowedReasons.has(String(value.leadOffer.reason)) || !presentation) return undefined;
    message.leadOffer = {
      sequence: value.leadOffer.sequence,
      reason: value.leadOffer.reason as ChatLeadOffer["reason"],
      presentation,
    };
  }
  if (value.clarification != null) {
    const clarification = readClarification(value.clarification);
    if (!clarification) return undefined;
    message.clarification = clarification;
  }
  if (value.clarificationSelection != null) {
    const selection = readClarificationSelection(value.clarificationSelection);
    if (!selection) return undefined;
    message.clarificationSelection = selection;
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
  if (value.answerFormat != null) {
    if (value.answerFormat !== "PLAIN_TEXT" && value.answerFormat !== "MARKDOWN") return undefined;
    message.answerFormat = value.answerFormat;
  }
  if (value.resultKind != null) {
    const resultKind = boundedString(value.resultKind, 80);
    if (!resultKind) return undefined;
    message.resultKind = resultKind;
  }
  if (value.requestId != null) {
    const requestId = boundedString(value.requestId, 120);
    if (!requestId) return undefined;
    message.requestId = requestId;
  }
  if (value.originInteractionId != null) {
    const originInteractionId = boundedString(value.originInteractionId, 120);
    if (!originInteractionId) return undefined;
    message.originInteractionId = originInteractionId;
  }
  if (value.failed != null) {
    if (typeof value.failed !== "boolean") return undefined;
    message.failed = value.failed;
  }
  if (value.images != null) {
    if (!Array.isArray(value.images) || value.images.length > 1) return undefined;
    const images = value.images.map(readImage);
    if (images.some((image) => !image)) return undefined;
    message.images = images as ChatImage[];
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
    if (
      !isRecord(parsed) ||
      (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== CHAT_SNAPSHOT_VERSION) ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= now ||
      (parsed.locale !== "vi" && parsed.locale !== "en") ||
      typeof parsed.conversationId !== "string" ||
      parsed.conversationId.length === 0 ||
      parsed.conversationId.length > 120 ||
      !Array.isArray(parsed.messages) ||
      parsed.messages.length === 0 ||
      parsed.messages.length > MAX_MESSAGES ||
      typeof parsed.remainingTurns !== "number" ||
      !Number.isInteger(parsed.remainingTurns) ||
      parsed.remainingTurns < 0 ||
      parsed.remainingTurns > 100 ||
      (parsed.serviceMode !== "AI" && parsed.serviceMode !== "CONTACT") ||
      typeof parsed.leadCaptured !== "boolean" ||
      typeof parsed.leadDeclined !== "boolean"
    ) {
      removeSnapshot();
      return null;
    }
    const legacy = parsed.version === 1;
    if (legacy && typeof parsed.leadPrompt !== "boolean") {
      removeSnapshot();
      return null;
    }
    const leadPromptSequence = legacy
      ? parsed.leadPrompt === true
        ? 1
        : 0
      : parsed.leadPromptSequence;
    if (leadPromptSequence !== 0 && leadPromptSequence !== 1 && leadPromptSequence !== 2) {
      removeSnapshot();
      return null;
    }
    const leadPromptMessageId =
      parsed.leadPromptMessageId == null
        ? undefined
        : boundedString(parsed.leadPromptMessageId, 120);
    if (parsed.leadPromptMessageId != null && !leadPromptMessageId) {
      removeSnapshot();
      return null;
    }
    const rawViewedSequences = legacy ? [] : parsed.viewedLeadSequences;
    if (
      !Array.isArray(rawViewedSequences) ||
      rawViewedSequences.some((item) => item !== 1 && item !== 2)
    ) {
      removeSnapshot();
      return null;
    }
    const viewedLeadSequences = Array.from(new Set(rawViewedSequences)) as Array<1 | 2>;
    const pendingRequestId =
      parsed.pendingRequestId == null ? undefined : boundedString(parsed.pendingRequestId, 120);
    if (parsed.pendingRequestId != null && !pendingRequestId) {
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
      leadPromptSequence: parsed.leadCaptured || parsed.leadDeclined ? 0 : leadPromptSequence,
      leadPromptMessageId,
      viewedLeadSequences,
      leadCaptured: parsed.leadCaptured,
      leadDeclined: parsed.leadDeclined,
      pendingRequestId,
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
