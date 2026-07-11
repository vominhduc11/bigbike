"use client";

import { LogOut, UserCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

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
  const isAuthed = auth.status === "authenticated";
  const displayName = isAuthed ? auth.profile.displayName ?? "" : "";

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await performLogout();
    setLoggingOut(false);
    router.push("/");
    router.refresh();
  }

  if (variant === "mobile") {
    return (
      <div className="border-b border-white/20 px-[25px] py-[30px]">
        {isAuthed ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="m-0! font-cta text-body font-semibold uppercase text-white">HEY YO! <span>{displayName}</span></p>
              <Link href={toAccountPath(locale)} className="text-caption text-white/70 no-underline!">{t("account")}</Link>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => void handleLogout()} disabled={loggingOut} aria-label={t("logout")} className="text-white hover:not-disabled:scale-100">
              <LogOut className="h-6 w-6" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex min-h-11 items-center gap-5 text-white">
            <UserCircle className="h-10 w-10 shrink-0" aria-hidden />
            <div className="text-body">
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
    <div className="group relative h-full">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("account")}
        className={cn(iconBtn, "h-[80px]! min-h-[80px]! px-[20px]! hover:not-disabled:scale-100")}
      >
        <UserCircle size={18} strokeWidth={1.75} aria-hidden />
      </Button>
      <div className="invisible absolute right-[-50px] top-[80px] w-[275px] translate-y-[10px] bg-white p-[30px] opacity-0 shadow-[0_0_6px_rgba(0,0,0,0.64)] transition-[opacity,transform,visibility] duration-300 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <span className="absolute right-[60px] top-[-18px] h-0 w-0 border-x-[18px] border-b-[18px] border-x-transparent border-b-white" aria-hidden />
        <div className="flex flex-col gap-5">
          <Button asChild variant="primary" size="auth">
            <Link href={isAuthed ? toAccountPath(locale) : toRegisterPath(locale)}>
              {isAuthed ? t("account") : t("register")}
            </Link>
          </Button>
          {isAuthed ? (
            <Button type="button" variant="dark" size="auth" onClick={() => void handleLogout()} disabled={loggingOut}>{t("logout")}</Button>
          ) : (
            <Button asChild variant="dark" size="auth">
              <Link href={toLoginPath(undefined, locale)}>{t("login")}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
