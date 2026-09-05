"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ChangeEvent,
  type FormEvent,
  type UIEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ImagePlus, Loader2, MessageCircle, Phone, RefreshCw, Send, Trash2, X } from "lucide-react";
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
  deleteChatHistory,
  fetchChatAvailability,
  fetchChatImageBlob,
  fetchChatHistory,
  openChatSession,
  streamChatMessage,
  uploadChatImage,
  ApiClientError,
  type ChatAction,
  type ChatClarification,
  type ChatClarificationOption,
  type ChatClarificationSelection,
  type ChatContact,
  type ChatProgressCode,
  type ChatProductCard,
  type ChatImage,
  type ChatNextStep,
  type ChatSalesStage,
} from "@/lib/api/client-api";
import { useAuth } from "@/lib/auth/auth-store";
import { queryKeys } from "@/lib/query/keys";
import {
  CHAT_STORAGE_KEY,
  CHAT_STORAGE_TTL_MS,
  clearChatSnapshot,
  readChatSnapshot,
  writeChatSnapshot,
  type ChatPersistenceSnapshot,
} from "@/lib/chat/chat-persistence";
import {
  clearChatIdentity,
  readOrCreateChatIdentity,
  saveChatIdentityToken,
  type ChatIdentity,
} from "@/lib/chat/chat-identity";
import { toLoginPath, toOrderHistoryPath, toOrderLookupPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { BigBikeContactPanel } from "./floating-chat/BigBikeContactPanel";
import { BigBikeProductCard } from "./floating-chat/BigBikeProductCard";
import { SafeChatMarkdown } from "./floating-chat/SafeChatMarkdown";

type FloatingChatProps = {
  hotline?: string;
  zaloUrl?: string;
  messengerUrl?: string;
  zaloDisplay?: string;
  messengerDisplay?: string;
};

type PanelState = "closed" | "expanded";
type AvailabilityState = "idle" | "loading" | "ready" | "error";
type PromptIntent = "PRODUCT_FINDING" | "PRODUCT_ACTION" | "UNKNOWN";

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  sequenceNo?: number;
  products?: ChatProductCard[];
  crossSellProducts?: ChatProductCard[];
  salesStage?: ChatSalesStage;
  nextStep?: ChatNextStep;
  clarification?: ChatClarification;
  clarificationSelection?: ChatClarificationSelection;
  actions?: ChatAction[];
  noResults?: boolean;
  answerFormat?: "PLAIN_TEXT" | "MARKDOWN";
  resultKind?: string;
  animate?: boolean;
  requestId?: string;
  failed?: boolean;
  images?: ChatImage[];
  localImageUrl?: string;
};

type PendingChatImage = {
  file: File;
  previewUrl: string;
};

const DEFAULT_MAX_TURNS = 40;
export const CHAT_MESSAGE_TIMEOUT_MS = 75_000;

class ChatMessageTimeoutError extends Error {
  constructor() {
    super("Chat message request timed out");
    this.name = "ChatMessageTimeoutError";
  }
}

function PrivateChatImage({
  image,
  visitorToken,
  localUrl,
  alt,
}: {
  image: ChatImage;
  visitorToken?: string;
  localUrl?: string;
  alt: string;
}) {
  if (localUrl) {
    return <ChatImagePreview source={localUrl} alt={alt} />;
  }
  return <RemotePrivateChatImage image={image} visitorToken={visitorToken} alt={alt} />;
}

function RemotePrivateChatImage({
  image,
  visitorToken,
  alt,
}: {
  image: ChatImage;
  visitorToken?: string;
  alt: string;
}) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    void fetchChatImageBlob(image.id, visitorToken)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id, visitorToken]);

  if (failed) {
    return (
      <div className="flex min-h-24 items-center justify-center border border-border bg-muted p-3 text-center font-body text-a5-meta text-muted-foreground">
        {alt}
      </div>
    );
  }
  if (!source) {
    return (
      <div
        className="flex min-h-24 items-center justify-center border border-border bg-muted"
        role="status"
      >
        <Loader2 className="size-5 animate-spin text-chat" aria-hidden="true" />
      </div>
    );
  }
  return <ChatImagePreview source={source} alt={alt} />;
}

function ChatImagePreview({ source, alt }: { source: string; alt: string }) {
  return (
    <Image
      src={source}
      alt={alt}
      width={640}
      height={480}
      unoptimized
      className="h-auto max-h-64 w-full border border-border object-contain"
    />
  );
}
function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function")
    crypto.getRandomValues(bytes);
  else
    for (let index = 0; index < bytes.length; index += 1)
      bytes[index] = Math.floor(Math.random() * 256);
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
        {message.answerFormat === "MARKDOWN" ? (
          <SafeChatMarkdown content={displayContent} />
        ) : (
          displayContent
        )}
      </div>
    </>
  );
}

type BigBikeAvatarSize = "launcher" | "header" | "message";

const BIGBIKE_AVATAR_SIZES: Record<BigBikeAvatarSize, { className: string }> = {
  launcher: { className: "size-14 md:size-16" },
  header: { className: "size-11" },
  message: { className: "size-9" },
};

