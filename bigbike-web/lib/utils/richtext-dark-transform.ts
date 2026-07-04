/**
 * Chuyển màu inline style trong HTML admin-dán (đã qua sanitizeRichHtml với
 * allowInlineStyles: true) sang bản đọc được trên nền tối — dùng để render
 * SONG SONG với bản gốc (xem components/catalog/ThemeAwareHtml.tsx), CSS
 * `[data-theme]` chỉ hiện đúng 1 bản. Bản gốc (light) KHÔNG bao giờ bị đụng
 * tới — admin không cần đổi gì, dữ liệu lưu giữ nguyên.
 *
 * Quy luật (STYLEGUIDE.md §Dark mode → khối HTML admin dán):
 *  - Neutral nhạt (nền trắng/gần trắng) → nền tối.
 *  - Neutral đậm (chữ đen/xám đậm) → chữ sáng.
 *  - Màu có chroma (accent: đỏ, xanh…) → GIỮ hue/saturation, chỉ nhích
 *    lightness vào dải đọc được trên nền tối — không đổi bản sắc.
 *  - Loại trừ hoàn toàn thẻ img/video/iframe/source/picture, và property
 *    background-image (không nằm trong whitelist property nên không đụng).
 */

type Rgba = [r: number, g: number, b: number, a: number];

const NAMED_COLORS: Record<string, [number, number, number]> = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  red: [255, 0, 0],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  silver: [192, 192, 192],
};

function parseToRgba(value: string): Rgba | null {
  const v = value.trim().toLowerCase();
  if (v in NAMED_COLORS) {
    const [r, g, b] = NAMED_COLORS[v];
    return [r, g, b, 1];
  }
  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (![3, 4, 6, 8].includes(hex.length) || /[^0-9a-f]/.test(hex)) return null;
    const grow = (h: string) => (hex.length <= 4 ? h + h : h);
    if (hex.length <= 4) {
      return [
        parseInt(grow(hex[0]), 16),
        parseInt(grow(hex[1]), 16),
        parseInt(grow(hex[2]), 16),
        hex.length === 4 ? parseInt(grow(hex[3]), 16) / 255 : 1,
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    ];
  }
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
  return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = 60 * (((g - b) / d) % 6);
        break;
      case g:
        h = 60 * ((b - r) / d + 2);
        break;
      default:
        h = 60 * ((r - g) / d + 4);
    }
  }
  if (h < 0) h += 360;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Đổi 1 giá trị màu CSS sang bản dùng được trên nền tối. Trả về null nếu
 * không parse được (vd `transparent`, `inherit`, `currentColor`) — giữ nguyên
 * giá trị gốc ở nơi gọi, an toàn hơn đoán sai.
 */
export function transformColorForDark(value: string): string | null {
  const rgba = parseToRgba(value);
  if (!rgba) return null;
  const [r, g, b, a] = rgba;
  const { h, s, l } = rgbToHsl(r, g, b);

  let newL: number;
  if (s < 0.12) {
    if (l >= 0.85) newL = 0.09; // nền sáng/gần trắng → nền tối
    else if (l <= 0.25) newL = 0.94; // chữ đen/xám đậm → chữ sáng
    else newL = clamp(1 - l, 0.55, 0.8); // xám trung tính → đảo quanh 0.5
  } else {
    // Accent: giữ hue+saturation, chỉ nhích lightness vào dải đọc được trên nền tối.
    newL = clamp(l < 0.5 ? l + 0.28 : l, 0.55, 0.74);
  }

  const [nr, ng, nb] = hslToRgb(h, s, newL);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  if (a >= 1) return `#${hex(nr)}${hex(ng)}${hex(nb)}`;
  return `rgba(${nr}, ${ng}, ${nb}, ${a})`;
}

// Chỉ các property mang MÀU mới được transform. "background-image" (và mọi
// property khác) cố tình KHÔNG nằm trong danh sách — không bao giờ bị đụng.
const COLOR_PROPS = new Set([
  "color",
  "background-color",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
]);

/** Tách khai báo CSS theo `;` NGOÀI ngoặc tròn (an toàn với `rgba(0,0,0,.5)`). */
function splitDeclarations(styleValue: string): string[] {
  const declarations: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of styleValue) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0) {
      declarations.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) declarations.push(current);
  return declarations;
}

function transformStyleAttrValue(styleValue: string): string {
  return splitDeclarations(styleValue)
    .map((decl) => {
      const idx = decl.indexOf(":");
      if (idx === -1) return decl;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      if (!COLOR_PROPS.has(prop)) return decl;
      const transformed = transformColorForDark(decl.slice(idx + 1).trim());
      return transformed ? `${decl.slice(0, idx)}:${transformed}` : decl;
    })
    .join(";");
}

const EXCLUDED_TAGS = new Set(["img", "video", "iframe", "source", "picture"]);

/**
 * Transform toàn bộ `style="..."` inline trong một chuỗi HTML ĐÃ sanitize
 * (allowInlineStyles). Bỏ qua hoàn toàn các thẻ media (không đụng `style`
 * của chúng, kể cả nếu có object-position màu nền giả).
 */
export function transformHtmlForDark(html: string): string {
  return html.replace(
    /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)\sstyle\s*=\s*"([^"]*)"([^>]*)>/g,
    (full: string, tagName: string, before: string, styleValue: string, after: string) => {
      if (EXCLUDED_TAGS.has(tagName.toLowerCase())) return full;
      return `<${tagName}${before} style="${transformStyleAttrValue(styleValue)}"${after}>`;
    },
  );
}
