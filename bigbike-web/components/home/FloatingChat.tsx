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
  sendChatMessage,
  type ChatAction,
  type ChatContact,
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
import { BiContactPanel } from "./floating-chat/BiContactPanel";
import { BiLeadForm, type BiAccountContact, type BiLeadDraft } from "./floating-chat/BiLeadForm";
import { BiProductCard } from "./floating-chat/BiProductCard";

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
};

type ComposerAction = {
  id: string;
  label: string;
  kind: "MESSAGE" | "CONTACT";
  intent: PromptIntent;
};

const DEFAULT_MAX_TURNS = 12;
export const CHAT_MESSAGE_TIMEOUT_MS = 45_000;

class ChatMessageTimeoutError extends Error {
  constructor() {
    super("Chat message request timed out");
    this.name = "ChatMessageTimeoutError";
  }
}
const EMPTY_LEAD_DRAFT: BiLeadDraft = {
  name: "",
  phone: "",
  note: "",
  consented: false,
};

function accountContactFromProfile(profile: { displayName: string | null; phone: string | null }): BiAccountContact | undefined {
  const name = profile.displayName?.trim();
  const phone = profile.phone?.trim();
  const digits = phone?.replace(/\D/g, "") || "";
  if (!name || !phone || !/^[0-9]{8,32}$/.test(digits)) return undefined;
  return { name, phone };
}

type BiAvatarSize = "launcher" | "header" | "message" | "minimized";

const BI_AVATAR_SIZES: Record<BiAvatarSize, { className: string }> = {
  launcher: { className: "size-14 md:size-16" },
  header: { className: "size-11" },
  message: { className: "size-9" },
  minimized: { className: "size-8" },
};

