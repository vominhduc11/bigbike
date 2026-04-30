"use client";

import Tippy from "@tippyjs/react/headless";
import type { ReactElement } from "react";

type BBTooltipProps = {
  content: string;
  children: ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
  delay?: number;
};

export function BBTooltip({
  content,
  children,
  placement = "bottom",
  delay = 60,
}: BBTooltipProps) {
  if (!content) return children;

  return (
    <Tippy
      render={(attrs) => (
        <span className="bb-tooltip" role="tooltip" {...attrs}>
          {content}
        </span>
      )}
      placement={placement}
      delay={[delay, 40]}
      duration={[100, 80]}
      offset={[0, 8]}
      trigger="mouseenter focus"
      hideOnClick
    >
      {children}
    </Tippy>
  );
}
