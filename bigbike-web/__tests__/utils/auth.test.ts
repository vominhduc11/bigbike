import { describe, it, expect } from "vitest";
import { isSafeReturnTo } from "@/lib/utils/auth";

describe("isSafeReturnTo — login open-redirect guard", () => {
  it("accepts a simple account path", () => {
    expect(isSafeReturnTo("/tai-khoan")).toBe(true);
  });

  it("accepts a deep order path", () => {
    expect(isSafeReturnTo("/tai-khoan/don-hang/abc-123")).toBe(true);
  });

  it("accepts root path", () => {
    expect(isSafeReturnTo("/")).toBe(true);
  });

  it("rejects absolute HTTPS URL", () => {
    expect(isSafeReturnTo("https://evil.com")).toBe(false);
  });

  it("rejects protocol-relative URL", () => {
    expect(isSafeReturnTo("//evil.com")).toBe(false);
  });

  it("rejects protocol-relative URL with path", () => {
    expect(isSafeReturnTo("//evil.com/steal-cookies")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isSafeReturnTo("")).toBe(false);
  });

  it("rejects javascript: scheme", () => {
    expect(isSafeReturnTo("javascript:alert(1)")).toBe(false);
  });

  it("rejects relative path without leading slash", () => {
    expect(isSafeReturnTo("tai-khoan")).toBe(false);
  });
});
