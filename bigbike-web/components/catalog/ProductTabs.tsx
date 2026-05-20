"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ProductTabSection = {
  /** Stable anchor id for the section. */
  id: string;
  /** Tab button text (also the section's descriptive title). */
  label: string;
  /** Rendered panel body. */
  content: ReactNode;
};

/**
 * Tabbed product-detail content (Mô tả / Thông số / Đánh giá …). Replaces the
 * scroll-band layout: one panel visible at a time, switched by the tab bar.
 */
export function ProductTabs({ sections }: { sections: ProductTabSection[] }) {
  if (sections.length === 0) return null;

  return (
    <section className="mx-auto mt-14 max-w-[1440px] px-4 sm:px-6">
      <Tabs defaultValue={sections[0].id}>
        <TabsList className="sticky top-[var(--bb-header-stack)] z-10 bg-background overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
          {sections.map((section) => (
            <TabsTrigger key={section.id} value={section.id} className="shrink-0">
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {sections.map((section) => (
          <TabsContent key={section.id} value={section.id} className="py-8">
            {section.content}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
