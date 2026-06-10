"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface BctBadgeProps {
  alt: string;
  className?: string;
}

export function BctBadge({ alt, className }: BctBadgeProps) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/wp/license.png"
      alt={alt}
      // Sizing comes from Tailwind utilities (utilities layer) which override the
      // preflight `img { height: auto }` base rule. The WP original sized this badge
      // by WIDTH on mobile (200px), so width — not height — is the driving axis there;
      // that keeps the ratio intact when preflight `max-width:100%` caps it on narrow
      // screens. Desktop drives by height instead (see caller).
      className={cn(className)}
      loading="lazy"
      onError={() => setHidden(true)}
    />
  );
}
