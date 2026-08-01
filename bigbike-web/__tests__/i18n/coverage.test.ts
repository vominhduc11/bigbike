import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

import en from "../../messages/en.json";
import vi from "../../messages/vi.json";

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, shape(child)]),
    );
  }
  return typeof value;
}

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name)
      ? [absolute]
      : [];
  });
}

describe("i18n production guards", () => {
  it("keeps VI and EN message keys and value types in exact parity", () => {
    expect(shape(en)).toEqual(shape(vi));
  });

  it("keeps next/link behind the storefront navigation entry point", () => {
    const roots = ["app", "components", "lib"].map((folder) => path.resolve(process.cwd(), folder));
    const violations = roots.flatMap(sourceFiles).filter((file) =>
      fs.readFileSync(file, "utf8").includes('from "next/link"'),
    );
    expect(violations.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });

  it("does not expose raw request error messages in storefront UI", () => {
    const roots = ["app/[locale]", "components"].map((folder) => path.resolve(process.cwd(), folder));
    const allowedLocalValidation = new Set([
      path.normalize("components/auth/AuthField.tsx"),
      path.normalize("components/checkout/parts/CheckoutAddressFields.tsx"),
    ]);
    const violations = roots.flatMap(sourceFiles).flatMap((file) => {
      const relative = path.normalize(path.relative(process.cwd(), file));
      if (allowedLocalValidation.has(relative)) return [];
      const source = fs.readFileSync(file, "utf8");
      return /(?:error|err|queryError|submitError)\.message|\(.*?as Error\)\.message/g.test(source)
        ? [relative]
        : [];
    });
    expect(violations).toEqual([]);
  });

  it("rejects untranslated literal labels and visible JSX text", () => {
    const contentModules = [
      "components/about/AboutPageContent.tsx",
      "components/contact/ContactPageContent.tsx",
      "components/guide/ClothingSizeTool.tsx",
      "components/guide/HelmetSizeTool.tsx",
      "components/policy/PrivacyPolicyContent.tsx",
      "components/policy/WarrantyPolicyContent.tsx",
    ].map(path.normalize);
    const allowedProperOrTechnical = /^(?:BigBike|BIGBIKE|BigBike\.vn ·|Bigbike\.vn|Facebook|Twitter|YouTube|TikTok|Shopee|Video|Zalo|Z|GTM|cm|\(Mrs\. Thư\))$/;
    const roots = ["app/[locale]", "components"].map((folder) => path.resolve(process.cwd(), folder));
    const violations = roots.flatMap(sourceFiles).flatMap((file) => {
      const relative = path.normalize(path.relative(process.cwd(), file));
      if (contentModules.includes(relative)) return [];
      const source = fs.readFileSync(file, "utf8");
      const findings: string[] = [];
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) {
          const text = node.getText(tree).replace(/\s+/g, " ").trim();
          if (/\p{L}/u.test(text) && !allowedProperOrTechnical.test(text)) findings.push(text);
        }
        if (
          ts.isJsxAttribute(node) &&
          ["aria-label", "placeholder", "title", "alt"].includes(node.name.getText(tree)) &&
          node.initializer && ts.isStringLiteral(node.initializer)
        ) {
          const value = node.initializer.text.trim();
          if (value && !allowedProperOrTechnical.test(value)) findings.push(value);
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
      return findings.map((finding) => `${relative}: ${finding}`);
    });
    expect(violations).toEqual([]);
  });
});
