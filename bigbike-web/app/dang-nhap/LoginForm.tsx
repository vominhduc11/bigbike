"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, User, KeyRound, AlertTriangle } from "lucide-react";
import { loginCustomer } from "@/lib/api/client-api";
import { refreshAuth, useAuth } from "@/lib/auth/auth-store";
import { createLoginSchema, type LoginFormValues } from "@/lib/schemas/auth";
import { toForgotPasswordPath } from "@/lib/utils/routes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SocialLoginButtons } from "./SocialLoginButtons";

/**
 * Login form body — rendered inside the shared tabbed auth shell (`AuthTabs`).
 * `returnTo` is resolved by the shell from the `?tiep=` query param.
 */
export function LoginForm({ returnTo }: { returnTo: string }) {
  const t = useTranslations("Auth.login");
  const tValidation = useTranslations("Auth.validation");
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace(returnTo);
    }
  }, [auth.status, router, returnTo]);

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
      await refreshAuth();
      router.push(returnTo);
    } catch (err: unknown) {
      const raw = (err as Error).message;
      const message = /invalid credentials/i.test(raw)
        ? t("invalidCredentials")
        : raw;
      setError("root", { message });
    }
  }

  if (auth.status === "authenticated") return null;

  return (
    <div>
      <p className="mb-5 text-sm text-muted-foreground">
        {t("intro")}
      </p>

      {errors.root && (
        <p
          role="alert"
          aria-live="assertive"
          className="mb-5 flex items-center gap-2 text-sm font-medium text-destructive"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          {errors.root.message}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bb-form-stack" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-username">
            {t("emailLabel")} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="login-username"
              autoComplete="username"
              placeholder={t("emailPlaceholder")}
              className="pr-11"
              aria-invalid={!!errors.login}
              aria-describedby={errors.login ? "login-username-error" : undefined}
              {...register("login")}
            />
            <User
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-primary"
            />
          </div>
          {errors.login && (
            <p id="login-username-error" role="alert" className="text-sm text-destructive">
              {errors.login.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-password">
            {t("passwordLabel")} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder={t("passwordPlaceholder")}
              className="pr-11"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              {...register("password")}
            />
            <KeyRound
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-primary"
            />
          </div>
          {errors.password && (
            <p id="login-password-error" role="alert" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <Controller
              control={control}
              name="remember"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value === true)}
                />
              )}
            />
            <span className="text-sm text-foreground">{t("remember")}</span>
          </label>
          <Link href={toForgotPasswordPath()} className="bb-link text-sm font-normal underline">
            {t("forgotPassword")}
          </Link>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>

      <SocialLoginButtons returnTo={returnTo} />
    </div>
  );
}
