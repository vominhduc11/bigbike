import { z } from "zod";
import { VN_PHONE_RE } from "./checkout";

export type QuickBuyFormValues = {
  customerName: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  ward: string;
  addressLine1: string;
  quantity: number;
  paymentMethod: "COD" | "BACS";
  customerNote?: string;
};

// Factory that attaches localised error messages — use as zodResolver argument
export function createQuickBuySchema(t: (key: string) => string) {
  return z.object({
    customerName: z.string().min(2, t("fullNameRequired")).max(100),
    phone: z.string().regex(VN_PHONE_RE, t("phoneInvalid")),
    email: z.string().email(t("emailInvalid")),
    province: z.string().min(1, t("provinceRequired")),
    district: z.string().min(1, t("districtRequired")),
    ward: z.string(),
    addressLine1: z.string().min(1, t("addressRequired")),
    quantity: z.number().int().min(1),
    paymentMethod: z.enum(["COD", "BACS"]),
    customerNote: z.string().max(1000).optional(),
  }) satisfies z.ZodType<QuickBuyFormValues>;
}
