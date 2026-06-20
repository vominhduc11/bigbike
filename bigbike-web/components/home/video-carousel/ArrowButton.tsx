import { ChevronLeft, ChevronRight } from "lucide-react";

export function ArrowButton({
  direction,
  onClick,
  label,
  disabled = false,
  tone = "dark",
}: {
  direction: "prev" | "next";
  onClick: () => void;
  label: string;
  disabled?: boolean;
  /** "dark" = nền tối → mũi tên trắng; "light" = nền sáng → mũi tên tối. */
  tone?: "dark" | "light";
}) {
  const isLight = tone === "light";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      // Inline style để thắng CSS WP/Bootstrap cũ ghi đè <button> trên trang chủ.
      // Không khung nền: chỉ mũi tên to, dùng drop-shadow để nổi trên mọi nền
      // (giống nút Play trên thumbnail video). Màu đổi theo nền đặt carousel.
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 76,
        height: 76,
        flexShrink: 0,
        padding: 0,
        background: "transparent",
        border: "none",
        color: isLight ? "#111111" : "#fff",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        outline: "none",
        filter: isLight
          ? "drop-shadow(0 1px 3px rgba(0,0,0,0.2))"
          : "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
      }}
      className="transition-transform duration-150 hover:!scale-110 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
    >
      {direction === "prev"
        ? <ChevronLeft aria-hidden="true" style={{ width: 64, height: 64, flexShrink: 0 }} strokeWidth={2} />
        : <ChevronRight aria-hidden="true" style={{ width: 64, height: 64, flexShrink: 0 }} strokeWidth={2} />
      }
    </button>
  );
}
