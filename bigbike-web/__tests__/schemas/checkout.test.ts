import { describe, it, expect } from "vitest";
import { checkoutAddressSchema } from "@/lib/schemas/checkout";

const valid = {
  fullName: "Nguyễn Văn A",
  phone: "0901234567",
  country: "VN",
  province: "Hà Nội",
  district: "Cầu Giấy",
  addressLine1: "123 Đường ABC",
};

describe("checkoutAddressSchema", () => {
  it("validates a correct address", () => {
    expect(checkoutAddressSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing fullName", () => {
    const result = checkoutAddressSchema.safeParse({ ...valid, fullName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid Vietnamese phone number", () => {
    const cases = ["12345678", "1234567890", "0201234567", "abc"];
    for (const phone of cases) {
      const result = checkoutAddressSchema.safeParse({ ...valid, phone });
      expect(result.success).toBe(false);
    }
  });

  it("accepts all valid VN phone prefixes (03x–09x)", () => {
    const prefixes = ["03", "05", "07", "08", "09"];
    for (const prefix of prefixes) {
      const phone = `${prefix}01234567`;
      const result = checkoutAddressSchema.safeParse({ ...valid, phone });
      expect(result.success).toBe(true);
    }
  });

  it("rejects missing province", () => {
    const result = checkoutAddressSchema.safeParse({ ...valid, province: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email when provided", () => {
    const result = checkoutAddressSchema.safeParse({ ...valid, email: "not-valid" });
    expect(result.success).toBe(false);
  });

  it("accepts empty email (optional)", () => {
    const result = checkoutAddressSchema.safeParse({ ...valid, email: "" });
    expect(result.success).toBe(true);
  });
});
