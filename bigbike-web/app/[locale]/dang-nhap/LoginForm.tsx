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
import { toAccountPath, toForgotPasswordPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { FormRootError } from "@/components/ui/FormRootError";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthField } from "@/components/auth/AuthField";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";

/**
 * Form đăng nhập theo theme WP — port `form.login-form` của page-login.php
 * (.form-group label+.form-control, .form-checkbox Ghi nhớ, .forgot-password-link,
 * .form-submit button đỏ). GIỮ NGUYÊN logic auth (RHF + zod + loginCustomer + refreshAuth).
 */
export function LoginForm({ returnTo, socialErrorKey }: { returnTo?: string; socialErrorKey?: OAuthErrorKey }) {
  const t = useTranslations("Auth.login");
  const tValidation = useTranslations("Auth.validation");
  const tSocial = useTranslations("Auth.social");
  const locale = useLocale() as Locale;
  const resolvedReturnTo = returnTo ?? toAccountPath(locale);
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace(resolvedReturnTo);
    }
  }, [auth.status, router, resolvedReturnTo]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(createLoginSchema(tValidation)),
    defaultValues: { login: "", password: "", remember: true },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      await loginCustomer(values.login, values.password, values.remember);
      markCustomerAuthenticated();
      await refreshAuth();
      router.push(resolvedReturnTo);
    } catch (err: unknown) {
      const message = err instanceof ApiClientError && [401, 403].includes(err.status)
        ? t("invalidCredentials")
        : t("errorGeneric");
      setError("root", { message });
    }
  }

  if (auth.status === "authenticated") return null;

  return (
    <div>
        <FormRootError message={errors.root?.message ?? (socialErrorKey ? tSocial(socialErrorKey) : undefined)} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <AuthField
            id="login-username"
            label={t("emailLabel")}
            autoComplete="username"
            placeholder={t("emailPlaceholder")}
            registration={register("login")}
            error={errors.login}
          />

          <AuthField
            id="login-password"
            type="password"
            label={t("passwordLabel")}
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            registration={register("password")}
            error={errors.password}
          />

          <div className="mb-8 grid gap-4 md:grid-cols-2">
              <div className="flex min-h-11 items-center gap-2">
                <Controller
                  name="remember"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="remember-me"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  )}
                />
                <label htmlFor="remember-me" className="cursor-pointer select-none text-a5-meta">
                  {t("remember")}
                </label>
              </div>
              <div className="flex min-h-11 items-center md:justify-end">
                <Link
                  href={toForgotPasswordPath(undefined, locale)}
                  className="text-a5-meta font-medium text-muted-foreground underline hover:no-underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
          </div>

          <div>
            <Button type="submit" size="auth" disabled={isSubmitting} className="!text-primary-foreground hover:!text-primary-foreground">
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </div>
        </form>

        <SocialLoginButtons returnTo={resolvedReturnTo} />
    </div>
  );
}
