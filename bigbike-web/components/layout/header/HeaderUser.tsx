"use client";

import { LogOut, UserCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/locale";
import { performLogout, useAuth } from "@/lib/auth/auth-store";
import { cn } from "@/lib/utils";
import { toAccountPath, toLoginPath, toRegisterPath } from "@/lib/utils/routes";
import { iconBtn } from "@/lib/ui-classes";

export function HeaderUser({ variant }: { variant: "desktop" | "mobile" }) {
  const t = useTranslations("HeaderUser");
  const locale = useLocale() as Locale;
  const auth = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAuthed = auth.status === "authenticated";
  const displayName = isAuthed ? auth.profile.displayName ?? "" : "";

  function clearCloseTimer() {
    if (!closeTimerRef.current) return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }

  function openMenu() {
    clearCloseTimer();
    setMenuOpen(true);
  }

  function closeMenu() {
    clearCloseTimer();
    setMenuOpen(false);
  }

  function scheduleCloseMenu() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
      closeTimerRef.current = null;
    }, 120);
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    closeMenu();
    await performLogout();
    setLoggingOut(false);
    router.push("/");
    router.refresh();
  }

  if (variant === "mobile") {
    return (
      <div className="border-b border-white/20 px-[25px] py-7.5">
        {isAuthed ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="m-0! font-cta text-a4-content font-semibold uppercase text-white">HEY YO! <span>{displayName}</span></p>
              <Link href={toAccountPath(locale)} className="text-a5-meta text-white/70 no-underline!">{t("account")}</Link>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => void handleLogout()} disabled={loggingOut} aria-label={t("logout")} className="text-white hover:not-disabled:scale-100">
              <LogOut className="h-6 w-6" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex min-h-11 items-center gap-5 text-white">
            <UserCircle className="h-10 w-10 shrink-0" aria-hidden />
            <div className="text-a4-content">
              <Link href={toRegisterPath(locale)} className="text-white! no-underline!">{t("register")}</Link>
              <span className="px-2">/</span>
              <Link href={toLoginPath(undefined, locale)} className="text-white! no-underline!">{t("login")}</Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative h-full"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleCloseMenu}
      onFocus={openMenu}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          scheduleCloseMenu();
        }
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("account")}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={openMenu}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeMenu();
          }
        }}
        className={cn(iconBtn, "h-20! min-h-20! px-5! hover:not-disabled:scale-100")}
      >
        <UserCircle size={18} strokeWidth={1.75} aria-hidden />
      </Button>
      <div
        role="menu"
        className={cn(
          "pointer-events-none invisible absolute right-[-50px] top-20 z-[var(--bb-z-dropdown)] w-[275px] bg-white p-7.5 opacity-0 shadow-[0_0_6px_rgba(0,0,0,0.64)] transition-[opacity,visibility] duration-300",
          menuOpen && "pointer-events-auto visible opacity-100",
        )}
      >
        <span className="absolute right-15 top-[-18px] h-0 w-0 border-x-[18px] border-b-[18px] border-x-transparent border-b-white" aria-hidden />
        <div className="flex flex-col gap-5">
          <Button asChild variant="primary" size="auth">
            <Link href={isAuthed ? toAccountPath(locale) : toRegisterPath(locale)} role="menuitem" onClick={closeMenu}>
              {isAuthed ? t("account") : t("register")}
            </Link>
          </Button>
          {isAuthed ? (
            <Button type="button" role="menuitem" variant="dark" size="auth" onClick={() => void handleLogout()} disabled={loggingOut}>{t("logout")}</Button>
          ) : (
            <Button asChild variant="dark" size="auth">
              <Link href={toLoginPath(undefined, locale)} role="menuitem" onClick={closeMenu}>{t("login")}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
