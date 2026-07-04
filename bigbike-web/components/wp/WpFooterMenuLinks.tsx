"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { getStaticPage, getGuideLayout } from "@/lib/content/static-pages";

/** 5 link cố định của footer (chính sách + hướng dẫn size) — client component để
 * đổi ngôn ngữ ngay khi bấm nút chuyển vi/en, không cần tải lại trang (cùng cơ chế
 * với menu header — xem WpMenuClient.tsx). Không còn gọi API/Menu admin. */
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

import { translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

export function WpFooterMenuLinks() {
  const locale = useLocale();
  const items = buildFooterMenuItems(locale);

  return (
    <ul className="menu">
      {items.map((item) => (
        <li key={item.href} className="menu-item">
          <Link href={translatePath(item.href, locale as Locale)}>{item.label}</Link>
        </li>
      ))}
    </ul>
  );
}
