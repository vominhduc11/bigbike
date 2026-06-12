"use client";

import { useTranslations } from "next-intl";
import { oauthAuthorizeUrl } from "@/lib/api/client-api";

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="ml-2.5 inline-block align-middle">
      <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.33-.04-1.57-.14-2.88-.14C11.9 2 10 3.66 10 6.7v2.8H7v4h3V22h4v-8.5z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 488 512" fill="currentColor" aria-hidden="true" className="ml-2.5 inline-block align-middle">
      <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
    </svg>
  );
}

/**
 * Khối đăng nhập mạng xã hội — port `.social-login` của page-login.php/page-register.php
 * (`<div class="social-login"><a> ĐĂNG NHẬP BẰNG <i class="fab fa-facebook-f"></i></a>`).
 * bigbike-web KHÔNG nạp Font Awesome → icon render bằng inline SVG.
 */
export function SocialLoginButtons({ returnTo }: { returnTo: string }) {
  const t = useTranslations("Auth.social");

  return (
    <div className="social-login">
      <a href={oauthAuthorizeUrl("facebook", returnTo)} aria-label={t("facebook")}>
        {t("prefix")}
        <FacebookIcon />
      </a>
      <a href={oauthAuthorizeUrl("google", returnTo)} aria-label={t("google")}>
        {t("prefix")}
        <GoogleIcon />
      </a>
    </div>
  );
}
