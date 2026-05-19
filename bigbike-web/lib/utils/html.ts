import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize rich-text / CMS HTML before rendering via dangerouslySetInnerHTML.
 *
 * Uses DOMPurify (DOM-based, battle-tested) rather than a hand-rolled regex
 * sanitizer — regex HTML sanitizers are historically bypassable. WordPress
 * shortcodes are stripped first (they are plain-text noise, not an XSS vector).
 */
export function sanitizeRichHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml) {
    return "<p>Nội dung đang cập nhật.</p>";
  }

  registerHooks();
  const withoutShortcodes = stripWpShortcodes(rawHtml);

  return DOMPurify.sanitize(withoutShortcodes, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Drop generic data-* attributes; `data-src` is allowlisted explicitly above.
    ALLOW_DATA_ATTR: false,
  })
    .replace(/<h1(\s[^>]*)?>/gi, "<h2$1>")
    .replace(/<\/h1>/gi, "</h2>");
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

const ALLOWED_TAGS = [
  "a", "b", "blockquote", "br", "caption", "cite", "code", "div", "em",
  "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i",
  "iframe", "img", "li", "ol", "p", "pre", "small", "span", "strong",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
];

// DOMPurify applies ALLOWED_ATTR globally (not per-tag); each attribute below
// is harmless on tags that ignore it. Event handlers and javascript: URLs are
// blocked by DOMPurify regardless.
const ALLOWED_ATTR = [
  "aria-label", "class", "id", "title",
  "href", "rel", "target",
  "allow", "allowfullscreen", "loading", "src", "data-src",
  "alt", "width", "height",
  "colspan", "rowspan", "scope",
];

const ALLOWED_IFRAME_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "www.google.com",
  "maps.google.com",
]);

let hooksRegistered = false;

/**
 * One-time DOMPurify hook registration:
 *  - drop <iframe> whose src host is not in the embed allowlist;
 *  - force rel="noopener noreferrer" on target="_blank" links.
 */
function registerHooks(): void {
  if (hooksRegistered) {
    return;
  }
  hooksRegistered = true;

  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName !== "iframe") {
      return;
    }
    const el = node as Element;
    const src = el.getAttribute("src") ?? "";
    let allowed = false;
    try {
      allowed = ALLOWED_IFRAME_HOSTS.has(new URL(src).hostname.toLowerCase());
    } catch {
      allowed = false;
    }
    if (!allowed) {
      el.parentNode?.removeChild(el);
    }
  });

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const el = node as Element;
    if (el.tagName === "A" && el.getAttribute("target") === "_blank") {
      el.setAttribute("rel", "noopener noreferrer");
    }
  });
}
