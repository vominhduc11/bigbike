"use client";

import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/locale";
import { oauthAuthorizeUrl } from "@/lib/api/client-api";
import { markCustomerAuthenticated } from "@/lib/auth/auth-store";

function FacebookIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0 text-blue"
    >
      <path
        fill="currentColor"
        d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.33-.04-1.57-.14-2.88-.14C11.9 2 10 3.66 10 6.7v2.8H7v4h3V22h4v-8.5z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        fill="currentColor"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.01h3.88c2.27-2.09 3.54-5.17 3.54-8.88z"
      />
      <path
        fill="currentColor"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="currentColor"
        d="M5.27 14.28a7.2 7.2 0 0 1-.38-2.28c0-.79.14-1.56.38-2.28V6.63H1.29A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.29 5.37l3.98-3.09z"
      />
      <path
        fill="currentColor"
        d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.63l3.98 3.09C6.22 6.87 8.87 4.76 12 4.76z"
      />
    </svg>
  );
}

type RegistrationConsent = {
  accepted: boolean;
  locale: Locale;
  onRequired: () => void;
};

export function SocialLoginButtons({
  returnTo,
  flow = "login",
  registrationConsent,
}: {
  returnTo: string;
  flow?: "login" | "register";
  registrationConsent?: RegistrationConsent;
}) {
  const t = useTranslations("Auth.social");
  const isRegistration = flow === "register";
  const consent =
    isRegistration && registrationConsent?.accepted
      ? { privacyConsent: true as const, privacyPolicyLocale: registrationConsent.locale }
      : undefined;

  function handleOAuthClick(event: MouseEvent<HTMLElement>) {
    if (isRegistration && !consent) {
      event.preventDefault();
      registrationConsent?.onRequired();
      return;
    }
    markCustomerAuthenticated();
  }

  const label = (provider: "facebook" | "google") =>
    t(isRegistration ? `${provider}Register` : provider);

  return (
    <div className="flex flex-col gap-3">
      {(["facebook", "google"] as const).map((provider) => (
        <Button
          key={provider}
          asChild
          variant="filter"
          size="auth"
          className="w-full justify-center"
        >
          <a href={oauthAuthorizeUrl(provider, returnTo, consent)} onClick={handleOAuthClick}>
            {provider === "facebook" ? <FacebookIcon /> : <GoogleIcon />}
            <span>{label(provider)}</span>
          </a>
        </Button>
      ))}
    </div>
  );
}
