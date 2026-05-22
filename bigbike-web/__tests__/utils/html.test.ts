import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "@/lib/utils/html";

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
});
