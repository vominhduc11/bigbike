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
  const loginHref = getSafeLoginHref(pathname);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapperRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
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
        className="hidden min-h-[var(--bb-header-height)] items-center justify-center px-3 text-white/40 cursor-default min-[768px]:inline-flex"
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
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlurCapture={handleBlur}
    >
      {auth.status === "authenticated" ? (
        <>
          <button
            type="button"
            className="bb-header-user-trigger bb-header-user-trigger-auth"
            aria-label={t("accountAriaLabelUser", { name: displayName })}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            onFocus={() => setOpen(true)}
          >
            <span className="bb-header-user-greeting">HEY YO!....</span>
            <span className="bb-header-user-name" title={auth.profile.email}>
              {displayName}
            </span>
          </button>

          <div
            className={cn("bb-header-user-menu", open && "is-open")}
            role="menu"
          >
            <ul className="bb-header-user-menu-list">
              <li>
                <Link
                  href={toAccountPath()}
                  className="bb-header-user-menu-link is-primary"
                  onClick={() => setOpen(false)}
                >
                  {t("myAccount")}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className="bb-header-user-menu-link"
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
            className="bb-header-user-trigger bb-header-user-trigger-guest"
            aria-label={t("accountAriaLabel")}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            onFocus={() => setOpen(true)}
          >
            <UserIcon />
          </button>

          <div
            className={cn("bb-header-user-menu", open && "is-open")}
            role="menu"
          >
            <ul className="bb-header-user-menu-list">
              <li>
                <Link
                  href={toRegisterPath()}
                  className="bb-header-user-menu-link is-primary"
                  onClick={() => setOpen(false)}
                >
                  {t("register")}
                </Link>
              </li>
              <li>
                <Link
                  href={loginHref}
                  className="bb-header-user-menu-link"
                  onClick={() => setOpen(false)}
                >
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
