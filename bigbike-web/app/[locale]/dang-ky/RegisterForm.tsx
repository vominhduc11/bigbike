"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerCustomer } from "@/lib/api/client-api";
import { markCustomerAuthenticated, refreshAuth } from "@/lib/auth/auth-store";
import type { OAuthErrorKey } from "@/lib/auth/oauth-error";
import { createRegisterSchema, type RegisterFormValues } from "@/lib/schemas/auth";
import { toAccountPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { FormRootError } from "@/components/ui/FormRootError";
import { Button } from "@/components/ui/button";
import { AuthField } from "@/components/auth/AuthField";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";

/**
 * Form đăng ký theo theme WP — port `form.form` của page-register.php (lưới
 * name/email + phone + password/repassword, .form-submit button đỏ).
 * GIỮ NGUYÊN logic auth (RHF + zod + registerCustomer + refreshAuth + success state).
 */
export function RegisterForm({ returnTo, socialErrorKey }: { returnTo?: string; socialErrorKey?: OAuthErrorKey }) {
  const t = useTranslations("Auth.register");
  const tValidation = useTranslations("Auth.validation");
  const tSocial = useTranslations("Auth.social");
  const locale = useLocale() as Locale;
  const resolvedReturnTo = returnTo ?? toAccountPath(locale);
  const router = useRouter();
  const [registered, setRegistered] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(createRegisterSchema(tValidation)),
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      await registerCustomer(values.email, values.password, values.fullName, undefined, values.phone);
      markCustomerAuthenticated();
      await refreshAuth();
      setConfirmedEmail(values.email);
      setRegistered(true);
    } catch {
      setError("root", { message: t("errorGeneric") });
    }
  }

  if (registered) {
    return (
      <div className="text-center">
            <h2 className="mb-3 font-body text-a2-page font-bold">{t("successHeading")}</h2>
            {confirmedEmail && (
              <p className="mb-8 text-a4-content">
                {t.rich("successDescription", {
                  email: confirmedEmail,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
            )}
            <div>
              <Button type="button" size="auth" onClick={() => router.push(resolvedReturnTo)}>
                {t("successCta")}
              </Button>
            </div>
      </div>
    );
  }

  return (
    <div>
        <FormRootError message={errors.root?.message ?? (socialErrorKey ? tSocial(socialErrorKey) : undefined)} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                <div>
                  <AuthField
                    id="reg-fullName"
                    label={t("fullNameLabel")}
                    autoComplete="name"
                    placeholder={t("fullNamePlaceholder")}
                    registration={register("fullName")}
                    error={errors.fullName}
                  />
                </div>
                <div>
                  <AuthField
                    id="reg-email"
                    type="email"
                    label={t("emailLabel")}
                    autoComplete="email"
                    placeholder={t("emailPlaceholder")}
                    registration={register("email")}
                    error={errors.email}
                  />
                </div>
                <div className="md:col-span-2">
                  <AuthField
                    id="reg-phone"
                    type="tel"
                    label={t("phoneLabel")}
                    autoComplete="tel"
                    placeholder={t("phonePlaceholder")}
                    registration={register("phone")}
                    error={errors.phone}
                  />
                </div>
                <div>
                  <AuthField
                    id="reg-password"
                    type="password"
                    label={t("passwordLabel")}
                    autoComplete="new-password"
                    placeholder={t("passwordPlaceholder")}
                    registration={register("password")}
                    error={errors.password}
                  />
                </div>
                <div>
                  <AuthField
                    id="reg-confirm"
                    type="password"
                    label={t("confirmLabel")}
                    autoComplete="new-password"
                    placeholder={t("confirmPlaceholder")}
                    registration={register("confirm")}
                    error={errors.confirm}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" size="auth" disabled={isSubmitting}>
                  {isSubmitting ? t("submitting") : t("submit")}
                </Button>
          </div>
        </form>

        <SocialLoginButtons returnTo={resolvedReturnTo} />
    </div>
  );
}
