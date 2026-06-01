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

/**
 * Remove HTML tags only — no entity decoding, no whitespace collapse. Mirrors
 * the minimal `stripHtml` the news pages used; callers add their own whitespace
 * handling/truncation. Nullish input collapses to "".
 */
export function stripHtmlTags(value: string | null | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, "");
}
