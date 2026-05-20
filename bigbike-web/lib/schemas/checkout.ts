import { z } from "zod";

// Match backend regex in CheckoutService.validateAddress
export const VN_PHONE_RE = /^(0[3-9][0-9]{8}|\+84[3-9][0-9]{8})$/;

type CheckoutValidationT = (key: string) => string;

export function createCheckoutAddressSchema(t: CheckoutValidationT) {
  return z.object({
    fullName: z.string().min(1, t("fullNameRequired")),
    phone: z
      .string()
      .regex(VN_PHONE_RE, t("phoneInvalid")),
    email: z
      .string()
      .email(t("emailInvalid"))
      .optional()
      .or(z.literal("")),
    country: z.string(),
    province: z.string().min(1, t("provinceRequired")),
    district: z.string().min(1, t("districtRequired")),
    ward: z.string().optional(),
    addressLine1: z.string().min(1, t("addressRequired")),
  });
}

export const checkoutAddressSchema = z.object({
  fullName: z.string().min(1, "Please enter your full name"),
  phone: z
    .string()
    .regex(VN_PHONE_RE, "Invalid phone number (example: 0901234567 or +84901234567)"),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  country: z.string(),
  province: z.string().min(1, "Please select a province/city"),
  district: z.string().min(1, "Please select a district"),
  ward: z.string().optional(),
  addressLine1: z.string().min(1, "Please enter your detailed address"),
});

export type CheckoutAddressFormValues = z.infer<typeof checkoutAddressSchema>;
