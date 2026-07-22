"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const CLAMP_THRESHOLD_PX = 360;

/**
 * Khung HTML tự do (admin dán trực tiếp) dài bao nhiêu cũng đo chiều cao thật qua
 * scrollHeight, tự thu gọn khi vượt CLAMP_THRESHOLD_PX kèm nút "Xem thêm/Thu gọn".
 * Dùng chung cho ProductSpecsTable (thông số kỹ thuật) và SizeGuideBlockView (bảng size)
 * — `html` phải được caller sanitize trước khi truyền vào.
 */
export function ClampableHtmlSection({
  html,
  contentClassName,
}: {
  html: string;
  contentClassName?: string;
}) {
  const t = useTranslations("Product");
  const locale = useLocale();

  const [isExpanded, setIsExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const checkHeight = () => {
      if (el.scrollHeight > CLAMP_THRESHOLD_PX) {
        setClamped(true);
      } else {
        setClamped(false);
      }
    };

    checkHeight();
    const timer = setTimeout(checkHeight, 150);
    return () => clearTimeout(timer);
  }, [html]);

  const showMoreLabel = t("reviews.showMore") || (locale === "en" ? "Show more" : "Xem thêm");
  const showLessLabel = t("reviews.showLess") || (locale === "en" ? "Show less" : "Thu gọn");

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={cn(
          contentClassName,
          "overflow-y-hidden transition-[max-height] duration-500 ease-in-out relative",
          clamped ? (isExpanded ? "max-h-750" : "max-h-70") : ""
        )}
      >
        <div dangerouslySetInnerHTML={{ __html: html }} />

        {clamped && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--bb-bg-page)] via-[var(--bb-bg-page)]/95 to-transparent pointer-events-none transition-opacity duration-300",
              isExpanded ? "opacity-0" : "opacity-100"
            )}
          />
        )}
      </div>

      {clamped && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
            className="flex items-center gap-1.5 border border-brand bg-[var(--bb-bg-page)] px-6 py-2.5 text-b4-action font-cta font-bold uppercase tracking-wider text-brand transition-all duration-[var(--bb-duration-fast)] hover:bg-brand hover:text-white cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-ring"
          >
            {isExpanded ? (
              <>
                {showLessLabel}
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                {showMoreLabel}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
