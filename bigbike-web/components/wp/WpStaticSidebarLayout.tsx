import type { ReactNode } from "react";
import { WpStaticSidebar, type WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";
import { sanitizeRichHtml } from "@/lib/utils/html";

type WpStaticSidebarLayoutProps = {
  sidebarItems: WpStaticSidebarItem[];
  /** emptyLabel cho WpStaticSidebar khi menu rỗng. */
  sidebarEmptyLabel?: string;
  /** HTML thân trang (chưa sanitize) — render qua sanitizeRichHtml vào `.static-page.wyswyg`. */
  body?: string | null;
  /** Node thân trang dịch được (vd `<LHtml>`) — ưu tiên hơn `body`; tự render `.static-page.wyswyg`. */
  bodyNode?: ReactNode;
  /** Nội dung tuỳ biến thay cho `body` (vd lưới card ở trang gốc /huong-dan). */
  children?: ReactNode;
};

/**
 * Layout trang tĩnh có sidebar — `.container > .row > [.col-md-3 sidebar] +
 * [.col-md-9 > .static-page.wyswyg]` (port page-static.php / page-guide.php).
 * Gom khối vốn copy y hệt ở /chinh-sach/[slug], /huong-dan-mua-hang và GuidePage.
 * Truyền `body` để render HTML CMS, hoặc `children` cho nội dung JSX tuỳ biến.
 */
export function WpStaticSidebarLayout({
  sidebarItems,
  sidebarEmptyLabel,
  body,
  bodyNode,
  children,
}: WpStaticSidebarLayoutProps) {
  return (
    <div className="container">
      <div className="row">
        <WpStaticSidebar items={sidebarItems} emptyLabel={sidebarEmptyLabel} />
        <div className="col-md-9">
          {bodyNode != null ? (
            bodyNode
          ) : body != null ? (
            <div
              className="static-page wyswyg"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(body) }}
            />
          ) : (
            <div className="static-page wyswyg">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}
