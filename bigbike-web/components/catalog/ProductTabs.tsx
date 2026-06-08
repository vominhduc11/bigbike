"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ProductTabSection = {
  id: string;
  label: string;
  content: ReactNode;
  /** Nếu set, click tab này sẽ scroll đến element có id này thay vì switch panel */
  scrollTo?: string;
};

function toWpTabButtonId(id: string) {
  return id.startsWith("tab-") ? `${id.slice(4)}-tab` : `${id}-tab`;
}

export function ProductTabs({ sections }: { sections: ProductTabSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  if (sections.length === 0) return null;
  const panelSections = sections.filter((s) => !s.scrollTo);
  const activeId = panelSections.some((s) => s.id === active)
    ? active
    : (panelSections[0]?.id ?? "");

  function handleScrollTo(targetId: string) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const header = document.querySelector<HTMLElement>(".bb-site-header");
    const offset = (header?.offsetHeight ?? 60) + 8;
    const y = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  return (
    // `bb-wp-tabs` + `tab-panel` kept as bare markers ONLY to host the descendant
    // reset `.bb-wp-tabs .tab-panel *{line-height:inherit}` (specificity 0,2,0 —
    // it intentionally overrides bb-richtext heading line-heights inside tabs; an
    // inline [&_*] util can't reach that specificity). All other styling is inline.
    <section className="bb-wp-tabs mx-auto mt-20 mb-10 px-[15px] max-w-[1140px] max-[1024px]:mt-[60px] max-md:mt-8 max-md:px-[var(--bb-mobile-page-x)] max-md:border-t-[3px] max-md:border-t-border min-[1536px]:max-w-[1360px] min-[1920px]:max-w-[1600px]">
      <div
        role="tablist"
        aria-label="Thông tin sản phẩm"
        className="mb-10 max-[1024px]:h-[42px] max-[1024px]:overflow-x-auto max-[1024px]:overflow-y-hidden max-[1024px]:[scrollbar-width:none] max-[1024px]:[&::-webkit-scrollbar]:hidden max-md:mb-[18px] max-md:hidden"
      >
        <ul
          id="myTab"
          className="relative flex flex-nowrap w-full m-0 pl-2.5 border-none list-none max-md:w-max max-md:min-w-full before:content-[''] before:absolute before:top-1/2 before:right-0 before:left-2.5 before:z-0 before:h-px before:bg-border-default"
        >
          {sections.map((section) => {
            const tabId = toWpTabButtonId(section.id);
            const active = activeId === section.id;
            return (
              <li
                key={section.id}
                className="relative z-[1] w-full max-w-[220px] m-0 pr-[30px] bg-white max-md:w-auto max-md:min-w-40 max-md:pr-3"
              >
                <a
                  role="tab"
                  aria-selected={active}
                  aria-controls={section.id}
                  id={tabId}
                  href={`#${section.id}`}
                  className={cn(
                    "relative block w-full h-[42px] border-none bg-transparent text-[var(--bb-text-secondary)] font-body text-base font-semibold leading-[42px] text-center whitespace-nowrap no-underline normal-case cursor-pointer after:content-[''] after:absolute after:inset-0 after:-z-[1] after:border after:border-border-default after:bg-white after:[transform:skewX(-20deg)] max-[1024px]:text-sm",
                    active && "text-white after:border-black after:bg-black",
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    if (section.scrollTo) {
                      handleScrollTo(section.scrollTo);
                    } else {
                      setActive(section.id);
                    }
                  }}
                >
                  <span data-text={section.label}>{section.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        {panelSections.map((section) => {
          const active = activeId === section.id;
          return (
            <div
              key={section.id}
              id={section.id}
              role="tabpanel"
              aria-labelledby={toWpTabButtonId(section.id)}
              className={cn(
                "tab-panel text-black text-[length:var(--fs-body)] leading-[1.7] md:leading-[2.3]",
                active ? "block" : "hidden",
                "max-md:block max-md:pt-6 max-md:pb-1 max-md:mt-0 max-md:border-t-[3px] max-md:border-t-border max-md:first:[border-top:none] max-md:scroll-mt-[calc(var(--bb-header-height)_+_52px)]",
                "max-md:before:content-[attr(data-label)] max-md:before:block max-md:before:mb-4 max-md:before:font-[family-name:var(--bb-font-display)] max-md:before:text-lg max-md:before:font-semibold max-md:before:text-[var(--bb-text-primary)] max-md:before:uppercase max-md:before:tracking-normal max-md:before:leading-[1.2]",
              )}
              data-label={section.label}
            >
              {section.content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
