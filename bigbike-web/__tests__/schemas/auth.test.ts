import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, resetPasswordSchema } from "@/lib/schemas/auth";

describe("loginSchema", () => {
  it("validates a correct payload", () => {
    const result = loginSchema.safeParse({ login: "user@example.com", password: "secret", remember: false });
    expect(result.success).toBe(true);
  });

  it("rejects empty login", () => {
    const result = loginSchema.safeParse({ login: "", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ login: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    firstName: "An",
    email: "an@example.com",
    password: "12345678",
    confirm: "12345678",
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
});
