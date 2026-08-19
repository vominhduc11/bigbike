import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import vi from "../../messages/vi.json";
import staticPages from "../../lib/content/static-pages.json";

const repoRoot = process.cwd();

function collectFiles(directory: string, extensions: Set<string>): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(absolute, extensions);
    return extensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function readPublicCopy(): string {
  // Nội dung trang tĩnh đã đóng băng vào lib/content/static-pages.json (liệt kê
  // rõ bên dưới); thư mục content/pages (.mdx) bản cũ không còn tồn tại.
  const roots = ["messages"];
  const files = roots.flatMap((root) => collectFiles(path.join(repoRoot, root), new Set([".json", ".ts", ".tsx"])));
  const explicitFiles = [
    "components/contact/ContactPageContent.tsx",
    "lib/content/static-pages.json",
  ].map((file) => path.join(repoRoot, file));
  return [...files, ...explicitFiles].map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

describe("public copy audit", () => {
  it("keeps the current contact baseline and removes stale contact details", () => {
    expect(vi.Footer.address).toBe("79/30/52 Âu Cơ, Phường Hòa Bình, TP. Hồ Chí Minh");
    expect(en.Footer.address).toBe("79/30/52 Âu Cơ, Hòa Bình Ward, Ho Chi Minh City");
    expect(vi.StaticPage.advisorThu).toContain("0764.640.679");
    expect(en.StaticPage.advisorThu).toContain("0764.640.679");

    const copy = readPublicCopy();
    expect(copy).not.toMatch(/028\.62797251|0784[. ]640[. ]679|Ward 14|P\.14|Q\.11|Phường 14/);
  });

  it("keeps policy titles and SEO metadata localized", () => {
    for (const slug of ["chinh-sach-bao-hanh", "chinh-sach-bao-mat-thong-tin"]) {
      const page = staticPages[slug as keyof typeof staticPages];
      expect(page.titleEn).toBeTruthy();
      expect(page.seoTitle).toBeTruthy();
      expect(page.seoTitleEn).toBeTruthy();
      expect(page.seoDescription).toBeTruthy();
      expect(page.seoDescriptionEn).toBeTruthy();
    }
  });

  it("rejects the audited mixed-language and Vietnamese copy regressions", () => {
    const copy = readPublicCopy();
    expect(copy).not.toMatch(/Followers Facebook|Khách recommend|review 5 sao|Google map|kỉ niệm|Hoá đơn|Huỷ|tuỳ chọn|TP HCM/);
    expect(copy).not.toMatch(/[ÃÆ�]|(?:Ă|ă)[^\p{L}\s]|á(?:º|»|¼|½|¾|¿)|â(?:€|™|œ|ž|”|“|–|—|…)/u);
  });
});
