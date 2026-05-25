"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordReset, resetCustomerPassword } from "@/lib/api/client-api";
import {
  createForgotPasswordSchema,
  createResetPasswordSchema,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
} from "@/lib/schemas/auth";
import { toLoginPath } from "@/lib/utils/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ForgotPasswordFlowProps = {
  token?: string | null;
};

function RootError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" aria-live="assertive" className="mb-5 text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

function RequestResetForm() {
  const t = useTranslations("Auth.forgot");
  const tValidation = useTranslations("Auth.validation");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(createForgotPasswordSchema(tValidation)),
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    try {
      await requestPasswordReset(values.login.trim());
      reset();
      setSuccess(true);
    } catch (err: unknown) {
      setError("root", { message: (err as Error).message });
    }
  }

  if (success) {
    return (
      <>
        <h1 className="mb-3 text-base font-semibold normal-case">{t("title")}</h1>
        <p className="m-0 text-sm leading-relaxed text-foreground">{t("sentDescription")}</p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-3 text-base font-semibold normal-case">{t("title")}</h1>
      <p className="mb-5 text-sm leading-relaxed text-foreground">{t("subtitle")}</p>
      <RootError message={errors.root?.message} />
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-[30px]" noValidate>
        <div>
          <Label htmlFor="forgot-login" className="sr-only">
            {t("emailLabel")}
          </Label>
          <Input
            id="forgot-login"
            autoComplete="username"
            className="h-[52px] min-h-[52px] px-5 py-0 text-sm"
            aria-invalid={!!errors.login}
            aria-describedby={errors.login ? "forgot-login-error" : undefined}
            {...register("login")}
          />
          {errors.login && (
            <p id="forgot-login-error" role="alert" className="mt-2 text-sm text-destructive">
              {errors.login.message}
            </p>
          )}
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
    </>
  );
}

function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth.reset");
  const tForgot = useTranslations("Auth.forgot");
  const tValidation = useTranslations("Auth.validation");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(createResetPasswordSchema(tValidation)),
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    try {
      await resetCustomerPassword(token, values.password);
      setSuccess(true);
    } catch (err: unknown) {
      setError("root", { message: (err as Error).message });
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <h1 className="mb-3 text-base font-semibold normal-case">{t("successHeading")}</h1>
        <p className="mb-6 text-sm leading-relaxed text-foreground">{t("successDescription")}</p>
        <Button asChild variant="primary" className="h-[52px] w-full py-0 text-sm hover:not-disabled:scale-100">
          <Link href={toLoginPath()}>{t("loginNow")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-3 text-base font-semibold normal-case">{tForgot("title")}</h1>
      <p className="mb-5 text-sm leading-relaxed text-foreground">{t("subtitle")}</p>
      <RootError message={errors.root?.message} />
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-[30px]" noValidate>
        <div className="flex flex-col gap-2.5">
          <Label htmlFor="reset-password">
            {t("newPasswordLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder={t("newPasswordPlaceholder")}
            className="h-[52px] min-h-[52px] px-5 py-0 text-sm"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "reset-password-error" : undefined}
            {...register("password")}
          />
          {errors.password && (
            <p id="reset-password-error" role="alert" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2.5">
          <Label htmlFor="reset-confirm">
            {t("confirmLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t("confirmPlaceholder")}
            className="h-[52px] min-h-[52px] px-5 py-0 text-sm"
            aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? "reset-confirm-error" : undefined}
            {...register("confirm")}
          />
          {errors.confirm && (
            <p id="reset-confirm-error" role="alert" className="text-sm text-destructive">
              {errors.confirm.message}
            </p>
          )}
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
    </>
  );
}

export default function ForgotPasswordFlow({ token }: ForgotPasswordFlowProps) {
  return <div className="bb-auth-wrap">{token ? <ResetPasswordForm token={token} /> : <RequestResetForm />}</div>;
}
