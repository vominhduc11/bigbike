import DOMPurify from 'dompurify'

// Tags allowed in admin-managed HTML setting values (footer text, rich descriptions...).
const ALLOWED_TAGS = [
  'a', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'div', 'em',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i',
  'img', 'li', 'ol', 'p', 'pre', 'small', 'span', 'strong',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
]

const ALLOWED_ATTR = [
  'aria-label', 'class', 'id', 'title',
  'href', 'rel', 'target',
  'alt', 'src', 'width', 'height', 'loading',
  'colspan', 'rowspan', 'scope',
]

/**
 * Sanitize an admin-managed HTML string before rendering via dangerouslySetInnerHTML.
 *
 * Setting values are written by admins, but a lower-privilege admin could store a
 * payload that runs in a higher-privilege admin's browser — so HTML settings must
 * still be sanitized (DOMPurify strips scripts, event handlers, javascript: URLs).
 *
 * @param {unknown} raw  Raw HTML string (or anything; non-strings are coerced).
 * @returns {string}     Sanitized HTML safe for dangerouslySetInnerHTML.
 */
export function sanitizeHtml(raw) {
  if (raw == null || raw === '') return ''
  return DOMPurify.sanitize(String(raw), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}
