"use client";

import { useEffect } from "react";
import Link from "@/i18n/StorefrontLink";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
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
import { AuthSkeleton } from "@/components/ui/Skeletons";
import { reportStorefrontFailure } from "@/lib/observability/storefront-error";

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

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
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

  async function onSubmit(values: LoginFormValues) {
    try {
      await loginCustomer(values.login, values.password, values.remember);
      markCustomerAuthenticated();
      await refreshAuth();
    } catch (err: unknown) {
      reportStorefrontFailure("login", err);
      const message =
        err instanceof ApiClientError && [401, 403].includes(err.status)
          ? t("invalidCredentials")
          : t("errorGeneric");
      setError("root", { message });
    }
  }

  if (auth.status === "authenticated") return <AuthSkeleton credential />;

  return (
    <div>
      <FormRootError
        message={errors.root?.message ?? (socialErrorKey ? tSocial(socialErrorKey) : undefined)}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField
          id="login-username"
          label={t("emailLabel")}
          autoComplete="username"
          placeholder={t("emailPlaceholder")}
          registration={register("login")}
          error={errors.login}
          compact
          groupClassName="lg:mb-4"
        />

        <AuthField
          id="login-password"
          type="password"
          label={t("passwordLabel")}
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          passwordToggleLabels={{ show: tPassword("show"), hide: tPassword("hide") }}
          registration={register("password")}
          error={errors.password}
          compact
          groupClassName="lg:mb-4"
        />

        <div className="mb-3 grid gap-3 md:mb-5 md:grid-cols-2 lg:mb-4">
          <div className="flex min-h-11 items-center gap-2">
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
                  <Label
                    htmlFor="remember-me"
                    className="cursor-pointer select-none text-a5-meta"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('[role="checkbox"]')) return;
                      event.preventDefault();
                      field.onChange(!field.value);
                    }}
                  >
                    {t("remember")}
                  </Label>
                </>
              )}
            />
          </div>
          <div className="flex min-h-11 items-center md:justify-end">
            <Link
              href={toForgotPasswordPath(undefined, locale)}
              className="inline-flex min-h-11 items-center text-a5-meta font-medium text-blue underline hover:no-underline"
            >
              {t("forgotPassword")}
            </Link>
          </div>
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

      <p className="mt-2 text-center text-a5-meta text-muted-foreground lg:mt-2">
        <Link
          href={toOrderLookupPath(locale)}
          data-auth-order-lookup
          className="font-medium text-blue underline hover:no-underline"
        >
          {t("orderLookup")}
        </Link>
      </p>

      <Button
        asChild
        variant="secondary"
        size="auth"
        className="mt-2 min-h-11 w-full md:mt-3 md:min-h-13 lg:mt-2"
      >
        <Link href={toRegisterPath(locale)}>{t("registerCta")}</Link>
      </Button>

      <div
        className="my-3 flex items-center gap-3 md:my-6 lg:my-3"
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
