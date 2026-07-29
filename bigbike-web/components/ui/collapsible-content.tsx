"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_PREVIEW_HEIGHT = 280;
const HEIGHT_TOLERANCE = 1;

export type CollapsibleContentProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  previewHeight?: number;
  expandLabel?: string;
  collapseLabel?: string;
};

/**
 * Khung nội dung dài có preview nhưng luôn giữ toàn bộ children trong HTML/DOM.
 * Chiều cao được đo lại khi nội dung, ảnh hoặc viewport thay đổi; mỗi instance
 * tự quản lý trạng thái mở/đóng độc lập.
 */
export function CollapsibleContent({
  children,
  className,
  contentClassName,
  previewHeight = DEFAULT_PREVIEW_HEIGHT,
  expandLabel,
  collapseLabel,
}: CollapsibleContentProps) {
  const t = useTranslations("Common");
  const generatedId = useId();
  const contentId = `collapsible-content-${generatedId.replace(/:/g, "")}`;
  const contentRef = useRef<HTMLDivElement>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      const nextHeight = Math.ceil(content.scrollHeight);
      setContentHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );

      if (nextHeight <= previewHeight + HEIGHT_TOLERANCE) {
        setIsExpanded(false);
      }
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [previewHeight]);

  const isCollapsible =
    contentHeight !== null && contentHeight > previewHeight + HEIGHT_TOLERANCE;
  const maxHeight =
    contentHeight === null
      ? previewHeight
      : isCollapsible
        ? isExpanded
          ? contentHeight
          : previewHeight
        : undefined;
  const resolvedExpandLabel = expandLabel ?? t("showMore");
  const resolvedCollapseLabel = collapseLabel ?? t("showLess");

  return (
    <div
      className={cn("relative", className)}
      data-collapsible-content
      data-state={
        contentHeight === null
          ? "measuring"
          : isCollapsible
            ? isExpanded
              ? "expanded"
              : "collapsed"
            : "static"
      }
    >
      <div
        id={contentId}
        className="relative overflow-y-hidden transition-[max-height] duration-500 ease-in-out motion-reduce:transition-none"
        style={{ maxHeight: maxHeight == null ? undefined : `${maxHeight}px` }}
      >
        <div ref={contentRef} className={contentClassName}>
          {children}
        </div>

        {isCollapsible ? (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--bb-bg-page)] via-[var(--bb-bg-page)]/95 to-transparent transition-opacity duration-300 motion-reduce:transition-none",
              isExpanded ? "opacity-0" : "opacity-100",
            )}
          />
        ) : null}
      </div>

      {isCollapsible ? (
        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 px-6 py-2.5 tracking-wide hover:border-primary hover:bg-primary hover:text-primary-foreground"
            aria-controls={contentId}
            aria-expanded={isExpanded}
            data-collapsible-toggle
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? (
              <>
                {resolvedCollapseLabel}
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                {resolvedExpandLabel}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
