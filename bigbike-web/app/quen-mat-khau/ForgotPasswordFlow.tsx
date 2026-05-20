"use client";

import Link from "next/link";
import Image from "next/image";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ForgotPasswordFlowProps = {
  token?: string | null;
};

function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="bb-auth-header">
      <h1 className="bb-auth-title">{title}</h1>
      {subtitle && <p className="bb-page-subtitle mx-auto">{subtitle}</p>}
    </header>
  );
}

function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

function RootError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-none border border-destructive/30 bg-destructive/10 px-4 py-3 mb-5 text-sm text-destructive"
    >
      {message}
    </div>
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
        <AuthHeader title={t("title")} />
        <div className="text-center">
          <Image
            src="/auth/forgot-password-sent.png"
            alt={t("sentImageAlt")}
            width={224}
            height={200}
            className="mx-auto"
          />
          <p className="bb-page-subtitle mx-auto mt-6">
            {t("sentDescription")}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeader title={t("title")} subtitle={t("subtitle")} />
      <RootError message={errors.root?.message} />
      <form onSubmit={handleSubmit(onSubmit)} className="bb-form-stack" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="forgot-login">
            {t("emailLabel")} <RequiredMark />
          </Label>
          <Input
            id="forgot-login"
            autoComplete="username"
            placeholder={t("emailPlaceholder")}
            aria-invalid={!!errors.login}
            aria-describedby={errors.login ? "forgot-login-error" : undefined}
            {...register("login")}
          />
          {errors.login && (
            <p id="forgot-login-error" role="alert" className="text-sm text-destructive">
              {errors.login.message}
            </p>
          )}
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
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
        <Image
          src="/auth/reset-success.png"
          alt={t("successImageAlt")}
          width={200}
          height={220}
          className="mx-auto"
        />
        <h2 className="bb-auth-title mt-6">{t("successHeading")}</h2>
        <p className="bb-page-subtitle mx-auto mt-3">
          {t("successDescription")}
        </p>
        <Button asChild variant="primary" className="w-full mt-8">
          <Link href={toLoginPath()}>{t("loginNow")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeader title={tForgot("title")} subtitle={t("subtitle")} />
      <RootError message={errors.root?.message} />
      <form onSubmit={handleSubmit(onSubmit)} className="bb-form-stack" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password">
            {t("newPasswordLabel")} <RequiredMark />
          </Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder={t("newPasswordPlaceholder")}
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm">
            {t("confirmLabel")} <RequiredMark />
          </Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t("confirmPlaceholder")}
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
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </>
  );
}

export default function ForgotPasswordFlow({ token }: ForgotPasswordFlowProps) {
  return (
    <div className="bb-auth-wrap">
      {token ? <ResetPasswordForm token={token} /> : <RequestResetForm />}
    </div>
  );
}
