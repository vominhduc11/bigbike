import { describe, it, expect } from "vitest";
import robots from "@/app/robots";

function collectDisallow(result: ReturnType<typeof robots>): string[] {
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  return rules.flatMap((r) =>
    Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : [],
  );
}

describe("robots()", () => {
  it("disallows /xac-nhan-email (without trailing slash)", () => {
    const disallow = collectDisallow(robots());
    expect(disallow).toContain("/xac-nhan-email");
  });

  it("disallows /xac-nhan-email/ (with trailing slash)", () => {
    const disallow = collectDisallow(robots());
    expect(disallow).toContain("/xac-nhan-email/");
  });

  it("disallows auth and account routes", () => {
    const disallow = collectDisallow(robots());
    expect(disallow.some((p) => p.includes("/tai-khoan"))).toBe(true);
    expect(disallow.some((p) => p.includes("/dang-nhap"))).toBe(true);
  });

  it("disallows API routes", () => {
    const disallow = collectDisallow(robots());
    expect(disallow).toContain("/api/");
  });

  it("includes sitemap URL", () => {
    expect(robots().sitemap).toMatch(/sitemap\.xml$/);
  });
});
