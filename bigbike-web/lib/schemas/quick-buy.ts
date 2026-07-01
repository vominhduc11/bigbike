import { z } from "zod";
import { VN_PHONE_RE } from "./checkout";

export type QuickBuyFormValues = {
  customerName: string;
  phone: string;
  email: string;
  province: string;
  ward: string;
  addressLine1: string;
  quantity: number;
  customerNote?: string;
};

// Factory that attaches localised error messages — use as zodResolver argument
export function createQuickBuySchema(t: (key: string) => string) {
  return z.object({
    customerName: z.string().min(2, t("fullNameRequired")).max(100),
    phone: z.string().regex(VN_PHONE_RE, t("phoneInvalid")),
    email: z.string().email(t("emailInvalid")),
    province: z.string().min(1, t("provinceRequired")),
    ward: z.string().min(1, t("wardRequired")),
    addressLine1: z.string().min(1, t("addressRequired")),
    quantity: z.number().int().min(1),
    customerNote: z.string().max(1000).optional(),
  }) satisfies z.ZodType<QuickBuyFormValues>;
}
