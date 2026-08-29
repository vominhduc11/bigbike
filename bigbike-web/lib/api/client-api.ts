import type {
  Cart,
  CheckoutPayload,
  CustomerAddress,
  CustomerAuthData,
  CustomerProfile,
  OrderDetail,
  OrderListItem,
  OrderSummary,
  SaveAddressPayload,
  UpdateCustomerProfilePayload,
} from "@/lib/contracts/commerce";
import type {
  Article,
  Brand,
  CatalogFacets,
  Category,
  Product,
  PublicMenu,
} from "@/lib/contracts/public";
import { withFlatHighlights } from "@/lib/contracts/public";
import { env } from "@/env";

const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

function invalidPayloadMessage(): string {
  if (typeof window !== "undefined" && /^\/en(?:\/|$)/.test(window.location.pathname)) {
    return "The server did not return valid data.";
  }
  return "Máy chủ không trả về dữ liệu hợp lệ.";
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiClientError";
  }
}

type ApiErrorPayload = {
  code?: string;
  fieldErrors?: Record<string, string>;
  details?: Array<{ field?: string | null; code?: string; message?: string }>;
};

function toApiClientError(status: number, payload: unknown): ApiClientError {
  const apiError = (payload as { error?: ApiErrorPayload } | null)?.error;
  const detailCode = apiError?.details?.find((detail) => detail.code)?.code;
  const detailFields = apiError?.details?.reduce<Record<string, string>>((result, detail) => {
    if (detail.field && detail.message) result[detail.field] = detail.message;
    return result;
  }, {});
  return new ApiClientError(
    status,
    apiError?.code === "VALIDATION_ERROR" && detailCode ? detailCode : apiError?.code,
    apiError?.fieldErrors ??
      (detailFields && Object.keys(detailFields).length > 0 ? detailFields : undefined),
  );
}

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function clientRequest<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiClientError(res.status, payload);
  }
  if (payload === null) throw new Error(invalidPayloadMessage());
  return (payload as { data: T }).data ?? (payload as T);
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["data", "content", "items", "results"]) {
      const direct = record[key];
      if (Array.isArray(direct)) {
        return direct as T[];
      }
      if (direct && typeof direct === "object") {
        const nested = direct as Record<string, unknown>;
        for (const nestedKey of ["data", "content", "items", "results"]) {
          if (Array.isArray(nested[nestedKey])) {
            return nested[nestedKey] as T[];
          }
        }
      }
    }
  }

  return [];
}

function payloadData(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as Record<string, unknown>).data;
  }
  return payload;
}

function payloadPagination<T>(payload: unknown): T | null {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.pagination) {
      return record.pagination as T;
    }
    if (record.data && typeof record.data === "object" && "pagination" in record.data) {
      return (record.data as Record<string, unknown>).pagination as T;
    }
  }
  return null;
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export type ChatContact = {
  hotline?: string | null;
  zaloUrl?: string | null;
  messengerUrl?: string | null;
  zaloDisplay?: string | null;
  messengerDisplay?: string | null;
};

export type ChatImage = {
  id: string;
  contentPath: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  status: string;
  createdAt: string;
};

export type ChatAvailability = {
  mode: "AI" | "CONTACT";
  reason?: string | null;
  greeting?: string | null;
  quickPrompts: string[];
  maxTurns: number;
  contacts: ChatContact;
  images: {
    enabled: boolean;
    maxBytes: number;
    maxPerTurn: number;
    maxPerConversation: number;
    dailyLimit: number;
    disclosure: string;
  };
};

export type ChatActionType =
  | "COMPARE_PRODUCTS"
  | "CHECK_SIZE"
  | "CHECK_STOCK"
  | "CHANGE_BUDGET"
  | "FIND_SIMILAR"
  | "VIEW_POLICY"
  | "FIND_PRODUCTS"
  | "RELATED_ARTICLE_QUESTION"
  | "CHANGE_NEEDS"
  | "CONTACT_STAFF"
  | "LOGIN"
  | "ORDER_HISTORY"
  | "ORDER_LOOKUP"
  | "CALL_HOTLINE"
  | "OPEN_ZALO"
  | "OPEN_MESSENGER";

export type ChatAction = {
  type: ChatActionType;
};

export type ChatProductCard = {
  slug: string;
  name: string;
  imageUrl?: string | null;
  retailPrice?: number | null;
  salePrice?: number | null;
  currency?: string | null;
  stockState?: string | null;
};

export type ChatSalesStage = "BROWSING" | "CHOOSING" | "DECIDING" | "POST_PURCHASE";

export type ChatNextStep = {
  type: string;
  productSlug?: string | null;
  clarificationId?: string | null;
};

export type ChatHandoffStatus = {
  id: string;
  status: "WAITING" | "ACTIVE" | "RETURNED_TO_AI" | "CLOSED";
  requestedAt: string;
  channelState?: string | null;
  assignedDisplayName?: string | null;
  withinBusinessHours?: boolean;
  nextOpenAt?: string | null;
  businessHoursText?: string | null;
};

export type ChatChannelState =
  "AI_ACTIVE" | "WAITING_FOR_STAFF" | "STAFF_ACTIVE" | "AI_RESUMED" | "CLOSED";

export type ChatContinuation = {
  available: boolean;
  threadId?: string | null;
  successorConversationId?: string | null;
  message?: string | null;
};

