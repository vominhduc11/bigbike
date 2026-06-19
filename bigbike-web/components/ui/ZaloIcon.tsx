type ZaloIconProps = {
  className?: string;
};

/**
 * Logo Zalo dựng bằng SVG nội tuyến (web KHÔNG nạp Font Awesome / icon font ngoài).
 * Bong bóng chat lấy màu theo `currentColor` (nút truyền text-zalo → bong bóng xanh),
 * chữ "Zalo" trắng nằm trong bong bóng. Dùng cho nút "Tư vấn Zalo" trên PDP.
 */
export function ZaloIcon({ className }: ZaloIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {/* Bong bóng chat bo góc + đuôi dưới-trái — màu theo currentColor (xanh Zalo). */}
      <path
        fill="currentColor"
        d="M24 4C12.4 4 3 11.85 3 21.5c0 5.28 2.84 10 7.3 13.18-.25 2.3-1.02 4.95-2.5 6.86-.45.58-.03 1.42.69 1.34 3.43-.39 6.62-1.78 8.98-3.4 2.04.47 4.2.72 6.53.72 11.6 0 21-7.85 21-17.5S35.6 4 24 4Z"
      />
      {/* Chữ "Zalo" trắng trong bong bóng. */}
      <text
        x="24"
        y="26.5"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="13"
        fontWeight="700"
        letterSpacing="-0.4"
        fill="#fff"
      >
        Zalo
      </text>
    </svg>
  );
}
