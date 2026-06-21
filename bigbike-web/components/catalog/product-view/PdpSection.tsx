import type { ReactNode } from "react";

/**
 * Tiêu đề khối nội dung PDP (desktop) — H2 in hoa, đậm, lớn. Thống nhất nhịp tiêu
 * đề mọi section (theo mockup PDP), dùng token/Arial — KHÔNG hardcode màu/font.
 * `id` để mobile-anchor/scroll trỏ tới.
 */
export function PdpSectionHeading({
  title,
  id,
}: {
  title: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="pdp-section-head scroll-mt-[var(--bb-header-height)]">
      <h2 className="title">{title}</h2>
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
