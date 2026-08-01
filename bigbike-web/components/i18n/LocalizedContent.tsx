"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Compatibility wrapper. Content is now fetched in the URL locale on the server;
 * no client-side language refetch or hydration-time text replacement is allowed.
 */
export function LocalizedContentProvider({ children }: { kind: string; slug: string; children: ReactNode }) {
  return <>{children}</>;
}

export function useLocalizedField<T = unknown>(_field: string): T | undefined {
  void _field;
  return undefined;
}

export function LText({ children }: { field: string; children: ReactNode }) {
  return <>{children}</>;
}

type LHtmlProps = {
  field: string;
  viHtml: string;
  className?: string;
  allowInlineStyles?: boolean;
  rewriteMediaUrls?: boolean;
};

const TRANSPARENT_THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169' viewBox='0 0 300 169'%3E%3C/svg%3E";

export function LHtml({ viHtml, className }: LHtmlProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement) || target.dataset.fallbackApplied) return;
      target.dataset.fallbackApplied = "true";
      target.src = TRANSPARENT_THUMBNAIL;
      target.classList.add("bb-news-img-placeholder");
    };
    container.addEventListener("error", handleError, true);
    return () => container.removeEventListener("error", handleError, true);
  }, []);

  return <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: viHtml }} />;
}
