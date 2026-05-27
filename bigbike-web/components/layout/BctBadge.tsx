"use client";

import { useState } from "react";

interface BctBadgeProps {
  alt: string;
  height: number;
}

export function BctBadge({ alt, height }: BctBadgeProps) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/wp/license.png"
      alt={alt}
      height={height}
      loading="lazy"
      onError={() => setHidden(true)}
    />
  );
}