export type ChatClarificationCriterion =
  | "GROUP"
  | "USE_CASE"
  | "PRICE"
  | "TYPE"
  | "SIZE"
  | "COLOR"
  | "MEASUREMENT"
  | "REFERENCE"
  | "INTERPRETATION";

export type ChatClarificationOption = {
  id: string;
  label: string;
  count: number | null;
  kind: "FILTER" | "BYPASS";
};

export type ChatClarification = {
  id: string;
  criterion: ChatClarificationCriterion;
  options: ChatClarificationOption[];
};

export type ChatClarificationSelection = {
  clarificationId: string;
  optionId: string;
};

export type ChatMessageResult = {
  conversationId?: string | null;
  assistantMessageId?: string | null;
  mode: "AI" | "CONTACT";
  reason?: string | null;
  answer?: string | null;
  turnCount: number;
  maxTurns: number;
  remainingTurns: number;
  products: ChatProductCard[];
  crossSellProducts: ChatProductCard[];
  salesStage: ChatSalesStage;
  nextStep?: ChatNextStep | null;
  handoff?: ChatHandoffStatus | null;
  clarification?: ChatClarification | null;
  handoffRecommended: boolean;
  actions: ChatAction[];
  contacts: ChatContact;
  answerFormat: "PLAIN_TEXT" | "MARKDOWN";
  resultKind: string;
  channelState: ChatChannelState;
  countedTurns: number;
  turnLimit: number;
  turnsRemaining: number;
  continuation?: ChatContinuation | null;
};

export type ChatProgressCode = "UNDERSTANDING" | "CHECKING_PRODUCTS" | "FINALIZING";

