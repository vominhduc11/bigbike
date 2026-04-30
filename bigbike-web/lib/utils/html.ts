export function sanitizeRichHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml) {
    return "<p>Noi dung dang cap nhat.</p>";
  }

  const withoutDangerousBlocks = rawHtml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");

  const withoutShortcodes = stripWpShortcodes(withoutDangerousBlocks);

  return withoutShortcodes.replace(
    /<\/?([a-zA-Z0-9-]+)(\s[^>]*)?>/g,
    (tag, rawName: string, rawAttrs = "") => {
      const name = rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) {
        return "";
      }
      if (tag.startsWith("</")) {
        return VOID_TAGS.has(name) ? "" : `</${name}>`;
      }

      const attrs = sanitizeAttrs(name, rawAttrs);
      return `<${name}${attrs ? ` ${attrs}` : ""}>`;
    },
  );
}

// WordPress shortcode names known to wrap content (`[name]…[/name]`). The
// wrapper is removed but the inner HTML is preserved. Anything not in this
// set is treated as standalone and stripped entirely.
const PAIRED_SHORTCODES = new Set([
  "caption",
  "embed",
  "audio",
  "video",
  "playlist",
  "gallery",
]);

/**
 * Strip WordPress shortcodes (`[caption …]…[/caption]`, `[gallery ids="…"]`,
 * etc.) from rich-text HTML. WP renders these server-side; when content is
 * fetched as raw HTML we sometimes receive the shortcode source instead of
 * the rendered output, which then leaks into the PDP description.
 *
 * Behaviour:
 *  - Paired shortcodes (`[caption]…[/caption]`): wrapper stripped, inner kept.
 *  - Standalone shortcodes (`[gallery ids="1,2"]`): removed entirely.
 *  - Escaped doubled brackets (`[[name]]`): unwrapped to a literal `[name]`
 *    per WP convention.
 */
function stripWpShortcodes(html: string): string {
  // Protect escaped doubled brackets (`[[name]]` is WP's literal form) before
  // running shortcode strips, so the inner `[name]` isn't picked up. Sentinels
  // are control chars that won't appear in legitimate HTML/text.
  const OPEN_SENTINEL = "";
  const CLOSE_SENTINEL = "";

  let out = html
    .replace(/\[\[/g, OPEN_SENTINEL)
    .replace(/\]\]/g, CLOSE_SENTINEL);

  // 1. Unwrap paired shortcodes — remove opening and closing tags,
  //    keep inner HTML.
  for (const name of PAIRED_SHORTCODES) {
    const open = new RegExp(`\\[${name}(?:\\s[^\\[\\]]*)?\\]`, "gi");
    const close = new RegExp(`\\[\\/${name}\\]`, "gi");
    out = out.replace(open, "").replace(close, "");
  }

  // 2. Remove any remaining standalone shortcodes `[name]` or `[name attrs]`.
  //    Requires alpha first char so we don't eat `[1, 2, 3]` style brackets.
  out = out.replace(
    /\[\/?[a-zA-Z][\w-]*(?:\s[^\[\]]*)?\]/g,
    "",
  );

  // Restore escaped brackets to their literal form (single `[…]`).
  out = out.replace(new RegExp(OPEN_SENTINEL, "g"), "[")
           .replace(new RegExp(CLOSE_SENTINEL, "g"), "]");

  return out;
}

const VOID_TAGS = new Set(["br", "hr", "img"]);

const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "iframe",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "small",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const GLOBAL_ATTRS = new Set(["aria-label", "class", "id", "title"]);

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "rel", "target"]),
  iframe: new Set(["allow", "allowfullscreen", "height", "loading", "src", "width"]),
  img: new Set(["alt", "data-src", "height", "loading", "src", "width"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
};

function sanitizeAttrs(tagName: string, rawAttrs: string): string {
  const allowedForTag = TAG_ATTRS[tagName] ?? new Set<string>();
  const attrs: string[] = [];
  const attrPattern = /([a-zA-Z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    if (name.startsWith("on") || (!GLOBAL_ATTRS.has(name) && !allowedForTag.has(name))) {
      continue;
    }

    const value = unquote(match[2]).replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if ((name === "href" || name === "src" || name === "data-src") && !isSafeUrl(value, name, tagName)) {
      continue;
    }

    attrs.push(`${name}="${escapeAttr(value)}"`);
  }

  if (
    tagName === "a" &&
    attrs.some((attr) => attr.startsWith("target=\"_blank\"")) &&
    !attrs.some((attr) => attr.startsWith("rel="))
  ) {
    attrs.push('rel="noopener noreferrer"');
  }

  return attrs.join(" ");
}

function unquote(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const ALLOWED_IFRAME_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "www.google.com",
  "maps.google.com",
]);

function isSafeUrl(value: string, attrName: string, tagName?: string): boolean {
  const normalized = value.replace(/\s/g, "").toLowerCase();
  if (attrName === "src" && tagName === "iframe") {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return ALLOWED_IFRAME_HOSTS.has(host);
    } catch {
      return false;
    }
  }
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("#") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("tel:")
  ) {
    return true;
  }
  return attrName !== "href" && normalized.startsWith("data:image/");
}
