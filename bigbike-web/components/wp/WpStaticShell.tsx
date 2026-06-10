import { WpCategoryHero, type WpCategoryCrumb } from "./WpCategoryHero";

/**
 * Khung WP dùng chung cho nhóm trang NỘI DUNG TĨNH — port 1:1 từ
 * wp-content/themes/bigbike/page.php: .page-title (banner + breadcrumb) +
 * #main-content. Header + footer KHÔNG còn render ở đây — đã được layout chung
 * render một lần cho mọi route WP (xem app/layout.tsx). Shell chỉ lo bundle CSS
 * riêng của trang, hero và phần nội dung.
 *
 * page.php không bọc thêm div quanh .page-title / #main-content, nên shell cũng
 * render trực tiếp. Mỗi trang tự dựng `.container` bên trong children để bám đúng
 * cấu trúc của template tương ứng (page.php / page-about / page-contact / ...).
 */
export function WpStaticShell({
  title,
  breadcrumb,
  heroBgUrl,
  heroIllustrationUrl,
  heroIllustrationAlt,
  showHero = true,
  mainClassName = "pb-40",
  cssHref = "/wp-content/themes/bigbike/css/wp-theme-static.css?v=1",
  children,
}: {
  title: string;
  breadcrumb: WpCategoryCrumb[];
  heroBgUrl?: string | null;
  heroIllustrationUrl?: string | null;
  heroIllustrationAlt?: string | null;
  /** page-contact.php ẩn .page-title (banner) — đặt false để bỏ hero. */
  showHero?: boolean;
  /** Class của #main-content — page.php dùng "pb-40"; page-contact dùng "pb-40 contact-page". */
  mainClassName?: string;
  /** Bundle CSS theme cho trang — mặc định static; cụm giao dịch truyền bundle riêng. */
  cssHref?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="stylesheet" href={cssHref} precedence="default" />

      {showHero ? (
        <WpCategoryHero
          title={title}
          breadcrumb={breadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroIllustrationAlt}
        />
      ) : null}

      <div className={mainClassName} id="main-content">
        {children}
      </div>
    </>
  );
}
