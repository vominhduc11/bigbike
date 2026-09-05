"use client";

import { useEffect, useState } from "react";
import Link from "@/i18n/StorefrontLink";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClientError, loginCustomer } from "@/lib/api/client-api";
import { markCustomerAuthenticated, refreshAuth, useAuth } from "@/lib/auth/auth-store";
import type { OAuthErrorKey } from "@/lib/auth/oauth-error";
import { createLoginSchema, type LoginFormValues } from "@/lib/schemas/auth";
import {
  toAccountPath,
  toForgotPasswordPath,
  toOrderLookupPath,
  toRegisterPath,
} from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { AuthField } from "@/components/auth/AuthField";
import { GuestStorefrontExit } from "@/components/auth/GuestStorefrontExit";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormRootError } from "@/components/ui/FormRootError";
import { Label } from "@/components/ui/label";
import { AuthFormSkeleton } from "@/components/ui/Skeletons";
import { reportStorefrontFailure } from "@/lib/observability/storefront-error";

type LoginField = "login" | "password";
const LOGIN_FIELDS: LoginField[] = ["login", "password"];

export function LoginForm({
  returnTo,
  socialErrorKey,
}: {
  returnTo?: string;
  socialErrorKey?: OAuthErrorKey;
}) {
  const t = useTranslations("Auth.login");
  const tValidation = useTranslations("Auth.validation");
  const tSocial = useTranslations("Auth.social");
  const tPassword = useTranslations("Auth.password");
  const locale = useLocale() as Locale;
  const resolvedReturnTo = returnTo ?? toAccountPath(locale);
  const router = useRouter();
  const auth = useAuth();
  const [submittedInvalidField, setSubmittedInvalidField] = useState<LoginField | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, touchedFields },
    clearErrors,
    resetField,
    setError,
    setFocus,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(createLoginSchema(tValidation)),
    defaultValues: { login: "", password: "", remember: true },
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace(resolvedReturnTo);
    }
  }, [auth.status, router, resolvedReturnTo]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setFocus("login");
    }
  }, [setFocus]);

  function showFirstInvalidField(invalid: FieldErrors<LoginFormValues>) {
    const field = LOGIN_FIELDS.find((name) => invalid[name]);
    if (!field) return;

    setSubmittedInvalidField(field);
    setError("root", { message: t("formIncomplete") });
    window.requestAnimationFrame(() => setFocus(field));
  }

  async function onSubmit(values: LoginFormValues) {
    clearErrors("root");
    setSubmittedInvalidField(null);
    try {
      await loginCustomer(values.login, values.password, values.remember);
      markCustomerAuthenticated();
      await refreshAuth();
    } catch (err: unknown) {
      reportStorefrontFailure("login", err);

      if (err instanceof ApiClientError && [401, 403].includes(err.status)) {
        resetField("password");
        setError("root", { message: t("invalidCredentials") });
        window.requestAnimationFrame(() => setFocus("password"));
        return;
      }

      if (err instanceof ApiClientError && err.status === 429) {
        setError("root", {
          message: t("errorRateLimited", { seconds: err.retryAfterSeconds ?? 60 }),
        });
        return;
      }

      setError("root", {
        message: err instanceof ApiClientError ? t("errorSystem") : t("errorNetwork"),
      });
    }
  }

  const visibleError = (field: LoginField) =>
    touchedFields[field] || submittedInvalidField === field ? errors[field] : undefined;

  // Đã ở trong cột biểu mẫu của AuthPageFrame → chỉ thay phần biểu mẫu, không
  // dựng lại cả hai nửa màn hình. Tiêu đề thật đã render bởi AuthTitleBlock.
  if (auth.status === "authenticated") return <AuthFormSkeleton withTitle={false} />;

  return (
    <div>
      <FormRootError
        message={errors.root?.message ?? (socialErrorKey ? tSocial(socialErrorKey) : undefined)}
      />

      <form onSubmit={handleSubmit(onSubmit, showFirstInvalidField)} noValidate>
        <AuthField
          id="login-username"
          label={t("emailLabel")}
          autoComplete="username"
          placeholder={t("emailPlaceholder")}
          registration={register("login")}
          error={visibleError("login")}
          compact
        />

        <AuthField
          id="login-password"
          type="password"
          label={t("passwordLabel")}
          labelAction={
            <Link
              href={toForgotPasswordPath(undefined, locale)}
              className="inline-flex min-h-11 items-center text-a5-meta font-medium text-blue underline hover:no-underline"
            >
              {t("forgotPassword")}
            </Link>
          }
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          passwordToggleLabels={{ show: tPassword("show"), hide: tPassword("hide") }}
          registration={register("password")}
          error={visibleError("password")}
          compact
        />

        <div className="mb-4 flex min-h-11 items-center gap-2 md:mb-5">
          <Controller
            name="remember"
            control={control}
            render={({ field }) => (
              <>
                <Checkbox
                  id="remember-me"
                  touchTarget
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
                <Label htmlFor="remember-me" className="cursor-pointer select-none text-a5-meta">
                  {t("remember")}
                </Label>
              </>
            )}
          />
        </div>

        <Button
          type="submit"
          size="auth"
          disabled={isSubmitting}
          className="min-h-11 md:min-h-13 !text-primary-foreground hover:!text-primary-foreground"
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>

      <div className="mt-4 space-y-2 text-center text-a5-meta text-muted-foreground">
        <p>
          {t("noAccountPrompt")}{" "}
          <Link
            href={toRegisterPath(locale)}
            className="font-medium text-blue underline hover:no-underline"
          >
            {t("registerCta")}
          </Link>
        </p>
        <p>
          <Link
            href={toOrderLookupPath(locale)}
            data-auth-order-lookup
            className="font-medium text-blue underline hover:no-underline"
          >
            {t("orderLookup")}
          </Link>
        </p>
      </div>

      <div
        className="my-5 flex items-center gap-3 md:my-6"
        role="separator"
        aria-label={tSocial("divider")}
      >
        <span className="h-px flex-1 bg-border" />
        <span className="text-a5-meta text-muted-foreground">{tSocial("divider")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <SocialLoginButtons returnTo={resolvedReturnTo} />
      <GuestStorefrontExit returnTo={returnTo} />
    </div>
  );
}