const CHAT_ACTION_TYPES = new Set<ChatActionType>([
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
const CHAT_CLARIFICATION_CRITERIA = new Set<ChatClarificationCriterion>([
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
const CHAT_OPTION_ID = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const CHAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHAT_FORBIDDEN_TEXT =
  /(?:\b(?:api|endpoint|database|session|quota|gemini|json|tool|sql|function\s*call|functioncall|stack\s*trace|exception|error(?:\s*(?:code|id|message))?)\b|\berror\s*[:#])/i;
const CHAT_RAW_CODES =
  /\b(?:CANCELLED|COMPLETED|PENDING|PROCESSING|IN_STOCK|OUT_OF_STOCK|AI_UNAVAILABLE|CONTACT_FALLBACK|NO_MATCH_IN_REQUESTED_PRICE_RANGE|SEARCH_WAS_BROADENED)\b/;
const CHAT_RAW_CURRENCY =
  /(?:\b\d[\d.,]*\s*(?:VND|VNĐ)\b|\b(?:VND|VNĐ)\b|\b\d[\d.,]*[.,]\d{1,2}\s*₫)/i;
const CHAT_URL = /(?:https?:\/\/|www\.|\/(?:product|san-pham)\/)/i;
const CHAT_UNSAFE_RICH_CONTENT = /(?:<\/?[a-z][^>]*>|`|!?\[[^\]]*\]\([^)]*\))/i;
const CHAT_VIETNAMESE_TEXT = /[à-ỹÀ-ỸđĐ]/;

function isSafeChatDisplayText(value: unknown, lang: "vi" | "en"): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const text = value.trim();
  if (
    CHAT_FORBIDDEN_TEXT.test(text) ||
    CHAT_RAW_CODES.test(text) ||
    CHAT_RAW_CURRENCY.test(text) ||
    CHAT_URL.test(text) ||
    CHAT_UNSAFE_RICH_CONTENT.test(text)
  )
    return false;
  return lang !== "en" || !CHAT_VIETNAMESE_TEXT.test(text);
}

function normalizeChatContacts(value: unknown): ChatContact {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const text = (key: string) =>
    typeof source[key] === "string" ? (source[key] as string) : undefined;
  return {
    hotline: text("hotline"),
    zaloUrl: text("zaloUrl"),
    messengerUrl: text("messengerUrl"),
    zaloDisplay: text("zaloDisplay"),
    messengerDisplay: text("messengerDisplay"),
  };
}

function normalizeChatActions(value: unknown): ChatAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      item && typeof item === "object" ? (item as Record<string, unknown>).type : null,
    )
    .filter(
      (type): type is ChatActionType =>
        typeof type === "string" && CHAT_ACTION_TYPES.has(type as ChatActionType),
    )
    .map((type) => ({ type }))
    .slice(0, 3);
}

function normalizeChatProducts(value: unknown): { products: ChatProductCard[]; unsafe: boolean } {
  if (value == null) return { products: [], unsafe: false };
  if (!Array.isArray(value)) return { products: [], unsafe: true };

  const asNumber = (raw: unknown): number | null => {
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const products: ChatProductCard[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const retailPrice = asNumber(source.retailPrice);
    const saleProvided =
      source.salePrice !== null && source.salePrice !== undefined && source.salePrice !== "";
    const salePrice = saleProvided ? asNumber(source.salePrice) : null;
    const slug = typeof source.slug === "string" ? source.slug.trim() : "";
    const name = typeof source.name === "string" ? source.name.trim() : "";
    const valid =
      slug.length > 0 &&
      name.length > 0 &&
      retailPrice !== null &&
      retailPrice > 0 &&
      source.currency === "VND" &&
      source.stockState === "IN_STOCK" &&
      (!saleProvided || (salePrice !== null && salePrice > 0 && salePrice < retailPrice));
    if (!valid) continue;
    products.push({
      slug,
      name,
      imageUrl: typeof source.imageUrl === "string" ? source.imageUrl : null,
      retailPrice,
      salePrice,
      currency: "VND",
      stockState: "IN_STOCK",
    });
  }
  return { products: products.slice(0, 8), unsafe: false };
}

function normalizeChatClarification(
  value: unknown,
  lang: "vi" | "en",
): { clarification: ChatClarification | null; unsafe: boolean } {
  if (value == null) return { clarification: null, unsafe: false };
  if (!value || typeof value !== "object") return { clarification: null, unsafe: true };
  const source = value as Record<string, unknown>;
  if (
    typeof source.id !== "string" ||
    !CHAT_UUID.test(source.id) ||
    typeof source.criterion !== "string" ||
    !CHAT_CLARIFICATION_CRITERIA.has(source.criterion as ChatClarificationCriterion) ||
    !Array.isArray(source.options) ||
    source.options.length === 0 ||
    source.options.length > 12
  ) {
    return { clarification: null, unsafe: true };
  }
  const options: ChatClarificationOption[] = [];
  const ids = new Set<string>();
  for (const item of source.options) {
    if (!item || typeof item !== "object") return { clarification: null, unsafe: true };
    const option = item as Record<string, unknown>;
    const count = option.count == null ? null : option.count;
    if (
      typeof option.id !== "string" ||
      option.id.length > 80 ||
      !CHAT_OPTION_ID.test(option.id) ||
      ids.has(option.id) ||
      !isSafeChatDisplayText(option.label, lang) ||
      (count !== null &&
        (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)) ||
      (option.kind !== "FILTER" && option.kind !== "BYPASS")
    ) {
      return { clarification: null, unsafe: true };
    }
    ids.add(option.id);
    options.push({
      id: option.id,
      label: option.label.trim(),
      count,
      kind: option.kind,
    });
  }
  return {
    clarification: {
      id: source.id,
      criterion: source.criterion as ChatClarificationCriterion,
      options,
    },
    unsafe: false,
  };
}

function normalizeChatMessageResult(value: unknown, lang: "vi" | "en"): ChatMessageResult {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const answer = typeof source.answer === "string" ? source.answer.trim() : "";
  const safeAnswer = Boolean(answer && isSafeChatDisplayText(answer, lang));
  const normalizedProducts = normalizeChatProducts(source.products);
  const normalizedCrossSell = normalizeChatProducts(source.crossSellProducts);
  const normalizedClarification = normalizeChatClarification(source.clarification, lang);
  const unsafe =
    Boolean(answer && !safeAnswer) ||
    normalizedProducts.unsafe ||
    normalizedCrossSell.unsafe ||
    normalizedClarification.unsafe;
  const stage: ChatSalesStage =
    source.salesStage === "CHOOSING" ||
    source.salesStage === "DECIDING" ||
    source.salesStage === "POST_PURCHASE"
      ? source.salesStage
      : "BROWSING";
  const nextStepSource =
    source.nextStep && typeof source.nextStep === "object"
      ? (source.nextStep as Record<string, unknown>)
      : null;
  const nextStep =
    nextStepSource && typeof nextStepSource.type === "string"
      ? {
          type: nextStepSource.type,
          productSlug:
            typeof nextStepSource.productSlug === "string" ? nextStepSource.productSlug : null,
          clarificationId:
            typeof nextStepSource.clarificationId === "string"
              ? nextStepSource.clarificationId
              : null,
        }
      : null;
  const handoffSource =
    source.handoff && typeof source.handoff === "object"
      ? (source.handoff as Record<string, unknown>)
      : null;
  const handoffStatuses = new Set(["WAITING", "ACTIVE", "RETURNED_TO_AI", "CLOSED"]);
  const handoff =
    handoffSource &&
    typeof handoffSource.id === "string" &&
    typeof handoffSource.status === "string" &&
    handoffStatuses.has(handoffSource.status) &&
    typeof handoffSource.requestedAt === "string"
      ? {
          id: handoffSource.id,
          status: handoffSource.status as ChatHandoffStatus["status"],
          requestedAt: handoffSource.requestedAt,
          channelState:
            typeof handoffSource.channelState === "string" ? handoffSource.channelState : null,
          assignedDisplayName:
            typeof handoffSource.assignedDisplayName === "string"
              ? handoffSource.assignedDisplayName
              : null,
          withinBusinessHours: handoffSource.withinBusinessHours === true,
          nextOpenAt:
            typeof handoffSource.nextOpenAt === "string" ? handoffSource.nextOpenAt : null,
          businessHoursText:
            typeof handoffSource.businessHoursText === "string"
              ? handoffSource.businessHoursText.trim()
              : null,
        }
      : null;
  const mode = source.mode === "AI" && safeAnswer && !unsafe ? "AI" : "CONTACT";
  const channelState = [
    "AI_ACTIVE",
    "WAITING_FOR_STAFF",
    "STAFF_ACTIVE",
    "AI_RESUMED",
    "CLOSED",
  ].includes(String(source.channelState))
    ? (source.channelState as ChatChannelState)
    : "AI_ACTIVE";
  return {
    conversationId: typeof source.conversationId === "string" ? source.conversationId : null,
    assistantMessageId:
      typeof source.assistantMessageId === "string" ? source.assistantMessageId : null,
    mode,
    reason: typeof source.reason === "string" ? source.reason : null,
    answer: unsafe ? null : answer || null,
    turnCount: typeof source.turnCount === "number" ? source.turnCount : 0,
    maxTurns: typeof source.maxTurns === "number" ? source.maxTurns : 12,
    remainingTurns: typeof source.remainingTurns === "number" ? source.remainingTurns : 0,
    products: unsafe ? [] : normalizedProducts.products,
    crossSellProducts: unsafe ? [] : normalizedCrossSell.products.slice(0, 2),
    salesStage: stage,
    nextStep: unsafe ? null : nextStep,
    handoff: unsafe ? null : handoff,
    clarification: unsafe ? null : normalizedClarification.clarification,
    handoffRecommended: mode === "CONTACT" || source.handoffRecommended === true,
    actions:
      unsafe || !answer || normalizedClarification.clarification
        ? []
        : normalizeChatActions(source.actions),
    contacts: normalizeChatContacts(source.contacts),
    answerFormat: source.answerFormat === "MARKDOWN" ? "MARKDOWN" : "PLAIN_TEXT",
    resultKind:
      typeof source.resultKind === "string" && source.resultKind.trim()
        ? source.resultKind.trim()
        : mode,
    channelState,
    countedTurns:
      typeof source.countedTurns === "number"
        ? source.countedTurns
        : typeof source.turnCount === "number"
          ? source.turnCount
          : 0,
    turnLimit:
      typeof source.turnLimit === "number"
        ? source.turnLimit
        : typeof source.maxTurns === "number"
          ? source.maxTurns
          : 40,
    turnsRemaining:
      typeof source.turnsRemaining === "number"
        ? source.turnsRemaining
        : typeof source.remainingTurns === "number"
          ? source.remainingTurns
          : 0,
    continuation:
      source.continuation && typeof source.continuation === "object"
        ? {
            available: (source.continuation as Record<string, unknown>).available === true,
            threadId:
              typeof (source.continuation as Record<string, unknown>).threadId === "string"
                ? ((source.continuation as Record<string, unknown>).threadId as string)
                : null,
            successorConversationId:
              typeof (source.continuation as Record<string, unknown>).successorConversationId ===
              "string"
                ? ((source.continuation as Record<string, unknown>)
                    .successorConversationId as string)
                : null,
            message:
              typeof (source.continuation as Record<string, unknown>).message === "string"
                ? ((source.continuation as Record<string, unknown>).message as string)
                : null,
          }
        : null,
  };
}

export function fetchChatAvailability(lang: "vi" | "en"): Promise<ChatAvailability> {
  return clientRequest<ChatAvailability>("GET", `/api/v1/chat/availability?lang=${lang}`).then(
    (value) => {
      const source = value && typeof value === "object" ? value : ({} as ChatAvailability);
      const quickPrompts = Array.isArray(source.quickPrompts)
        ? source.quickPrompts
            .filter((prompt): prompt is string => isSafeChatDisplayText(prompt, lang))
            .slice(0, 4)
        : [];
      return {
        ...source,
        mode: source.mode === "AI" ? "AI" : "CONTACT",
        greeting: isSafeChatDisplayText(source.greeting, lang) ? source.greeting : null,
        quickPrompts,
        maxTurns: Number.isFinite(source.maxTurns) ? source.maxTurns : 16,
        contacts: normalizeChatContacts(source.contacts),
        images: {
          enabled: source.images?.enabled === true,
          maxBytes: Number.isFinite(source.images?.maxBytes)
            ? source.images.maxBytes
            : 8 * 1024 * 1024,
          maxPerTurn: Number.isFinite(source.images?.maxPerTurn) ? source.images.maxPerTurn : 1,
          maxPerConversation: Number.isFinite(source.images?.maxPerConversation)
            ? source.images.maxPerConversation
            : 5,
          dailyLimit: Number.isFinite(source.images?.dailyLimit) ? source.images.dailyLimit : 0,
          disclosure: isSafeChatDisplayText(source.images?.disclosure, lang)
            ? source.images.disclosure
            : "",
        },
      };
    },
  );
}

export function sendChatMessage(
  message: string,
  lang: "vi" | "en",
  conversationId?: string,
  signal?: AbortSignal,
  requestId?: string,
  pageContext?: { type: "PRODUCT"; productSlug: string } | null,
  clarificationSelection?: ChatClarificationSelection,
  visitorToken?: string,
  imageIds?: string[],
): Promise<ChatMessageResult> {
  return clientRequest<unknown>(
    "POST",
    "/api/v1/chat/messages",
    {
      conversationId: conversationId || null,
      message,
      lang,
      requestId: requestId || null,
      pageContext: pageContext ?? null,
      clarificationSelection: clarificationSelection ?? null,
      visitorToken: visitorToken || null,
      imageIds: imageIds?.slice(0, 1) ?? [],
    },
    undefined,
    signal,
  ).then((value) => normalizeChatMessageResult(value, lang));
}

function parseSseEvent(block: string): { event: string; data: string } | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return data.length > 0 ? { event, data: data.join("\n") } : null;
}

/**
 * Reads only the server's fixed progress codes. The completed, moderated answer
 * is returned as one object; partial model output is never exposed to the UI.
 */
export async function streamChatMessage(
  message: string,
  lang: "vi" | "en",
  conversationId: string | undefined,
  requestId: string,
  onProgress: (code: ChatProgressCode) => void,
  signal?: AbortSignal,
  pageContext?: { type: "PRODUCT"; productSlug: string } | null,
  clarificationSelection?: ChatClarificationSelection,
  visitorToken?: string,
  imageIds?: string[],
): Promise<ChatMessageResult> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;

  const response = await fetch(`${API_BASE_URL}/api/v1/chat/messages/stream`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      conversationId: conversationId || null,
      message,
      lang,
      requestId,
      pageContext: pageContext ?? null,
      clarificationSelection: clarificationSelection ?? null,
      visitorToken: visitorToken || null,
      imageIds: imageIds?.slice(0, 1) ?? [],
    }),
    signal,
  });
  if (!response.ok || !response.body) throw new ApiClientError(response.status);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatMessageResult | null = null;

  const consume = (block: string) => {
    const parsed = parseSseEvent(block);
    if (!parsed) return;
    const value: unknown = JSON.parse(parsed.data);
    if (parsed.event === "progress") {
      const code = value && typeof value === "object" ? (value as { code?: unknown }).code : null;
      if (code === "UNDERSTANDING" || code === "CHECKING_PRODUCTS" || code === "FINALIZING") {
        onProgress(code);
      }
    } else if (parsed.event === "result") {
      result = normalizeChatMessageResult(value, lang);
    } else if (parsed.event === "error") {
      throw new Error("CHAT_UNAVAILABLE");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      consume(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
  if (!result) throw new Error(invalidPayloadMessage());
  return result;
}

export function requestChatHandoff(input: {
  requestId: string;
  conversationId?: string;
  locale: "vi" | "en";
  visitorToken?: string;
}): Promise<{
  conversationId: string;
  handoffId: string;
  status: "WAITING" | "ACTIVE";
  requestedAt: string;
  channelState: ChatChannelState;
  withinBusinessHours: boolean;
  nextOpenAt?: string | null;
  businessHoursText?: string | null;
}> {
  return clientRequest("POST", "/api/v1/chat/handoffs", {
    requestId: input.requestId,
    conversationId: input.conversationId ?? null,
    locale: input.locale,
    trigger: "BUTTON",
    visitorToken: input.visitorToken || null,
  });
}

export type ChatSession = {
  visitorToken: string;
  rememberedThrough: string;
  memoryEnabled: boolean;
  activeConversationId?: string | null;
  rememberedContextSummary?: string | null;
};

export type ChatHistoryMessage = {
  id: string;
  sequenceNo: number;
  role: "CUSTOMER" | "ASSISTANT" | "STAFF" | "SYSTEM";
  content: string;
  source?: string | null;
  answerFormat?: "PLAIN_TEXT" | "MARKDOWN" | null;
  resultKind?: string | null;
  staffDisplayName?: string | null;
  createdAt: string;
  images: ChatImage[];
};

export type ChatHistory = {
  conversationId: string;
  threadId: string;
  channelState: ChatChannelState;
  latestSequence: number;
  messages: ChatHistoryMessage[];
  handoff?: ChatHandoffStatus | null;
};

export function openChatSession(input: {
  visitorId: string;
  visitorToken?: string;
  locale: "vi" | "en";
  memoryEnabled: boolean;
}): Promise<ChatSession> {
  return clientRequest("POST", "/api/v1/chat/sessions", {
    visitorId: input.visitorId,
    visitorToken: input.visitorToken || null,
    locale: input.locale,
    memoryEnabled: input.memoryEnabled,
  });
}

export function fetchChatHistory(
  conversationId: string,
  visitorToken?: string,
  afterSequence = 0,
): Promise<ChatHistory> {
  return clientRequest(
    "GET",
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages?afterSequence=${Math.max(0, afterSequence)}`,
    undefined,
    visitorToken ? { "X-Chat-Visitor-Token": visitorToken } : undefined,
  );
}

export async function uploadChatImage(input: {
  file: File;
  requestId: string;
  conversationId?: string;
  lang: "vi" | "en";
  visitorToken?: string;
}): Promise<{ conversationId: string; image: ChatImage }> {
  const params = new URLSearchParams({ requestId: input.requestId, lang: input.lang });
  if (input.conversationId) params.set("conversationId", input.conversationId);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (input.visitorToken) headers["X-Chat-Visitor-Token"] = input.visitorToken;
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const form = new FormData();
  form.append("file", input.file);

  const response = await fetch(`${API_BASE_URL}/api/v1/chat/images?${params.toString()}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw toApiClientError(response.status, payload);
  }
  const data = payloadData(payload) as { conversationId?: unknown; image?: unknown } | null;
  if (
    !data ||
    typeof data.conversationId !== "string" ||
    !data.image ||
    typeof data.image !== "object"
  ) {
    throw new Error(invalidPayloadMessage());
  }
  const image = data.image as Record<string, unknown>;
  if (typeof image.id !== "string" || typeof image.contentPath !== "string") {
    throw new Error(invalidPayloadMessage());
  }
  return {
    conversationId: data.conversationId,
    image: {
      id: image.id,
      contentPath: image.contentPath,
      mimeType: typeof image.mimeType === "string" ? image.mimeType : input.file.type,
      width: typeof image.width === "number" ? image.width : 0,
      height: typeof image.height === "number" ? image.height : 0,
      sizeBytes: typeof image.sizeBytes === "number" ? image.sizeBytes : input.file.size,
      status: typeof image.status === "string" ? image.status : "STORED",
      createdAt: typeof image.createdAt === "string" ? image.createdAt : new Date().toISOString(),
    },
  };
}

export async function fetchChatImageBlob(imageId: string, visitorToken?: string): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/chat/images/${encodeURIComponent(imageId)}/content`,
    {
      credentials: "include",
      headers: visitorToken ? { "X-Chat-Visitor-Token": visitorToken } : undefined,
      cache: "no-store",
    },
  );
  if (!response.ok) throw new ApiClientError(response.status);
  return response.blob();
}

export function deleteChatHistory(visitorToken?: string): Promise<{ deleted: boolean }> {
  return clientRequest(
    "DELETE",
    "/api/v1/chat/history",
    undefined,
    visitorToken ? { "X-Chat-Visitor-Token": visitorToken } : undefined,
  );
}

export function createChatRealtimeToken(
  conversationId: string,
  visitorToken?: string,
): Promise<{ token: string; expiresAt: string }> {
  return clientRequest("POST", "/api/v1/chat/realtime-token", {
    conversationId,
    visitorToken: visitorToken || null,
  });
}

export function fetchCart(): Promise<Cart> {
  return clientRequest("GET", "/api/v1/cart");
}

export function addCartItem(
  productId: string,
  quantity: number,
  variantId?: string,
): Promise<Cart> {
  return clientRequest("POST", "/api/v1/cart/items", {
    productId,
    quantity,
    productVariantId: variantId ?? null,
  });
}

export function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
  return clientRequest("PATCH", `/api/v1/cart/items/${itemId}`, { quantity });
}

export function removeCartItem(itemId: string): Promise<Cart> {
  return clientRequest("DELETE", `/api/v1/cart/items/${itemId}`);
}

export function clearCart(): Promise<Cart> {
  return clientRequest("DELETE", "/api/v1/cart/clear");
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export function submitCheckout(
  payload: CheckoutPayload,
  idempotencyKey?: string,
): Promise<OrderSummary> {
  const extra = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  return clientRequest("POST", "/api/v1/checkout", payload, extra);
}

export type PublicSetting = { settingKey: string; settingValue: string };

/**
 * List endpoint — parsed directly (not via `clientRequest`) so a `data: null`/missing
 * envelope field defaults to `[]` instead of falling back to the whole response object
 * (which would make callers' `.find()` throw on a non-array).
 */
export async function fetchPublicSettings(lang?: string): Promise<PublicSetting[]> {
  const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/public${qs}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return asArray<PublicSetting>(payloadData(payload));
}

export function fetchPublicMenu(location: string, lang?: string): Promise<PublicMenu> {
  const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  return clientRequest("GET", `/api/v1/menus/${location}${qs}`);
}

// ── Catalog ───────────────────────────────────────────────────────────────────

/** Append `?lang=` only when a non-empty language is supplied (vi is backend default). */
function withLang(path: string, lang?: string): string {
  return lang ? `${path}?lang=${encodeURIComponent(lang)}` : path;
}

/**
 * Client-side product detail fetch used by the content localizer to refetch
 * the full payload in English after a locale switch.
 */
export async function fetchPublicProduct(slug: string, lang?: string): Promise<Product> {
  const product = await clientRequest<Product>(
    "GET",
    withLang(`/api/v1/products/${encodeURIComponent(slug)}`, lang),
  );
  return withFlatHighlights(product);
}

/** Client-side detail fetches — used by the content localizer to swap detail-page
 *  data to EN after a locale switch, keeping the server render static `vi` (ISR). */
export function fetchPublicArticle(slug: string, lang?: string): Promise<Article> {
  return clientRequest("GET", withLang(`/api/v1/articles/${encodeURIComponent(slug)}`, lang));
}

export function fetchPublicBrand(slug: string, lang?: string): Promise<Brand> {
  return clientRequest("GET", withLang(`/api/v1/brands/${encodeURIComponent(slug)}`, lang));
}

export function fetchPublicCategory(slug: string, lang?: string): Promise<Category> {
  return clientRequest("GET", withLang(`/api/v1/categories/${encodeURIComponent(slug)}`, lang));
}

type PublicProductListQuery = {
  page?: number;
  size?: number;
  sort?: string;
  category?: string;
  brand?: string | string[];
  q?: string;
  filterColor?: string | string[];
  filterFinish?: string | string[];
  filterGender?: string;
  sizeFilter?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  homepageBlock?: "NONE" | "FEATURED_GRID";
  lang?: string;
};

export type PublicProductListResult = {
  data: Product[];
  pagination: { page: number; totalPages: number; totalItems?: number | null } | null;
};

/** Append a query param only when the value is meaningful (skips undefined/null/empty string). */
function appendParam(
  qs: URLSearchParams,
  key: string,
  value: string | string[] | number | boolean | undefined,
) {
  if (value !== undefined && value !== null && `${value}` !== "") qs.set(key, `${value}`);
}

/**
 * Client-side catalog list fetch — dùng cho lưới sản phẩm CSR ở các trang archive
 * (danh mục / tất cả sản phẩm / tìm kiếm). Trang chỉ render shell tĩnh (ISR), lưới
 * lọc/phân trang fetch ở client theo searchParams. Param names khớp backend như
 * `listProducts` của public-api (pwb-brand, filter_color, min_price, max_price).
 */
export async function fetchPublicProductList(
  query: PublicProductListQuery,
  signal?: AbortSignal,
): Promise<PublicProductListResult> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | string[] | number | boolean | undefined) => {
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item !== "") qs.append(k, item);
      });
    } else {
      appendParam(qs, k, v);
    }
  };
  put("page", query.page);
  put("size", query.size);
  put("sort", query.sort ?? "createdAt:desc");
  put("category", query.category);
  put("pwb-brand", query.brand);
  put("q", query.q);
  put("filter_color", query.filterColor);
  put("filter_finish", query.filterFinish);
  put("filter_gender", query.filterGender);
  put("kich-co", query.sizeFilter);
  put("min_price", query.minPrice);
  put("max_price", query.maxPrice);
  put("in_stock", query.inStock ? true : undefined);
  put("homepage_block", query.homepageBlock);
  put("lang", query.lang);

  const res = await fetch(`${API_BASE_URL}/api/v1/products?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    data: asArray<Product>(payloadData(payload)),
    pagination: payloadPagination<PublicProductListResult["pagination"]>(payload),
  };
}

export type PublicCatalogFacetsQuery = {
  category?: string;
  brand?: string | string[];
  q?: string;
  filterColor?: string | string[];
  filterFinish?: string | string[];
  filterGender?: string;
  sizeFilter?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  lang?: string;
};

/** Refetches facet counts for the current catalog context; price bounds are omitted so the axis stays stable. */
export async function fetchPublicCatalogFacets(
  query: PublicCatalogFacetsQuery,
  signal?: AbortSignal,
): Promise<{ data: CatalogFacets }> {
  const qs = new URLSearchParams();
  const put = (key: string, value: string | string[] | number | boolean | undefined) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) qs.append(key, item);
      });
    } else if (value !== undefined && value !== "") {
      qs.set(key, String(value));
    }
  };
  put("category", query.category);
  put("pwb-brand", query.brand);
  put("q", query.q);
  put("filter_color", query.filterColor);
  put("filter_finish", query.filterFinish);
  put("filter_gender", query.filterGender);
  put("kich-co", query.sizeFilter);
  put("min_price", query.minPrice);
  put("max_price", query.maxPrice);
  put("in_stock", query.inStock ? true : undefined);
  put("lang", query.lang);

  const payload = await clientRequest<unknown>(
    "GET",
    `/api/v1/catalog/facets?${qs.toString()}`,
    undefined,
    undefined,
    signal,
  );
  const data = payloadData(payload) as CatalogFacets;
  return { data };
}

type PublicArticleListQuery = {
  page?: number;
  size?: number;
  q?: string;
  lang?: string;
};

export type PublicArticleListResult = {
  data: Article[];
  pagination: { page: number; totalPages: number; totalItems?: number | null } | null;
};

/** Client-side article list fetch — lưới tin tức CSR (tìm/phân trang). */
export async function fetchPublicArticleList(
  query: PublicArticleListQuery,
): Promise<PublicArticleListResult> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | number | undefined) => appendParam(qs, k, v);
  put("page", query.page);
  put("size", query.size);
  put("sort", "publishedAt:desc");
  put("q", query.q);
  put("lang", query.lang);

  const res = await fetch(`${API_BASE_URL}/api/v1/articles?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    data: asArray<Article>(payloadData(payload)),
    pagination: payloadPagination<PublicArticleListResult["pagination"]>(payload),
  };
}

