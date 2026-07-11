"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { getStaticPage, getGuideLayout } from "@/lib/content/static-pages";
import { translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

/** 5 link cố định của footer (chính sách + hướng dẫn size) — client component để
 * đổi ngôn ngữ ngay khi bấm nút chuyển vi/en, không cần tải lại trang (cùng cơ chế
 * với menu header - xem HeaderMenu.tsx). Không còn gọi API/Menu admin. */
function buildFooterMenuItems(locale: string) {
  const isEn = locale === "en";
  const returnPage = getStaticPage("chinh-sach-doi-tra-hang", locale);
  const warrantyPage = getStaticPage("chinh-sach-bao-hanh", locale);
  const privacyPage = getStaticPage("chinh-sach-bao-mat-thong-tin", locale);

  const guideLayout = getGuideLayout(locale);
  const sizeMuEntry = guideLayout.entries.find((e) => e.pageSlug === "cach-do-size-dau");
  const sizeTrangPhucEntry = guideLayout.entries.find((e) => e.pageSlug === "cach-do-size-trang-phuc");

  return [
    {
      href: "/chinh-sach/chinh-sach-doi-tra-hang/",
      label: returnPage?.title || (isEn ? "Return Policy" : "Chính sách đổi trả hàng"),
    },
    {
      href: "/chinh-sach/chinh-sach-bao-hanh/",
      label: warrantyPage?.title || (isEn ? "Warranty Policy" : "Chính sách bảo hành"),
    },
    {
      href: "/chinh-sach/chinh-sach-bao-mat-thong-tin/",
      label: privacyPage?.title || (isEn ? "Privacy Policy" : "Chính sách bảo mật thông tin"),
    },
    {
      href: "/huong-dan/size-mu/",
      label: sizeMuEntry?.title || (isEn ? "Helmet Sizing Guide" : "Cách xác định size mũ bảo hiểm"),
    },
    {
      href: "/huong-dan/size-trang-phuc/",
      label: sizeTrangPhucEntry?.title || (isEn ? "Clothing Sizing Guide" : "Cách đo size trang phục bảo hộ"),
    },
  ];
}

export function FooterMenuLinks() {
  const locale = useLocale();
  const items = buildFooterMenuItems(locale);

  return (
    <ul className="m-0 flex list-none flex-col gap-[5px] p-0">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={translatePath(item.href, locale as Locale)}
            className="text-white! no-underline! hover:text-brand-inverse!"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
