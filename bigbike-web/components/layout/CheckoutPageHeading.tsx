import type { ReactNode } from "react";
import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/locale";
import { toHomePath } from "@/lib/utils/routes";

/**
 * Tiêu đề + breadcrumb (Bigbike.vn → {title}) cho khung checkout KHÔNG-hero:
 * /gio-hang, /thanh-toan, /don-hang/xac-nhan. Port markup microdata
 * `.breadcrumb > ul > li[property="name"]` từ page-cart.php / page-checkout.php.
 * Đặt trực tiếp trong `.container` của từng trang. `title` nhận ReactNode để truyền
 * `<Tr>` (đổi ngôn ngữ ở client) — cùng node render ở cả h1 lẫn breadcrumb.
 */
export function CheckoutPageHeading({ title }: { title: ReactNode }) {
  const locale = useLocale() as Locale;
  const tBreadcrumb = useTranslations("Breadcrumb");
  return (
    <header className="mt-6 md:mt-16">
      <h1 className="m-0 font-body text-a2-page font-semibold">{title}</h1>
      <nav className="mt-5" aria-label={tBreadcrumb("ariaLabel")}>
        <ol className="m-0 flex list-none items-center p-0 text-a5-meta text-muted-foreground">
          <li><Link href={toHomePath(locale)} className="font-semibold text-muted-foreground! no-underline! hover:text-brand!">Bigbike.vn</Link></li>
          <li className="before:mx-1 before:content-['/']"><span property="name">{title}</span></li>
        </ol>
      </nav>
    </header>
  );
}
