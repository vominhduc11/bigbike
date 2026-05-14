import { z } from "zod";

// Match backend regex in CheckoutService.validateAddress
const VN_PHONE_RE = /^(0[3-9][0-9]{8}|\+84[3-9][0-9]{8})$/;

export const checkoutAddressSchema = z.object({
  fullName: z.string().min(1, "Vui lòng nhập họ và tên"),
  phone: z
    .string()
    .regex(VN_PHONE_RE, "Số điện thoại không hợp lệ (ví dụ: 0901234567 hoặc +84901234567)"),
  email: z
    .string()
    .email("Email không hợp lệ")
    .optional()
    .or(z.literal("")),
  country: z.string(),
  province: z.string().min(1, "Vui lòng chọn tỉnh/thành"),
  district: z.string().min(1, "Vui lòng chọn quận/huyện"),
  ward: z.string().optional(),
  addressLine1: z.string().min(1, "Vui lòng nhập địa chỉ chi tiết"),
});

export type CheckoutAddressFormValues = z.infer<typeof checkoutAddressSchema>;
