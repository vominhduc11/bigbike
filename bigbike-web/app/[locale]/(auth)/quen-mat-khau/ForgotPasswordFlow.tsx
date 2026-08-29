"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { AuthField } from "@/components/auth/AuthField";
import { AuthTitleBlock } from "@/components/auth/AuthPageFrame";

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
    setFocus,
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(createForgotPasswordSchema(tValidation)),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setFocus("login");
    }
  }, [setFocus]);

  async function onSubmit(values: ForgotPasswordFormValues) {
    try {
      await requestPasswordReset(values.login.trim());
      reset();
      setSuccess(true);
    } catch {
      setError("root", { message: t("errorGeneric") });
    }
  }

  if (success) {
    return (
      <>
        <AuthTitleBlock title={t("title")} />
        <div>
          <p className="m-0">{t("sentDescription")}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthTitleBlock title={t("title")}>
        <p className="m-0">{t("subtitle")}</p>
      </AuthTitleBlock>
      <div>
        <FormRootError message={errors.root?.message} />
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <AuthField
            id="forgot-login"
            label={t("emailLabel")}
            autoComplete="username"
            registration={register("login")}
            error={errors.login}
          />
          <div>
            <Button type="submit" size="auth" disabled={isSubmitting}>
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth.reset");
  const tForgot = useTranslations("Auth.forgot");
  const tValidation = useTranslations("Auth.validation");
  const tPassword = useTranslations("Auth.password");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setFocus,
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(createResetPasswordSchema(tValidation)),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setFocus("password");
    }
  }, [setFocus]);

  async function onSubmit(values: ResetPasswordFormValues) {
    try {
      await resetCustomerPassword(token, values.password);
      setSuccess(true);
    } catch {
      setError("root", { message: t("errorGeneric") });
    }
  }

  if (success) {
    return (
      <>
        <AuthTitleBlock title={t("successHeading")} centered>
          <p className="m-0">{t("successDescription")}</p>
        </AuthTitleBlock>
        <div>
          <div>
            <Button
              type="button"
              size="auth"
              onClick={() => router.push(toLoginPath(undefined, locale))}
            >
              {t("loginNow")}
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthTitleBlock title={tForgot("title")}>
        <p className="m-0">{t("subtitle")}</p>
      </AuthTitleBlock>
      <div>
        <FormRootError message={errors.root?.message} />
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <AuthField
            id="reset-password"
            type="password"
            autoComplete="new-password"
            label={t("newPasswordLabel")}
            placeholder={t("newPasswordPlaceholder")}
            hint={tPassword("ruleMin8")}
            passwordToggleLabels={{ show: tPassword("show"), hide: tPassword("hide") }}
            registration={register("password")}
            error={errors.password}
          />
          <AuthField
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            label={t("confirmLabel")}
            placeholder={t("confirmPlaceholder")}
            passwordToggleLabels={{ show: tPassword("show"), hide: tPassword("hide") }}
            registration={register("confirm")}
            error={errors.confirm}
          />
          <div>
            <Button type="submit" size="auth" disabled={isSubmitting}>
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

export default function ForgotPasswordFlow({ token }: ForgotPasswordFlowProps) {
  return token ? <ResetPasswordForm token={token} /> : <RequestResetForm />;
}
