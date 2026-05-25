"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginCustomer } from "@/lib/api/client-api";
import { refreshAuth, useAuth } from "@/lib/auth/auth-store";
import { createLoginSchema, type LoginFormValues } from "@/lib/schemas/auth";
import { toForgotPasswordPath } from "@/lib/utils/routes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialLoginButtons } from "./SocialLoginButtons";

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
      const message = /invalid credentials/i.test(raw) ? t("invalidCredentials") : raw;
      setError("root", { message });
    }
  }

  if (auth.status === "authenticated") return null;

  return (
    <div>
      {errors.root && (
        <p role="alert" aria-live="assertive" className="mb-5 text-sm font-medium text-destructive">
          {errors.root.message}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-[30px]" noValidate>
        <div className="flex flex-col gap-2.5">
          <Label htmlFor="login-username">
            {t("emailLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="login-username"
            autoComplete="username"
            placeholder={t("emailPlaceholder")}
            className="h-[52px] min-h-[52px] px-5 py-0 text-sm"
            aria-invalid={!!errors.login}
            aria-describedby={errors.login ? "login-username-error" : undefined}
            {...register("login")}
          />
          {errors.login && (
            <p id="login-username-error" role="alert" className="text-sm text-destructive">
              {errors.login.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <Label htmlFor="login-password">
            {t("passwordLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            className="h-[52px] min-h-[52px] px-5 py-0 text-sm"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "login-password-error" : undefined}
            {...register("password")}
          />
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
                <Checkbox checked={field.value} onCheckedChange={(value) => field.onChange(value === true)} />
              )}
            />
            <span className="text-sm text-foreground">{t("remember")}</span>
          </label>
          <Link href={toForgotPasswordPath()} className="bb-link text-sm font-normal underline">
            {t("forgotPassword")}
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="h-[52px] w-full py-0 text-sm hover:not-disabled:scale-100"
          disabled={isSubmitting}
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>

      <SocialLoginButtons returnTo={returnTo} />
    </div>
  );
}
