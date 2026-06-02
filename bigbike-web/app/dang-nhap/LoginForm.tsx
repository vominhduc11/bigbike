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
import { bbLink } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthField } from "@/components/ui/AuthField";
import { FormRootError } from "@/components/ui/FormRootError";
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
      <FormRootError message={errors.root?.message} />

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-[30px]" noValidate>
        <AuthField
          describeError
          id="login-username"
          label={t("emailLabel")}
          autoComplete="username"
          placeholder={t("emailPlaceholder")}
          registration={register("login")}
          error={errors.login}
        />

        <AuthField
          describeError
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          label={t("passwordLabel")}
          registration={register("password")}
          error={errors.password}
        />

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
          <Link href={toForgotPasswordPath()} className={cn(bbLink, "text-sm")}>
            {t("forgotPassword")}
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="auth"
          disabled={isSubmitting}
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>

      <SocialLoginButtons returnTo={returnTo} />
    </div>
  );
}
