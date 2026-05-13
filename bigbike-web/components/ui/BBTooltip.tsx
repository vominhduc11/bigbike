"use client";

import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type BBTooltipProps = {
  content: string;
  children: ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
  delay?: number;
};

export function BBTooltip({ content, children, placement = "bottom", delay = 60 }: BBTooltipProps) {
  if (!content) return children;
  return (
    <TooltipProvider delayDuration={delay}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={placement}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