function BiAvatar({ size }: { size: BiAvatarSize }) {
  const avatar = BI_AVATAR_SIZES[size];

  return (
    <span
      data-bi-avatar
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

function ActionButtons({ actions, locale }: { actions: ChatAction[]; locale: Locale }) {
  const t = useTranslations("Support");
  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const href = action.type === "LOGIN"
          ? toLoginPath(toOrderLookupPath(locale), locale)
          : action.type === "ORDER_HISTORY"
            ? toOrderHistoryPath(locale)
            : toOrderLookupPath(locale);
        const label = action.type === "LOGIN"
          ? t("orderLogin")
          : action.type === "ORDER_HISTORY"
            ? t("orderHistory")
            : t("orderLookup");
        return (
          <Button key={action.type} asChild variant="outline" size="sm" className="min-h-11 px-3">
            <a href={href}>{label}</a>
          </Button>
        );
      })}
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
  const activeLocale = useLocale() === "en" ? "en" : "vi";
  const locale = activeLocale as Locale;
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
  const [retryMessage, setRetryMessage] = useState<{ message: string; intent: PromptIntent } | null>(null);
  const [leadPrompt, setLeadPrompt] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadDeclined, setLeadDeclined] = useState(false);
  const [showContactLead, setShowContactLead] = useState(false);
  const [leadDraft, setLeadDraft] = useState<BiLeadDraft>({
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
  const messageSequence = useRef(0);
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
    setLeadPrompt(false);
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
    launcherContainerRef.current?.setAttribute("data-bi-launcher-ready", "true");

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
        setLeadPrompt(snapshot.leadPrompt && !snapshot.leadCaptured && !snapshot.leadDeclined);
        setLeadCaptured(snapshot.leadCaptured);
        setLeadDeclined(snapshot.leadDeclined);
        setAvailabilityState("ready");
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
      version: 1,
      expiresAt: persistenceExpiresAtRef.current,
      locale: activeLocale,
      conversationId,
      messages: messages.slice(-64),
      remainingTurns,
      serviceMode,
      leadPrompt: leadPrompt && !leadCaptured && !leadDeclined,
      leadCaptured,
      leadDeclined,
    };
    writeChatSnapshot(snapshot);
  }, [activeLocale, conversationId, leadCaptured, leadDeclined, leadPrompt, messages, remainingTurns, serviceMode]);

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
  }, [contactOpen, leadPrompt, messages, panelState, sending]);

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
    messageSequence.current += 1;
    return `${prefix}-${messageSequence.current}`;
  }

  function announceAssistant(content: string, products: ChatProductCard[] = []) {
    const message = `${t("biTitle")}: ${content}`;
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

  async function submitMessage(raw: string, intent: PromptIntent = "UNKNOWN") {
    const message = raw.trim();
    if (!message || sending || serviceMode !== "AI" || remainingTurns <= 0) return;

    const userMessageId = nextMessageId("user");
    const conversationGeneration = conversationGenerationRef.current;
    setDraft("");
    setMessages((current) => [...current, { id: userMessageId, role: "USER", content: message }]);
    setSending(true);
    setRetryAvailable(false);
    setRetryMessage(null);
    setContactNotice("");
    setAnnouncement("");
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
        sendChatMessage(message, activeLocale, conversationId, controller.signal),
        timeout,
      ]).finally(() => {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      });
      if (!mountedRef.current || conversationGeneration !== conversationGenerationRef.current) return;
      const nextProducts = (response.products || []).slice(0, 3);
      const nextRemainingTurns = validTurnCount(response.remainingTurns, 0);
      const answer = response.answer?.trim()
        || (response.mode === "CONTACT" ? t("inputLockedExplanation") : t("noInformation"));
      const assistantMessage: ChatMessage = {
        id: nextMessageId("assistant"),
        role: "ASSISTANT",
        content: answer,
        products: nextProducts,
        actions: response.actions,
        noResults: intent === "PRODUCT_FINDING" && nextProducts.length === 0,
      };

      setMessages((current) => [...current, assistantMessage]);
      announceAssistant(answer, nextProducts);
      setContacts(mergeContacts(response.contacts, fallbackContacts));
      if (response.conversationId) setConversationId(response.conversationId);
      setRemainingTurns(nextRemainingTurns);
      setLeadPrompt(Boolean(response.leadPrompt) && !leadCaptured && !leadDeclined);
      setRetryAvailable(false);

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
      setMessages((current) => current.filter((item) => item.id !== userMessageId));
      setDraft(message);
      setAvailabilityState("error");
      setRetryAvailable(true);
      setRetryMessage({ message, intent });
      const notice = error instanceof ChatMessageTimeoutError
        ? t("timeoutNotice")
        : t("fallbackNotice", { reason: "network" });
      setContactNotice(notice);
      setAnnouncement(`${notice} ${t("contactStatus")}`);
    } finally {
      if (mountedRef.current) setSending(false);
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
    setLeadPrompt(false);
    setShowContactLead(false);
    appendAssistantMessage(t("leadSuccess"));
  }

  async function handleLeadDeclined() {
    if (!conversationId) return;
    await declineChatLead(conversationId);
    if (!mountedRef.current) return;
    setLeadDeclined(true);
    setLeadPrompt(false);
    setShowContactLead(false);
    appendAssistantMessage(t("leadDeclined"));
  }

  const displayMessages = messages;
  const latestAssistant = [...messages].reverse().find((message) => message.role === "ASSISTANT");

  const composerActions = useMemo<ComposerAction[]>(() => {
    if (messages.length === 0) return [];
    if (latestAssistant?.noResults) {
      const actions: ComposerAction[] = [];
      if (serviceMode === "AI") {
        actions.push(
          { id: "no-results-budget", label: t("changeBudget"), kind: "MESSAGE", intent: "PRODUCT_FINDING" },
          { id: "no-results-needs", label: t("changeNeeds"), kind: "MESSAGE", intent: "PRODUCT_FINDING" },
        );
      }
      actions.push({
        id: "no-results-contact",
        label: contactOpen ? t("contactToggleClose") : t("talkToStaff"),
        kind: "CONTACT",
        intent: "UNKNOWN",
      });
      return actions;
    }
    if (latestAssistant?.products?.length) {
      const actions: ComposerAction[] = [];
      if (latestAssistant.products.length > 1) {
        actions.push({ id: "products-compare", label: t("compareProducts"), kind: "MESSAGE", intent: "PRODUCT_ACTION" });
      }
      actions.push(
        { id: "products-budget", label: t("changeBudget"), kind: "MESSAGE", intent: "PRODUCT_FINDING" },
        {
          id: "products-contact",
          label: contactOpen ? t("contactToggleClose") : t("talkToStaff"),
          kind: "CONTACT",
          intent: "UNKNOWN",
        },
      );
      return actions.slice(0, 4);
    }
    return [];
  }, [contactOpen, latestAssistant, messages.length, serviceMode, t]);

  function runComposerAction(action: ComposerAction) {
    if (action.kind === "CONTACT") {
      toggleContact();
      return;
    }
    void submitMessage(action.label, action.intent);
  }

  const hasContactComposerAction = composerActions.some((action) => action.kind === "CONTACT");
  const statusLabel = serviceMode === "CONTACT" ? t("contactStatus") : t("aiStatus");

  function renderFab(mobileOnly = false, includeTriggerId = true) {
    const tooltipId = mobileOnly ? "bi-fab-tooltip-mobile" : "bi-fab-tooltip";
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
          <BiAvatar
            size="launcher"
          />
        </Button>
      </div>
    );
  }

  function registerLauncherContainer(node: HTMLDivElement | null) {
    launcherContainerRef.current = node;
    if (node && hydratedRef.current) node.setAttribute("data-bi-launcher-ready", "true");
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
              <BiAvatar
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
          data-bi-assistant
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusLauncherSoon();
          }}
          className="bb-floating-chat-panel left-0! right-0! top-0! bottom-0! flex h-dvh max-h-none! w-screen! max-w-none! translate-x-0! translate-y-0! flex-col overflow-hidden! rounded-none! border-0 bg-background p-0 max-md:data-[state=open]:zoom-in-100 max-md:data-[state=closed]:zoom-out-100 [&>button]:hidden md:left-auto! md:right-[var(--bb-floating-action-right)]! md:top-auto! md:bottom-[var(--bb-floating-chat-bottom)]! md:h-160! md:max-h-[calc(100dvh-6rem)]! md:w-106! md:border md:shadow-[var(--bb-shadow-md)]"
        >
          <DialogHeader className="shrink-0 border-x-0 border-t-0 border-b-4 border-chat bg-surface-dark px-4 pb-4 pt-[max(var(--bb-space-4),env(safe-area-inset-top))] text-primary-foreground md:pt-4">
            <div className="flex min-w-0 items-start gap-3">
              <BiAvatar
                size="header"
              />
              <div className="min-w-0 flex-1">
                <DialogTitle className="font-cta text-b4-action font-semibold uppercase tracking-wide text-primary-foreground">
                  {t("biTitle")}
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
              <BiAvatar
                size="header"
              />
              <Loader2 className="size-5 animate-spin text-chat" aria-hidden="true" />
              <p className="font-body text-a4-content text-muted-foreground">{t("checking")}</p>
            </div>
          ) : (
            <>
              <div
                ref={listRef}
                data-bi-conversation
                className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-secondary p-4"
                onScroll={onConversationScroll}
              >
                <div className="grid gap-4">
                  {messages.length === 0 ? (
                    <section data-bi-onboarding aria-labelledby="bi-onboarding-heading" className="border border-border bg-background p-4">
                      <div className="flex items-start gap-3">
                        <BiAvatar
                          size="header"
                        />
                        <div className="min-w-0">
                          <p className="font-cta text-b5-label font-semibold uppercase tracking-wide text-chat">{t("biTitle")}</p>
                          <h2 id="bi-onboarding-heading" className="mt-1 font-body text-a3-section font-semibold leading-title text-foreground">
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
                    const products = message.products?.slice(0, 3) || [];
                    return (
                      <div key={message.id} className={`flex gap-3 ${message.role === "USER" ? "justify-end" : "justify-start"}`}>
                        {message.role === "ASSISTANT" ? (
                          showAssistantAvatar ? (
                            <BiAvatar
                              size="message"
                            />
                          ) : <span className="size-9 shrink-0" aria-hidden="true" />
                        ) : null}
                        <div className="grid max-w-4/5 min-w-0 gap-2">
                          <div className={`border px-4 py-3 font-body text-a4-content leading-relaxed text-foreground ${message.role === "USER" ? "border-chat bg-cyan/10" : "border-border bg-background"}`}>
                            {message.content}
                          </div>
                          {products.length > 0 ? (
                            <div
                              data-bi-product-list
                              className={products.length > 1 ? "flex gap-3 overflow-x-auto snap-x pb-2" : "grid"}
                            >
                              {products.map((product) => (
                                <BiProductCard
                                  key={product.slug}
                                  product={product}
                                  locale={locale}
                                  compact={products.length > 1}
                                />
                              ))}
                            </div>
                          ) : null}
                          {message.actions?.length ? <ActionButtons actions={message.actions} locale={locale} /> : null}
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
                      <BiAvatar
                        size="message"
                      />
                      <div className="flex items-center gap-2 border border-border bg-background px-4 py-3 font-body text-a5-meta text-muted-foreground">
                        <Loader2 className="size-4 animate-spin text-chat" aria-hidden="true" />
                        {t("typing")}
                      </div>
                    </div>
                  ) : null}

                  {contactOpen ? (
                    <div id="bi-contact-inline" data-bi-contact-inline className="grid gap-3">
                      {messages.length > 0 ? (
                        <p className="border-l-4 border-chat bg-background p-3 font-body text-a5-meta leading-relaxed text-muted-foreground">
                          {t("contactContextPreserved")}
                        </p>
                      ) : null}
                      <BiContactPanel
                        contacts={effectiveContacts}
                        onRequestCallback={conversationId && leadPrompt && !leadCaptured && !leadDeclined
                          ? () => setShowContactLead(true)
                          : undefined}
                      />
                      {showContactLead && conversationId && leadPrompt && !leadCaptured && !leadDeclined ? (
                        <BiLeadForm
                          conversationId={conversationId}
                          draft={leadDraft}
                          onDraftChange={setLeadDraft}
                          onCaptured={handleLeadCaptured}
                          onDeclined={handleLeadDeclined}
                          accountContact={accountContact}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                data-bi-composer
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
                        ? void submitMessage(retryMessage.message, retryMessage.intent)
                        : void requestAvailability(true)}
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                      {t("retry")}
                    </Button>
                  </div>
                ) : null}

                {composerActions.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {composerActions.slice(0, 5).map((action) => (
                      <Button
                        key={action.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 max-w-full whitespace-normal px-3 text-center hover:scale-100"
                        disabled={sending || (action.kind === "MESSAGE" && serviceMode !== "AI")}
                        onClick={() => runComposerAction(action)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                ) : null}

                {remainingTurns > 0 && remainingTurns <= 3 ? (
                  <p className="mb-3 border border-state-warning bg-state-warning-bg p-3 font-body text-a5-meta text-foreground">
                    {t("remainingWarning", { count: remainingTurns })}
                  </p>
                ) : null}

                <form onSubmit={handleSubmit} className="flex items-end gap-2">
                  <Label htmlFor="bi-chat-message" className="sr-only">{t("messageLabel")}</Label>
                  <Input
                    ref={messageInputRef}
                    id="bi-chat-message"
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

                {!hasContactComposerAction ? (
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 px-3"
                      aria-label={contactOpen ? t("contactToggleClose") : t("talkToStaff")}
                      title={contactOpen ? t("contactToggleClose") : t("contactToggleOpen")}
                      aria-expanded={contactOpen}
                      aria-controls="bi-contact-inline"
                      onClick={toggleContact}
                    >
                      <Phone className="size-4" aria-hidden="true" />
                      {contactOpen ? t("contactToggleClose") : t("talkToStaff")}
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