export type PublicBrandListResult = {
  data: Brand[];
  pagination: { page: number; totalPages: number; totalItems?: number | null } | null;
};

/** Client-side brand list fetch — lưới thương hiệu CSR (phân trang/sắp xếp). */
export async function fetchPublicBrandList(query: {
  page?: number;
  size?: number;
  sort?: string;
  showOnHomepage?: boolean;
  lang?: string;
}): Promise<PublicBrandListResult> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | number | undefined) => appendParam(qs, k, v);
  put("page", query.page);
  put("size", query.size);
  put("sort", query.sort ?? "name:asc");
  if (query.showOnHomepage) qs.set("showOnHomepage", "true");
  put("lang", query.lang);

  const res = await fetch(`${API_BASE_URL}/api/v1/brands?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    data: asArray<Brand>(payloadData(payload)),
    pagination: payloadPagination<PublicBrandListResult["pagination"]>(payload),
  };
}

/** Client-side category list fetch — dùng cho lưới danh mục trang chủ refetch theo lang. */
export async function fetchPublicCategoryList(query: {
  size?: number;
  sort?: string;
  showOnHomepage?: boolean;
  lang?: string;
}): Promise<Category[]> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | number | undefined) => appendParam(qs, k, v);
  put("size", query.size);
  put("sort", query.sort ?? "sortOrder:asc");
  if (query.showOnHomepage) qs.set("showOnHomepage", "true");
  put("lang", query.lang);

  const res = await fetch(`${API_BASE_URL}/api/v1/categories?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return asArray<Category>(payloadData(payload));
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function loginCustomer(
  login: string,
  password: string,
  remember = false,
): Promise<CustomerAuthData> {
  return clientRequest("POST", "/api/v1/customer/auth/login", { login, password, remember });
}

/**
 * Builds the social-login start URL. Returns an absolute backend URL — the browser
 * must leave the SPA so the OAuth provider can complete the redirect round-trip.
 */
export function oauthAuthorizeUrl(
  provider: "google" | "facebook",
  returnTo?: string,
  registrationConsent?: { privacyConsent: true; privacyPolicyLocale: "vi" | "en" },
): string {
  const base = `${API_BASE_URL}/api/v1/customer/auth/oauth/${provider}/authorize`;
  const params = new URLSearchParams();
  if (returnTo) params.set("tiep", returnTo);
  if (registrationConsent) {
    params.set("privacyConsent", "true");
    params.set("privacyPolicyLocale", registrationConsent.privacyPolicyLocale);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function registerCustomer(
  email: string,
  password: string,
  firstName: string,
  lastName?: string,
  phone?: string,
  privacyPolicyLocale: "vi" | "en" = "vi",
): Promise<CustomerAuthData> {
  return clientRequest("POST", "/api/v1/customer/auth/register", {
    email,
    password,
    phone,
    firstName,
    lastName,
    privacyConsent: true,
    privacyPolicyLocale,
  });
}

export function logoutCustomer(): Promise<void> {
  return clientRequest("POST", "/api/v1/customer/auth/logout");
}

export function resendEmailVerification(): Promise<{ sent: boolean }> {
  return clientRequest("POST", "/api/v1/customer/auth/resend-verification");
}

export function requestPasswordReset(login: string): Promise<void> {
  return clientRequest("POST", "/api/v1/customer/auth/password/forgot", { login }).then(
    () => undefined,
  );
}

export function resetCustomerPassword(token: string, password: string): Promise<void> {
  return clientRequest("POST", "/api/v1/customer/auth/password/reset", { token, password }).then(
    () => undefined,
  );
}

// ── Customer ──────────────────────────────────────────────────────────────────

export function fetchMe(): Promise<CustomerProfile> {
  return clientRequest("GET", "/api/v1/customer/me");
}

export function updateCustomerProfile(
  payload: UpdateCustomerProfilePayload,
): Promise<CustomerProfile> {
  return clientRequest("PATCH", "/api/v1/customer/me", payload);
}

// Avatar upload/remove bypass clientRequest (JSON-only) — multipart body for upload,
// no body for delete — but reuse the same CSRF/credentials/error-unwrap conventions.
async function unwrapAvatarResponse(res: Response): Promise<CustomerProfile> {
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (payload === null) throw new Error(invalidPayloadMessage());
  return (payload as { data: CustomerProfile }).data;
}

export async function uploadCustomerAvatar(file: File): Promise<CustomerProfile> {
  const form = new FormData();
  form.set("file", file);
  const headers: Record<string, string> = { Accept: "application/json" };
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(`${API_BASE_URL}/api/v1/customer/me/avatar`, {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  });
  return unwrapAvatarResponse(res);
}

export async function removeCustomerAvatar(): Promise<CustomerProfile> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(`${API_BASE_URL}/api/v1/customer/me/avatar`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return unwrapAvatarResponse(res);
}

export function fetchMyAddresses(): Promise<CustomerAddress[]> {
  return clientRequest("GET", "/api/v1/customer/addresses");
}

export function createAddress(payload: SaveAddressPayload): Promise<CustomerAddress> {
  return clientRequest("POST", "/api/v1/customer/addresses", payload);
}

export function updateAddress(id: string, payload: SaveAddressPayload): Promise<CustomerAddress> {
  return clientRequest("PATCH", `/api/v1/customer/addresses/${encodeURIComponent(id)}`, payload);
}

export function deleteAddress(id: string): Promise<void> {
  return clientRequest("DELETE", `/api/v1/customer/addresses/${encodeURIComponent(id)}`);
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function fetchMyOrders(
  page = 1,
  status?: string,
): Promise<{ data: OrderListItem[]; pagination: { totalPages: number; totalItems?: number } }> {
  const qs = new URLSearchParams({ page: String(page), size: "10" });
  if (status && status !== "ALL") qs.set("status", status);
  const res = await fetch(`${API_BASE_URL}/api/v1/customer/orders?${qs.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg =
      (payload?.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    data: (payload?.data as OrderListItem[] | undefined) ?? [],
    pagination: (payload?.pagination as
      { totalPages: number; totalItems?: number } | undefined) ?? { totalPages: 1 },
  };
}

export function cancelMyOrder(orderId: string): Promise<OrderDetail> {
  return clientRequest("PATCH", `/api/v1/customer/orders/${encodeURIComponent(orderId)}/cancel`);
}

export async function fetchMyOrder(orderId: string): Promise<OrderDetail> {
  const res = await fetch(`${API_BASE_URL}/api/v1/customer/orders/${encodeURIComponent(orderId)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (payload === null) throw new Error(invalidPayloadMessage());
  return (payload as { data: OrderDetail }).data ?? (payload as OrderDetail);
}

// ── Email verification ────────────────────────────────────────────────────────

export async function fetchOrderLookup(
  orderNumber: string,
  orderKey: string,
): Promise<OrderDetail | null> {
  const qs = new URLSearchParams({ orderNumber, orderKey });
  const res = await fetch(`${API_BASE_URL}/api/v1/orders/lookup?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (payload as { data?: OrderDetail } | null)?.data ?? null;
}

export function verifyEmail(token: string): Promise<void> {
  return clientRequest<void>(
    "POST",
    `/api/v1/customer/auth/verify-email?token=${encodeURIComponent(token)}`,
  );
}
