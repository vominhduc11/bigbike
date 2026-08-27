import { describe, expect, it } from "vitest";
import { getPasswordStrength } from "@/components/auth/PasswordStrengthMeter";

describe("getPasswordStrength", () => {
  it("does not turn the advisory indicator into a new password rule", () => {
    expect(getPasswordStrength("")).toBe("empty");
    expect(getPasswordStrength("12345678")).toBe("fair");
  });

  it("rewards longer and more varied passwords", () => {
    expect(getPasswordStrength("abcdefgh")).toBe("weak");
    expect(getPasswordStrength("Abcdefgh123!")).toBe("strong");
  });
});
