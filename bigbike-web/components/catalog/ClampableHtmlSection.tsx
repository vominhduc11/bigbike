"use client";

import { CollapsibleContent } from "@/components/ui/collapsible-content";

/**
 * Adapter HTML cho ProductSpecsTable (thông số kỹ thuật) và SizeGuideBlockView
 * (bảng size). `html` phải được caller sanitize trước khi truyền vào.
 */
export function ClampableHtmlSection({
  html,
  contentClassName,
}: {
  html: string;
  contentClassName?: string;
}) {
  return (
    <CollapsibleContent contentClassName={contentClassName}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </CollapsibleContent>
  );
}
