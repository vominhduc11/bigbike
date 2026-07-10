"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import type { Locale } from "@/i18n/locale";
import { FormRootError } from "@/components/ui/FormRootError";
import { Button } from "@/components/ui/button";
import { WpAuthField } from "@/components/wp/WpAuthField";

type ForgotPasswordFlowProps = {
  token?: string | null;
};

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
        <div className="user-activity-content-title mb-[30px]">
          <h1 className="mb-2">{t("title")}</h1>
        </div>
        <div className="row">
          <div className="col-12">
            <p className="m-0">{t("sentDescription")}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="user-activity-content-title mb-[30px]">
        <h1 className="mb-2">{t("title")}</h1>
        <p className="m-0">{t("subtitle")}</p>
      </div>
      <div className="row">
        <div className="col-12">
          <FormRootError message={errors.root?.message} />
          <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <WpAuthField
              id="forgot-login"
              label={t("emailLabel")}
              autoComplete="username"
              registration={register("login")}
              error={errors.login}
            />
            <div className="form-submit form-group">
              <Button type="submit" size="auth" disabled={isSubmitting}>
                {isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth.reset");
  const tForgot = useTranslations("Auth.forgot");
  const tValidation = useTranslations("Auth.validation");
  const locale = useLocale() as Locale;
  const router = useRouter();
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
      <>
        <div className="user-activity-content-title mb-[30px] text-center">
          <h1 className="mb-2">{t("successHeading")}</h1>
          <p className="m-0">{t("successDescription")}</p>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="form-submit form-group">
              <Button type="button" size="auth" onClick={() => router.push(toLoginPath(undefined, locale))}>
                {t("loginNow")}
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="user-activity-content-title mb-[30px]">
        <h1 className="mb-2">{tForgot("title")}</h1>
        <p className="m-0">{t("subtitle")}</p>
      </div>
      <div className="row">
        <div className="col-12">
          <FormRootError message={errors.root?.message} />
          <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <WpAuthField
              id="reset-password"
              type="password"
              autoComplete="new-password"
              label={t("newPasswordLabel")}
              placeholder={t("newPasswordPlaceholder")}
              registration={register("password")}
              error={errors.password}
            />
            <WpAuthField
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              label={t("confirmLabel")}
              placeholder={t("confirmPlaceholder")}
              registration={register("confirm")}
              error={errors.confirm}
            />
            <div className="form-submit form-group">
              <Button type="submit" size="auth" disabled={isSubmitting}>
                {isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function ForgotPasswordFlow({ token }: ForgotPasswordFlowProps) {
  return token ? <ResetPasswordForm token={token} /> : <RequestResetForm />;
}
