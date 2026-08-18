import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  const values = cells(line);
  return values.length > 1 && values.every((value) => /^:?-{3,}:?$/.test(value));
}

/** Renders only the Markdown subset approved by the assistant contract. */
export function SafeChatMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const line = lines[cursor].trim();
    if (!line) {
      cursor += 1;
      continue;
    }

    if (line.includes("|") && cursor + 1 < lines.length && isTableDivider(lines[cursor + 1])) {
      const headers = cells(line);
      const rows: string[][] = [];
      cursor += 2;
      while (cursor < lines.length && lines[cursor].includes("|") && rows.length < 12) {
        rows.push(cells(lines[cursor]));
        cursor += 1;
      }
      blocks.push(
        <div key={`table-${cursor}`} className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-left">
            <thead>
              <tr>{headers.map((header, index) => (
                <th key={index} className="border border-border bg-secondary px-3 py-2 font-semibold">{inline(header)}</th>
              ))}</tr>
            </thead>
            <tbody>{rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{headers.map((_, cellIndex) => (
                <td key={cellIndex} className="border border-border px-3 py-2 align-top">{inline(row[cellIndex] ?? "—")}</td>
              ))}</tr>
            ))}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const listMatch = line.match(/^(?:([-*])|(\d+)\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = Boolean(listMatch[2]);
      const items: string[] = [];
      while (cursor < lines.length) {
        const match = lines[cursor].trim().match(/^(?:([-*])|(\d+)\.)\s+(.+)$/);
        if (!match || Boolean(match[2]) !== ordered) break;
        items.push(match[3]);
        cursor += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={`list-${cursor}`} className={ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
          {items.map((item, index) => <li key={index}>{inline(item)}</li>)}
        </List>,
      );
      continue;
    }

    const paragraph: string[] = [line];
    cursor += 1;
    while (cursor < lines.length) {
      const next = lines[cursor].trim();
      if (!next || /^(?:[-*]|\d+\.)\s+/.test(next)
        || (next.includes("|") && cursor + 1 < lines.length && isTableDivider(lines[cursor + 1]))) break;
      paragraph.push(next);
      cursor += 1;
    }
    blocks.push(<p key={`paragraph-${cursor}`}>{inline(paragraph.join(" "))}</p>);
  }

  return <div className="space-y-3">{blocks}</div>;
}
