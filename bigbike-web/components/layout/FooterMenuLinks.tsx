"use client";

import Link from "@/i18n/StorefrontLink";
import { useLocale } from "next-intl";
import { getGuideLayout } from "@/lib/content/static-pages";
import { getPolicyLinks, getRetainedPolicyLinks } from "@/lib/content/policy-pages";
import { translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

/** Liên kết chính sách và hướng dẫn size — client component để
 * đổi ngôn ngữ ngay khi bấm nút chuyển vi/en, không cần tải lại trang (cùng cơ chế
 * với menu header - xem HeaderMenu.tsx). Không còn gọi API/Menu admin. */
function buildRetainedMenuItems(locale: string) {
  const isEn = locale === "en";

  const guideLayout = getGuideLayout(locale);
  const sizeMuEntry = guideLayout.entries.find((e) => e.pageSlug === "cach-do-size-dau");
  const sizeTrangPhucEntry = guideLayout.entries.find(
    (e) => e.pageSlug === "cach-do-size-trang-phuc",
  );

  return [
    ...getRetainedPolicyLinks(locale),
    {
      id: "helmet-sizing",
      href: "/huong-dan/size-mu/",
      label:
        sizeMuEntry?.title || (isEn ? "Helmet Sizing Guide" : "Cách xác định size mũ bảo hiểm"),
    },
    {
      id: "clothing-sizing",
      href: "/huong-dan/size-trang-phuc/",
      label:
        sizeTrangPhucEntry?.title ||
        (isEn ? "Clothing Sizing Guide" : "Cách đo size trang phục bảo hộ"),
    },
  ];
}

function renderLink(item: { href: string; label: string }, locale: string) {
  return (
    <Link
      href={translatePath(item.href, locale as Locale)}
      className="inline-flex min-h-11 items-center text-white! no-underline! hover:text-brand-inverse!"
    >
      {item.label}
    </Link>
  );
}

export function FooterMenuLinks() {
  const locale = useLocale();
  const policies = getPolicyLinks(locale);

  return (
    <ul data-footer-policy-list className="m-0 flex list-none flex-col gap-2 p-0">
      {policies.map((item) => (
        <li key={item.href} data-footer-menu-link={item.id}>
          {renderLink(item, locale)}
        </li>
      ))}
    </ul>
  );
}

export function FooterSupportLinks() {
  const locale = useLocale();
  const items = buildRetainedMenuItems(locale);

  return (
    <ul data-footer-retained-links className="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((item) => (
        <li key={item.href} data-footer-support-link={item.id}>
          {renderLink(item, locale)}
        </li>
      ))}
    </ul>
  );
}
