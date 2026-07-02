"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { fetchPublicSettings } from "@/lib/api/client-api";
import { queryKeys } from "@/lib/query/keys";
import { sanitizeRichHtml } from "@/lib/utils/html";

/**
 * Các khối marketing trang chủ lấy chữ từ `site_settings` (about_*, home_exp_*,
 * home_content_bottom_html). Server luôn render tĩnh `vi` (ISR/SEO, xem `i18n/request.ts`)
 * nên các khối này cũng là `vi`; việc đổi sang EN chỉ xảy ra ở CLIENT (ClientIntlProvider
 * đọc cookie NEXT_LOCALE, không round-trip server). Vì thế ba khối dưới đây refetch settings
 * theo `lang` rồi swap sang bản EN — cùng pattern với `HomeFeaturedProducts` / `LocalizedContent`.
 *
 * Backend trả EN-với-fallback-`vi` field-by-field (BUSINESS_RULES PRODUCT_RULE_002), nên key
 * nào admin chưa nhập bản EN sẽ tự hiển thị `vi`. Render đầu (locale `vi`) dùng prop server
 * → khớp HTML server, không hydration mismatch; chỉ swap sau khi khách chọn EN.
 *
 * Cả ba component dùng chung queryKeys.publicSettings(locale) nên React Query gộp thành 1
 * request — key này cũng dùng chung với PolicyPageClient nên chuyển trang chủ ↔ trang chính
 * sách trong cùng phiên không phải gọi lại API.
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

/**
 * Tiêu đề khối trang chủ ("Sản phẩm nổi bật", "Tin tức", "Videos"…) — kicker + title lấy từ
 * `site_settings` (admin sửa được). Cùng vấn đề như các khối marketing: server render `vi`,
 * phải swap EN ở client. Ưu tiên: bản EN admin nhập → bản `vi` server (prop) → nhãn dịch sẵn
 * (`Home.*`). Khi locale `vi` hoặc admin chưa nhập EN thì giữ nguyên prop server → khớp HTML
 * server, không hydration mismatch. `kickerSettingKey` bỏ trống cho khối chỉ có title (Videos).
 */
export function HomeBlockHeading({
  className,
  kickerSettingKey,
  titleSettingKey,
  kicker,
  title,
  fallbackKickerKey,
  fallbackTitleKey,
}: {
  className: string;
  kickerSettingKey?: string;
  titleSettingKey: string;
  kicker?: string;
  title?: string;
  fallbackKickerKey?: string;
  fallbackTitleKey: string;
}) {
  const pick = useEnSettingLookup();
  const t = useTranslations("Home");

  const sub = kickerSettingKey
    ? (pick(kickerSettingKey) ?? (kicker || (fallbackKickerKey ? t(fallbackKickerKey) : "")))
    : "";
  const heading = pick(titleSettingKey) ?? (title || t(fallbackTitleKey));

  return (
    <div className={className}>
      {sub ? <p className="sub-title">{sub}</p> : null}
      {heading ? <h3>{heading}</h3> : null}
    </div>
  );
}

/** Khối "Giới thiệu BigBike" — tiêu đề phụ + tiêu đề + nội dung HTML. */
export function HomeAboutSection({
  subtitle,
  title,
  viHtml,
}: {
  subtitle: string;
  title: string;
  /** HTML bản `vi` ĐÃ sanitize ở server — fallback + render đầu khớp server. */
  viHtml: string;
}) {
  const pick = useEnSettingLookup();
  if (!subtitle && !title && !viHtml) return null;

  const heading = pick("about_title") ?? title;
  const sub = pick("about_subtitle") ?? subtitle;
  const enHtml = pick("about_content_html");
  const html = enHtml ? sanitizeRichHtml(enHtml, RICH_HTML_OPTS) : viHtml;

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

/** Tiêu đề khối "Góc trải nghiệm" — tiêu đề phụ + tiêu đề + mô tả. */
export function HomeExperienceHeading({
  subtitle,
  title,
  desc,
}: {
  subtitle: string;
  title: string;
  desc: string;
}) {
  const pick = useEnSettingLookup();
  if (!subtitle && !title && !desc) return null;

  const sub = pick("home_exp_subtitle") ?? subtitle;
  const heading = pick("home_exp_title") ?? title;
  const body = pick("home_exp_desc") ?? desc;

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
