"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { performLogout, useAuth } from "@/lib/auth/auth-store";
import { cn } from "@/lib/utils";
import {
  getSafeLoginHref,
  toAccountPath,
  toRegisterPath,
} from "@/lib/utils/routes";

const CLOSE_DELAY_MS = 100;

// Trigger + dropdown content. The stateful dropdown SHELL stays as CSS:
// bb-header-user (position anchor + ≤1260px hide) and bb-header-user-menu
// (::before caret, ::after hover-bridge, .is-open transition, reduced-motion).
const trigger =
  "inline-flex min-h-[var(--bb-header-height)] border-none bg-transparent text-white cursor-pointer transition-colors duration-[var(--bb-duration-fast)] ease-[var(--bb-ease-standard)] hover:text-[var(--bb-brand-primary)] hover:bg-white/5 focus-visible:text-[var(--bb-brand-primary)] focus-visible:bg-white/5 focus-visible:outline-none";
const triggerGuest = "items-center justify-center px-[clamp(10px,0.9vw,16px)] py-0";
const triggerAuth = "w-[132px] flex-col items-start justify-center gap-[2px] pt-5 px-4 pb-4 text-left";
const menuLink =
  "flex w-full h-11 items-center justify-center border-none bg-[#111111] font-cta text-[14px] font-semibold tracking-[0.06em] leading-none uppercase cursor-pointer !text-white !no-underline visited:!text-white transition-colors duration-[var(--bb-duration-fast)] ease-[var(--bb-ease-standard)] focus-visible:outline-none";
const menuLinkPrimary =
  "bg-brand hover:bg-[var(--bb-action-primary-hover)] focus-visible:bg-[var(--bb-action-primary-hover)]";
const menuLinkPlain = "hover:bg-[#333333] focus-visible:bg-[#333333]";

function UserIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function HeaderUserMenu() {
  const t = useTranslations("Header");
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loginHref = getSafeLoginHref(pathname);

  function scheduleClose() {
    closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  function cancelClose() {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => cancelClose();
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapperRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setOpen(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await performLogout();
    setLoggingOut(false);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  if (auth.status === "loading") {
    return (
      <button
        type="button"
        disabled
        aria-label={t("accountAriaLabel")}
        className="hidden min-h-[var(--bb-header-height)] items-center justify-center px-3 text-white/40 cursor-default md:inline-flex"
      >
        <UserIcon />
      </button>
    );
  }

  const displayName =
    auth.status === "authenticated"
      ? auth.profile.displayName?.trim() || auth.profile.email || t("myAccount")
      : "";

  return (
    <div
      ref={wrapperRef}
      className="bb-header-user max-[1260px]:hidden"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      onBlurCapture={handleBlur}
    >
      {auth.status === "authenticated" ? (
        <>
          <button
            type="button"
            className={cn(trigger, triggerAuth)}
            aria-label={t("accountAriaLabelUser", { name: displayName })}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            onFocus={() => setOpen(true)}
          >
            <span className="w-full overflow-hidden font-cta text-[14px] font-semibold leading-none uppercase text-ellipsis whitespace-nowrap">
              {t("loggedInGreeting")}
            </span>
            <span
              className="w-full overflow-hidden text-[14px] font-light leading-[1.2] text-ellipsis whitespace-nowrap normal-case"
              title={auth.profile.email}
            >
              {displayName}
            </span>
          </button>

          <div className={cn("bb-header-user-menu", open && "is-open")} role="menu">
            <ul className="grid gap-2 m-0 p-0 list-none">
              <li>
                <Link
                  href={toAccountPath()}
                  className={cn(menuLink, menuLinkPrimary)}
                  onClick={() => setOpen(false)}
                >
                  {t("myAccount")}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className={cn(menuLink, menuLinkPlain)}
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? t("loggingOut") : t("logout")}
                </button>
              </li>
            </ul>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className={cn(trigger, triggerGuest)}
            aria-label={t("accountAriaLabel")}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            onFocus={() => setOpen(true)}
          >
            <UserIcon />
          </button>

          <div className={cn("bb-header-user-menu", open && "is-open")} role="menu">
            <ul className="grid gap-2 m-0 p-0 list-none">
              <li>
                <Link
                  href={toRegisterPath()}
                  className={cn(menuLink, menuLinkPrimary)}
                  onClick={() => setOpen(false)}
                >
                  {t("register")}
                </Link>
              </li>
              <li>
                <Link href={loginHref} className={cn(menuLink, menuLinkPlain)} onClick={() => setOpen(false)}>
                  {t("login")}
                </Link>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
