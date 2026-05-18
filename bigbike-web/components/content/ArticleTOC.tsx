"use client";

import { useEffect, useState } from "react";

type TocItem = {
  id: string;
  text: string;
  level: 2 | 3 | 4;
  numbering: string;
};

const SCROLL_OFFSET_PERCENT = 0.14;
const CONTENT_SELECTOR = "[data-article-body]";

function slugify(text: string, fallback: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base.length > 0 ? base : fallback;
}

export function ArticleTOC() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const container = document.querySelector(CONTENT_SELECTOR);
    if (!container) return;

    const headings = Array.from(
      container.querySelectorAll<HTMLHeadingElement>("h2, h3, h4"),
    );
    if (headings.length < 2) return;

    let h2Count = 0;
    let h3Count = 0;
    let h4Count = 0;
    const collected: TocItem[] = [];

    headings.forEach((node, index) => {
      const text = node.textContent?.trim().replace(/^\d+\./g, "").trim();
      if (!text) return;

      const tag = node.tagName.toUpperCase();
      const level = tag === "H2" ? 2 : tag === "H3" ? 3 : 4;
      const id = node.id || `heading-${index}-${slugify(text, String(index))}`;
      node.id = id;

      let numbering = "";
      if (level === 2) {
        h2Count += 1;
        h3Count = 0;
        h4Count = 0;
        numbering = `${h2Count}`;
      } else if (level === 3) {
        h3Count += 1;
        h4Count = 0;
        numbering = `${h2Count || 1}.${h3Count}`;
      } else {
        h4Count += 1;
        numbering = `${h2Count || 1}.${h3Count || 1}.${h4Count}`;
      }

      collected.push({ id, text, level: level as 2 | 3 | 4, numbering });
    });

    if (collected.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(collected);
    }
  }, []);

  if (items.length === 0) return null;

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    const offset = window.innerHeight * SCROLL_OFFSET_PERCENT;
    const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <div
      className={`px-4 py-[10px] bg-card border border-foreground mb-[14px] max-w-full ${expanded ? "w-full" : "w-fit"}`}
      aria-label="Mục lục"
    >
      <div className="text-lg leading-tight pb-1 font-semibold text-foreground flex items-center gap-2">
        <span>Mục lục</span>
        <button
          type="button"
          className="bg-transparent text-foreground border-none cursor-pointer font-[inherit] p-0 hover:text-brand"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "[ẩn]" : "[hiện]"}
        </button>
      </div>
      {expanded && (
        <ul className="list-none p-0 m-0">
          {items.map((item) => (
            <li
              key={item.id}
              className={`block ${item.level === 3 ? "ml-5" : item.level === 4 ? "ml-10" : ""}`}
            >
              <a
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                className="inline-block my-[2px] underline text-foreground transition-colors duration-300 hover:text-brand"
              >
                {item.numbering}. {item.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
