"use client";

import {
  cloneElement,
  useId,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactElement,
} from "react";

type TooltipPlacement = "top" | "bottom" | "left" | "right";
type TooltipChildProps = {
  "aria-describedby"?: string;
};

type BBTooltipProps = {
  content: string;
  children: ReactElement<TooltipChildProps>;
  placement?: TooltipPlacement;
  delay?: number;
};

export function BBTooltip({
  content,
  children,
  placement = "bottom",
  delay = 60,
}: BBTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  if (!content) return children;

  const describedBy = [children.props["aria-describedby"], open ? tooltipId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  const tooltipStyle = {
    "--bb-tooltip-delay": `${delay}ms`,
  } as CSSProperties;

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setOpen(false);
  }

  return (
    <span
      className="bb-tooltip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={handleBlur}
    >
      {cloneElement(children, { "aria-describedby": describedBy })}
      <span
        id={tooltipId}
        className={`bb-tooltip bb-tooltip--${placement}`}
        role="tooltip"
        data-open={open ? "true" : "false"}
        style={tooltipStyle}
      >
        {content}
      </span>
    </span>
  );
}
