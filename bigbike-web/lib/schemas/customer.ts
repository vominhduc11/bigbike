import { z } from "zod";

type ValidationT = (key: string) => string;

const optionalEmail = (t: ValidationT) => z.string().trim().max(255, t("max255")).refine(
  (value) => !value || z.string().email().safeParse(value).success,
  t("emailInvalid"),
);

export function createAddressSchema(t: ValidationT) {
  return z.object({
    type: z.enum(["BILLING", "SHIPPING"]),
    fullName: z.string().trim().min(1, t("required")).max(255, t("max255")),
    phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/, t("phoneInvalid")),
    email: optionalEmail(t),
    province: z.string().trim().min(1, t("required")).max(255, t("max255")),
    ward: z.string().trim().min(1, t("required")).max(255, t("max255")),
    addressLine1: z.string().trim().min(1, t("required")).max(500, t("max500")),
    isDefault: z.boolean(),
  });
}

export function createReviewSchema(t: ValidationT, signedIn: boolean) {
  return z.object({
    rating: z.number().refine((value) => value >= 1 && value <= 5 && Number.isInteger(value * 2), t("ratingInvalid")),
    authorName: signedIn ? z.string() : z.string().trim().min(1, t("required")).max(80, t("max80")),
    authorEmail: optionalEmail(t),
    comment: z.string().trim().max(1000, t("max1000")),
    website: z.string(),
  });
}

export function createProfileSchema(t: ValidationT, initialEmail: string) {
  return z.object({
    displayName: z.string().trim().max(255, t("max255")),
    email: optionalEmail(t),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  }).superRefine((value, context) => {
    if (value.newPassword && (value.newPassword.length < 8 || value.newPassword.length > 256)) {
      context.addIssue({ code: "custom", path: ["newPassword"], message: t("passwordLength") });
    }
    if (value.newPassword && value.newPassword !== value.confirmPassword) {
      context.addIssue({ code: "custom", path: ["confirmPassword"], message: t("passwordMismatch") });
    }
    if ((value.email && value.email !== initialEmail) || value.newPassword) {
      if (!value.currentPassword) context.addIssue({ code: "custom", path: ["currentPassword"], message: t("currentPasswordRequired") });
    }
  });
}

export function createOrderLookupSchema(t: ValidationT) {
  return z.object({
    orderNumber: z.string().trim().min(1, t("required")),
    orderKey: z.string().trim().min(1, t("required")),
  });
}

export type AddressFormValues = z.infer<ReturnType<typeof createAddressSchema>>;
export type ReviewFormValues = z.infer<ReturnType<typeof createReviewSchema>>;
export type ProfileFormValues = z.infer<ReturnType<typeof createProfileSchema>>;
export type OrderLookupFormValues = z.infer<ReturnType<typeof createOrderLookupSchema>>;
