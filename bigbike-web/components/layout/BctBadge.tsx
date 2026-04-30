"use client";

interface BctBadgeProps {
  alt: string;
  height: number;
}

const EXTERNAL_SRC = "https://online.gov.vn/Content/EndUser/Images/LogoCCDVTMDT.png";

export function BctBadge({ alt, height }: BctBadgeProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/bct-logo.png"
      alt={alt}
      height={height}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = EXTERNAL_SRC;
      }}
    />
  );
}
