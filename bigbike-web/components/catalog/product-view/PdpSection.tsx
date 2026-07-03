import type { ReactNode } from "react";

/**
 * Tiêu đề khối nội dung PDP — H2 in hoa, đậm, lớn, kèm vạch đỏ brand bên trái (đồng bộ
 * với `BlockTitle` của khối mô tả dạng block — xem description-blocks/blocks.tsx). Thống
 * nhất nhịp + dấu hiệu nhận biết tiêu đề mục cho MỌI section PDP (theo mockup PDP), dùng
 * token/Arial — KHÔNG hardcode màu/font. `id` để mobile-anchor/scroll trỏ tới. `end` (tuỳ
 * chọn) là phần tử phụ căn phải CÙNG HÀNG tiêu đề (vd huy hiệu) — xem ProductTrustCard.
 */
export function PdpSectionHeading({
  title,
  id,
  end,
}: {
  title: ReactNode;
  id?: string;
  end?: ReactNode;
}) {
  return (
    <div
      id={id}
      className="pdp-section-head flex flex-wrap items-center justify-between gap-3 scroll-mt-[var(--bb-header-height)]"
    >
      <h2 className="title flex items-stretch gap-3">
        <span className="w-1 shrink-0 self-stretch bg-brand" aria-hidden />
        <span>{title}</span>
      </h2>
      {end}
    </div>
  );
}

/**
 * Ngăn cách giữa các khối nội dung PDP (desktop + khối hiện trên mobile): vạch hairline mảnh ở ĐẦU
 * mỗi mục + nhịp dọc đều, đồng bộ với khối Đánh giá. Dùng token `border-border` (KHÔNG hardcode màu)
 * và thang spacing 4px của Tailwind. DÙNG CHUNG cho MỌI section — kể cả 2 carousel (Sản phẩm tương tự /
 * Phụ kiện bán kèm) — để toàn trang có một nhịp dọc đồng đều, tiêu đề căn trái thống nhất.
 */
export const PDP_SECTION_SEP = "mt-12 border-t border-border pt-12 max-md:mt-10 max-md:pt-10";
