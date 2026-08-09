"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bot, Loader2, MessageCircle, MessagesSquare, Phone, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaImage } from "@/components/ui/MediaImage";
import { Textarea } from "@/components/ui/textarea";
import { ZaloIcon } from "@/components/ui/ZaloIcon";
import {
  captureChatLead,
  fetchChatAvailability,
  sendChatMessage,
  type ChatContact,
  type ChatProductCard,
} from "@/lib/api/client-api";
import { telHref } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

type FloatingChatProps = {
  hotline?: string;
  zaloUrl?: string;
  messengerUrl?: string;
  zaloDisplay?: string;
  messengerDisplay?: string;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  products?: ChatProductCard[];
};

type ContactItem = {
  key: "hotline" | "zalo" | "messenger";
  href: string;
  label: string;
  value: string;
  icon: ReactNode;
};

function extractDisplayValue(url: string): string {
  const match = /\/([^/?#]+)(?:[?#].*)?$/.exec(url);
  if (match?.[1]) return match[1];
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function mergeContacts(primary: ChatContact | undefined, fallback: ChatContact): ChatContact {
  return {
    hotline: primary?.hotline || fallback.hotline,
    zaloUrl: primary?.zaloUrl || fallback.zaloUrl,
    messengerUrl: primary?.messengerUrl || fallback.messengerUrl,
    zaloDisplay: primary?.zaloDisplay || fallback.zaloDisplay,
    messengerDisplay: primary?.messengerDisplay || fallback.messengerDisplay,
  };
}

function formatPrice(value: number | null | undefined, locale: Locale): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function ContactPanel({ contacts }: { contacts: ChatContact }) {
  const t = useTranslations("Support");
  const items = useMemo<ContactItem[]>(() => {
    const result: ContactItem[] = [];
    if (contacts.hotline && telHref(contacts.hotline) !== "tel:") {
      result.push({
        key: "hotline",
        href: telHref(contacts.hotline),
        label: t("hotline"),
        value: contacts.hotline.replace(/\s+/g, ""),
        icon: <Phone className="size-6" aria-hidden="true" />,
      });
    }
    if (contacts.zaloUrl) {
      result.push({
        key: "zalo",
        href: contacts.zaloUrl,
        label: t("zalo"),
        value: contacts.zaloDisplay?.trim() || extractDisplayValue(contacts.zaloUrl),
        icon: <ZaloIcon className="size-8" />,
      });
    }
    if (contacts.messengerUrl) {
      result.push({
        key: "messenger",
        href: contacts.messengerUrl,
        label: t("messenger"),
        value: contacts.messengerDisplay?.trim() || extractDisplayValue(contacts.messengerUrl),
        icon: <MessagesSquare className="size-6" aria-hidden="true" />,
      });
    }
    return result;
  }, [contacts, t]);

  return (
    <div className="grid gap-3 p-5">
      <div>
        <h3 className="font-body text-a3-section font-semibold text-foreground">{t("contactTitle")}</h3>
        <p className="mt-1 text-a5-meta text-muted-foreground">{t("contactDescription")}</p>
      </div>
      {items.length > 0 ? items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target={item.key === "hotline" ? undefined : "_blank"}
          rel={item.key === "hotline" ? undefined : "nofollow noreferrer"}
          className="flex min-h-14 items-center gap-3 border border-border bg-background px-4 py-3 text-foreground no-underline hover:border-primary hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center text-blue">{item.icon}</span>
          <span className="min-w-0 text-a4-content">
            {item.label}: <strong className="break-words">{item.value}</strong>
          </span>
        </a>
      )) : (
        <p className="border border-border bg-secondary p-4 text-a4-content text-muted-foreground">{t("contactUnavailable")}</p>
      )}
    </div>
  );
}

function ProductCard({ product, locale }: { product: ChatProductCard; locale: Locale }) {
  const t = useTranslations("Support");
  const price = product.salePrice ?? product.retailPrice;
  return (
    <article className="flex border border-border bg-background">
      <MediaImage
        image={product.imageUrl ? { url: product.imageUrl } : null}
        altFallback={product.name}
        width={160}
        height={160}
        className="aspect-square size-20 shrink-0 border-r border-border object-cover"
        sizes="80px"
      />
      <div className="min-w-0 p-3">
        <h4 className="line-clamp-2 text-a5-meta font-semibold text-foreground">{product.name}</h4>
        <p className="mt-1 text-a5-meta font-semibold text-primary">{formatPrice(price, locale) || t("priceUnavailable")}</p>
        <p className="mt-1 text-a5-meta text-muted-foreground">
          {product.stockState === "OUT_OF_STOCK" ? t("outOfStock") : t("inStock")}
        </p>
        <Button asChild variant="link" size="sm" className="mt-1">
          <a href={toProductPath(product.slug, locale)}>{t("viewProduct")}</a>
        </Button>
      </div>
    </article>
  );
}

function LeadForm({
  conversationId,
  onCaptured,
}: {
  conversationId: string;
  onCaptured: () => void;
}) {
  const t = useTranslations("Support");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phone.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await captureChatLead({
        conversationId,
        name: name.trim() || undefined,
        phone: phone.trim(),
        note: note.trim() || undefined,
      });
      onCaptured();
    } catch {
      setError(t("leadError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 border border-blue bg-blue/10 p-4">
      <div>
        <h3 className="text-a4-content font-semibold text-foreground">{t("leadTitle")}</h3>
        <p className="mt-1 text-a5-meta text-muted-foreground">{t("leadDescription")}</p>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="bi-lead-name">{t("leadName")}</Label>
        <Input id="bi-lead-name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="bi-lead-phone">{t("leadPhone")}</Label>
        <Input id="bi-lead-phone" type="tel" required value={phone} maxLength={32} onChange={(event) => setPhone(event.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="bi-lead-note">{t("leadNote")}</Label>
        <Textarea id="bi-lead-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} className="min-h-20" />
      </div>
      {error ? <p role="alert" className="text-a5-meta text-destructive">{error}</p> : null}
      <Button type="submit" size="sm" disabled={!phone.trim() || submitting}>
        {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {submitting ? t("leadSubmitting") : t("leadSubmit")}
      </Button>
    </form>
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
  const defaultGreeting = t("defaultGreeting");
  const activeLocale = useLocale() === "en" ? "en" : "vi";
  const locale = activeLocale as Locale;
  const fallbackContacts = useMemo<ChatContact>(() => ({
    hotline,
    zaloUrl,
    messengerUrl,
    zaloDisplay,
    messengerDisplay,
  }), [hotline, messengerDisplay, messengerUrl, zaloDisplay, zaloUrl]);
  const [open, setOpen] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [mode, setMode] = useState<"AI" | "CONTACT">("AI");
  const [contacts, setContacts] = useState<ChatContact>(fallbackContacts);
  const [greeting, setGreeting] = useState("");
  const [quickPrompts, setQuickPrompts] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [leadPrompt, setLeadPrompt] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [remainingTurns, setRemainingTurns] = useState(12);
  const listRef = useRef<HTMLDivElement>(null);
  const effectiveContacts = useMemo(
    () => mergeContacts(contacts, fallbackContacts),
    [contacts, fallbackContacts],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchChatAvailability(activeLocale)
      .then((availability) => {
        if (cancelled) return;
        const nextContacts = mergeContacts(availability.contacts, fallbackContacts);
        setContacts(nextContacts);
        setMode(availability.mode);
        setShowContacts(availability.mode !== "AI");
        setGreeting(availability.greeting?.trim() || defaultGreeting);
        setQuickPrompts((availability.quickPrompts || []).slice(0, 4));
        setRemainingTurns(availability.maxTurns || 12);
      })
      .catch(() => {
        if (cancelled) return;
        setMode("CONTACT");
        setShowContacts(true);
        setContacts(fallbackContacts);
      })
      .finally(() => { if (!cancelled) setLoadingAvailability(false); });
    return () => { cancelled = true; };
  }, [activeLocale, defaultGreeting, fallbackContacts, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [leadPrompt, messages, sending]);

  async function submitMessage(raw: string) {
    const message = raw.trim();
    if (!message || sending || mode !== "AI" || remainingTurns <= 0) return;
    setDraft("");
    setQuickPrompts([]);
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "USER", content: message }]);
    setSending(true);
    try {
      const response = await sendChatMessage(message, activeLocale, conversationId);
      setContacts(mergeContacts(response.contacts, fallbackContacts));
      if (response.mode !== "AI") {
        setMode("CONTACT");
        setShowContacts(true);
        return;
      }
      if (response.conversationId) setConversationId(response.conversationId);
      setRemainingTurns(response.remainingTurns);
      setLeadPrompt(Boolean(response.leadPrompt) && !leadCaptured);
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: "ASSISTANT",
        content: response.answer?.trim() || t("noInformation"),
        products: (response.products || []).slice(0, 3),
      }]);
    } catch {
      setMode("CONTACT");
      setShowContacts(true);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(draft);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setLoadingAvailability(true);
    setOpen(nextOpen);
  }

  const visibleMessages = messages.length > 0
    ? messages
    : [{ id: "greeting", role: "ASSISTANT" as const, content: greeting || defaultGreeting }];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div id="sudovn-btn-wrapper" dir="ltr" className="group relative flex flex-col-reverse items-end">
        <div className="absolute bottom-1/2 right-full mr-3 translate-y-1/2 whitespace-nowrap bg-chat px-2 py-1 font-cta text-b5-label uppercase text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:hidden">
          {t("needHelp")}
        </div>
        <DialogTrigger asChild>
          <Button
            type="button"
            size="icon"
            className="relative size-12 rounded-full! bg-chat text-primary-foreground shadow-lg hover:bg-chat hover:scale-[1.02] md:size-16"
            aria-label={t("open")}
          >
            <span className="absolute inset-0 rounded-full bg-chat opacity-30 motion-safe:animate-ping" aria-hidden="true" />
            <MessageCircle className="relative size-6 md:size-7" aria-hidden="true" />
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="bb-floating-chat-panel flex h-dvh max-h-none! w-full max-w-none! flex-col overflow-hidden rounded-none! border-0 p-0 left-0! top-0! right-0! bottom-0! translate-x-0! translate-y-0! md:left-auto! md:top-auto! md:right-[var(--bb-floating-action-right)]! md:bottom-[var(--bb-floating-chat-panel-bottom)]! md:h-[min(37.5rem,calc(100dvh-8rem))] md:w-105 md:rounded-none! md:border md:shadow-[var(--bb-shadow-lg)]">
        <DialogHeader className="shrink-0 border-0 bg-chat px-5 py-4 pr-14 text-primary-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-foreground text-chat" aria-hidden="true"><Bot className="size-5" /></span>
            <div>
              <DialogTitle className="font-cta text-b4-action uppercase tracking-wide text-primary-foreground">{t("biTitle")}</DialogTitle>
              <DialogDescription className="text-a5-meta text-primary-foreground">{t("aiDisclosure")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingAvailability ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center" role="status">
            <Loader2 className="size-7 animate-spin text-chat" aria-hidden="true" />
            <p className="text-a4-content text-muted-foreground">{t("checking")}</p>
          </div>
        ) : showContacts || mode === "CONTACT" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {mode === "CONTACT" ? <p className="mx-5 mt-5 border border-state-warning bg-state-warning-bg p-3 text-a5-meta text-foreground">{t("fallbackNotice")}</p> : null}
            <ContactPanel contacts={effectiveContacts} />
            {mode === "AI" ? (
              <div className="mt-auto border-t border-border p-4">
                <Button type="button" variant="secondary" className="w-full" onClick={() => setShowContacts(false)}>{t("backToBi")}</Button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto bg-secondary p-4" aria-live="polite">
              <div className="grid gap-4">
                {visibleMessages.map((message) => (
                  <div key={message.id} className={`flex gap-2 ${message.role === "USER" ? "justify-end" : "justify-start"}`}>
                    {message.role === "ASSISTANT" ? <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-chat text-primary-foreground" aria-hidden="true"><Bot className="size-4" /></span> : null}
                    <div className="grid max-w-4/5 gap-2">
                      <div className={`border p-3 text-a4-content leading-relaxed ${message.role === "USER" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}>
                        {message.content}
                      </div>
                      {message.products?.map((product) => <ProductCard key={product.slug} product={product} locale={locale} />)}
                    </div>
                    {message.role === "USER" ? <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background" aria-hidden="true"><UserRound className="size-4" /></span> : null}
                  </div>
                ))}
                {sending ? (
                  <div className="flex items-center gap-2 text-a5-meta text-muted-foreground" role="status">
                    <Loader2 className="size-4 animate-spin text-chat" aria-hidden="true" />
                    {t("typing")}
                  </div>
                ) : null}
                {leadPrompt && conversationId && !leadCaptured ? (
                  <LeadForm
                    conversationId={conversationId}
                    onCaptured={() => {
                      setLeadCaptured(true);
                      setLeadPrompt(false);
                      setMessages((current) => [...current, { id: `lead-${Date.now()}`, role: "ASSISTANT", content: t("leadSuccess") }]);
                    }}
                  />
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-border bg-background p-4">
              {quickPrompts.length > 0 ? (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {quickPrompts.map((prompt) => (
                    <Button key={prompt} type="button" variant="outline" size="sm" className="shrink-0 normal-case" onClick={() => void submitMessage(prompt)}>{prompt}</Button>
                  ))}
                </div>
              ) : null}
              {remainingTurns <= 0 ? <p className="mb-3 border border-state-warning bg-state-warning-bg p-3 text-a5-meta text-foreground">{t("turnLimit")}</p> : null}
              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <Label htmlFor="bi-chat-message" className="sr-only">{t("messageLabel")}</Label>
                <Input
                  id="bi-chat-message"
                  value={draft}
                  maxLength={1000}
                  disabled={sending || remainingTurns <= 0}
                  placeholder={t("messagePlaceholder")}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <Button type="submit" size="icon" disabled={!draft.trim() || sending || remainingTurns <= 0} aria-label={t("send")}>
                  <Send className="size-5" aria-hidden="true" />
                </Button>
              </form>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-a5-meta text-muted-foreground">{t("remainingTurns", { count: remainingTurns })}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowContacts(true)}>
                  <Phone className="size-4" aria-hidden="true" />{t("talkToStaff")}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
