export type PageHeadingProps = {
  /** Nhãn nhỏ in hoa phía trên tiêu đề (kicker). */
  kicker?: string | null;
  title: string;
  description?: string | null;
};

/**
 * Tiêu đề trang dùng chung cho các trang KHÔNG có banner hero
 * (danh mục sản phẩm, chi tiết thương hiệu...). Trang có hero dùng `PageHero`.
 * Style giữ ở class legacy `bb-page-head` đã có — không thêm CSS mới.
 */
export function PageHeading({ kicker, title, description }: PageHeadingProps) {
  return (
    <div className="bb-page-head">
      {kicker ? <span className="kicker">{kicker}</span> : null}
      <h1>{title}</h1>
      {description ? <p className="bb-entity-desc">{description}</p> : null}
    </div>
  );
}
