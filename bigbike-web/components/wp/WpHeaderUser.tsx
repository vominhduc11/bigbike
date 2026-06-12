"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { performLogout, useAuth } from "@/lib/auth/auth-store";
import { toAccountPath, toLoginPath, toRegisterPath } from "@/lib/utils/routes";

/**
 * Khối user trên header WP — giữ DOM gốc (.user-logged / .toogle-menu / .not-login),
 * wire vào auth thật của bigbike-web.
 * variant "desktop" = .user-control--item.user.desktop-user
 * variant "mobile"  = khối trong .mobile-item (menu mobile)
 */
export function WpHeaderUser({ variant }: { variant: "desktop" | "mobile" }) {
  const t = useTranslations("WpUser");
  const auth = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await performLogout();
    setLoggingOut(false);
    router.push("/");
    router.refresh();
  }

  const isAuthed = auth.status === "authenticated";
  const displayName = isAuthed ? auth.profile.displayName ?? "" : "";

  if (variant === "mobile") {
    if (isAuthed) {
      return (
        <div className="user-logged">
          <p>
            HEY YO! <span>{displayName}</span>
          </p>
          <Link href={toAccountPath()}>{t("account")}</Link>
          <div className="logout-btn">
            <a href="#" onClick={(e) => { e.preventDefault(); void handleLogout(); }}>
              <i className="fal fa-sign-out-alt" />
            </a>
          </div>
        </div>
      );
    }
    return (
      <div className="not-login">
        <i className="fal fa-user-circle" />
        <div className="wrap">
          <Link href={toRegisterPath()}>{t("register")}</Link> /{" "}
          <Link href={toLoginPath()}>{t("login")}</Link>
        </div>
      </div>
    );
  }

  // desktop
  if (isAuthed) {
    return (
      <>
        <div className="user-logged">
          <p>HEY YO!...</p>
          <span>{displayName}</span>
        </div>
        <div className="toogle-menu">
          <ul>
            <li className="login-btn">
              <Link href={toAccountPath()}>{t("account")}</Link>
            </li>
            <li className="register-btn">
              <a href="#" onClick={(e) => { e.preventDefault(); void handleLogout(); }}>
                {t("logout")}
              </a>
            </li>
          </ul>
        </div>
      </>
    );
  }

  return (
    <>
      <a href="#" onClick={(e) => e.preventDefault()}>
        <i className="fal fa-user-circle" />
      </a>
      <div className="toogle-menu">
        <ul>
          <li className="login-btn">
            <Link href={toRegisterPath()}>{t("register")}</Link>
          </li>
          <li className="register-btn">
            <Link href={toLoginPath()}>{t("login")}</Link>
          </li>
        </ul>
      </div>
    </>
  );
}
