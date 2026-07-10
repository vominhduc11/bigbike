"use client";

import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { fetchPublicSettings } from "@/lib/api/client-api";
import { queryKeys } from "@/lib/query/keys";
import { sanitizeRichHtml } from "@/lib/utils/html";

/**
 * Khối SEO cuối trang chủ (`home_content_bottom_html`) lấy chữ từ `site_settings` — admin
 * còn sửa được (nhóm `seo`). Server luôn render tĩnh `vi` (ISR/SEO, xem `i18n/request.ts`)
 * nên khối này cũng là `vi`; việc đổi sang EN chỉ xảy ra ở CLIENT (ClientIntlProvider đọc
 * cookie NEXT_LOCALE, không round-trip server). Vì thế `HomeContentBottom` refetch settings
 * theo `lang` rồi swap sang bản EN — cùng pattern với `HomeFeaturedProducts` / `LocalizedContent`.
 *
 * Backend trả EN-với-fallback-`vi` field-by-field (BUSINESS_RULES PRODUCT_RULE_002), nên key
 * nào admin chưa nhập bản EN sẽ tự hiển thị `vi`. Render đầu (locale `vi`) dùng prop server
 * → khớp HTML server, không hydration mismatch; chỉ swap sau khi khách chọn EN.
 *
 * `HomeBlockHeading`/`HomeAboutSection`/`HomeExperienceHeading` KHÔNG còn dùng cơ chế này —
 * nội dung của chúng đã hardcode (nhóm setting `public_home`, gỡ khỏi Cài đặt admin 2026-07-03,
 * xem DATA_CONTRACT.md "public_home keys — removed"); bản EN truyền thẳng qua prop `*En` và
 * chọn theo `useLocale()`, không gọi API.
 *
 * `HomeContentBottom` dùng `queryKeys.publicSettings(locale)` để tất cả client consumer cần
 * settings theo locale dùng chung một React Query cache key.
 */
export function useEnSettingLookup(): (key: string) => string | undefined {
  const locale = useLocale();
  const isAlt = locale !== DEFAULT_LOCALE;

  const { data } = useQuery({
    queryKey: queryKeys.publicSettings(locale),
    queryFn: () => fetchPublicSettings(locale),
    enabled: isAlt,
    staleTime: 5 * 60 * 1000,
  });

  return (key: string) => {
    if (!isAlt || !data) return undefined;
    const value = data.find((s) => s.settingKey === key)?.settingValue?.trim();
    return value || undefined;
  };
}

const RICH_HTML_OPTS = { allowInlineStyles: true, rewriteMediaUrls: true } as const;

/** Chọn bản EN khi locale khác `vi`; giữ nguyên bản `vi` (khớp HTML server) khi không. */
function useLocalizedText(vi: string, en: string): string {
  const locale = useLocale();
  return locale !== DEFAULT_LOCALE && en ? en : vi;
}

/**
 * Tiêu đề khối trang chủ ("Sản phẩm nổi bật", "Tin tức", "Videos"…) — kicker + title đã
 * hardcode (nhóm setting `public_home`, gỡ khỏi Cài đặt admin 2026-07-03). VI render ở server
 * (khớp HTML đầu, không hydration mismatch); EN chỉ swap ở client theo locale hiện tại.
 * `kicker`/`kickerEn` bỏ trống cho khối chỉ có title (Videos).
 */
export function HomeBlockHeading({
  className,
  kicker,
  kickerEn,
  title,
  titleEn,
}: {
  className: string;
  kicker?: string;
  kickerEn?: string;
  title: string;
  titleEn: string;
}) {
  const sub = useLocalizedText(kicker ?? "", kickerEn ?? "");
  const heading = useLocalizedText(title, titleEn);

  return (
    <div className={className}>
      {sub ? <p className="sub-title">{sub}</p> : null}
      {heading ? <h3>{heading}</h3> : null}
    </div>
  );
}

/** Khối "Giới thiệu BigBike" — tiêu đề phụ + tiêu đề + nội dung HTML (hardcode, xem HomePage). */
export function HomeAboutSection({
  subtitle,
  subtitleEn,
  title,
  titleEn,
  viHtml,
  enHtml,
}: {
  subtitle: string;
  subtitleEn: string;
  title: string;
  titleEn: string;
  /** HTML ĐÃ sanitize ở server (server render `vi` đầu tiên — khớp HTML, không hydration mismatch). */
  viHtml: string;
  enHtml: string;
}) {
  const sub = useLocalizedText(subtitle, subtitleEn);
  const heading = useLocalizedText(title, titleEn);
  const html = useLocalizedText(viHtml, enHtml);

  return (
    <div className="about-bigbike">
      <div className="container">
        <div className="block-title text-center mb-40">
          {sub ? <p className="sub-title">{sub}</p> : null}
          {heading ? <h3>{heading}</h3> : null}
        </div>
        {html ? (
          <div className="block-content text-center" dangerouslySetInnerHTML={{ __html: html }} />
        ) : null}
      </div>
    </div>
  );
}

/** Tiêu đề khối "Góc trải nghiệm" — tiêu đề phụ + tiêu đề + mô tả (hardcode, xem HomePage). */
export function HomeExperienceHeading({
  subtitle,
  subtitleEn,
  title,
  titleEn,
  desc,
  descEn,
}: {
  subtitle: string;
  subtitleEn: string;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
}) {
  const sub = useLocalizedText(subtitle, subtitleEn);
  const heading = useLocalizedText(title, titleEn);
  const body = useLocalizedText(desc, descEn);

  return (
    <div className="container">
      <div className="block-title text-center pb-40">
        {sub ? <p className="sub-title">{sub}</p> : null}
        {heading ? <h3>{heading}</h3> : null}
        {body ? (
          <div className="row pt-30">
            <div className="col-md-8 offset-md-2">
              <div className="block-title--content">{body}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Khối nội dung SEO cuối trang chủ (rich HTML hiển thị). */
export function HomeContentBottom({ viHtml }: { viHtml: string }) {
  const pick = useEnSettingLookup();
  if (!viHtml) return null;

  const enHtml = pick("home_content_bottom_html");
  const html = enHtml ? sanitizeRichHtml(enHtml, RICH_HTML_OPTS) : viHtml;

  return (
    <div className="content-bottom wyswyg">
      <div className="container" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
