import Link from "next/link";
import type { ReactNode } from "react";

/* eslint-disable @next/next/no-img-element */

/**
 * .page-title — port 1:1 từ woocommerce/archive-product.php: nền top_image,
 * tiêu đề danh mục + breadcrumb (yoast) bên trái, ảnh minh hoạ bên phải.
 */

export type WpCategoryCrumb = { label: string; href?: string; labelNode?: ReactNode };

const DEFAULT_BG = "/wp-content/themes/bigbike/images/page-title-bg.png";
const DEFAULT_ILLUSTRATION = "/wp-content/themes/bigbike/images/mu-bao-hiem.png";

export function WpCategoryHero({
  title,
  titleNode,
  breadcrumb,
  bgUrl,
  illustrationUrl,
  illustrationAlt,
  focusId,
}: {
  /** Tiêu đề dạng text — dùng cho `<h1>` (khi không có titleNode) và alt ảnh minh hoạ. */
  title: string;
  /** Tiêu đề dạng node (vd `<LText>` để đổi ngôn ngữ ở client); ưu tiên hơn `title` cho `<h1>`. */
  titleNode?: ReactNode;
  /** Phần tử dịch được cho từng crumb (vd crumb cuối là tên danh mục/bài). Index khớp `breadcrumb`. */
  breadcrumb: WpCategoryCrumb[];
  bgUrl?: string | null;
  illustrationUrl?: string | null;
  illustrationAlt?: string | null;
  /** Mốc cho nút "Xem trên web" của màn Cài đặt admin (data-bb-focus). */
  focusId?: string;
}) {
  const bg = bgUrl?.trim() || DEFAULT_BG;
  const illustration = illustrationUrl?.trim() || DEFAULT_ILLUSTRATION;

  return (
    <div className="page-title" style={{ backgroundImage: `url('${bg}')` }} data-bb-focus={focusId}>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-md-6">
            <h1 className="">{titleNode ?? title}</h1>
            <div className="breadcrumb">
              <ul>
                {breadcrumb.map((crumb, i) => (
                  <li key={i}>
                    {crumb.href ? (
                      <Link href={crumb.href} className={i === 0 ? "home" : "taxonomy"}>
                        <span property="name">{crumb.labelNode ?? crumb.label}</span>
                      </Link>
                    ) : (
                      <span property="name">{crumb.labelNode ?? crumb.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="img text-right">
          <img src={illustration} alt={illustrationAlt ?? title} />
        </div>
      </div>
    </div>
  );
}
