"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE } from "@/i18n/locale";

/* eslint-disable @next/next/no-img-element */

/**
 * .page-title — port 1:1 từ woocommerce/archive-product.php: nền top_image,
 * tiêu đề danh mục + breadcrumb (yoast) bên trái, ảnh minh hoạ bên phải.
 *
 * Client vì `href` phải theo đúng locale hiện tại của khách (`useLocale()`); các
 * trang gọi component này (danh mục/bài viết) là Server Component luôn render "vi"
 * tĩnh (xem i18n/request.ts) nên không thể tự đổi crumb sang URL EN. `altHref` (khi
 * caller đã biết bản EN, vd qua `slugEn`) được ưu tiên khi locale hiện tại là "en";
 * thiếu `altHref` → giữ nguyên `href` vi (đúng hành vi khi chưa có slug tiếng Anh).
 */

export type WpCategoryCrumb = {
  label: string;
  href?: string;
  /** URL bản tiếng Anh của crumb này, nếu caller đã biết (vd category.slugEn). */
  altHref?: string;
  labelNode?: ReactNode;
};

const DEFAULT_BG = "/wp-content/themes/bigbike/images/page-title-bg.png";
const DEFAULT_ILLUSTRATION = "/wp-content/themes/bigbike/images/mu-bao-hiem.png";

export function WpCategoryHero({
  title,
  titleNode,
  breadcrumb,
  bgUrl,
  mobileBgUrl,
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
  /** Ảnh nền riêng cho điện thoại (≤767px). Bỏ trống → dùng `bgUrl`. */
  mobileBgUrl?: string | null;
  illustrationUrl?: string | null;
  illustrationAlt?: string | null;
  /** Mốc cho nút "Xem trên web" của màn Cài đặt admin (data-bb-focus). */
  focusId?: string;
}) {
  const locale = useLocale();
  const bg = bgUrl?.trim() || DEFAULT_BG;
  const mobileBg = mobileBgUrl?.trim() || null;
  const illustration = illustrationUrl?.trim() || DEFAULT_ILLUSTRATION;
  const resolveCrumbHref = (crumb: WpCategoryCrumb) =>
    locale !== DEFAULT_LOCALE && crumb.altHref ? crumb.altHref : crumb.href;

  return (
    <div className="page-title relative" style={{ backgroundImage: `url('${bg}')` }} data-bb-focus={focusId}>
      {mobileBg ? (
        // Art direction: ảnh nền riêng cho điện thoại (≤767px), phủ kín đè lên ảnh desktop.
        <img
          src={mobileBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover md:hidden"
        />
      ) : null}
      <div className="container">
        <div className="row align-items-center">
          <div className="col-md-6">
            <h1 className="">{titleNode ?? title}</h1>
            <div className="breadcrumb">
              <ul>
                {breadcrumb.map((crumb, i) => {
                  const href = resolveCrumbHref(crumb);
                  return (
                    <li key={i}>
                      {href ? (
                        <Link href={href} className={i === 0 ? "home" : "taxonomy"}>
                          <span property="name">{crumb.labelNode ?? crumb.label}</span>
                        </Link>
                      ) : (
                        <span property="name">{crumb.labelNode ?? crumb.label}</span>
                      )}
                    </li>
                  );
                })}
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
