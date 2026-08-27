import { describe, it, expect } from "vitest";
import {
  createLoginSchema,
  createRegisterSchema,
  createResetPasswordSchema,
} from "@/lib/schemas/auth";

// Identity translator — assert on validation logic, not on localized messages.
const t = (key: string) => key;
const loginSchema = createLoginSchema(t);
const registerSchema = createRegisterSchema(t);
const resetPasswordSchema = createResetPasswordSchema(t);

describe("loginSchema", () => {
  it("validates a correct payload", () => {
    const result = loginSchema.safeParse({
      login: "user@example.com",
      password: "secret",
      remember: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty login", () => {
    const result = loginSchema.safeParse({ login: "", password: "secret", remember: false });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      login: "user@example.com",
      password: "",
      remember: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    fullName: "An",
    email: "an@example.com",
    phone: "0912345678",
    password: "12345678",
    confirm: "12345678",
    privacyConsent: true,
  };

  it("validates a correct payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ ...valid, password: "1234", confirm: "1234" });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched confirm password", () => {
    const result = registerSchema.safeParse({ ...valid, confirm: "different" });
    expect(result.success).toBe(false);
    const errors = result.error!.flatten().fieldErrors;
    expect(errors.confirm).toBeDefined();
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("uses the required message when email is blank", () => {
    const result = registerSchema.safeParse({ ...valid, email: "" });
    expect(result.success).toBe(false);
    expect(result.error!.flatten().fieldErrors.email).toEqual(["emailRequired"]);
  });

  it("requires Privacy Policy agreement", () => {
    const result = registerSchema.safeParse({ ...valid, privacyConsent: false });
    expect(result.success).toBe(false);
    expect(result.error!.flatten().fieldErrors.privacyConsent).toEqual(["privacyConsentRequired"]);
  });
});

describe("resetPasswordSchema", () => {
  it("rejects passwords that do not match", () => {
    const result = resetPasswordSchema.safeParse({ password: "newpass1", confirm: "newpass2" });
    expect(result.success).toBe(false);
  });

  it("validates matching passwords of sufficient length", () => {
    const result = resetPasswordSchema.safeParse({ password: "newpass1", confirm: "newpass1" });
    expect(result.success).toBe(true);
  });

  it("uses the required message when the new password is blank", () => {
    const result = resetPasswordSchema.safeParse({ password: "", confirm: "" });
    expect(result.success).toBe(false);
    expect(result.error!.flatten().fieldErrors.password).toEqual(["passwordRequired"]);
  });
});