function BigBikeAvatar({ size }: { size: BigBikeAvatarSize }) {
  const avatar = BIGBIKE_AVATAR_SIZES[size];

  return (
    <span
      data-bigbike-avatar
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full! bg-chat text-primary-foreground ${avatar.className}`}
    >
      <MessageCircle
        className={size === "launcher" ? "size-6 md:size-7" : "size-4"}
        aria-hidden="true"
      />
    </span>
  );
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

function ClarificationButtons({
  clarification,
  disabled,
  onSelect,
}: {
  clarification: ChatClarification;
  disabled: boolean;
  onSelect: (option: ChatClarificationOption) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" data-bigbike-clarification-options>
      {clarification.options.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 h-auto whitespace-normal px-3 text-left"
          disabled={disabled}
          onClick={() => onSelect(option)}
        >
          {option.label}
          {option.count != null ? ` (${option.count})` : ""}
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
  const queryClient = useQueryClient();
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
  const fallbackContacts = useMemo<ChatContact>(
    () => ({
      hotline,
      zaloUrl,
      messengerUrl,
      zaloDisplay,
      messengerDisplay,
    }),
    [hotline, messengerDisplay, messengerUrl, zaloDisplay, zaloUrl],
  );

  const [panelState, setPanelState] = useState<PanelState>("closed");
  const [serviceMode, setServiceMode] = useState<"AI" | "CONTACT">("AI");
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("idle");
  const [contacts, setContacts] = useState<ChatContact>(fallbackContacts);
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
    clarificationSelection?: ChatClarificationSelection;
    image?: ChatImage;
    localImageUrl?: string;
  } | null>(null);
  const [progressCode, setProgressCode] = useState<ChatProgressCode | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string>();
  const [announcement, setAnnouncement] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);
  const [expandedProductMessages, setExpandedProductMessages] = useState<string[]>([]);
  const [visitorToken, setVisitorToken] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);
  /** CHAT_RULE_049: true once the customer has actually opened the chat panel. */
  const sessionStartedRef = useRef(false);
  const [imageSettings, setImageSettings] = useState({
    enabled: false,
    maxBytes: 8 * 1024 * 1024,
    maxPerTurn: 1,
    maxPerConversation: 3,
    dailyLimit: 20,
    disclosure: "",
  });
  const [pendingImage, setPendingImage] = useState<PendingChatImage | null>(null);
  const [imageError, setImageError] = useState("");

  const fabLauncherRef = useRef<HTMLButtonElement>(null);
  const launcherContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const availabilityBusyRef = useRef(false);
  const availabilityLocaleRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);
  const nearBottomRef = useRef(true);
  const hydratedRef = useRef(false);
  const persistenceReadyRef = useRef(false);
  const persistenceExpiresAtRef = useRef<number | null>(null);
  const restoredSessionRef = useRef(false);
  const expiryTimerRef = useRef<number | null>(null);
  const previousAuthStatusRef = useRef(auth.status);
  const conversationGenerationRef = useRef(0);
  const identityRef = useRef<ChatIdentity | undefined>(undefined);
  const localImageUrlsRef = useRef(new Set<string>());

  const effectiveContacts = useMemo(
    () => mergeContacts(contacts, fallbackContacts),
    [contacts, fallbackContacts],
  );

  const applyHistory = useCallback((history: Awaited<ReturnType<typeof fetchChatHistory>>) => {
    const mapped: ChatMessage[] = history.messages
      .filter((item) => item.content?.trim())
      .map((item) => ({
        id: item.id,
        sequenceNo: item.sequenceNo,
        role: item.role === "CUSTOMER" ? "USER" : item.role,
        content: item.content.trim(),
        answerFormat: item.answerFormat === "MARKDOWN" ? "MARKDOWN" : "PLAIN_TEXT",
        resultKind: item.resultKind || undefined,
        images: item.images || [],
      }));
    setMessages((current) =>
      mapped.map((item) => ({
        ...current.find((existing) => existing.id === item.id),
        ...item,
        animate: false,
      })),
    );
    setConversationId(history.conversationId);
    setServiceMode("AI");
  }, []);

  const syncHistory = useCallback(
    async (id: string, token?: string) => {
      try {
        const history = await fetchChatHistory(id, token, 0);
        if (mountedRef.current) applyHistory(history);
      } catch {
        // A push is only a refresh hint. The next reconnect or explicit open retries REST history.
      }
    },
    [applyHistory],
  );

  // CHAT_RULE_049: this runs when the customer opens the chat panel, never on page load, so a
  // visitor identifier is no longer created for everyone who merely browses the site.
  const initializeVisitorSession = useCallback(async () => {
    if (typeof window === "undefined") return;
    let identity = readOrCreateChatIdentity();
    identityRef.current = identity;
    try {
      let session;
      try {
        session = await openChatSession({
          visitorId: identity.visitorId,
          visitorToken: identity.visitorToken,
          locale: activeLocale,
        });
      } catch {
        clearChatIdentity();
        identity = readOrCreateChatIdentity();
        identityRef.current = identity;
        session = await openChatSession({
          visitorId: identity.visitorId,
          locale: activeLocale,
        });
      }
      if (!mountedRef.current) return;
      saveChatIdentityToken(session.visitorToken);
      identityRef.current = { ...identity, visitorToken: session.visitorToken };
      setVisitorToken(session.visitorToken);
      if (session.activeConversationId) {
        await syncHistory(session.activeConversationId, session.visitorToken);
      }
    } catch {
      // A failed session leaves the widget usable; the next send retries.
    }
  }, [activeLocale, syncHistory]);

  const clearConversation = useCallback(
    (closePanel = false) => {
      conversationGenerationRef.current += 1;
      clearChatSnapshot();
      persistenceExpiresAtRef.current = null;
      restoredSessionRef.current = false;
      availabilityLocaleRef.current = undefined;
      if (expiryTimerRef.current != null && typeof window !== "undefined") {
        window.clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
      setMessages([]);
      setConversationId(undefined);
      setDraft("");
      setPendingImage((current) => {
        if (current?.previewUrl) {
          URL.revokeObjectURL(current.previewUrl);
          localImageUrlsRef.current.delete(current.previewUrl);
        }
        return null;
      });
      for (const url of localImageUrlsRef.current) URL.revokeObjectURL(url);
      localImageUrlsRef.current.clear();
      setImageError("");
      setSending(false);
      setRemainingTurns(DEFAULT_MAX_TURNS);
      setServiceMode("AI");
      setAvailabilityState("idle");
      setContacts(fallbackContacts);
      setContactNotice("");
      setContactOpen(false);
      setRetryAvailable(false);
      setRetryMessage(null);
      setProgressCode(null);
      setPendingRequestId(undefined);
      setAnnouncement("");
      setConfirmDelete(false);
      if (closePanel) setPanelState("closed");
    },
    [fallbackContacts],
  );

  useEffect(() => {
    const localImageUrls = localImageUrlsRef.current;
    mountedRef.current = true;
    hydratedRef.current = true;
    launcherContainerRef.current?.setAttribute("data-bigbike-launcher-ready", "true");

    const snapshot = readChatSnapshot();
    persistenceReadyRef.current = true;
    if (snapshot) {
      restoredSessionRef.current = true;
      persistenceExpiresAtRef.current = snapshot.expiresAt;
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        setMessages(snapshot.messages);
        setConversationId(snapshot.conversationId);
        setRemainingTurns(snapshot.remainingTurns);
        setServiceMode(snapshot.serviceMode);
        setAvailabilityState("ready");
        setPendingRequestId(snapshot.pendingRequestId);
        if (snapshot.pendingRequestId) {
          const failedMessage = [...snapshot.messages]
            .reverse()
            .find(
              (item) =>
                item.role === "USER" && item.failed && item.requestId === snapshot.pendingRequestId,
            );
          if (failedMessage) {
            setRetryAvailable(true);
            setRetryMessage({
              message: failedMessage.content,
              intent: "UNKNOWN",
              requestId: snapshot.pendingRequestId,
              clarificationSelection: failedMessage.clarificationSelection,
              image: failedMessage.images?.[0],
            });
          }
        }
      });
    }

    return () => {
      mountedRef.current = false;
      for (const url of localImageUrls) URL.revokeObjectURL(url);
      localImageUrls.clear();
      if (expiryTimerRef.current != null && typeof window !== "undefined") {
        window.clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, []);

  // The session is opened by openPanel(), not on mount. Signing in or out while the panel is
  // already open still needs a refresh so the conversation follows the right owner.
  useEffect(() => {
    if (panelState === "closed" || !sessionStartedRef.current) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void initializeVisitorSession();
    });
    return () => {
      cancelled = true;
    };
  }, [auth.status, initializeVisitorSession, panelState]);

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
    if (!persistenceReadyRef.current) return;
    if (!conversationId || messages.length === 0) return;
    if (persistenceExpiresAtRef.current == null) {
      persistenceExpiresAtRef.current = Date.now() + CHAT_STORAGE_TTL_MS;
    }

    const snapshot: ChatPersistenceSnapshot = {
      version: 5,
      expiresAt: persistenceExpiresAtRef.current,
      locale: activeLocale,
      conversationId,
      messages: messages.slice(-64).map((message) => {
        const persistedMessage = { ...message };
        delete persistedMessage.localImageUrl;
        return persistedMessage;
      }),
      remainingTurns,
      serviceMode,
      pendingRequestId,
    };
    writeChatSnapshot(snapshot);
  }, [activeLocale, conversationId, messages, pendingRequestId, remainingTurns, serviceMode]);

  useEffect(() => {
    if (!persistenceReadyRef.current || !conversationId || persistenceExpiresAtRef.current == null)
      return;
    const checkExpiry = () => {
      const delay = (persistenceExpiresAtRef.current ?? 0) - Date.now();
      if (delay <= 0) {
        if (mountedRef.current) clearConversation(false);
        return;
      }
      // Browser timers overflow above roughly 24.8 days. Recheck daily so a
      // 30-day memory window never fires immediately on browsers or in tests.
      expiryTimerRef.current = window.setTimeout(checkExpiry, Math.min(delay, 24 * 60 * 60 * 1000));
    };
    checkExpiry();
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
  }, [contactOpen, messages, panelState, sending]);

  const requestAvailability = useCallback(
    async (force = false) => {
      if (availabilityBusyRef.current) return;
      if (!force && availabilityLocaleRef.current === activeLocale) return;

      availabilityBusyRef.current = true;
      availabilityLocaleRef.current = activeLocale;
      if (!restoredSessionRef.current) setAvailabilityState("loading");
      try {
        if (force)
          await queryClient.invalidateQueries({
            queryKey: queryKeys.chatAvailability(activeLocale),
          });
        const availability = await queryClient.fetchQuery({
          queryKey: queryKeys.chatAvailability(activeLocale),
          queryFn: () => fetchChatAvailability(activeLocale),
          staleTime: 5 * 60 * 1000,
          retry: false,
        });
        if (!mountedRef.current) return;
        const nextContacts = mergeContacts(availability.contacts, fallbackContacts);

        setContacts(nextContacts);
        setImageSettings({
          enabled: availability.images?.enabled === true,
          maxBytes: 8 * 1024 * 1024,
          maxPerTurn: 1,
          maxPerConversation: 3,
          dailyLimit: 20,
          disclosure: availability.images?.disclosure || t("imageDisclosure"),
        });
        if (!conversationId) setRemainingTurns(DEFAULT_MAX_TURNS);
        setAvailabilityState("ready");
        setRetryAvailable(false);
        setRetryMessage(null);
        setServiceMode(availability.mode);
        if (availability.mode === "AI") {
          setContactNotice("");
        } else {
          setContactNotice(t("fallbackNotice", { reason: "service" }));
        }
      } catch {
        if (!mountedRef.current) return;
        setAvailabilityState("error");
        setRetryAvailable(true);
        setRetryMessage(null);
        setServiceMode("CONTACT");
        setContacts(fallbackContacts);
        setImageSettings((current) => ({ ...current, enabled: false }));
        const notice = t("fallbackNotice", { reason: "network" });
        setContactNotice(notice);
        setAnnouncement(`${notice} ${t("contactStatus")}`);
      } finally {
        availabilityBusyRef.current = false;
      }
    },
    [activeLocale, conversationId, fallbackContacts, queryClient, t],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void requestAvailability();
    });
    return () => {
      cancelled = true;
    };
  }, [requestAvailability]);

  function focusLauncherSoon() {
    requestAnimationFrame(() => {
      fabLauncherRef.current?.focus();
    });
  }

  function openPanel() {
    setPanelState("expanded");
    setHasInteracted(true);
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      void initializeVisitorSession();
    }
    if (availabilityLocaleRef.current !== activeLocale) void requestAvailability();
  }

  function closePanel() {
    setPanelState("closed");
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) return;
    setPanelState("closed");
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
    setAnnouncement(
      products.length > 0
        ? `${message} ${t("productCountAnnouncement", { count: products.length })}`
        : message,
    );
  }

  async function submitMessage(
    raw: string,
    intent: PromptIntent = "UNKNOWN",
    existingRequestId?: string,
    clarificationSelection?: ChatClarificationSelection,
    attachedImage?: PendingChatImage,
    uploadedImage?: ChatImage,
    uploadedImageLocalUrl?: string,
  ) {
    const message = raw.trim();
    if ((!message && !attachedImage && !uploadedImage) || sending || serviceMode !== "AI") return;

    const requestId = existingRequestId ?? createRequestId();
    const isRetry = Boolean(existingRequestId);
    const userMessageId = nextMessageId("user");
    const conversationGeneration = conversationGenerationRef.current;
    let turnImage = uploadedImage;
    let turnImageLocalUrl = uploadedImageLocalUrl;
    let turnConversationId = conversationId;
    let userMessageVisible = isRetry;
    if (!attachedImage) setDraft("");
    setSending(true);
    setRetryAvailable(false);
    setRetryMessage(null);
    setContactNotice("");
    setAnnouncement("");
    setProgressCode("UNDERSTANDING");
    setPendingRequestId(requestId);
    nearBottomRef.current = true;

    try {
      if (attachedImage && !turnImage) {
        const upload = await uploadChatImage({
          file: attachedImage.file,
          requestId: createRequestId(),
          conversationId,
          lang: activeLocale,
          visitorToken,
        });
        if (!mountedRef.current || conversationGeneration !== conversationGenerationRef.current)
          return;
        turnImage = upload.image;
        turnImageLocalUrl = attachedImage.previewUrl;
        turnConversationId = upload.conversationId;
        setConversationId(upload.conversationId);
        setPendingImage(null);
        setImageError("");
        setDraft("");
      }

      setMessages((current) => {
        const existing = current.some((item) => item.requestId === requestId);
        if (isRetry && existing) {
          return current.map((item) =>
            item.requestId === requestId ? { ...item, failed: false } : item,
          );
        }
        return [
          ...current,
          {
            id: userMessageId,
            role: "USER",
            content: message || t("imageSent"),
            requestId,
            clarificationSelection,
            images: turnImage ? [turnImage] : [],
            localImageUrl: turnImageLocalUrl,
          },
        ];
      });
      userMessageVisible = true;

      const controller = new AbortController();
      let timeoutId: number | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          controller.abort();
          reject(new ChatMessageTimeoutError());
        }, CHAT_MESSAGE_TIMEOUT_MS);
      });
      const onProgress = (code: ChatProgressCode) => {
        if (mountedRef.current && conversationGeneration === conversationGenerationRef.current)
          setProgressCode(code);
      };
      const request = turnImage
        ? streamChatMessage(
            message,
            activeLocale,
            turnConversationId,
            requestId,
            onProgress,
            controller.signal,
            pageContext,
            clarificationSelection,
            visitorToken,
            [turnImage.id],
          )
        : streamChatMessage(
            message,
            activeLocale,
            turnConversationId,
            requestId,
            onProgress,
            controller.signal,
            pageContext,
            clarificationSelection,
            visitorToken,
          );
      const response = await Promise.race([request, timeout]).finally(() => {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      });
      if (!mountedRef.current || conversationGeneration !== conversationGenerationRef.current)
        return;
      const nextProducts = (response.products || []).slice(0, 8);
      const nextRemainingTurns = validTurnCount(
        response.turnsRemaining,
        validTurnCount(response.remainingTurns, 0),
      );
      const answer =
        response.answer?.trim() ||
        (response.mode === "CONTACT" ? t("inputLockedExplanation") : t("noInformation"));
      if (answer) {
        const assistantMessageId = response.assistantMessageId || nextMessageId("assistant");
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: "ASSISTANT",
          content: answer,
          products: nextProducts,
          crossSellProducts: response.crossSellProducts,
          salesStage: response.salesStage,
          nextStep: response.nextStep ?? undefined,
          clarification: response.clarification ?? undefined,
          actions: response.clarification ? [] : response.actions,
          noResults:
            intent === "PRODUCT_FINDING" &&
            nextProducts.length === 0 &&
            !response.clarification &&
            response.resultKind !== "CLARIFICATION",
          answerFormat: response.answerFormat,
          resultKind: response.resultKind,
          animate: true,
        };
        setMessages((current) => [...current, assistantMessage]);
        announceAssistant(answer, nextProducts);
      }
      setContacts(mergeContacts(response.contacts, fallbackContacts));
      if (response.conversationId) setConversationId(response.conversationId);
      setRemainingTurns(nextRemainingTurns);
      setRetryAvailable(false);
      setPendingRequestId(undefined);

      if (response.mode === "CONTACT") {
        setServiceMode("CONTACT");
        setContactNotice(answer || t("uncertainty"));
        setAnnouncement(`${answer || t("uncertainty")} ${t("contactStatus")}`);
      } else {
        setServiceMode("AI");
        setContactNotice(
          response.continuation?.available
            ? response.continuation.message || t("conversationContinued")
            : "",
        );
      }
    } catch (error) {
      if (!mountedRef.current || conversationGeneration !== conversationGenerationRef.current)
        return;
      if (!userMessageVisible) {
        const notice =
          error instanceof ApiClientError
            ? error.code === "CHAT_IMAGE_TOO_LARGE" || error.status === 413
              ? t("imageTooLarge")
              : error.code === "CHAT_IMAGE_UNSUPPORTED_TYPE" || error.status === 415
                ? t("imageUnsupported")
                : error.code === "CHAT_IMAGE_DAILY_LIMIT" || error.status === 429
                  ? t("imageDailyLimitReached")
                  : error.code === "CHAT_IMAGE_CONVERSATION_LIMIT"
                    ? t("imageConversationLimit")
                    : error.code === "CHAT_IMAGE_UNAVAILABLE"
                      ? t("imageUnavailable")
                      : t("imageInvalid")
            : t("imageUploadFailed");
        setImageError(notice);
        setContactNotice(notice);
        setPendingRequestId(undefined);
        return;
      }
      setMessages((current) =>
        current.map((item) => (item.requestId === requestId ? { ...item, failed: true } : item)),
      );
      setDraft(message);
      setAvailabilityState("error");
      setRetryAvailable(true);
      setRetryMessage({
        message,
        intent,
        requestId,
        clarificationSelection,
        image: turnImage,
        localImageUrl: turnImageLocalUrl,
      });
      setPendingRequestId(requestId);
      const notice =
        error instanceof ChatMessageTimeoutError
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
    void submitMessage(draft, "UNKNOWN", undefined, undefined, pendingImage || undefined);
  }

  function clearPendingImage() {
    setPendingImage((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
        localImageUrlsRef.current.delete(current.previewUrl);
      }
      return null;
    });
    setImageError("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !imageSettings.enabled) return;
    setImageError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError(t("imageUnsupported"));
      return;
    }
    if (file.size <= 0 || file.size > imageSettings.maxBytes) {
      setImageError(
        t("imageTooLarge", {
          maxMb: Math.max(1, Math.floor(imageSettings.maxBytes / (1024 * 1024))),
        }),
      );
      return;
    }
    clearPendingImage();
    const previewUrl = URL.createObjectURL(file);
    localImageUrlsRef.current.add(previewUrl);
    setPendingImage({ file, previewUrl });
    setImageError("");
  }

  function toggleContact() {
    setContactOpen((current) => !current);
  }

  async function handleDeleteHistory() {
    if (deletingHistory) return;
    setDeletingHistory(true);
    try {
      await deleteChatHistory(visitorToken);
      clearConversation(false);
      clearChatIdentity();
      setVisitorToken(undefined);
      setConfirmDelete(false);
      await initializeVisitorSession();
    } catch {
      if (mountedRef.current) setContactNotice(t("historyDeleteError"));
    } finally {
      if (mountedRef.current) setDeletingHistory(false);
    }
  }

  const displayMessages = messages;
  const latestMessage = displayMessages[displayMessages.length - 1];

  function handleClarification(message: ChatMessage, option: ChatClarificationOption) {
    if (!message.clarification || sending || latestMessage?.id !== message.id) return;
    void submitMessage(option.label, "PRODUCT_FINDING", undefined, {
      clarificationId: message.clarification.id,
      optionId: option.id,
    });
  }

  function actionLabel(type: ChatAction["type"]): string {
    switch (type) {
      case "COMPARE_PRODUCTS":
        return t("actionCompareProducts");
      case "CHECK_SIZE":
        return t("actionCheckSize");
      case "CHECK_STOCK":
        return t("actionCheckStock");
      case "CHANGE_BUDGET":
        return t("actionChangeBudget");
      case "FIND_SIMILAR":
        return t("actionFindSimilar");
      case "VIEW_POLICY":
        return t("actionViewPolicy");
      case "FIND_PRODUCTS":
        return t("actionFindProducts");
      case "RELATED_ARTICLE_QUESTION":
        return t("actionRelatedArticle");
      case "CHANGE_NEEDS":
        return t("actionChangeNeeds");
      case "LOGIN":
        return t("orderLogin");
      case "ORDER_HISTORY":
        return t("orderHistory");
      case "ORDER_LOOKUP":
        return t("orderLookup");
      case "CALL_HOTLINE":
        return t("actionCallHotline");
      case "OPEN_ZALO":
        return t("openZalo");
      case "OPEN_MESSENGER":
        return t("openMessenger");
    }
  }

  function actionIntent(type: ChatAction["type"]): PromptIntent {
    if (type === "COMPARE_PRODUCTS") return "PRODUCT_ACTION";
    if (
      [
        "CHECK_SIZE",
        "CHECK_STOCK",
        "CHANGE_BUDGET",
        "FIND_SIMILAR",
        "FIND_PRODUCTS",
        "CHANGE_NEEDS",
      ].includes(type)
    )
      return "PRODUCT_FINDING";
    return "UNKNOWN";
  }

  async function handleIssuedAction(action: ChatAction) {
    if (sending) return;
    setContactNotice("");
    try {
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
      } else {
        await submitMessage(actionLabel(action.type), actionIntent(action.type));
      }
    } catch {
      if (mountedRef.current) setContactNotice(t("fallbackNotice", { reason: "network" }));
    }
  }

  const statusLabel = serviceMode === "CONTACT" ? t("contactStatus") : t("aiStatus");
  const composerLocked = sending || !visitorToken || serviceMode !== "AI";

  function renderFab() {
    const tooltipId = "bigbike-fab-tooltip";
    return (
      <div
        ref={registerLauncherContainer}
        id="bb-floating-chat-trigger"
        dir="ltr"
        className="group relative flex flex-col-reverse items-end"
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
          aria-label={t("open")}
          aria-describedby={tooltipId}
          onClick={openPanel}
        >
          {!hasInteracted ? (
            <span
              className="pointer-events-none absolute inset-0 -z-10 rounded-full! border border-chat motion-safe:animate-[bb-chat-halo_3.6s_ease-out_infinite] motion-reduce:hidden"
              aria-hidden="true"
            />
          ) : null}
          <BigBikeAvatar size="launcher" />
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

      <Dialog modal={false} open={panelState === "expanded"} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          data-bigbike-assistant
          overlayClassName="md:hidden"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusLauncherSoon();
          }}
          className="bb-floating-chat-panel left-0! right-0! top-0! bottom-0! flex h-dvh max-h-none! w-screen! max-w-none! translate-x-0! translate-y-0! flex-col overflow-hidden! rounded-none! border-0 bg-background p-0 max-md:data-[state=open]:zoom-in-100 max-md:data-[state=closed]:zoom-out-100 [&>button]:hidden md:left-auto! md:right-[var(--bb-floating-action-right)]! md:top-auto! md:bottom-[var(--bb-floating-chat-bottom)]! md:h-[var(--bb-floating-chat-panel-height)]! md:max-h-[calc(100dvh-var(--bb-floating-chat-bottom))]! md:w-106! md:border md:shadow-[var(--bb-shadow-md)]"
        >
          <DialogHeader
            data-bigbike-chat-header
            className="shrink-0 gap-1 border-x-0 border-t-0 border-b-4 border-chat bg-surface-dark px-3 py-3 text-primary-foreground"
          >
            <div className="flex min-w-0 items-center gap-2">
              <BigBikeAvatar size="header" />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <DialogTitle className="font-cta text-b4-action font-semibold uppercase tracking-wide">
                  {t("bigbikeTitle")}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full! bg-chat" aria-hidden="true" />
                  <span className="font-cta text-b5-label font-semibold uppercase tracking-wide">
                    {statusLabel}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 min-h-11 shrink-0 border border-primary-foreground/60 p-0 text-primary-foreground hover:scale-100 hover:bg-primary-foreground/10"
                aria-label={t("close")}
                onClick={closePanel}
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            </div>
            <DialogDescription className="font-body text-a5-meta leading-relaxed opacity-80">
              {t("aiDisclosure")}
            </DialogDescription>
          </DialogHeader>

          {/*
            CHAT_RULE_049 (owner decision 2026-09-05): no memory disclosure line and no memory
            on/off switch — the assistant only remembers inside this browser session, so there is
            nothing left to turn off. The delete control stays, with its confirmation.
          */}
          <div data-bigbike-memory-bar className="shrink-0 border-b border-border bg-background">
            <div className="flex items-stretch justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 min-h-11 shrink-0 rounded-none border-l border-border p-0 hover:scale-100 hover:bg-secondary"
                aria-label={t("deleteConversation")}
                title={t("deleteConversation")}
                aria-expanded={confirmDelete}
                aria-controls="bigbike-memory-details"
                onClick={() => setConfirmDelete((current) => !current)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div
              id="bigbike-memory-details"
              className="border-t border-border px-4 py-3"
              hidden={!confirmDelete}
            >
              <div className="border border-state-warning bg-state-warning-bg p-3" role="alert">
                <p className="m-0 font-body text-a5-meta font-semibold text-foreground">
                  {t("confirmDeleteHistory")}
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deletingHistory}
                    onClick={() => setConfirmDelete(false)}
                  >
                    {t("cancelDeleteHistory")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={deletingHistory}
                    onClick={() => void handleDeleteHistory()}
                  >
                    {deletingHistory ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-4" aria-hidden="true" />
                    )}
                    {deletingHistory ? t("deletingHistory") : t("confirmDeleteAction")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>

          <div className="relative min-h-0 flex-1">
            {availabilityState === "loading" ? (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-secondary/95 p-6 text-center"
                role="status"
              >
                <BigBikeAvatar size="header" />
                <Loader2 className="size-5 animate-spin text-chat" aria-hidden="true" />
                <p className="font-body text-a4-content text-muted-foreground">{t("checking")}</p>
              </div>
            ) : null}
            <div
              ref={listRef}
              data-bigbike-conversation
              className="h-full overflow-x-hidden overflow-y-auto overscroll-contain bg-secondary p-4"
              onScroll={onConversationScroll}
            >
              <div className="grid gap-4">
                {displayMessages.map((message, index) => {
                  if (message.role === "SYSTEM") {
                    return (
                      <div key={message.id} className="flex justify-center">
                        <p className="m-0 max-w-4/5 border border-border bg-background px-3 py-2 text-center font-body text-a5-meta leading-relaxed text-muted-foreground">
                          {message.content}
                        </p>
                      </div>
                    );
                  }
                  const showAssistantAvatar =
                    message.role === "ASSISTANT" &&
                    (index === 0 || displayMessages[index - 1]?.role !== "ASSISTANT");
                  const products = message.products?.slice(0, 8) || [];
                  const crossSellProducts = message.crossSellProducts?.slice(0, 2) || [];
                  const expanded = expandedProductMessages.includes(message.id);
                  const visibleProducts = expanded ? products : products.slice(0, 3);
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === "USER" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "ASSISTANT" ? (
                        showAssistantAvatar ? (
                          <BigBikeAvatar size="message" />
                        ) : (
                          <span className="size-9 shrink-0" aria-hidden="true" />
                        )
                      ) : null}
                      <div
                        className={
                          message.role === "USER"
                            ? "grid max-w-4/5 min-w-0 gap-2"
                            : "grid min-w-0 flex-1 gap-2"
                        }
                      >
                        <div
                          className={`border px-4 py-3 font-body text-a5-meta leading-relaxed text-foreground ${message.role === "USER" ? "border-chat bg-cyan/10" : "border-border bg-background"}`}
                        >
                          {message.images?.length ? (
                            <div className="mb-3 grid gap-2" data-chat-customer-images>
                              {message.images.map((image, imageIndex) => (
                                <PrivateChatImage
                                  key={image.id}
                                  image={image}
                                  visitorToken={visitorToken}
                                  localUrl={imageIndex === 0 ? message.localImageUrl : undefined}
                                  alt={t("customerImageAlt")}
                                />
                              ))}
                            </div>
                          ) : null}
                          {message.role === "ASSISTANT" ? (
                            <AssistantAnswer message={message} />
                          ) : (
                            message.content
                          )}
                        </div>
                        {message.role === "ASSISTANT" && message.clarification ? (
                          <ClarificationButtons
                            clarification={message.clarification}
                            disabled={sending || latestMessage?.id !== message.id}
                            onSelect={(option) => handleClarification(message, option)}
                          />
                        ) : null}
                        {products.length > 0 ? (
                          <div data-bigbike-product-list className="grid min-w-0 gap-3">
                            {visibleProducts.map((product) => (
                              <BigBikeProductCard
                                key={product.slug}
                                product={product}
                                locale={locale}
                              />
                            ))}
                            {products.length > 3 ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-h-11 w-full"
                                onClick={() =>
                                  setExpandedProductMessages((current) =>
                                    expanded
                                      ? current.filter((id) => id !== message.id)
                                      : [...current, message.id],
                                  )
                                }
                              >
                                {expanded
                                  ? t("showFewerProducts")
                                  : t("viewMoreProducts", { count: products.length - 3 })}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                        {crossSellProducts.length > 0 ? (
                          <section className="grid min-w-0 gap-3 border-l-4 border-chat bg-background p-3">
                            <h3 className="font-cta text-b5-label font-semibold uppercase tracking-wide text-foreground">
                              {t("relatedAccessories")}
                            </h3>
                            {crossSellProducts.map((product) => (
                              <BigBikeProductCard
                                key={`cross-${product.slug}`}
                                product={product}
                                locale={locale}
                              />
                            ))}
                          </section>
                        ) : null}
                        {!message.clarification && message.actions?.length ? (
                          <ActionButtons
                            actions={message.actions}
                            disabled={sending}
                            labelFor={actionLabel}
                            onAction={(action) => void handleIssuedAction(action)}
                          />
                        ) : null}
                        {message.noResults ? (
                          <div className="border-l-4 border-chat bg-background p-4">
                            <p className="font-body text-a4-content font-semibold text-foreground">
                              {t("noResults")}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {sending ? (
                  <div className="flex items-start gap-3" role="status">
                    <BigBikeAvatar size="message" />
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

                {contactOpen ? (
                  <div
                    id="bigbike-contact-inline"
                    data-bigbike-contact-inline
                    className="grid gap-3"
                  >
                    {messages.length > 0 ? (
                      <p className="border-l-4 border-chat bg-background p-3 font-body text-a5-meta leading-relaxed text-muted-foreground">
                        {t("contactContextPreserved")}
                      </p>
                    ) : null}
                    <BigBikeContactPanel contacts={effectiveContacts} />
                  </div>
                ) : null}
              </div>
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
                  onClick={() =>
                    retryMessage
                      ? void submitMessage(
                          retryMessage.message,
                          retryMessage.intent,
                          retryMessage.requestId,
                          retryMessage.clarificationSelection,
                          undefined,
                          retryMessage.image,
                          retryMessage.localImageUrl,
                        )
                      : void requestAvailability(true)
                  }
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

            {pendingImage ? (
              <div
                className="mb-3 flex items-start gap-3 border border-border bg-muted p-3"
                data-chat-pending-image
              >
                <Image
                  src={pendingImage.previewUrl}
                  alt={t("selectedImageAlt")}
                  width={80}
                  height={80}
                  unoptimized
                  className="size-20 shrink-0 border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-a5-meta font-semibold text-foreground">
                    {pendingImage.file.name}
                  </p>
                  <p className="mt-1 font-body text-a5-meta text-muted-foreground">
                    {t("selectedImageReady")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 min-h-11 shrink-0 p-0"
                  onClick={clearPendingImage}
                  disabled={sending}
                  aria-label={t("removeSelectedImage")}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ) : null}

            {imageError ? (
              <p
                className="mb-3 border border-destructive bg-destructive/5 p-3 font-body text-a5-meta text-destructive"
                role="alert"
              >
                {imageError}
              </p>
            ) : null}

            {imageSettings.enabled ? (
              <p
                className="mb-3 font-body text-a5-meta leading-relaxed text-muted-foreground"
                data-chat-image-disclosure
              >
                {imageSettings.disclosure || t("imageDisclosure")}
              </p>
            ) : null}

            <form onSubmit={handleSubmit} className="flex min-w-0 items-end gap-2">
              {imageSettings.enabled ? (
                <>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleImageSelection}
                    disabled={composerLocked || Boolean(pendingImage)}
                    aria-label={t("chooseImage")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-12 min-h-12 shrink-0 p-0"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={composerLocked || Boolean(pendingImage)}
                    aria-label={t("chooseImage")}
                    title={t("chooseImageHint", {
                      maxMb: Math.max(1, Math.floor(imageSettings.maxBytes / (1024 * 1024))),
                    })}
                  >
                    <ImagePlus className="size-5" aria-hidden="true" />
                  </Button>
                </>
              ) : null}
              <Label htmlFor="bigbike-chat-message" className="sr-only">
                {t("messageLabel")}
              </Label>
              <Input
                ref={messageInputRef}
                id="bigbike-chat-message"
                className="min-w-0 flex-1"
                value={draft}
                maxLength={1000}
                disabled={composerLocked}
                placeholder={
                  serviceMode === "CONTACT"
                    ? t("messagePlaceholderLocked")
                    : t("messagePlaceholder")
                }
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button
                type="submit"
                size="icon"
                className="size-12 min-h-12 shrink-0 p-0"
                disabled={(!draft.trim() && !pendingImage) || composerLocked}
                aria-label={t("send")}
              >
                {sending ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-5" aria-hidden="true" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12 min-h-12 shrink-0 p-0"
                aria-label={contactOpen ? t("contactToggleClose") : t("contactToggleOpen")}
                title={contactOpen ? t("contactToggleClose") : t("contactToggleOpen")}
                aria-expanded={contactOpen}
                aria-controls="bigbike-contact-inline"
                onClick={toggleContact}
              >
                <Phone className="size-4" aria-hidden="true" />
                <span className="sr-only">
                  {contactOpen ? t("contactToggleClose") : t("contactToggleOpen")}
                </span>
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
