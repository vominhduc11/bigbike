"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type FormEvent,
  type UIEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import {
  Loader2,
  MessageCircle,
  Minus,
  Phone,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  declineChatLead,
  fetchChatAvailability,
  recordChatInteraction,
  streamChatMessage,
  type ChatAction,
  type ChatContact,
  type ChatProgressCode,
  type ChatProductCard,
} from "@/lib/api/client-api";
import { useAuth } from "@/lib/auth/auth-store";
import {
  CHAT_STORAGE_KEY,
  CHAT_STORAGE_TTL_MS,
  clearChatSnapshot,
  readChatSnapshot,
  writeChatSnapshot,
  type ChatPersistenceSnapshot,
} from "@/lib/chat/chat-persistence";
import { toLoginPath, toOrderHistoryPath, toOrderLookupPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { BigBikeContactPanel } from "./floating-chat/BigBikeContactPanel";
import { BigBikeLeadForm, type BigBikeAccountContact, type BigBikeLeadDraft } from "./floating-chat/BigBikeLeadForm";
import { BigBikeProductCard } from "./floating-chat/BigBikeProductCard";
import { SafeChatMarkdown } from "./floating-chat/SafeChatMarkdown";

type FloatingChatProps = {
  hotline?: string;
  zaloUrl?: string;
  messengerUrl?: string;
  zaloDisplay?: string;
  messengerDisplay?: string;
};

type PanelState = "closed" | "minimized" | "expanded";
type AvailabilityState = "idle" | "loading" | "ready" | "error";
type PromptIntent = "PRODUCT_FINDING" | "PRODUCT_ACTION" | "UNKNOWN";

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  products?: ChatProductCard[];
  actions?: ChatAction[];
  noResults?: boolean;
  answerFormat?: "PLAIN_TEXT" | "MARKDOWN";
  resultKind?: string;
  animate?: boolean;
  requestId?: string;
  originInteractionId?: string;
  failed?: boolean;
};

type ComposerAction = {
  id: string;
  label: string;
  kind: "MESSAGE" | "CONTACT";
  intent: PromptIntent;
};

const DEFAULT_MAX_TURNS = 12;
export const CHAT_MESSAGE_TIMEOUT_MS = 75_000;

class ChatMessageTimeoutError extends Error {
  constructor() {
    super("Chat message request timed out");
    this.name = "ChatMessageTimeoutError";
  }
}
const EMPTY_LEAD_DRAFT: BigBikeLeadDraft = {
  name: "",
  phone: "",
  note: "",
  consented: false,
};

