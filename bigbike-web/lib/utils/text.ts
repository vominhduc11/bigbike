/**
 * Dependency-free plain-text helpers for deriving excerpts/teasers from
 * rich-text HTML.
 *
 * Deliberately separate from `lib/utils/html.ts`: that module imports
 * `isomorphic-dompurify` for sanitization, so importing it into a client
 * component (e.g. ArticleCard) would ship DOMPurify to the browser. These
 * helpers are pure regex transforms and safe to import anywhere.
 */

/**
 * Strip HTML to a single-line plain-text string: removes tags, decodes the
 * common named/numeric entities, collapses whitespace, and trims. Callers apply
 * their own truncation. Expects a non-null string (callers guard with
 * `body ? stripHtmlToText(body) : ""`).
 */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const SEO_META_MAX_LENGTH = 165;

/**
 * Convert a rich fallback into the plain, bounded value allowed in public SEO
 * metadata. The marker-aware pass removes the known legacy chat-widget subtree
 * without removing legitimate `data-component="message-text-content"` product copy.
 */
export function normalizeMetaDescription(value: string | null | undefined, maxLength = SEO_META_MAX_LENGTH): string {
  const plain = stripHtmlToText(stripKnownSeoWidgetMarkup(value ?? ""));
  if (!plain || maxLength <= 0 || plain.length <= maxLength) return plain;

  const candidate = plain.slice(0, maxLength + 1).trim();
  const boundary = candidate.lastIndexOf(" ");
  return boundary >= Math.max(1, Math.floor(maxLength / 2))
    ? candidate.slice(0, boundary).trim()
    : plain.slice(0, maxLength).trim();
}

function stripKnownSeoWidgetMarkup(value: string): string {
  if (!value) return value;

  const tokens = value.split(/(<[^>]*>)/g);
  let skipDepth = 0;
  let output = "";
  for (const token of tokens) {
    if (!token) continue;
    if (!token.startsWith("<")) {
      if (skipDepth === 0) output += token;
      continue;
    }

    const closing = /^<\s*\//.test(token);
    const opening = /^<\s*[a-z][^>]*>$/i.test(token) && !/\/\s*>$/.test(token);
    if (skipDepth > 0) {
      if (opening && !closing) skipDepth += 1;
      if (closing) skipDepth = Math.max(0, skipDepth - 1);
      continue;
    }

    if (!closing && isSeoWidgetStart(token)) {
      skipDepth = 1;
      continue;
    }
    output += token;
  }
  return output;
}

function isSeoWidgetStart(tag: string): boolean {
  return /(?:id|class)\s*=\s*["'][^"']*(?:messageView|message-view|chat-item|chat-message|bubble-message)[^"']*["']/i.test(tag)
    || /data-component\s*=\s*["'](?:bubble-message|message-view)["']/i.test(tag);
}

/**
 * Remove HTML tags only — no entity decoding, no whitespace collapse. Mirrors
 * the minimal `stripHtml` the news pages used; callers add their own whitespace
 * handling/truncation. Nullish input collapses to "".
 */
export function stripHtmlTags(value: string | null | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, "");
}
