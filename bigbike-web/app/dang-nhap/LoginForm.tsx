"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginCustomer } from "@/lib/api/client-api";
import { markCustomerAuthenticated, refreshAuth, useAuth } from "@/lib/auth/auth-store";
import { createLoginSchema, type LoginFormValues } from "@/lib/schemas/auth";
import { toAccountPath, toForgotPasswordPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { FormRootError } from "@/components/ui/FormRootError";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { WpAuthField } from "@/components/wp/WpAuthField";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";

/**
 * Form đăng nhập theo theme WP — port `form.login-form` của page-login.php
 * (.form-group label+.form-control, .form-checkbox Ghi nhớ, .forgot-password-link,
 * .form-submit button đỏ). GIỮ NGUYÊN logic auth (RHF + zod + loginCustomer + refreshAuth).
 */
export function LoginForm({ returnTo }: { returnTo?: string }) {
  const t = useTranslations("Auth.login");
  const tValidation = useTranslations("Auth.validation");
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
      const raw = (err as Error).message;
      const message = /invalid credentials/i.test(raw) ? t("invalidCredentials") : raw;
      setError("root", { message });
    }
  }

  if (auth.status === "authenticated") return null;

  return (
    <div className="row">
      <div className="col-12">
        <FormRootError message={errors.root?.message} />

        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <WpAuthField
            id="login-username"
            groupClassName="login-email"
            label={t("emailLabel")}
            autoComplete="username"
            placeholder={t("emailPlaceholder")}
            registration={register("login")}
            error={errors.login}
          />

          <WpAuthField
            id="login-password"
            groupClassName="login-password"
            type="password"
            label={t("passwordLabel")}
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            registration={register("password")}
            error={errors.password}
          />

          <div className="row">
            <div className="col-md-6">
              <div className="form-group flex items-center gap-2">
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
                <label htmlFor="remember-me" className="!mb-0 cursor-pointer select-none">
                  {t("remember")}
                </label>
              </div>
            </div>
            <div className="col-md-6">
              <div className="forgot-password-link text-right">
                <Link href={toForgotPasswordPath(undefined, locale)}>{t("forgotPassword")}</Link>
              </div>
            </div>
          </div>

          <div className="form-submit form-group">
            <Button type="submit" size="auth" disabled={isSubmitting}>
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </div>
        </form>

        <SocialLoginButtons returnTo={resolvedReturnTo} />
      </div>
    </div>
  );
}
