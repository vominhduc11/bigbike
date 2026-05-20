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
      firstName: z.string().min(1, t("firstNameRequired")),
      lastName: z.string().optional(),
      email: z.string().email(t("emailInvalid")),
      password: z.string().min(8, t("passwordMin8")),
      confirm: z.string().min(1, t("confirmRequired")),
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
      password: z.string().min(8, t("passwordMin8")),
      confirm: z.string().min(1, t("confirmRequired")),
    })
    .refine((d) => d.password === d.confirm, {
      message: t("passwordMismatch"),
      path: ["confirm"],
    });
}

export const loginSchema = z.object({
  login: z.string().min(1, "Please enter your email or phone number"),
  password: z.string().min(1, "Please enter your password"),
  remember: z.boolean(),
});

export const registerSchema = z
  .object({
    firstName: z.string().min(1, "Please enter your first name"),
    lastName: z.string().optional(),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export const forgotPasswordSchema = z.object({
  login: z.string().min(1, "Please enter your email or phone number"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
