"use client";

import { useEffect, useState } from "react";
import Link from "@/i18n/StorefrontLink";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerCustomer } from "@/lib/api/client-api";
import { markCustomerAuthenticated, refreshAuth } from "@/lib/auth/auth-store";
import type { OAuthErrorKey } from "@/lib/auth/oauth-error";
import { createRegisterSchema, type RegisterFormValues } from "@/lib/schemas/auth";
import { toAccountPath, toLoginPath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { AuthField } from "@/components/auth/AuthField";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormRootError } from "@/components/ui/FormRootError";
import { Label } from "@/components/ui/label";
import { reportStorefrontFailure } from "@/lib/observability/storefront-error";

export function RegisterForm({
  returnTo,
  socialErrorKey,
}: {
  returnTo?: string;
  socialErrorKey?: OAuthErrorKey;
}) {
  const t = useTranslations("Auth.register");
  const tValidation = useTranslations("Auth.validation");
  const tSocial = useTranslations("Auth.social");
  const tPassword = useTranslations("Auth.password");
  const locale = useLocale() as Locale;
  const resolvedReturnTo = returnTo ?? toAccountPath(locale);
  const privacyPolicyHref = translatePath("/chinh-sach/chinh-sach-bao-mat-thong-tin/", locale);
  const router = useRouter();
  const [registered, setRegistered] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");

  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors, isSubmitting },
    setError,
    setFocus,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(createRegisterSchema(tValidation)),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirm: "",
      privacyConsent: false,
    },
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const password = useWatch({ control, name: "password" }) ?? "";
  const privacyConsent = useWatch({ control, name: "privacyConsent" }) ?? false;

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setFocus("fullName");
    }
  }, [setFocus]);

  async function onSubmit(values: RegisterFormValues) {
    try {
      await registerCustomer(
        values.email,
        values.password,
        values.fullName,
        undefined,
        values.phone,
        locale,
      );
      markCustomerAuthenticated();
      await refreshAuth();
      setConfirmedEmail(values.email);
      setRegistered(true);
    } catch (error) {
      reportStorefrontFailure("register", error);
      setError("root", { message: t("errorGeneric") });
    }
  }

  function requirePrivacyAgreement() {
    void trigger("privacyConsent", { shouldFocus: true });
  }

  if (registered) {
    return (
      <div className="text-center">
        <h2 className="mb-3 font-body text-a2-page font-bold">{t("successHeading")}</h2>
        {confirmedEmail ? (
          <p className="mb-8 text-a4-content">
            {t.rich("successDescription", {
              email: confirmedEmail,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        ) : null}
        <Button type="button" size="auth" onClick={() => router.push(resolvedReturnTo)}>
          {t("successCta")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <FormRootError
        message={errors.root?.message ?? (socialErrorKey ? tSocial(socialErrorKey) : undefined)}
      />

      <form id="register-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <AuthField
              id="reg-fullName"
              label={t("fullNameLabel")}
              autoComplete="name"
              placeholder={t("fullNamePlaceholder")}
              registration={register("fullName")}
              error={errors.fullName}
            />
          </div>
          <AuthField
            id="reg-email"
            type="email"
            label={t("emailLabel")}
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            registration={register("email")}
            error={errors.email}
          />
          <AuthField
            id="reg-phone"
            type="tel"
            label={t("phoneLabel")}
            autoComplete="tel"
            placeholder={t("phonePlaceholder")}
            registration={register("phone")}
            error={errors.phone}
          />
          <AuthField
            id="reg-password"
            type="password"
            label={t("passwordLabel")}
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            hint={tPassword("ruleMin8")}
            passwordToggleLabels={{ show: tPassword("show"), hide: tPassword("hide") }}
            registration={register("password")}
            error={errors.password}
          />
          <AuthField
            id="reg-confirm"
            type="password"
            label={t("confirmLabel")}
            autoComplete="new-password"
            placeholder={t("confirmPlaceholder")}
            passwordToggleLabels={{ show: tPassword("show"), hide: tPassword("hide") }}
            registration={register("confirm")}
            error={errors.confirm}
          />
          <div className="md:col-span-2">
            <PasswordStrengthMeter
              password={password}
              label={tPassword("strengthLabel")}
              labels={{
                empty: tPassword("strengthEmpty"),
                weak: tPassword("strengthWeak"),
                fair: tPassword("strengthFair"),
                good: tPassword("strengthGood"),
                strong: tPassword("strengthStrong"),
              }}
            />
          </div>
          <div className="mb-5 md:col-span-2">
            <Controller
              name="privacyConsent"
              control={control}
              render={({ field }) => (
                <div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="reg-privacy-consent"
                      touchTarget
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      aria-invalid={Boolean(errors.privacyConsent)}
                      aria-labelledby="reg-privacy-consent-label"
                      aria-describedby={
                        errors.privacyConsent ? "reg-privacy-consent-error" : undefined
                      }
                    />
                    <div
                      id="reg-privacy-consent-label"
                      className="min-h-11 pt-3 text-a5-meta leading-body"
                    >
                      <Label htmlFor="reg-privacy-consent" className="cursor-pointer">
                        {t("privacyConsentPrefix")}{" "}
                      </Label>
                      <Link
                        href={privacyPolicyHref}
                        className="font-semibold text-blue underline hover:no-underline"
                        onPointerDown={(event) => {
                          if (
                            event.button === 0 &&
                            !event.metaKey &&
                            !event.ctrlKey &&
                            !event.shiftKey &&
                            !event.altKey
                          ) {
                            event.preventDefault();
                            router.push(privacyPolicyHref);
                          }
                        }}
                      >
                        {t("privacyPolicyLink")}
                      </Link>
                      {t("privacyConsentSuffix")}
                    </div>
                  </div>
                  {errors.privacyConsent ? (
                    <p
                      id="reg-privacy-consent-error"
                      role="alert"
                      className="mt-2 text-a5-meta text-destructive"
                    >
                      {errors.privacyConsent.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
          </div>
        </div>

        <Button type="submit" size="auth" disabled={isSubmitting} className="hidden md:inline-flex">
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
        <Button type="submit" size="auth" disabled={isSubmitting} className="mt-3 w-full md:hidden">
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>

      <Button asChild variant="secondary" size="auth" className="mt-3 w-full">
        <Link href={toLoginPath(undefined, locale)}>{t("loginCta")}</Link>
      </Button>

      <div
        className="my-6 flex items-center gap-3"
        role="separator"
        aria-label={tSocial("divider")}
      >
        <span className="h-px flex-1 bg-border" />
        <span className="text-a5-meta text-muted-foreground">{tSocial("divider")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <SocialLoginButtons
        returnTo={resolvedReturnTo}
        flow="register"
        registrationConsent={{
          accepted: privacyConsent,
          locale,
          onRequired: requirePrivacyAgreement,
        }}
      />
    </div>
  );
}
