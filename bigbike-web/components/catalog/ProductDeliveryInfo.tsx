type DeliveryItem = {
  icon: "truck" | "box" | "shield" | "return";
  title: string;
  detail: string;
};

const ITEMS: DeliveryItem[] = [
  { icon: "truck", title: "Giao nhanh nội thành HCM", detail: "Giao trong ngày với đơn khu vực trung tâm" },
  { icon: "box", title: "Giao toàn quốc", detail: "Nhận hàng sau 2–4 ngày làm việc" },
  { icon: "shield", title: "Bảo hành chính hãng", detail: "Hỗ trợ kỹ thuật trọn đời sản phẩm" },
  { icon: "return", title: "Đổi trả trong 7 ngày", detail: "Khi sản phẩm lỗi do nhà sản xuất" },
];

function DeliveryIcon({ name }: { name: DeliveryItem["icon"] }) {
  const common = {
    width: 18,
    height: 18,
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

/** Static delivery / warranty / return trust band shown under the buy box. */
export function ProductDeliveryInfo() {
  return (
    <ul className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
      {ITEMS.map((item) => (
        <li key={item.title} className="flex items-start gap-3">
          <span className="mt-0.5 flex shrink-0 text-brand" aria-hidden="true">
            <DeliveryIcon name={item.icon} />
          </span>
          <span className="min-w-0 text-sm leading-snug">
            <b className="font-semibold text-foreground">{item.title}</b>
            <span className="text-muted-foreground"> — {item.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
