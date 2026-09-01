"use client";

import { useEffect, useState } from "react";
import Link from "@/i18n/StorefrontLink";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerCustomer } from "@/lib/api/client-api";
import { markCustomerAuthenticated, refreshAuth } from "@/lib/auth/auth-store";
import type { OAuthErrorKey } from "@/lib/auth/oauth-error";
import { createRegisterSchema, type RegisterFormValues } from "@/lib/schemas/auth";
import { toAccountPath, toLoginPath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { AuthField } from "@/components/auth/AuthField";
import { GuestStorefrontExit } from "@/components/auth/GuestStorefrontExit";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormRootError } from "@/components/ui/FormRootError";
import { reportStorefrontFailure } from "@/lib/observability/storefront-error";

type RegisterField = keyof RegisterFormValues;
const REGISTER_FIELDS: RegisterField[] = [
  "fullName",
  "email",
  "phone",
  "password",
  "confirm",
  "privacyConsent",
];

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
  const [submittedInvalidField, setSubmittedInvalidField] = useState<RegisterField | null>(null);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors, isSubmitting, touchedFields },
    clearErrors,
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
  const confirm = useWatch({ control, name: "confirm" }) ?? "";
  const privacyConsent = useWatch({ control, name: "privacyConsent" }) ?? false;

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setFocus("fullName");
    }
  }, [setFocus]);

  function showFirstInvalidField(invalid: FieldErrors<RegisterFormValues>) {
    const field = REGISTER_FIELDS.find((name) => invalid[name]);
    if (!field) return;

    setSubmittedInvalidField(field);
    setError("root", { message: t("formIncomplete") });
    window.requestAnimationFrame(() => setFocus(field));
  }

  async function onSubmit(values: RegisterFormValues) {
    clearErrors("root");
    setSubmittedInvalidField(null);
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
    setSubmittedInvalidField("privacyConsent");
    void trigger("privacyConsent", { shouldFocus: true });
  }

  const visibleError = (field: RegisterField) =>
    touchedFields[field] || submittedInvalidField === field ? errors[field] : undefined;
  const confirmStatus =
    confirm.length > 0
      ? {
          message: confirm === password ? t("passwordMatch") : t("passwordNotMatch"),
          tone: confirm === password ? ("success" as const) : ("error" as const),
        }
      : undefined;

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
        <GuestStorefrontExit returnTo={returnTo} />
      </div>
    );
  }

  return (
    <div>
      <FormRootError
        message={errors.root?.message ?? (socialErrorKey ? tSocial(socialErrorKey) : undefined)}
      />

      <form id="register-form" onSubmit={handleSubmit(onSubmit, showFirstInvalidField)} noValidate>
        <div className="grid gap-x-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <AuthField
              id="reg-fullName"
              label={t("fullNameLabel")}
              autoComplete="name"
              placeholder={t("fullNamePlaceholder")}
              registration={register("fullName")}
              error={visibleError("fullName")}
              compact
            />
          </div>
          <AuthField
            id="reg-email"
            type="email"
            label={t("emailLabel")}
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            registration={register("email")}
            error={visibleError("email")}
            compact
          />
          <AuthField
            id="reg-phone"
            type="tel"
            label={t("phoneLabel")}
            autoComplete="tel"
            placeholder={t("phonePlaceholder")}
            registration={register("phone")}
            error={visibleError("phone")}
            compact
          />
          <div>
            <AuthField
              id="reg-password"
              type="password"
              label={t("passwordLabel")}
              autoComplete="new-password"
              placeholder={t("passwordPlaceholder")}
              passwordToggleLabels={{ show: tPassword("show"), hide: tPassword("hide") }}
              registration={register("password")}
              error={visibleError("password")}
              groupClassName="mb-2"
              compact
            />
            <PasswordStrengthMeter
              password={password}
              label={tPassword("strengthLabel")}
              requirementLabel={tPassword("ruleMin8")}
              labels={{
                empty: tPassword("strengthEmpty"),
                weak: tPassword("strengthWeak"),
                fair: tPassword("strengthFair"),
                good: tPassword("strengthGood"),
                strong: tPassword("strengthStrong"),
              }}
              compact
            />
          </div>
          <AuthField
            id="reg-confirm"
            type="password"
            label={t("confirmLabel")}
            autoComplete="new-password"
            placeholder={t("confirmPlaceholder")}
            passwordToggleLabels={{ show: tPassword("show"), hide: tPassword("hide") }}
            registration={register("confirm")}
            error={visibleError("confirm")}
            status={confirmStatus}
            compact
          />
          <div className="mb-5 md:col-span-2">
            <Controller
              name="privacyConsent"
              control={control}
              render={({ field }) => {
                const fieldIssue = visibleError("privacyConsent");
                return (
                  <div>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="reg-privacy-consent"
                        touchTarget
                        className="-mt-1"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        aria-invalid={Boolean(fieldIssue)}
                        aria-labelledby="reg-privacy-consent-label"
                        aria-describedby={fieldIssue ? "reg-privacy-consent-error" : undefined}
                      />
                      <div
                        id="reg-privacy-consent-label"
                        className="min-h-11 cursor-pointer select-none text-a5-meta leading-body"
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest("a, [role='checkbox']")) return;
                          field.onChange(!field.value);
                        }}
                      >
                        {t("privacyConsentPrefix")}{" "}
                        <Link
                          href={privacyPolicyHref}
                          className="font-semibold text-blue underline hover:no-underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {t("privacyPolicyLink")}
                        </Link>
                        {t("privacyConsentSuffix")}
                      </div>
                    </div>
                    {fieldIssue ? (
                      <p
                        id="reg-privacy-consent-error"
                        role="alert"
                        className="mt-2 text-a5-meta text-destructive"
                      >
                        {fieldIssue.message}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
          </div>
        </div>

        <Button type="submit" size="auth" disabled={isSubmitting} className="min-h-11 md:min-h-13">
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>

      <p className="mt-4 text-center text-a5-meta text-muted-foreground">
        {t("hasAccountPrompt")}{" "}
        <Link
          href={toLoginPath(undefined, locale)}
          className="font-medium text-blue underline hover:no-underline"
        >
          {t("loginCta")}
        </Link>
      </p>

      <div
        className="my-5 flex items-center gap-3 md:my-6"
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
      <GuestStorefrontExit returnTo={returnTo} />
    </div>
  );
}
