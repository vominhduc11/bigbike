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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        <h2 className="mb-3 text-base font-semibold normal-case">{t("successHeading")}</h2>
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
          className="h-[52px] w-full py-0 text-sm hover:not-disabled:scale-100"
          onClick={() => router.push(returnTo)}
        >
          {t("successCta")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      {errors.root && (
        <p role="alert" aria-live="assertive" className="mb-5 text-sm font-medium text-destructive">
          {errors.root.message}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-[30px]" noValidate>
        <div className="flex flex-col gap-2.5">
          <Label htmlFor="reg-fullName">
            {t("fullNameLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-fullName"
            autoComplete="name"
            placeholder={t("fullNamePlaceholder")}
            className="h-[52px] min-h-[52px] px-5 py-0 text-sm"
            {...register("fullName")}
          />
          {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
        </div>

        <div className="flex flex-col gap-2.5">
          <Label htmlFor="reg-email">
            {t("emailLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            className="h-[52px] min-h-[52px] px-5 py-0 text-sm"
            {...register("email")}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-2.5">
          <Label htmlFor="reg-phone">
            {t("phoneLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-phone"
            type="tel"
            autoComplete="tel"
            placeholder={t("phonePlaceholder")}
            className="h-[52px] min-h-[52px] px-5 py-0 text-sm"
            {...register("phone")}
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>

        <div className="flex flex-col gap-2.5">
          <Label htmlFor="reg-password">
            {t("passwordLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            className="h-[52px] min-h-[52px] px-5 py-0 text-sm"
            {...register("password")}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-2.5">
          <Label htmlFor="reg-confirm">
            {t("confirmLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t("confirmPlaceholder")}
            className="h-[52px] min-h-[52px] px-5 py-0 text-sm"
            {...register("confirm")}
          />
          {errors.confirm && <p className="text-sm text-destructive">{errors.confirm.message}</p>}
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
