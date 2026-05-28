"use client";

import { useTranslations } from "next-intl";

type DeliveryItem = {
  icon: "truck" | "box" | "shield" | "return";
  titleKey: string;
  detailKey: string;
};

const ITEMS: DeliveryItem[] = [
  { icon: "truck", titleKey: "cityTitle", detailKey: "cityDetail" },
  { icon: "box", titleKey: "nationwideTitle", detailKey: "nationwideDetail" },
  { icon: "shield", titleKey: "warrantyTitle", detailKey: "warrantyDetail" },
  { icon: "return", titleKey: "returnTitle", detailKey: "returnDetail" },
];

function DeliveryIcon({ name }: { name: DeliveryItem["icon"] }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "truck":
      return (
        <svg {...common}>
          <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="17.5" cy="18" r="1.6" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4" />
        </svg>
      );
    case "return":
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16M21 4v4h-4M3 20v-4h4" />
        </svg>
      );
  }
}

/** Static delivery / warranty / return trust grid shown under the buy box. */
export function ProductDeliveryInfo() {
  const t = useTranslations("Product.delivery");
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:gap-4">
      {ITEMS.map((item) => (
        <li
          key={item.titleKey}
          className="flex items-center gap-3 border border-border bg-muted/40 p-3"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand-soft text-brand"
            aria-hidden="true"
          >
            <DeliveryIcon name={item.icon} />
          </span>
          <span className="min-w-0 leading-snug">
            <b className="block text-sm font-semibold text-foreground">
              {t(item.titleKey)}
            </b>
            <span className="block text-xs text-muted-foreground">
              {t(item.detailKey)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
