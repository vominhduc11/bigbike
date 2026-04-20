export function sanitizeRichHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml) {
    return "<p>Noi dung dang cap nhat.</p>";
  }

  return rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

