import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const richContentClassName =
  "text-a4-content leading-relaxed text-foreground " +
  "[&_a]:font-semibold [&_a]:text-brand [&_a]:underline-offset-4 hover:[&_a]:underline " +
  "[&_blockquote]:border-l-4 [&_blockquote]:border-brand [&_blockquote]:pl-4 " +
  "[&_h1]:mb-5 [&_h1]:font-cta [&_h1]:text-a1-title [&_h1]:font-bold [&_h1]:uppercase " +
  "[&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:font-cta [&_h2]:text-a2-page [&_h2]:font-bold [&_h2]:uppercase " +
  "[&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:font-cta [&_h3]:text-a3-section [&_h3]:font-semibold [&_h3]:uppercase " +
  "[&_img]:h-auto [&_img]:max-w-full [&_li]:mb-2 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_p]:mb-4 [&_table]:mb-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto " +
  "[&_td]:border-t [&_td]:border-border [&_td]:p-3 [&_th]:border-t [&_th]:border-border [&_th]:p-3 " +
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6";

export function RichContent({
  html,
  className,
  children,
}: {
  html?: string;
  className?: string;
  children?: ReactNode;
}) {
  if (html != null) {
    return (
      <div
        className={cn(richContentClassName, className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <div className={cn(richContentClassName, className)}>{children}</div>;
}
