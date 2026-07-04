import { describe, expect, it } from "vitest";
import { transformColorForDark, transformHtmlForDark } from "@/lib/utils/richtext-dark-transform";
import { contrastAgainst } from "@/lib/theme/contrast";

describe("transformColorForDark", () => {
  it("maps a near-white background toward a dark value", () => {
    const out = transformColorForDark("#ffffff");
    expect(out).not.toBeNull();
    // Now far from white (i.e. genuinely dark), not merely "off-white".
    expect(contrastAgainst(out!, "#ffffff")).toBeGreaterThan(15);
  });

  it("maps near-black text toward a light value", () => {
    const out = transformColorForDark("#111111");
    expect(out).not.toBeNull();
    expect(contrastAgainst(out!, "#000000")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps hue/saturation for a saturated accent color (brand red)", () => {
    const out = transformColorForDark("#ff0c09");
    expect(out).not.toBeNull();
    // Same family of hue: red channel still clearly dominant.
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(out!);
    expect(m).not.toBeNull();
    const [r, g, b] = [m![1], m![2], m![3]].map((h) => parseInt(h, 16));
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    // Legible against a near-black page.
    expect(contrastAgainst(out!, "#0b0b0d")).toBeGreaterThanOrEqual(4.5);
  });

  it("preserves alpha on rgba() input", () => {
    const out = transformColorForDark("rgba(0, 0, 0, 0.5)");
    expect(out).toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/);
  });

  it("returns null (leave-as-is) for unparseable keywords", () => {
    expect(transformColorForDark("transparent")).toBeNull();
    expect(transformColorForDark("inherit")).toBeNull();
    expect(transformColorForDark("currentColor")).toBeNull();
  });
});

describe("transformHtmlForDark", () => {
  it("transforms color and background-color on a plain element", () => {
    const html = '<p style="color:#000000;background-color:#ffffff">Xin chào</p>';
    const out = transformHtmlForDark(html);
    expect(out).not.toContain("#000000");
    expect(out).not.toContain("#ffffff");
    expect(out).toContain("Xin chào");
  });

  it("does NOT touch style on img/video/iframe/source/picture", () => {
    const html =
      '<div style="color:#000"><img style="color:#000;background-color:#fff" src="/a.jpg"/>' +
      '<video style="background-color:#fff" src="/a.mp4"></video>' +
      '<iframe style="background-color:#fff" src="/x"></iframe></div>';
    const out = transformHtmlForDark(html);
    expect(out).toContain('img style="color:#000;background-color:#fff"');
    expect(out).toContain('video style="background-color:#fff"');
    expect(out).toContain('iframe style="background-color:#fff"');
    // The wrapping <div> (not excluded) DID get transformed.
    expect(out).not.toMatch(/<div style="color:#000"/);
  });

  it("leaves background-image untouched (not a whitelisted color property)", () => {
    const html = '<div style="background-image:url(/hero.jpg);color:#000000">Text</div>';
    const out = transformHtmlForDark(html);
    expect(out).toContain("background-image:url(/hero.jpg)");
    expect(out).not.toContain("color:#000000");
  });

  it("handles rgba() values containing commas without mis-splitting declarations", () => {
    const html = '<p style="background-color:rgba(0,0,0,0.5);font-weight:700">X</p>';
    const out = transformHtmlForDark(html);
    expect(out).toContain("font-weight:700");
    expect(out).not.toContain("rgba(0,0,0,0.5)");
  });

  it("leaves elements without a style attribute untouched", () => {
    const html = "<p>Không có style</p>";
    expect(transformHtmlForDark(html)).toBe(html);
  });
});
