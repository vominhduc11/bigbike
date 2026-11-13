// @vitest-environment node
import { expect, it } from "vitest";
import { sanitizeRichHtml } from "@/lib/utils/html";

it("preserves content and security hooks through repeated server window renewals", () => {
  const html = `<style>.content { color: red; font-family: Unapproved; }</style>
    <h1>Kiểm tra nội dung</h1><p style="color:red;font-size:80px">Nội dung</p>
    <a href="/sp/" target="_blank">Sản phẩm</a>
    <iframe src="https://www.youtube.com/embed/real-video"></iframe>
    <iframe src="https://untrusted.example/embed"></iframe>
    <script>alert('xss')</script><img src="/media/real.jpg" onerror="alert(1)">`;
  const options = { allowInlineStyles: true, allowStyleTags: true, locale: "en" as const };
  const expected = sanitizeRichHtml(html, options);
  expect(expected).toContain("Kiểm tra nội dung");
  expect(expected).toContain("www.youtube.com");
  expect(expected).toContain('rel="noopener noreferrer"');
  expect(expected).not.toMatch(/untrusted\.example|<script|onerror|font-family|font-size/);
  for (let i = 0; i < 250; i++) {
    expect(sanitizeRichHtml(html, options)).toBe(expected);
  }
});
