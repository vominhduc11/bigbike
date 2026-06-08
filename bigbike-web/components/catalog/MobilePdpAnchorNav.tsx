"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type AnchorNavItem = {
  id: string;
  label: string;
};

export function MobilePdpAnchorNav({ items }: { items: AnchorNavItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [visible, setVisible] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const manualRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollNavToActive = useCallback((id: string) => {
    const nav = navRef.current;
    if (!nav) return;
    const btn = nav.querySelector<HTMLElement>(`[data-id="${id}"]`);
    btn?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, []);

  // Show nav once purchase section scrolls out of view
  useEffect(() => {
    const purchaseSection = document.querySelector<HTMLElement>(".bb-wp-pdp-layout");
    if (!purchaseSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry ? !entry.isIntersecting : false);
      },
      { threshold: 0 },
    );
    observer.observe(purchaseSection);
    return () => observer.disconnect();
  }, []);

  // Track active section via IntersectionObserver
  useEffect(() => {
    if (items.length === 0) return;

    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (manualRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          setActiveId(id);
          scrollNavToActive(id);
        }
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items, scrollNavToActive]);

  function handleClick(id: string) {
    const el = document.getElementById(id);
    if (!el) return;

    manualRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      manualRef.current = false;
    }, 800);

    setActiveId(id);
    scrollNavToActive(id);

    const headerEl = document.querySelector<HTMLElement>(".bb-site-header");
    const navEl = navRef.current;
    const offset = (headerEl?.offsetHeight ?? 60) + (navEl?.offsetHeight ?? 44) + 8;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className={cn(
        "hidden max-md:flex max-md:overflow-x-auto max-md:overflow-y-hidden max-md:[scroll-snap-type:x_mandatory] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden max-md:bg-white max-md:border-b max-md:border-border max-md:fixed max-md:top-[var(--bb-header-height)] max-md:left-0 max-md:right-0 max-md:z-40 max-md:px-2 max-md:gap-0 max-md:[transition-property:transform] max-md:duration-200 max-md:ease-[ease]",
        visible
          ? "max-md:[transform:translateY(0)] max-md:pointer-events-auto"
          : "max-md:[transform:translateY(-100%)] max-md:pointer-events-none",
      )}
      aria-label="Điều hướng nội dung sản phẩm"
      aria-hidden={!visible}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-id={item.id}
          className={cn(
            "max-md:flex-none max-md:[scroll-snap-align:start] max-md:py-2.5 max-md:px-3.5 max-md:border-b-2 max-md:bg-transparent max-md:font-body max-md:text-xs max-md:font-bold max-md:uppercase max-md:tracking-normal max-md:whitespace-nowrap max-md:cursor-pointer max-md:-mb-px max-md:min-h-11",
            activeId === item.id
              ? "max-md:text-brand max-md:border-b-brand"
              : "max-md:text-muted-foreground max-md:border-b-transparent",
          )}
          onClick={() => handleClick(item.id)}
          tabIndex={visible ? 0 : -1}
          aria-current={activeId === item.id ? "location" : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
