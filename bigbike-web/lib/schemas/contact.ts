import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên"),
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(10, "Nội dung tối thiểu 10 ký tự"),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
