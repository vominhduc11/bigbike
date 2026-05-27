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
      className={cn("bb-pdp-anchor-nav", visible && "is-visible")}
      aria-label="Điều hướng nội dung sản phẩm"
      aria-hidden={!visible}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-id={item.id}
          className={cn("bb-pdp-anchor-btn", activeId === item.id && "is-active")}
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
