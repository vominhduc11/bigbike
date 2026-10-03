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

  it("resolves literal translation calls against their declared message namespaces", () => {
    const roots = ["app", "components", "lib"].map((folder) => path.resolve(process.cwd(), folder));
    const violations: string[] = [];
    for (const file of roots.flatMap(sourceFiles)) {
      const source = fs.readFileSync(file, "utf8");
      const tree = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const namespaces = new Map<string, Set<string>>();
      const collect = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
          let init = node.initializer;
          if (init && ts.isAwaitExpression(init)) init = init.expression;
          if (
            init &&
            ts.isCallExpression(init) &&
            ["useTranslations", "getTranslations"].includes(init.expression.getText(tree))
          ) {
            const arg = init.arguments[0];
            let namespace: string | undefined;
            if (!arg) namespace = "";
            else if (ts.isStringLiteral(arg)) namespace = arg.text;
            else if (ts.isObjectLiteralExpression(arg)) {
              const property = arg.properties.find(
                (item) => item.name?.getText(tree) === "namespace",
              );
              if (
                property &&
                ts.isPropertyAssignment(property) &&
                ts.isStringLiteral(property.initializer)
              ) {
                namespace = property.initializer.text;
              }
            }
            if (namespace !== undefined) {
              const values = namespaces.get(node.name.text) ?? new Set<string>();
              values.add(namespace);
              namespaces.set(node.name.text, values);
            }
          }
        }
        ts.forEachChild(node, collect);
      };
      collect(tree);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const name = node.expression.getText(tree).replace(/\.(rich|raw|markup|has)$/, "");
          const declared = namespaces.get(name);
          const arg = node.arguments[0];
          if (declared && arg && ts.isStringLiteral(arg)) {
            const exists = [...declared].some((namespace) => {
              const keys = [...namespace.split(".").filter(Boolean), ...arg.text.split(".")];
              let value: unknown = en;
              for (const key of keys) {
                value =
                  value && typeof value === "object"
                    ? (value as Record<string, unknown>)[key]
                    : undefined;
              }
              return value !== undefined;
            });
            if (!exists) {
              const line = tree.getLineAndCharacterOfPosition(node.getStart()).line + 1;
              violations.push(`${path.relative(process.cwd(), file)}:${line}: ${arg.text}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
    expect(violations).toEqual([]);
  });

  it("keeps next/link behind the storefront navigation entry point", () => {
    const roots = ["app", "components", "lib"].map((folder) => path.resolve(process.cwd(), folder));
    const violations = roots
      .flatMap(sourceFiles)
      .filter((file) => fs.readFileSync(file, "utf8").includes('from "next/link"'));
    expect(violations.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });

  it("does not expose raw request error messages in storefront UI", () => {
    const roots = ["app/[locale]", "components"].map((folder) =>
      path.resolve(process.cwd(), folder),
    );
    const allowedLocalValidation = new Set([
      path.normalize("components/auth/AuthField.tsx"),
      path.normalize("components/checkout/parts/CheckoutAddressFields.tsx"),
    ]);
    const violations = roots.flatMap(sourceFiles).flatMap((file) => {
      const relative = path.normalize(path.relative(process.cwd(), file));
      if (allowedLocalValidation.has(relative)) return [];
      const source = fs.readFileSync(file, "utf8");
      return /(?:error|err|queryError|submitError|uploadError)\.message|\(.*?as Error\)\.message/g.test(
        source,
      )
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
    ].map(path.normalize);
    const allowedProperOrTechnical =
      /^(?:BigBike|BIGBIKE|BigBike\.vn ·|Bigbike\.vn|Facebook|Twitter|YouTube|TikTok|Shopee|Video|Zalo|Z|cm|\(Mrs\. Thư\))$/;
    const roots = ["app/[locale]", "components"].map((folder) =>
      path.resolve(process.cwd(), folder),
    );
    const violations = roots.flatMap(sourceFiles).flatMap((file) => {
      const relative = path.normalize(path.relative(process.cwd(), file));
      if (contentModules.includes(relative)) return [];
      const source = fs.readFileSync(file, "utf8");
      const findings: string[] = [];
      const tree = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) {
          const text = node.getText(tree).replace(/\s+/g, " ").trim();
          if (/\p{L}/u.test(text) && !allowedProperOrTechnical.test(text)) findings.push(text);
        }
        if (
          ts.isJsxAttribute(node) &&
          ["aria-label", "placeholder", "title", "alt"].includes(node.name.getText(tree)) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer)
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
