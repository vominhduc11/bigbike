"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerCustomer } from "@/lib/api/client-api";
import { refreshAuth } from "@/lib/auth/auth-store";
import { createRegisterSchema, type RegisterFormValues } from "@/lib/schemas/auth";
import { toAccountPath } from "@/lib/utils/routes";
import { authHeading } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AuthField } from "@/components/ui/AuthField";
import { FormRootError } from "@/components/ui/FormRootError";
import { SocialLoginButtons } from "@/app/dang-nhap/SocialLoginButtons";

export function RegisterForm({ returnTo = toAccountPath() }: { returnTo?: string }) {
  const t = useTranslations("Auth.register");
  const tValidation = useTranslations("Auth.validation");
  const router = useRouter();
  const [registered, setRegistered] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(createRegisterSchema(tValidation)),
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      await registerCustomer(values.email, values.password, values.fullName, undefined, values.phone);
      await refreshAuth();
      setConfirmedEmail(values.email);
      setRegistered(true);
    } catch (err: unknown) {
      setError("root", { message: (err as Error).message });
    }
  }

  if (registered) {
    return (
      <div className="text-center">
        <h2 className={cn(authHeading, "mb-3")}>{t("successHeading")}</h2>
        {confirmedEmail && (
          <p className="bb-auth-footer mb-5">
            {t.rich("successDescription", {
              email: confirmedEmail,
              strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
            })}
          </p>
        )}
        <Button
          type="button"
          variant="primary"
          size="auth"
          onClick={() => router.push(returnTo)}
        >
          {t("successCta")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <FormRootError message={errors.root?.message} />

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-[30px]" noValidate>
        <AuthField
          id="reg-fullName"
          label={t("fullNameLabel")}
          autoComplete="name"
          placeholder={t("fullNamePlaceholder")}
          registration={register("fullName")}
          error={errors.fullName}
        />

        <AuthField
          id="reg-email"
          type="email"
          label={t("emailLabel")}
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          registration={register("email")}
          error={errors.email}
        />

        <AuthField
          id="reg-phone"
          type="tel"
          label={t("phoneLabel")}
          autoComplete="tel"
          placeholder={t("phonePlaceholder")}
          registration={register("phone")}
          error={errors.phone}
        />

        <AuthField
          id="reg-password"
          type="password"
          label={t("passwordLabel")}
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          registration={register("password")}
          error={errors.password}
        />

        <AuthField
          id="reg-confirm"
          type="password"
          label={t("confirmLabel")}
          autoComplete="new-password"
          placeholder={t("confirmPlaceholder")}
          registration={register("confirm")}
          error={errors.confirm}
        />

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
