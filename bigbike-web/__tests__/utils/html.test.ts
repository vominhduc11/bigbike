import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "@/lib/utils/html";
import staticPages from "@/lib/content/static-pages.json";

describe("sanitizeRichHtml — WP shortcodes", () => {
  it("unwraps [caption] preserving inner content", () => {
    const input = '<p>[caption id="x" align="aligncenter" width="640"]<img src="/a.jpg" />A photo[/caption]</p>';
    const output = sanitizeRichHtml(input);
    expect(output).not.toContain("[caption");
    expect(output).not.toContain("[/caption]");
    expect(output).toContain("<img");
    expect(output).toContain("A photo");
  });

  it("removes standalone [gallery] shortcodes entirely", () => {
    const input = '<p>Before</p>[gallery ids="1,2,3"]<p>After</p>';
    const output = sanitizeRichHtml(input);
    expect(output).not.toContain("[gallery");
    expect(output).toContain("Before");
    expect(output).toContain("After");
  });

  it("strips arbitrary shortcodes like [contact-form-7]", () => {
    const input = '<p>Form below.</p>[contact-form-7 id="42" title="Contact"]<p>End.</p>';
    const output = sanitizeRichHtml(input);
    expect(output).not.toMatch(/\[contact-form-7/);
    expect(output).toContain("End.");
  });

  it("does not eat array-style brackets in prose", () => {
    const input = "<p>The set is [1, 2, 3] and ranges [a, b].</p>";
    const output = sanitizeRichHtml(input);
    expect(output).toContain("[1, 2, 3]");
    expect(output).toContain("[a, b]");
  });

  it("collapses escaped [[shortcode]] into literal text", () => {
    const input = "<p>To show a literal use [[gallery]] in your post.</p>";
    const output = sanitizeRichHtml(input);
    expect(output).toContain("[gallery]");
    expect(output).not.toContain("[[gallery]]");
  });

  it("strips inline event handlers from rich html", () => {
    const input = '<p><img src=x onerror=alert(1)>Safe</p>';
    const output = sanitizeRichHtml(input);
    expect(output).not.toContain("onerror");
    expect(output).not.toContain("alert(1)");
    expect(output).toContain("<img");
    expect(output).toContain("Safe");
  });

  it("preserves inline styles only when explicitly requested", () => {
    const input = '<p style="text-align:center" onclick="alert(1)">Centered</p>';
    expect(sanitizeRichHtml(input)).not.toContain("style=");

    const output = sanitizeRichHtml(input, { allowInlineStyles: true });
    expect(output).toContain("style=");
    expect(output).toContain("text-align");
    expect(output).not.toContain("onclick");
  });

  it("rewrites legacy MinIO upload URLs only when explicitly requested", () => {
    const input = '<img src="http://localhost:9000/bigbike-media/wp-uploads/2026/04/a.webp">';
    expect(sanitizeRichHtml(input)).toContain("http://localhost:9000");

    const output = sanitizeRichHtml(input, { rewriteMediaUrls: true });
    expect(output).toContain('/media/wp-uploads/2026/04/a.webp');
    expect(output).not.toContain("localhost:9000");
  });

  it("preserves style tags only when explicitly requested", () => {
    const input = '<style>.test { color: red; }</style><p>Text</p>';
    expect(sanitizeRichHtml(input)).not.toContain("<style>");

    const output = sanitizeRichHtml(input, { allowStyleTags: true });
    expect(output).toContain("<style>");
    expect(output).toContain(".test");
  });

  it("keeps permitted layout styles while removing inline typography overrides", () => {
    const input = [
      '<style>.card { display:grid; gap:16px; font:700 18px/1.6 Arial; letter-spacing:1px; }</style>',
      '<p style="color:red; margin:12px; font-family:serif; font-size:24px; line-height:2; text-transform:uppercase">Text</p>',
    ].join("");

    const output = sanitizeRichHtml(input, { allowInlineStyles: true, allowStyleTags: true });

    expect(output).toContain("display:grid");
    expect(output).toContain("gap:16px");
    expect(output).toContain("color:red");
    expect(output).toContain("margin:12px");
    expect(output).not.toMatch(/(?:font|font-family|font-size|line-height|letter-spacing|text-transform)\s*:/i);
  });

  it("normalizes typography from every frozen static page", () => {
    for (const page of Object.values(staticPages)) {
      for (const body of [page.body, page.bodyEn]) {
        if (!body) continue;

        const output = sanitizeRichHtml(body, { allowInlineStyles: true, allowStyleTags: true });
        expect(output).not.toMatch(/(?:font|font-family|font-size|line-height|letter-spacing|text-transform)\s*:/i);
      }
    }
  });
});
