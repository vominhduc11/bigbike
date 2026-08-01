import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import staticPages from "../../lib/content/static-pages.json";
import { getStaticPage } from "../../lib/content/static-pages";

const repoRoot = process.cwd();
const vietnameseLetters = /[\u00c0-\u024f\u1e00-\u1effĐđ]/u;
const intentionalEnglishLocaleText = ["Tiếng Việt", "Âu Cơ", "Hòa Bình", "Thư"];

function collectStrings(value: unknown, keyPath = ""): Array<{ keyPath: string; value: string }> {
  if (typeof value === "string") return [{ keyPath, value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStrings(item, `${keyPath}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectStrings(item, keyPath ? `${keyPath}.${key}` : key),
    );
  }
  return [];
}

function removeIntentionalNames(value: string): string {
  return intentionalEnglishLocaleText.reduce(
    (remaining, allowed) => remaining.replaceAll(allowed, ""),
    value,
  );
}

function sourceFiles(): string[] {
  const roots = ["app", "components", "lib"];
  return roots.flatMap((root) => walk(path.join(repoRoot, root)));
}

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [absolute] : [];
  });
}

describe("English UI copy audit", () => {
  it("contains no Vietnamese copy in the English message catalog outside the allowlist", () => {
    const leaks = collectStrings(en)
      .filter(({ value }) => vietnameseLetters.test(value))
      .map(({ keyPath, value }) => ({ keyPath, value: removeIntentionalNames(value) }))
      .filter(({ keyPath, value }) => vietnameseLetters.test(value) && keyPath !== "Language.vi");

    expect(leaks).toEqual([]);
  });

  it("does not expose a Vietnamese static HTML body when the English body is unavailable", () => {
    for (const [slug, page] of Object.entries(staticPages)) {
      const localized = getStaticPage(slug, "en");
      expect(localized).not.toBeNull();
      expect(localized?.body).toBe(page.bodyEn ?? "");
    }
  });

  it("keeps known user-facing fallbacks out of source literals", () => {
    const unsafeFallbacks = new Set([
      "Bài viết",
      "Tin tức",
      "Danh mục",
      "Sản phẩm",
      "Còn hàng",
      "Hết hàng",
    ]);
    const leaks: string[] = [];

    for (const file of sourceFiles()) {
      const source = fs.readFileSync(file, "utf8");
      const relativeFile = path.relative(repoRoot, file).replaceAll("\\", "/");
      const isIntentionalLocaleBranch =
        relativeFile === "lib/seo/json-ld.ts" || relativeFile === "app/api/products/[id]/stock/route.ts";
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (!isIntentionalLocaleBranch && ts.isStringLiteral(node) && unsafeFallbacks.has(node.text)) {
          leaks.push(`${path.relative(repoRoot, file)}: ${node.text}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }

    expect(leaks).toEqual([]);
  });

  it("keeps English fallbacks for the catalog, review proxy and stock proxy", () => {
    const files = [
      "app/api/products/[id]/reviews/route.ts",
      "app/api/products/[id]/snapshot/route.ts",
      "app/api/products/[id]/stock/route.ts",
      "app/api/products/[id]/variants/route.ts",
      "lib/api/public-api.ts",
      "lib/api/client-api.ts",
    ];
    const source = files.map((file) => fs.readFileSync(path.join(repoRoot, file), "utf8")).join("\n");

    expect(source).toContain("Couldn't load reviews.");
    expect(source).toContain("Couldn't load product information.");
    expect(source).toContain("Couldn't load stock status.");
    expect(source).toContain("Couldn't load product variants.");
    expect(source).toContain("The requested data could not be found.");
    expect(source).toContain("The server did not return valid data.");
  });
});
