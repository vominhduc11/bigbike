export function sanitizeRichHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml) {
    return "<p>Noi dung dang cap nhat.</p>";
  }

  const withoutDangerousBlocks = rawHtml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");

  return withoutDangerousBlocks.replace(
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
    if ((name === "href" || name === "src" || name === "data-src") && !isSafeUrl(value, name)) {
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

function isSafeUrl(value: string, attrName: string): boolean {
  const normalized = value.replace(/\s/g, "").toLowerCase();
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