function accountContactFromProfile(profile: { displayName: string | null; phone: string | null }): BigBikeAccountContact | undefined {
  const name = profile.displayName?.trim();
  const phone = profile.phone?.trim();
  const digits = phone?.replace(/\D/g, "") || "";
  if (!name || !phone || !/^[0-9]{8,32}$/.test(digits)) return undefined;
  return { name, phone };
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function AssistantAnswer({ message }: { message: ChatMessage }) {
  const [visible, setVisible] = useState("");
  const shouldAnimate = Boolean(message.animate);

  useEffect(() => {
    if (!shouldAnimate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const reducedMotionTimer = window.setTimeout(() => setVisible(message.content), 0);
      return () => window.clearTimeout(reducedMotionTimer);
    }
    let length = 0;
    const step = Math.max(1, Math.ceil(message.content.length / 80));
    const timer = window.setInterval(() => {
      length = Math.min(message.content.length, length + step);
      setVisible(message.content.slice(0, length));
      if (length >= message.content.length) window.clearInterval(timer);
    }, 16);
    return () => window.clearInterval(timer);
  }, [message.content, shouldAnimate]);

  const displayContent = shouldAnimate ? visible : message.content;

  return (
    <>
      <span className="sr-only">{message.content}</span>
      <div aria-hidden="true">
        {message.answerFormat === "MARKDOWN" ? <SafeChatMarkdown content={displayContent} /> : displayContent}
      </div>
    </>
  );
}

type BigBikeAvatarSize = "launcher" | "header" | "message" | "minimized";

const BIGBIKE_AVATAR_SIZES: Record<BigBikeAvatarSize, { className: string }> = {
  launcher: { className: "size-14 md:size-16" },
  header: { className: "size-11" },
  message: { className: "size-9" },
  minimized: { className: "size-8" },
};

function BigBikeAvatar({ size }: { size: BigBikeAvatarSize }) {
  const avatar = BIGBIKE_AVATAR_SIZES[size];

  return (
    <span
      data-bigbike-avatar
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full! bg-chat text-primary-foreground ${avatar.className}`}
    >
      <MessageCircle className={size === "launcher" ? "size-6 md:size-7" : "size-4"} aria-hidden="true" />
    </span>
  );
}

function normalizedLabel(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function validTurnCount(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) >= 0 ? Math.floor(Number(value)) : fallback;
}

function contactValue(primary: string | null | undefined, fallback: string | null | undefined) {
  return primary?.trim() || fallback?.trim() || undefined;
}

function mergeContacts(primary: ChatContact | undefined, fallback: ChatContact): ChatContact {
  return {
    hotline: contactValue(primary?.hotline, fallback.hotline),
    zaloUrl: contactValue(primary?.zaloUrl, fallback.zaloUrl),
    messengerUrl: contactValue(primary?.messengerUrl, fallback.messengerUrl),
    zaloDisplay: contactValue(primary?.zaloDisplay, fallback.zaloDisplay),
    messengerDisplay: contactValue(primary?.messengerDisplay, fallback.messengerDisplay),
  };
}

function ActionButtons({
  actions,
  disabled,
  labelFor,
  onAction,
}: {
  actions: ChatAction[];
  disabled: boolean;
  labelFor: (type: ChatAction["type"]) => string;
  onAction: (action: ChatAction) => void;
}) {
  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.type}
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 px-3"
          disabled={disabled}
          onClick={() => onAction(action)}
        >
          {labelFor(action.type)}
        </Button>
      ))}
    </div>
  );
}

export function FloatingChat({
  hotline,
  zaloUrl,
  messengerUrl,
  zaloDisplay,
  messengerDisplay,
}: Readonly<FloatingChatProps>) {
  const t = useTranslations("Support");
  const pathname = usePathname();
  const activeLocale = useLocale() === "en" ? "en" : "vi";
  const locale = activeLocale as Locale;
  const pageContext = useMemo(() => {
    const match = pathname?.match(/^\/(?:en\/)?product\/([^/]+)\/?$/i);
    if (!match) return null;
    try {
      return { type: "PRODUCT" as const, productSlug: decodeURIComponent(match[1]) };
    } catch {
      return null;
    }
  }, [pathname]);
  const auth = useAuth();
  const accountContact = auth.status === "authenticated"
    ? accountContactFromProfile(auth.profile)
    : undefined;
  const defaultGreeting = t("defaultGreeting");
  const fallbackContacts = useMemo<ChatContact>(() => ({
    hotline,
    zaloUrl,
    messengerUrl,
    zaloDisplay,
    messengerDisplay,
  }), [hotline, messengerDisplay, messengerUrl, zaloDisplay, zaloUrl]);

  const fallbackPrompts = useMemo<ComposerAction[]>(() => [
    { id: "initial-needs", label: t("quickFindByNeed"), kind: "MESSAGE", intent: "PRODUCT_FINDING" },
    { id: "initial-budget", label: t("quickFilterByBudget"), kind: "MESSAGE", intent: "PRODUCT_FINDING" },
    { id: "initial-compare", label: t("quickCompareProducts"), kind: "MESSAGE", intent: "PRODUCT_ACTION" },
    { id: "initial-stock", label: t("quickCheckStock"), kind: "MESSAGE", intent: "PRODUCT_FINDING" },
  ], [t]);
  const findingPromptLabels = useMemo(() => new Set([
    t("quickFindByNeed"),
    t("quickFilterByBudget"),
    t("quickCheckStock"),
    t("changeBudget"),
    t("changeNeeds"),
  ].map(normalizedLabel)), [t]);
  const productActionLabels = useMemo(() => new Set([
    t("quickCompareProducts"),
    t("compareProducts"),
  ].map(normalizedLabel)), [t]);

  const [panelState, setPanelState] = useState<PanelState>("closed");
  const [serviceMode, setServiceMode] = useState<"AI" | "CONTACT">("AI");
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("idle");
  const [contacts, setContacts] = useState<ChatContact>(fallbackContacts);
  const [greeting, setGreeting] = useState("");
  const [initialPrompts, setInitialPrompts] = useState<ComposerAction[]>(fallbackPrompts);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [remainingTurns, setRemainingTurns] = useState(DEFAULT_MAX_TURNS);
  const [contactNotice, setContactNotice] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [retryMessage, setRetryMessage] = useState<{
    message: string;
    intent: PromptIntent;
    requestId: string;
    originInteractionId?: string;
  } | null>(null);
  const [progressCode, setProgressCode] = useState<ChatProgressCode | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string>();
  const [leadPromptSequence, setLeadPromptSequence] = useState<0 | 1 | 2>(0);
  const [leadPromptMessageId, setLeadPromptMessageId] = useState<string>();
  const [viewedLeadSequences, setViewedLeadSequences] = useState<Array<1 | 2>>([]);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadDeclined, setLeadDeclined] = useState(false);
  const [showContactLead, setShowContactLead] = useState(false);
  const [leadDraft, setLeadDraft] = useState<BigBikeLeadDraft>({
    name: "",
    phone: "",
    note: "",
    consented: false,
  });
  const [announcement, setAnnouncement] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);

  const fabLauncherRef = useRef<HTMLButtonElement>(null);
  const minimizedLauncherRef = useRef<HTMLButtonElement>(null);
  const launcherContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeTargetRef = useRef<Exclude<PanelState, "expanded">>("closed");
  const availabilityBusyRef = useRef(false);
  const availabilityLocaleRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);
  const nearBottomRef = useRef(true);
  const hydratedRef = useRef(false);
  const persistenceReadyRef = useRef(false);
  const persistenceExpiresAtRef = useRef<number | null>(null);
  const restoredSessionRef = useRef(false);
  const restoredServiceModeRef = useRef<"AI" | "CONTACT" | null>(null);
  const expiryTimerRef = useRef<number | null>(null);
  const previousAuthStatusRef = useRef(auth.status);
  const conversationGenerationRef = useRef(0);
  const viewedLeadSequencesRef = useRef<Set<1 | 2>>(new Set());

  const effectiveContacts = useMemo(
    () => mergeContacts(contacts, fallbackContacts),
    [contacts, fallbackContacts],
  );

  const clearConversation = useCallback((closePanel = false) => {
    conversationGenerationRef.current += 1;
    clearChatSnapshot();
    persistenceExpiresAtRef.current = null;
    restoredSessionRef.current = false;
    restoredServiceModeRef.current = null;
    availabilityLocaleRef.current = undefined;
    if (expiryTimerRef.current != null && typeof window !== "undefined") {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    setMessages([]);
    setConversationId(undefined);
    setDraft("");
    setSending(false);
    setRemainingTurns(DEFAULT_MAX_TURNS);
    setServiceMode("AI");
    setAvailabilityState("idle");
    setContacts(fallbackContacts);
    setGreeting("");
    setInitialPrompts(fallbackPrompts);
    setContactNotice("");
    setContactOpen(false);
    setRetryAvailable(false);
    setRetryMessage(null);
    setProgressCode(null);
    setPendingRequestId(undefined);
    setLeadPromptSequence(0);
    setLeadPromptMessageId(undefined);
    setViewedLeadSequences([]);
    viewedLeadSequencesRef.current = new Set();
    setLeadCaptured(false);
    setLeadDeclined(false);
    setShowContactLead(false);
    setLeadDraft(EMPTY_LEAD_DRAFT);
    setAnnouncement("");
    if (closePanel) setPanelState("closed");
  }, [fallbackContacts, fallbackPrompts]);

  useEffect(() => {
    mountedRef.current = true;
    hydratedRef.current = true;
    launcherContainerRef.current?.setAttribute("data-bigbike-launcher-ready", "true");

    const snapshot = readChatSnapshot();
    persistenceReadyRef.current = true;
    if (snapshot) {
      restoredSessionRef.current = true;
      restoredServiceModeRef.current = snapshot.serviceMode;
      persistenceExpiresAtRef.current = snapshot.expiresAt;
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        setMessages(snapshot.messages);
        setConversationId(snapshot.conversationId);
        setRemainingTurns(snapshot.remainingTurns);
        setServiceMode(snapshot.serviceMode);
        setLeadPromptSequence(snapshot.leadPromptSequence);
        setLeadPromptMessageId(snapshot.leadPromptMessageId);
        setViewedLeadSequences(snapshot.viewedLeadSequences);
        viewedLeadSequencesRef.current = new Set(snapshot.viewedLeadSequences);
        setLeadCaptured(snapshot.leadCaptured);
        setLeadDeclined(snapshot.leadDeclined);
        setAvailabilityState("ready");
        setPendingRequestId(snapshot.pendingRequestId);
        if (snapshot.pendingRequestId) {
          const failedMessage = [...snapshot.messages].reverse().find((item) =>
            item.role === "USER" && item.failed && item.requestId === snapshot.pendingRequestId);
          if (failedMessage) {
            setRetryAvailable(true);
            setRetryMessage({
              message: failedMessage.content,
              intent: "UNKNOWN",
              requestId: snapshot.pendingRequestId,
              originInteractionId: failedMessage.originInteractionId,
            });
          }
        }
      });
    }

    return () => {
      mountedRef.current = false;
      if (expiryTimerRef.current != null && typeof window !== "undefined") {
        window.clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (previousAuthStatusRef.current === "authenticated" && auth.status !== "authenticated") {
      clearConversation(true);
    }
    previousAuthStatusRef.current = auth.status;
  }, [auth.status, clearConversation]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === CHAT_STORAGE_KEY && event.newValue === null) {
        clearConversation(false);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearConversation]);

  useEffect(() => {
    if (!persistenceReadyRef.current || !conversationId || messages.length === 0) return;
    if (persistenceExpiresAtRef.current == null) {
      persistenceExpiresAtRef.current = Date.now() + CHAT_STORAGE_TTL_MS;
    }

    const snapshot: ChatPersistenceSnapshot = {
      version: 2,
      expiresAt: persistenceExpiresAtRef.current,
      locale: activeLocale,
      conversationId,
      messages: messages.slice(-64),
      remainingTurns,
      serviceMode,
      leadPromptSequence: leadCaptured || leadDeclined ? 0 : leadPromptSequence,
      leadPromptMessageId,
      viewedLeadSequences,
      leadCaptured,
      leadDeclined,
      pendingRequestId,
    };
    writeChatSnapshot(snapshot);
  }, [
    activeLocale,
    conversationId,
    leadCaptured,
    leadDeclined,
    leadPromptMessageId,
    leadPromptSequence,
    messages,
    pendingRequestId,
    remainingTurns,
    serviceMode,
    viewedLeadSequences,
  ]);

  useEffect(() => {
    if (!persistenceReadyRef.current || !conversationId || persistenceExpiresAtRef.current == null) return;
    const delay = persistenceExpiresAtRef.current - Date.now();
    if (delay <= 0) {
      clearConversation(false);
      return;
    }

    expiryTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) clearConversation(false);
    }, delay);
    return () => {
      if (expiryTimerRef.current != null) {
        window.clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, [clearConversation, conversationId]);

  useEffect(() => {
    if (panelState !== "expanded" || !nearBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [contactOpen, leadPromptSequence, messages, panelState, sending, showContactLead]);

  useEffect(() => {
    if (panelState !== "expanded"
      || !conversationId
      || !leadPromptMessageId
      || leadPromptSequence === 0
      || leadCaptured
      || leadDeclined
      || viewedLeadSequencesRef.current.has(leadPromptSequence)) return;

    const sequence = leadPromptSequence;
    viewedLeadSequencesRef.current.add(sequence);
    setViewedLeadSequences((current) => current.includes(sequence) ? current : [...current, sequence]);
    void recordChatInteraction({
      clientEventId: createRequestId(),
      conversationId,
      assistantMessageId: leadPromptMessageId,
      type: "LEAD_PROMPT_VIEWED",
      leadPromptSequence: sequence,
    }).catch(() => undefined);
  }, [
    conversationId,
    leadCaptured,
    leadDeclined,
    leadPromptMessageId,
    leadPromptSequence,
    panelState,
  ]);

  function promptIntent(label: string): PromptIntent {
    const normalized = normalizedLabel(label);
    if (findingPromptLabels.has(normalized)) return "PRODUCT_FINDING";
    if (productActionLabels.has(normalized)) return "PRODUCT_ACTION";
    return "UNKNOWN";
  }

  async function requestAvailability(force = false) {
    if (availabilityBusyRef.current) return;
    if (!force && availabilityLocaleRef.current === activeLocale) return;

    const preserveRestoredEndState = restoredSessionRef.current && restoredServiceModeRef.current === "CONTACT";
    availabilityBusyRef.current = true;
    availabilityLocaleRef.current = activeLocale;
    if (!restoredSessionRef.current) setAvailabilityState("loading");
    try {
      const availability = await fetchChatAvailability(activeLocale);
      if (!mountedRef.current) return;
      const nextContacts = mergeContacts(availability.contacts, fallbackContacts);
      const nextMaxTurns = validTurnCount(availability.maxTurns, DEFAULT_MAX_TURNS) || DEFAULT_MAX_TURNS;
      const backendPrompts = (availability.quickPrompts || []).slice(0, 4).map((label, index) => ({
        id: `backend-${index}`,
        label,
        kind: "MESSAGE" as const,
        intent: promptIntent(label),
      }));

      setContacts(nextContacts);
      setGreeting(availability.greeting?.trim() || defaultGreeting);
      setInitialPrompts(backendPrompts.length > 0 ? backendPrompts : fallbackPrompts);
      if (!conversationId) setRemainingTurns(nextMaxTurns);
      setAvailabilityState("ready");
      setRetryAvailable(false);
      setRetryMessage(null);
      if (!preserveRestoredEndState) setServiceMode(availability.mode);
      if (preserveRestoredEndState) {
        setContactNotice(remainingTurns <= 0 ? t("turnLimit") : t("inputLockedExplanation"));
      } else if (availability.mode === "AI") {
        setContactNotice("");
      } else {
        setContactNotice(t("fallbackNotice", { reason: "service" }));
      }
    } catch {
      if (!mountedRef.current) return;
      setAvailabilityState("error");
      setRetryAvailable(true);
      setRetryMessage(null);
      if (!preserveRestoredEndState) setServiceMode("AI");
      setContacts(fallbackContacts);
      const notice = preserveRestoredEndState
        ? (remainingTurns <= 0 ? t("turnLimit") : t("inputLockedExplanation"))
        : t("fallbackNotice", { reason: "network" });
      setContactNotice(notice);
      setAnnouncement(`${notice} ${t("contactStatus")}`);
    } finally {
      availabilityBusyRef.current = false;
    }
  }

  function focusLauncherSoon() {
    requestAnimationFrame(() => {
      const isDesktop = typeof window.matchMedia === "function"
        && window.matchMedia("(min-width: 768px)").matches;
      const target = isDesktop
        ? minimizedLauncherRef.current || fabLauncherRef.current
        : fabLauncherRef.current;
      target?.focus();
    });
  }

  function openPanel() {
    closeTargetRef.current = "closed";
    setPanelState("expanded");
    setHasInteracted(true);
    if (availabilityLocaleRef.current !== activeLocale) void requestAvailability();
  }

  function closePanel(target: Exclude<PanelState, "expanded">) {
    closeTargetRef.current = target;
    setPanelState(target);
  }

  function closeMinimizedBar() {
    setPanelState("closed");
    focusLauncherSoon();
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) return;
    const target = closeTargetRef.current;
    closeTargetRef.current = "closed";
    setPanelState(target);
  }

  function onConversationScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    nearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 96;
  }

  function nextMessageId(prefix: string) {
    return `${prefix}-${createRequestId()}`;
  }

  function announceAssistant(content: string, products: ChatProductCard[] = []) {
    const message = `${t("bigbikeTitle")}: ${content}`;
    setAnnouncement(products.length > 0
      ? `${message} ${t("productCountAnnouncement", { count: products.length })}`
      : message);
  }

  function appendAssistantMessage(content: string) {
    const nextMessage: ChatMessage = {
      id: nextMessageId("assistant"),
      role: "ASSISTANT",
      content,
    };
    setMessages((current) => [...current, nextMessage]);
    announceAssistant(content);
  }

  async function submitMessage(
    raw: string,
    intent: PromptIntent = "UNKNOWN",
    existingRequestId?: string,
    originInteractionId?: string,
  ) {
    const message = raw.trim();
    if (!message || sending || serviceMode !== "AI" || remainingTurns <= 0) return;

    const requestId = existingRequestId ?? createRequestId();
    const isRetry = Boolean(existingRequestId);
    const userMessageId = nextMessageId("user");
    const conversationGeneration = conversationGenerationRef.current;
    setDraft("");
    setMessages((current) => isRetry && current.some((item) => item.requestId === requestId)
      ? current.map((item) => item.requestId === requestId ? { ...item, failed: false } : item)
      : [...current, {
        id: userMessageId,
        role: "USER",
        content: message,
        requestId,
        originInteractionId,
      }]);
    setSending(true);
    setRetryAvailable(false);
    setRetryMessage(null);
    setContactNotice("");
    setAnnouncement("");
    setProgressCode("UNDERSTANDING");
    setPendingRequestId(requestId);
    nearBottomRef.current = true;

    try {
      const controller = new AbortController();
      let timeoutId: number | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          controller.abort();
          reject(new ChatMessageTimeoutError());
        }, CHAT_MESSAGE_TIMEOUT_MS);
      });
      const response = await Promise.race([
        streamChatMessage(
          message,
          activeLocale,
          conversationId,
          requestId,
          (code) => {
            if (mountedRef.current && conversationGeneration === conversationGenerationRef.current) setProgressCode(code);
          },
          controller.signal,
          pageContext,
          originInteractionId,
        ),
        timeout,
      ]).finally(() => {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      });
      if (!mountedRef.current || conversationGeneration !== conversationGenerationRef.current) return;
      const nextProducts = (response.products || []).slice(0, 8);
      const nextRemainingTurns = validTurnCount(response.remainingTurns, 0);
      const answer = response.answer?.trim()
        || (response.mode === "CONTACT" ? t("inputLockedExplanation") : t("noInformation"));
      const assistantMessageId = response.assistantMessageId || nextMessageId("assistant");
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "ASSISTANT",
        content: answer,
        products: nextProducts,
        actions: response.actions,
        noResults: intent === "PRODUCT_FINDING" && nextProducts.length === 0,
        answerFormat: response.answerFormat,
        resultKind: response.resultKind,
        originInteractionId,
        animate: true,
      };

      setMessages((current) => [...current, assistantMessage]);
      announceAssistant(answer, nextProducts);
      setContacts(mergeContacts(response.contacts, fallbackContacts));
      if (response.conversationId) setConversationId(response.conversationId);
      setRemainingTurns(nextRemainingTurns);
      const nextLeadSequence = response.leadPromptSequence === 1 || response.leadPromptSequence === 2
        ? response.leadPromptSequence
        : (response.leadPrompt ? 1 : 0);
      if (!leadCaptured && !leadDeclined && nextLeadSequence > 0) {
        setLeadPromptSequence(nextLeadSequence);
        setLeadPromptMessageId(assistantMessageId);
        setShowContactLead(false);
      }
      setRetryAvailable(false);
      setPendingRequestId(undefined);

      if (response.mode === "CONTACT") {
        setServiceMode("CONTACT");
        setContactNotice(answer || t("uncertainty"));
        setAnnouncement(`${answer || t("uncertainty")} ${t("contactStatus")}`);
      } else if (nextRemainingTurns <= 0) {
        setServiceMode("CONTACT");
        setContactNotice(t("turnLimit"));
      } else {
        setServiceMode("AI");
        setContactNotice("");
      }
    } catch (error) {
      if (!mountedRef.current || conversationGeneration !== conversationGenerationRef.current) return;
      setMessages((current) => current.map((item) =>
        item.requestId === requestId ? { ...item, failed: true } : item));
      setDraft(message);
      setAvailabilityState("error");
      setRetryAvailable(true);
      setRetryMessage({ message, intent, requestId, originInteractionId });
      setPendingRequestId(requestId);
      const notice = error instanceof ChatMessageTimeoutError
        ? t("timeoutNotice")
        : t("fallbackNotice", { reason: "network" });
      setContactNotice(notice);
      setAnnouncement(`${notice} ${t("contactStatus")}`);
    } finally {
      if (mountedRef.current) {
        setSending(false);
        setProgressCode(null);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(draft);
  }

  function toggleContact() {
    setContactOpen((open) => !open);
  }

  function handleLeadCaptured() {
    setLeadCaptured(true);
    setLeadPromptSequence(0);
    setLeadPromptMessageId(undefined);
    setShowContactLead(false);
    appendAssistantMessage(t("leadSuccess"));
  }

  async function handleLeadDeclined() {
    if (!conversationId) return;
    try {
      await declineChatLead(conversationId);
      if (!mountedRef.current) return;
      setLeadDeclined(true);
      setLeadPromptSequence(0);
      setLeadPromptMessageId(undefined);
      setShowContactLead(false);
      appendAssistantMessage(t("leadDeclined"));
    } catch {
      if (mountedRef.current) setContactNotice(t("leadDeclineError"));
      throw new Error("LEAD_DECLINE_FAILED");
    }
  }

  const displayMessages = messages;

  function actionLabel(type: ChatAction["type"]): string {
    switch (type) {
      case "COMPARE_PRODUCTS": return t("actionCompareProducts");
      case "CHECK_SIZE": return t("actionCheckSize");
      case "CHECK_STOCK": return t("actionCheckStock");
      case "CHANGE_BUDGET": return t("actionChangeBudget");
      case "FIND_SIMILAR": return t("actionFindSimilar");
      case "VIEW_POLICY": return t("actionViewPolicy");
      case "FIND_PRODUCTS": return t("actionFindProducts");
      case "RELATED_ARTICLE_QUESTION": return t("actionRelatedArticle");
      case "CHANGE_NEEDS": return t("actionChangeNeeds");
      case "CONTACT_STAFF": return t("talkToStaff");
      case "LOGIN": return t("orderLogin");
      case "ORDER_HISTORY": return t("orderHistory");
      case "ORDER_LOOKUP": return t("orderLookup");
      case "CALL_HOTLINE": return t("actionCallHotline");
      case "OPEN_ZALO": return t("openZalo");
      case "OPEN_MESSENGER": return t("openMessenger");
    }
  }

  function actionIntent(type: ChatAction["type"]): PromptIntent {
    if (type === "COMPARE_PRODUCTS") return "PRODUCT_ACTION";
    if (["CHECK_SIZE", "CHECK_STOCK", "CHANGE_BUDGET", "FIND_SIMILAR", "FIND_PRODUCTS", "CHANGE_NEEDS"]
      .includes(type)) return "PRODUCT_FINDING";
    return "UNKNOWN";
  }

  async function handleIssuedAction(message: ChatMessage, action: ChatAction) {
    if (!conversationId || sending) return;
    setContactNotice("");
    try {
      const interaction = await recordChatInteraction({
        clientEventId: createRequestId(),
        conversationId,
        assistantMessageId: message.id,
        type: "ACTION_CLICKED",
        actionType: action.type,
      });
      const originInteractionId = interaction.interactionId;
      if (action.type === "LOGIN") {
        window.location.assign(toLoginPath(toOrderLookupPath(locale), locale));
      } else if (action.type === "ORDER_HISTORY") {
        window.location.assign(toOrderHistoryPath(locale));
      } else if (action.type === "ORDER_LOOKUP") {
        window.location.assign(toOrderLookupPath(locale));
      } else if (action.type === "CALL_HOTLINE" && effectiveContacts.hotline) {
        window.location.assign(`tel:${effectiveContacts.hotline.replace(/[^+\d]/g, "")}`);
      } else if (action.type === "OPEN_ZALO" && effectiveContacts.zaloUrl) {
        window.open(effectiveContacts.zaloUrl, "_blank", "noopener,noreferrer");
      } else if (action.type === "OPEN_MESSENGER" && effectiveContacts.messengerUrl) {
        window.open(effectiveContacts.messengerUrl, "_blank", "noopener,noreferrer");
      } else if (action.type === "CONTACT_STAFF") {
        setContactOpen(true);
      } else {
        await submitMessage(actionLabel(action.type), actionIntent(action.type), undefined, originInteractionId);
      }
    } catch {
      if (mountedRef.current) setContactNotice(t("actionRecordError"));
    }
  }

  function handleCartLeadPrompt(messageId: string, sequence: 1 | 2) {
    if (leadCaptured || leadDeclined) return;
    setLeadPromptSequence(sequence);
    setLeadPromptMessageId(messageId);
    setShowContactLead(false);
  }

  function runComposerAction(action: ComposerAction) {
    if (action.kind === "CONTACT") {
      toggleContact();
      return;
    }
    void submitMessage(action.label, action.intent);
  }

  const statusLabel = serviceMode === "CONTACT" ? t("contactStatus") : t("aiStatus");

  function renderFab(mobileOnly = false, includeTriggerId = true) {
    const tooltipId = mobileOnly ? "bigbike-fab-tooltip-mobile" : "bigbike-fab-tooltip";
    return (
      <div
        ref={includeTriggerId ? registerLauncherContainer : undefined}
        id={includeTriggerId ? "bb-floating-chat-trigger" : undefined}
        dir="ltr"
        className={`group relative flex flex-col-reverse items-end ${mobileOnly ? "md:hidden" : ""}`}
      >
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-1/2 right-full mr-3 translate-y-1/2 whitespace-nowrap border border-chat bg-background px-3 py-2 font-cta text-b5-label font-semibold uppercase tracking-wide text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:hidden"
        >
          {t("fabTooltip")}
        </div>
        <Button
          ref={fabLauncherRef}
          type="button"
          size="icon"
          className="relative size-14 overflow-visible rounded-full! border-chat bg-chat p-0 text-primary-foreground shadow-none hover:border-chat hover:bg-chat focus-visible:outline-offset-4 md:size-16"
          aria-label={panelState === "minimized" ? t("reopen") : t("open")}
          aria-describedby={tooltipId}
          onClick={openPanel}
        >
          {!hasInteracted ? (
            <span
              className="pointer-events-none absolute inset-0 -z-10 rounded-full! border border-chat motion-safe:animate-[bb-chat-halo_3.6s_ease-out_infinite] motion-reduce:hidden"
              aria-hidden="true"
            />
          ) : null}
          <BigBikeAvatar
            size="launcher"
          />
        </Button>
      </div>
    );
  }

  function registerLauncherContainer(node: HTMLDivElement | null) {
    launcherContainerRef.current = node;
    if (node && hydratedRef.current) node.setAttribute("data-bigbike-launcher-ready", "true");
  }

  return (
    <>
      {panelState === "closed" ? renderFab() : null}
      {panelState === "minimized" ? (
        <div
          ref={registerLauncherContainer}
          id="bb-floating-chat-trigger"
          dir="ltr"
        >
          {renderFab(true, false)}
          <div
            className="hidden h-13 w-72 items-stretch border border-chat bg-background md:flex"
          >
            <Button
              ref={minimizedLauncherRef}
              type="button"
              variant="ghost"
              className="min-h-13 min-w-0 flex-1 justify-start gap-3 px-3 py-0 hover:scale-100 hover:bg-cyan/10"
              aria-label={t("reopen")}
              onClick={openPanel}
            >
              <BigBikeAvatar
                size="minimized"
              />
              <span className="truncate font-cta text-b4-action font-semibold uppercase tracking-wide text-foreground">
                {t("minimizedLabel")}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-13 min-h-13 shrink-0 border-l border-border px-0 hover:scale-100 hover:bg-secondary"
              aria-label={t("close")}
              onClick={closeMinimizedBar}
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={panelState === "expanded"} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          data-bigbike-assistant
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusLauncherSoon();
          }}
          className="bb-floating-chat-panel left-0! right-0! top-0! bottom-0! flex h-dvh max-h-none! w-screen! max-w-none! translate-x-0! translate-y-0! flex-col overflow-hidden! rounded-none! border-0 bg-background p-0 max-md:data-[state=open]:zoom-in-100 max-md:data-[state=closed]:zoom-out-100 [&>button]:hidden md:left-auto! md:right-[var(--bb-floating-action-right)]! md:top-auto! md:bottom-[var(--bb-floating-chat-bottom)]! md:h-160! md:max-h-[calc(100dvh-6rem)]! md:w-106! md:border md:shadow-[var(--bb-shadow-md)]"
        >
          <DialogHeader className="shrink-0 border-x-0 border-t-0 border-b-4 border-chat bg-surface-dark px-4 pb-4 pt-[max(var(--bb-space-4),env(safe-area-inset-top))] text-primary-foreground md:pt-4">
            <div className="flex min-w-0 items-start gap-3">
              <BigBikeAvatar
                size="header"
              />
              <div className="min-w-0 flex-1">
                <DialogTitle className="font-cta text-b4-action font-semibold uppercase tracking-wide text-primary-foreground">
                  {t("bigbikeTitle")}
                </DialogTitle>
                <div className="mt-1 flex items-center gap-2">
                  <span className="size-2 rounded-full! bg-chat" aria-hidden="true" />
                  <span className="font-cta text-b5-label font-semibold uppercase tracking-wide text-primary-foreground">
                    {statusLabel}
                  </span>
                </div>
                <DialogDescription className="mt-2 font-body text-a5-meta leading-relaxed text-primary-foreground">
                  {t("aiDisclosure")}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 min-h-11 border border-primary-foreground/60 p-0 text-primary-foreground hover:scale-100 hover:bg-primary-foreground/10"
                  aria-label={t("deleteConversation")}
                  title={t("deleteConversation")}
                  onClick={() => clearConversation(false)}
                >
                  <Trash2 className="size-5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 min-h-11 border border-primary-foreground/60 p-0 text-primary-foreground hover:scale-100 hover:bg-primary-foreground/10"
                  aria-label={t("minimize")}
                  onClick={() => closePanel("minimized")}
                >
                  <Minus className="size-5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 min-h-11 border border-primary-foreground/60 p-0 text-primary-foreground hover:scale-100 hover:bg-primary-foreground/10"
                  aria-label={t("close")}
                  onClick={() => closePanel("closed")}
                >
                  <X className="size-5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

          {availabilityState === "loading" ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-secondary p-6 text-center" role="status">
              <BigBikeAvatar
                size="header"
              />
              <Loader2 className="size-5 animate-spin text-chat" aria-hidden="true" />
              <p className="font-body text-a4-content text-muted-foreground">{t("checking")}</p>
            </div>
          ) : (
            <>
              <div
                ref={listRef}
                data-bigbike-conversation
                className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-secondary p-4"
                onScroll={onConversationScroll}
              >
                <div className="grid gap-4">
                  {messages.length === 0 ? (
                    <section data-bigbike-onboarding aria-labelledby="bigbike-onboarding-heading" className="border border-border bg-background p-4">
                      <div className="flex items-start gap-3">
                        <BigBikeAvatar
                          size="header"
                        />
                        <div className="min-w-0">
                          <p className="font-cta text-b5-label font-semibold uppercase tracking-wide text-chat">{t("bigbikeTitle")}</p>
                          <h2 id="bigbike-onboarding-heading" className="mt-1 font-body text-a3-section font-semibold leading-title text-foreground">
                            {greeting || defaultGreeting}
                          </h2>
                          <p className="mt-2 font-body text-a5-meta leading-relaxed text-muted-foreground">
                            {t("onboardingDescription")}
                          </p>
                        </div>
                      </div>

                      {initialPrompts.length > 0 ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {initialPrompts.slice(0, 4).map((action) => (
                            <Button
                              key={action.id}
                              type="button"
                              variant="outline"
                              className="min-h-16 w-full justify-start whitespace-normal border-border bg-background px-4 py-3 text-left text-foreground hover:border-chat hover:bg-cyan/10 hover:scale-100"
                              disabled={sending || serviceMode !== "AI"}
                              onClick={() => runComposerAction(action)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {displayMessages.map((message, index) => {
                    const showAssistantAvatar = message.role === "ASSISTANT"
                      && (index === 0 || displayMessages[index - 1]?.role !== "ASSISTANT");
                    const products = message.products?.slice(0, 8) || [];
                    return (
                      <div key={message.id} className={`flex gap-3 ${message.role === "USER" ? "justify-end" : "justify-start"}`}>
                        {message.role === "ASSISTANT" ? (
                          showAssistantAvatar ? (
                            <BigBikeAvatar
                              size="message"
                            />
                          ) : <span className="size-9 shrink-0" aria-hidden="true" />
                        ) : null}
                        <div className="grid max-w-4/5 min-w-0 gap-2">
                          <div className={`border px-4 py-3 font-body text-a4-content leading-relaxed text-foreground ${message.role === "USER" ? "border-chat bg-cyan/10" : "border-border bg-background"}`}>
                            {message.role === "ASSISTANT" ? <AssistantAnswer message={message} /> : message.content}
                          </div>
                          {products.length > 0 ? (
                            <div
                              data-bigbike-product-list
                              className={products.length > 1 ? "flex gap-3 overflow-x-auto snap-x pb-2" : "grid"}
                            >
                              {products.map((product) => (
                                <BigBikeProductCard
                                  key={product.slug}
                                  product={product}
                                  locale={locale}
                                  compact={products.length > 1}
                                  conversationId={conversationId}
                                  assistantInteractionId={message.originInteractionId}
                                  onLeadPrompt={(sequence) => handleCartLeadPrompt(message.id, sequence)}
                                />
                              ))}
                            </div>
                          ) : null}
                          {message.actions?.length ? (
                            <ActionButtons
                              actions={message.actions}
                              disabled={sending}
                              labelFor={actionLabel}
                              onAction={(action) => void handleIssuedAction(message, action)}
                            />
                          ) : null}
                          {message.noResults ? (
                            <div className="border-l-4 border-chat bg-background p-4">
                              <p className="font-body text-a4-content font-semibold text-foreground">{t("noResults")}</p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {sending ? (
                    <div className="flex items-start gap-3" role="status">
                      <BigBikeAvatar
                        size="message"
                      />
                      <div className="flex items-center gap-2 border border-border bg-background px-4 py-3 font-body text-a5-meta text-muted-foreground">
                        <Loader2 className="size-4 animate-spin text-chat" aria-hidden="true" />
                        {progressCode === "UNDERSTANDING"
                          ? t("progressUnderstanding")
                          : progressCode === "FINALIZING"
                            ? t("progressFinalizing")
                            : t("progressCheckingProducts")}
                      </div>
                    </div>
                  ) : null}

                  {conversationId
                    && leadPromptSequence > 0
                    && !leadCaptured
                    && !leadDeclined ? (
                      <section
                        data-bigbike-lead-prompt
                        aria-labelledby="bigbike-lead-prompt-title"
                        className="ml-12 grid gap-3 border border-chat bg-background p-4"
                      >
                        <div>
                          <h3 id="bigbike-lead-prompt-title" className="font-cta text-b4-action font-semibold uppercase tracking-wide text-foreground">
                            {t("leadTitle")}
                          </h3>
                          <p className="mt-1 font-body text-a5-meta leading-relaxed text-muted-foreground">
                            {t("leadPromptDescription")}
                          </p>
                        </div>
                        {!showContactLead ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button type="button" className="min-h-11" onClick={() => setShowContactLead(true)}>
                              {t("leadPromptAccept")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11"
                              onClick={() => void handleLeadDeclined().catch(() => undefined)}
                            >
                              {t("leadPromptDecline")}
                            </Button>
                          </div>
                        ) : conversationId ? (
                          <BigBikeLeadForm
                            conversationId={conversationId}
                            draft={leadDraft}
                            onDraftChange={setLeadDraft}
                            onCaptured={handleLeadCaptured}
                            onDeclined={handleLeadDeclined}
                            accountContact={accountContact}
                          />
                        ) : null}
                      </section>
                    ) : null}

                  {contactOpen ? (
                    <div id="bigbike-contact-inline" data-bigbike-contact-inline className="grid gap-3">
                      {messages.length > 0 ? (
                        <p className="border-l-4 border-chat bg-background p-3 font-body text-a5-meta leading-relaxed text-muted-foreground">
                          {t("contactContextPreserved")}
                        </p>
                      ) : null}
                      <BigBikeContactPanel
                        contacts={effectiveContacts}
                        onRequestCallback={conversationId && leadPromptSequence > 0 && !leadCaptured && !leadDeclined
                          ? () => setShowContactLead(true)
                          : undefined}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                data-bigbike-composer
                className="shrink-0 border-t border-border bg-background px-4 pt-4 pb-[max(var(--bb-space-4),env(safe-area-inset-bottom))] md:pb-4"
              >
                {contactNotice ? (
                  <p className="mb-3 border border-state-warning bg-state-warning-bg p-3 font-body text-a5-meta leading-relaxed text-foreground">
                    {contactNotice}
                  </p>
                ) : null}

                {retryAvailable ? (
                  <div className="mb-3 flex justify-end">
                    <Button
                      type="button"
                      className="border-chat bg-chat text-primary-foreground hover:border-chat hover:bg-chat"
                      onClick={() => retryMessage
                        ? void submitMessage(
                          retryMessage.message,
                          retryMessage.intent,
                          retryMessage.requestId,
                          retryMessage.originInteractionId,
                        )
                        : void requestAvailability(true)}
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                      {t("retry")}
                    </Button>
                  </div>
                ) : null}

                {remainingTurns > 0 && remainingTurns <= 3 ? (
                  <p className="mb-3 border border-state-warning bg-state-warning-bg p-3 font-body text-a5-meta text-foreground">
                    {t("remainingWarning", { count: remainingTurns })}
                  </p>
                ) : null}

                <form onSubmit={handleSubmit} className="flex items-end gap-2">
                  <Label htmlFor="bigbike-chat-message" className="sr-only">{t("messageLabel")}</Label>
                  <Input
                    ref={messageInputRef}
                    id="bigbike-chat-message"
                    value={draft}
                    maxLength={1000}
                    disabled={sending || serviceMode !== "AI" || remainingTurns <= 0}
                    placeholder={serviceMode === "CONTACT" || remainingTurns <= 0
                      ? t("messagePlaceholderLocked")
                      : t("messagePlaceholder")}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="size-12 min-h-12 shrink-0 p-0"
                    disabled={!draft.trim() || sending || serviceMode !== "AI" || remainingTurns <= 0}
                    aria-label={t("send")}
                  >
                    {sending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
                  </Button>
                </form>

                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 px-3"
                    aria-label={contactOpen ? t("contactToggleClose") : t("talkToStaff")}
                    title={contactOpen ? t("contactToggleClose") : t("contactToggleOpen")}
                    aria-expanded={contactOpen}
                aria-controls="bigbike-contact-inline"
                    onClick={toggleContact}
                  >
                    <Phone className="size-4" aria-hidden="true" />
                    {contactOpen ? t("contactToggleClose") : t("talkToStaff")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
