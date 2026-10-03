"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactChannels, type ContactChannelsData } from "@/components/contact/ContactChannels";
import { CONTACT_OPEN_EVENT, hideFloatingContactLauncher } from "@/lib/contact/contact-launcher";
import { cn } from "@/lib/utils";

const fabButton =
  "relative flex size-[var(--bb-floating-contact-size)] items-center justify-center rounded-full! border-0 p-0 shadow-none hover:not-disabled:scale-100 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-primary-foreground focus-visible:outline-offset-3";

function OpenIcon() {
  return (
    <svg
      className="size-7"
      width="28"
      height="28"
      viewBox="0 0 28 29"
      fill="none"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M14 3C8 3 3 7.5 3 13c0 3.2 1.6 6 4.1 7.9V25l3.8-2.1c1 .2 2 .3 3.1.3 6 0 11-4.5 11-10S20 3 14 3Z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="size-7.25"
      width="29"
      height="29"
      viewBox="0 0 29 29"
      fill="none"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M18.866 14.45l9.58-9.582L24.03.448l-9.587 9.58L4.873.447.455 4.866l9.575 9.587-9.583 9.57 4.418 4.42 9.58-9.577 9.58 9.58 4.42-4.42"
      />
    </svg>
  );
}

/** CHAT_RULE_070: this widget opens direct contact links and makes no chat requests. */
export function FloatingContact(contacts: Readonly<ContactChannelsData>) {
  const t = useTranslations("Support");
  const pathname = usePathname();
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const launcher = useRef<HTMLDivElement>(null);
  const openingButton = useRef<HTMLElement | null>(null);
  const open = openedPath === pathname;

  useEffect(() => {
    for (const storageName of ["localStorage", "sessionStorage"] as const) {
      try {
        const storage = window[storageName];
        for (const key of [
          "bb_ai_chat_session_v1",
          "bb_chat_visitor_id_v1",
          "bb_chat_visitor_token_v1",
          "bb_chat_memory_enabled_v1",
        ]) {
          storage.removeItem(key);
        }
      } catch {
        // Browser storage can be disabled; contact links still remain available.
      }
    }
    launcher.current?.setAttribute("data-bigbike-contact-ready", "true");
    const showContacts = (event: Event) => {
      const trigger = (event as CustomEvent<HTMLElement>).detail;
      if (trigger instanceof HTMLElement) openingButton.current = trigger;
      setOpenedPath(pathname);
    };
    window.addEventListener(CONTACT_OPEN_EVENT, showContacts);
    return () => window.removeEventListener(CONTACT_OPEN_EVENT, showContacts);
  }, [pathname]);

  return (
    <Dialog open={open} onOpenChange={(value) => setOpenedPath(value ? pathname : null)}>
      {!hideFloatingContactLauncher(pathname) ? (
        <div
          ref={launcher}
          id="bb-floating-contact-trigger"
          dir="ltr"
          className={cn(
            "group relative font-body motion-reduce:animate-none",
            open ? "invisible" : "[animation:b24-widget-button-visible_1s_ease-out_forwards_1]",
          )}
        >
          <span
            id="bigbike-contact-tooltip"
            role="tooltip"
            className="pointer-events-none absolute bottom-1/2 right-full mr-3 translate-y-1/2 whitespace-nowrap rounded-[var(--bb-contact-hint-radius)]! bg-chat px-[var(--bb-contact-detail-gap)] py-0.5 font-body text-a5-meta text-primary-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 max-md:hidden"
          >
            {t("fabTooltip")}
          </span>
          <span
            className="pointer-events-none absolute inset-0 rounded-full! bg-chat opacity-0 [animation:bb-contact-halo_2.4s_ease-out_infinite] motion-reduce:hidden"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute inset-0 rounded-full! bg-chat opacity-0 [animation:bb-contact-halo_2.4s_ease-out_1.2s_infinite] motion-reduce:hidden"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -inset-1.5 rounded-full! bg-chat opacity-10"
            aria-hidden="true"
          />
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(fabButton, "bg-chat text-primary-foreground hover:bg-chat")}
              aria-label={t("open")}
              aria-describedby="bigbike-contact-tooltip"
              onClick={(event) => {
                openingButton.current = event.currentTarget;
              }}
            >
              <OpenIcon />
            </Button>
          </DialogTrigger>
        </div>
      ) : null}
      <DialogContent
        id="bigbike-contact-panel"
        data-bigbike-contact
        showCloseButton={false}
        overlayClassName="bg-[var(--bb-contact-overlay)] backdrop-blur-[var(--bb-contact-overlay-blur)] md:bg-transparent md:backdrop-blur-none data-[state=open]:animate-none! data-[state=closed]:animate-none!"
        className="left-auto! right-[var(--bb-floating-action-right)]! top-auto! bottom-[calc(var(--bb-floating-contact-bottom)_+_var(--bb-floating-contact-size)_+_var(--bb-space-2))]! w-[min(86vw,20rem)] min-w-75 max-w-none max-h-none overflow-visible! translate-none! transform-none! rounded-[var(--bb-contact-card-radius)]! border-0 bg-white py-2 text-[var(--bb-contact-text)] shadow-[var(--bb-contact-card-shadow)] data-[state=open]:animate-none! data-[state=closed]:animate-none! before:absolute before:-bottom-1.75 before:right-6.25 before:border-x-8 before:border-x-transparent before:border-t-8 before:border-t-white before:content-['']"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openingButton.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">{t("contactTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("contactDescription")}</DialogDescription>
        <ContactChannels contacts={contacts} />
        <div
          dir="ltr"
          className="fixed right-[var(--bb-floating-action-right)] bottom-[var(--bb-floating-contact-bottom)]"
        >
          <span
            className="pointer-events-none absolute -inset-1.5 rounded-full! bg-[var(--bb-contact-close-bg)] opacity-10"
            aria-hidden="true"
          />
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                fabButton,
                "bg-[var(--bb-contact-close-bg)] text-[var(--bb-contact-close-text)] transition-colors duration-300 ease-linear hover:bg-[var(--bb-contact-close-bg)]",
              )}
              aria-label={t("close")}
            >
              <span className="flex size-full items-center justify-center [animation:socialRotate_0.4s] motion-reduce:animate-none">
                <CloseIcon />
              </span>
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
