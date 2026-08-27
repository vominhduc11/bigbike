import { z } from "zod";

type AuthValidationT = (key: string) => string;

export function createLoginSchema(t: AuthValidationT) {
  return z.object({
    login: z.string().min(1, t("loginRequired")),
    password: z.string().min(1, t("passwordRequired")),
    remember: z.boolean(),
  });
}

export function createRegisterSchema(t: AuthValidationT) {
  return z
    .object({
      fullName: z.string().min(1, t("firstNameRequired")),
      email: z
        .string()
        .min(1, t("emailRequired"))
        .refine(
          (value) => value.length === 0 || z.email().safeParse(value).success,
          t("emailInvalid"),
        ),
      phone: z
        .string()
        .min(1, t("phoneRequired"))
        .refine((value) => value.length === 0 || /^\+?[0-9]{8,15}$/.test(value), t("phoneInvalid")),
      password: z
        .string()
        .min(1, t("passwordRequired"))
        .refine((value) => value.length === 0 || value.length >= 8, t("passwordMin8")),
      confirm: z.string().min(1, t("confirmRequired")),
      privacyConsent: z.boolean().refine((value) => value, t("privacyConsentRequired")),
    })
    .refine((d) => d.password === d.confirm, {
      message: t("passwordMismatch"),
      path: ["confirm"],
    });
}

export function createForgotPasswordSchema(t: AuthValidationT) {
  return z.object({
    login: z.string().min(1, t("loginRequired")),
  });
}

export function createResetPasswordSchema(t: AuthValidationT) {
  return z
    .object({
      password: z
        .string()
        .min(1, t("passwordRequired"))
        .refine((value) => value.length === 0 || value.length >= 8, t("passwordMin8")),
      confirm: z.string().min(1, t("confirmRequired")),
    })
    .refine((d) => d.password === d.confirm, {
      message: t("passwordMismatch"),
      path: ["confirm"],
    });
}

export type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;
export type RegisterFormValues = z.infer<ReturnType<typeof createRegisterSchema>>;
export type ForgotPasswordFormValues = z.infer<ReturnType<typeof createForgotPasswordSchema>>;
export type ResetPasswordFormValues = z.infer<ReturnType<typeof createResetPasswordSchema>>;
