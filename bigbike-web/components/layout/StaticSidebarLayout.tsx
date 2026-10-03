import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { PolicySidebar, type PolicySidebarItem } from "@/components/layout/PolicySidebar";
import { RichContent } from "@/components/layout/RichContent";
import { sanitizeRichHtml } from "@/lib/utils/html";

type StaticSidebarLayoutProps = {
  sidebarItems: PolicySidebarItem[];
  sidebarEmptyLabel?: string;
  compactSidebar?: boolean;
  body?: string | null;
  bodyNode?: ReactNode;
  children?: ReactNode;
};

export function StaticSidebarLayout({
  sidebarItems,
  sidebarEmptyLabel,
  compactSidebar,
  body,
  bodyNode,
  children,
}: StaticSidebarLayoutProps) {
  return (
    <Container className="grid grid-cols-1 gap-8 md:grid-cols-12">
      <PolicySidebar items={sidebarItems} emptyLabel={sidebarEmptyLabel} compact={compactSidebar} />
      <div className="min-w-0 md:col-span-9">
        {bodyNode != null ? (
          bodyNode
        ) : body != null ? (
          <RichContent html={sanitizeRichHtml(body)} />
        ) : (
          <RichContent>{children}</RichContent>
        )}
      </div>
    </Container>
  );
}
