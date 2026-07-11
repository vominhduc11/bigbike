import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Tiêu đề + breadcrumb (Bigbike.vn → {title}) cho khung checkout KHÔNG-hero:
 * /gio-hang, /thanh-toan, /don-hang/xac-nhan. Port markup microdata
 * `.breadcrumb > ul > li[property="name"]` từ page-cart.php / page-checkout.php.
 * Đặt trực tiếp trong `.container` của từng trang. `title` nhận ReactNode để truyền
 * `<Tr>` (đổi ngôn ngữ ở client) — cùng node render ở cả h1 lẫn breadcrumb.
 */
export function CheckoutPageHeading({ title }: { title: ReactNode }) {
  return (
    <header className="mt-16">
      <h1 className="m-0 font-cta text-4xl font-semibold uppercase md:text-5xl">{title}</h1>
      <nav className="mt-3" aria-label="Breadcrumb">
        <ol className="m-0 flex list-none items-center p-0 text-caption text-muted-foreground">
          <li><Link href="/" className="font-semibold text-muted-foreground! no-underline! hover:text-brand!">Bigbike.vn</Link></li>
          <li className="before:mx-1 before:content-['/']"><span property="name">{title}</span></li>
        </ol>
      </nav>
    </header>
  );
}
