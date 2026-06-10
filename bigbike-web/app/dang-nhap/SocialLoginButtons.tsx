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

/**
 * Khối đăng nhập mạng xã hội — port `.social-login` của page-login.php/page-register.php
 * (`<div class="social-login"><a> ĐĂNG NHẬP BẰNG <i class="fab fa-facebook-f"></i></a>`).
 * bigbike-web KHÔNG nạp Font Awesome → icon Facebook render bằng inline SVG.
 */
export function SocialLoginButtons({ returnTo }: { returnTo: string }) {
  const t = useTranslations("Auth.social");

  return (
    <div className="social-login">
      <a href={oauthAuthorizeUrl("facebook", returnTo)} aria-label={t("facebook")}>
        {t("facebookShort")}
        <FacebookIcon />
      </a>
    </div>
  );
}
