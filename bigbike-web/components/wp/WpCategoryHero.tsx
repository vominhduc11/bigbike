import Link from "next/link";

/* eslint-disable @next/next/no-img-element */

/**
 * .page-title — port 1:1 từ woocommerce/archive-product.php: nền top_image,
 * tiêu đề danh mục + breadcrumb (yoast) bên trái, ảnh minh hoạ bên phải.
 */

export type WpCategoryCrumb = { label: string; href?: string };

const DEFAULT_BG = "/wp-content/themes/bigbike/images/page-title-bg.png";
const DEFAULT_ILLUSTRATION = "/wp-content/themes/bigbike/images/mu-bao-hiem.png";

export function WpCategoryHero({
  title,
  breadcrumb,
  bgUrl,
  illustrationUrl,
  illustrationAlt,
}: {
  title: string;
  breadcrumb: WpCategoryCrumb[];
  bgUrl?: string | null;
  illustrationUrl?: string | null;
  illustrationAlt?: string | null;
}) {
  const bg = bgUrl?.trim() || DEFAULT_BG;
  const illustration = illustrationUrl?.trim() || DEFAULT_ILLUSTRATION;

  return (
    <div className="page-title" style={{ backgroundImage: `url('${bg}')` }}>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-md-6">
            <h1 className="">{title}</h1>
            <div className="breadcrumb">
              <ul>
                {breadcrumb.map((crumb, i) => (
                  <li key={i}>
                    {crumb.href ? (
                      <Link href={crumb.href} className={i === 0 ? "home" : "taxonomy"}>
                        <span property="name">{crumb.label}</span>
                      </Link>
                    ) : (
                      <span property="name">{crumb.label}</span>
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
