"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerCustomer } from "@/lib/api/client-api";
import { markCustomerAuthenticated, refreshAuth } from "@/lib/auth/auth-store";
import { createRegisterSchema, type RegisterFormValues } from "@/lib/schemas/auth";
import { toAccountPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { FormRootError } from "@/components/ui/FormRootError";
import { Button } from "@/components/ui/button";
import { WpAuthField } from "@/components/wp/WpAuthField";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";

/**
 * Form đăng ký theo theme WP — port `form.form` của page-register.php (lưới
 * name/email + phone + password/repassword, .form-submit button đỏ).
 * GIỮ NGUYÊN logic auth (RHF + zod + registerCustomer + refreshAuth + success state).
 */
export function RegisterForm({ returnTo }: { returnTo?: string }) {
  const t = useTranslations("Auth.register");
  const tValidation = useTranslations("Auth.validation");
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
    } catch (err: unknown) {
      setError("root", { message: (err as Error).message });
    }
  }

  if (registered) {
    return (
      <div className="row">
        <div className="col-12">
          <div className="text-center">
            <h2 className="mb-3">{t("successHeading")}</h2>
            {confirmedEmail && (
              <p className="mb-[30px]">
                {t.rich("successDescription", {
                  email: confirmedEmail,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
            )}
            <div className="form-submit form-group">
              <Button type="button" size="auth" onClick={() => router.push(resolvedReturnTo)}>
                {t("successCta")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="row">
      <div className="col-12">
        <FormRootError message={errors.root?.message} />

        <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="row">
            <div className="col-md-12">
              <div className="row">
                <div className="col-md-6">
                  <WpAuthField
                    id="reg-fullName"
                    label={t("fullNameLabel")}
                    autoComplete="name"
                    placeholder={t("fullNamePlaceholder")}
                    registration={register("fullName")}
                    error={errors.fullName}
                  />
                </div>
                <div className="col-md-6">
                  <WpAuthField
                    id="reg-email"
                    type="email"
                    label={t("emailLabel")}
                    autoComplete="email"
                    placeholder={t("emailPlaceholder")}
                    registration={register("email")}
                    error={errors.email}
                  />
                </div>
                <div className="col-md-12">
                  <WpAuthField
                    id="reg-phone"
                    type="tel"
                    label={t("phoneLabel")}
                    autoComplete="tel"
                    placeholder={t("phonePlaceholder")}
                    registration={register("phone")}
                    error={errors.phone}
                  />
                </div>
                <div className="col-md-6">
                  <WpAuthField
                    id="reg-password"
                    type="password"
                    label={t("passwordLabel")}
                    autoComplete="new-password"
                    placeholder={t("passwordPlaceholder")}
                    registration={register("password")}
                    error={errors.password}
                  />
                </div>
                <div className="col-md-6">
                  <WpAuthField
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
              <div className="form-submit form-group">
                <Button type="submit" size="auth" disabled={isSubmitting}>
                  {isSubmitting ? t("submitting") : t("submit")}
                </Button>
              </div>
            </div>
          </div>
        </form>

        <SocialLoginButtons returnTo={resolvedReturnTo} />
      </div>
    </div>
  );
}
