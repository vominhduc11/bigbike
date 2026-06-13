import { WpCategoryHero, type WpCategoryCrumb } from "./WpCategoryHero";
import { WpThemeStylesheet } from "./WpThemeStylesheet";

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
  titleNode,
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
  /** Tiêu đề dạng node (vd `<LText>` đổi ngôn ngữ ở client) — ưu tiên hơn `title` cho `<h1>`. */
  titleNode?: React.ReactNode;
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
      <WpThemeStylesheet href={cssHref} />

      {showHero ? (
        <WpCategoryHero
          title={title}
          titleNode={titleNode}
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
