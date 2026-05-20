"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { registerCustomer } from "@/lib/api/client-api";
import { refreshAuth } from "@/lib/auth/auth-store";
import { createRegisterSchema, type RegisterFormValues } from "@/lib/schemas/auth";
import { toAccountPath } from "@/lib/utils/routes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Register form body — rendered inside the shared tabbed auth shell (`AuthTabs`).
 * On success it swaps to an email-confirmation panel.
 */
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
      await registerCustomer(
        values.email,
        values.password,
        values.firstName,
        values.lastName || undefined,
      );
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
        <div className="mb-4 flex justify-center">
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--bb-brand-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="mb-3 text-[clamp(1.25rem,3vw,1.75rem)]">{t("successHeading")}</h2>
        {confirmedEmail && (
          <p className="bb-auth-footer mb-5">
            {t.rich("successDescription", {
              email: confirmedEmail,
              strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
            })}
          </p>
        )}
        <Button type="button" variant="primary" className="w-full" onClick={() => router.push(returnTo)}>
          {t("successCta")}
        </Button>
      </div>
    );
  }

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
          <Label htmlFor="reg-firstName">
            {t("firstNameLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-firstName"
            autoComplete="given-name"
            placeholder={t("firstNamePlaceholder")}
            {...register("firstName")}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-lastName">{t("lastNameLabel")}</Label>
          <Input
            id="reg-lastName"
            autoComplete="family-name"
            placeholder={t("lastNamePlaceholder")}
            {...register("lastName")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-email">
            {t("emailLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            {...register("email")}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-password">
            {t("passwordLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-confirm">
            {t("confirmLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t("confirmPlaceholder")}
            {...register("confirm")}
          />
          {errors.confirm && <p className="text-sm text-destructive">{errors.confirm.message}</p>}
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </div>
  );
}
