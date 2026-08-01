import type { ReactNode } from "react";
import { telHref } from "@/lib/utils/format";

/**
 * Nội dung trang Chính sách bảo vệ thông tin cá nhân
 * (/chinh-sach/chinh-sach-bao-mat-thong-tin) — TRANG TĨNH.
 *
 * Toàn bộ nội dung chính sách (thông tin thu thập, mục đích, công cụ đo lường, chia sẻ bên thứ ba,
 * quyền của khách, bảo vệ dữ liệu) cố định trong code, song ngữ VI/EN — đây là cam kết hiển thị cho
 * khách, KHÔNG phải system feature.
 *
 * Số điện thoại / Zalo: theo yêu cầu owner, trang này ĐÓNG CỨNG số liên hệ (không lấy từ
 * site_settings). Đây là ngoại lệ có chủ ý của guard `check-no-runtime-business-data` — file này
 * được allowlist riêng trong scripts/check-no-runtime-business-data.mjs.
 */

const HOTLINE = "0906902404";
const ZALO = "0764640679";
const ZALO_URL = "https://zalo.me/0764640679";

type Lang = "vi" | "en";

type Bi = { vi: string; en: string };

const t = (lang: Lang, s: Bi) => (lang === "en" ? s.en : s.vi);

const COPY = {
  intro: {
    vi: "BigBike.vn cam kết bảo vệ thông tin cá nhân của khách hàng. Trang này giải thích rõ chúng tôi thu thập, sử dụng và bảo vệ dữ liệu của bạn như thế nào.",
    en: "BigBike.vn is committed to protecting our customers' personal information. This page explains how we collect, use and protect your data.",
  },
  s1Title: { vi: "1. Thông tin chúng tôi thu thập", en: "1. Information we collect" },
  s2Title: { vi: "2. Mục đích sử dụng", en: "2. How we use it" },
  s3Title: { vi: "3. Công cụ đo lường và theo dõi", en: "3. Measurement and tracking tools" },
  s3Intro: {
    vi: "Website sử dụng các công cụ phân tích để cải thiện trải nghiệm người dùng:",
    en: "The website uses analytics tools to improve the user experience:",
  },
  s3Note: {
    vi: "Các công cụ này thu thập dữ liệu ẩn danh về hành vi duyệt web (trang xem, thời gian, thiết bị). Không thu thập thông tin cá nhân nhận dạng trực tiếp.",
    en: "These tools collect anonymous data about browsing behaviour (pages viewed, time, device). They do not collect directly identifiable personal information.",
  },
  s4Title: { vi: "4. Chia sẻ thông tin với bên thứ ba", en: "4. Sharing with third parties" },
  s4Intro: {
    vi: "BigBike chỉ chia sẻ thông tin trong các trường hợp sau:",
    en: "BigBike only shares information in the following cases:",
  },
  s4NoSell: {
    vi: "BigBike tuyệt đối không bán thông tin khách hàng cho bên thứ ba vì mục đích thương mại.",
    en: "BigBike never sells customer information to third parties for commercial purposes.",
  },
  s5Title: { vi: "5. Quyền của bạn", en: "5. Your rights" },
  s5Contact: {
    vi: "Để thực hiện các quyền trên, liên hệ:",
    en: "To exercise these rights, contact:",
  },
  zaloLabel: { vi: "Zalo", en: "Zalo" },
  s6Title: { vi: "6. Bảo vệ dữ liệu", en: "6. Data protection" },
  footerNote: {
    vi: "Chính sách này có thể được cập nhật theo thời gian. Phiên bản mới nhất luôn được đăng tại bigbike.vn.",
    en: "This policy may be updated over time. The latest version is always published at bigbike.vn.",
  },
} satisfies Record<string, Bi>;

const COLLECT: Bi[] = [
  {
    vi: "Họ tên, số điện thoại, địa chỉ giao hàng khi đặt hàng",
    en: "Full name, phone number, delivery address when placing an order",
  },
  {
    vi: "Email (nếu đăng ký tài khoản hoặc nhận thông tin khuyến mãi)",
    en: "Email (if you register an account or subscribe to promotions)",
  },
];

const PURPOSE: Bi[] = [
  { vi: "Xử lý đơn hàng và giao hàng", en: "Process and deliver orders" },
  { vi: "Liên hệ xác nhận đơn, tư vấn sau bán", en: "Confirm orders and provide after-sales support" },
  { vi: "Gửi thông tin khuyến mãi (nếu khách đồng ý)", en: "Send promotions (with your consent)" },
];

const ANALYTICS: string[] = [
  "Google Analytics 4 (GA4)",
  "Facebook Pixel",
];
const ANALYTICS_GENERIC: Bi = {
  vi: "Công cụ tracking theo dõi hành vi người dùng",
  en: "User-behaviour tracking tools",
};

const SHARE: Bi[] = [
  {
    vi: "Đơn vị vận chuyển (GHN, GHTK…) — chỉ thông tin giao hàng",
    en: "Delivery partners (GHN, GHTK…) — shipping information only",
  },
  {
    vi: "Google, Meta — dữ liệu ẩn danh phục vụ quảng cáo",
    en: "Google, Meta — anonymous data for advertising",
  },
];

const RIGHTS: Bi[] = [
  { vi: "Yêu cầu xem thông tin đã lưu", en: "Request to view the data we store" },
  { vi: "Yêu cầu chỉnh sửa hoặc xóa thông tin", en: "Request to correct or delete your data" },
  { vi: "Hủy nhận email/SMS bất kỳ lúc nào", en: "Unsubscribe from email/SMS at any time" },
];

const PROTECT: Bi[] = [
  { vi: "Dữ liệu mã hóa SSL/HTTPS", en: "Data encrypted with SSL/HTTPS" },
  {
    vi: "Không bán thông tin khách hàng cho bên thứ ba vì mục đích thương mại",
    en: "We do not sell customer information to third parties for commercial purposes",
  },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 font-body text-a2-page font-bold leading-title text-brand">
      {children}
    </h2>
  );
}

function Bullets({ lang, items }: { lang: Lang; items: Bi[] }) {
  return (
    <ul className="mb-6 list-disc space-y-2 pl-5 leading-body">
      {items.map((c, i) => (
        <li key={i}>{t(lang, c)}</li>
      ))}
    </ul>
  );
}

export function PrivacyPolicyContent({ locale }: { locale: string }) {
  const lang: Lang = locale === "en" ? "en" : "vi";

  return (
    <div className="max-w-none text-a4-content leading-body text-foreground">
      {/* Intro */}
      <p className="mb-6 text-a4-content leading-body">{t(lang, COPY.intro)}</p>

      {/* 1. Thông tin thu thập */}
      <SectionTitle>{t(lang, COPY.s1Title)}</SectionTitle>
      <Bullets lang={lang} items={COLLECT} />

      {/* 2. Mục đích sử dụng */}
      <SectionTitle>{t(lang, COPY.s2Title)}</SectionTitle>
      <Bullets lang={lang} items={PURPOSE} />

      {/* 3. Công cụ đo lường */}
      <SectionTitle>{t(lang, COPY.s3Title)}</SectionTitle>
      <p className="mb-3 leading-body">{t(lang, COPY.s3Intro)}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {[...ANALYTICS, t(lang, ANALYTICS_GENERIC)].map((label, i) => (
          <span
            key={i}
            className="inline-block border border-border bg-secondary px-3 py-1 text-a5-meta font-bold text-foreground"
          >
            {label}
          </span>
        ))}
      </div>
      <p className="mb-6 text-a5-meta leading-snug text-muted-foreground">{t(lang, COPY.s3Note)}</p>

      {/* 4. Chia sẻ bên thứ ba */}
      <SectionTitle>{t(lang, COPY.s4Title)}</SectionTitle>
      <p className="mb-3 leading-body">{t(lang, COPY.s4Intro)}</p>
      <Bullets lang={lang} items={SHARE} />
      <div className="mb-6 border border-border border-l-4 border-l-brand bg-white p-4">
        <p className="font-bold leading-body text-brand">{t(lang, COPY.s4NoSell)}</p>
      </div>

      {/* 5. Quyền của bạn */}
      <SectionTitle>{t(lang, COPY.s5Title)}</SectionTitle>
      <Bullets lang={lang} items={RIGHTS} />
      <p className="mb-6 leading-body">
        {t(lang, COPY.s5Contact)}{" "}
        <a href={telHref(HOTLINE)} className="font-bold text-brand no-underline">
          {HOTLINE}
        </a>
        <span>{lang === "en" ? " or " : " hoặc "}</span>
        <span>
          {t(lang, COPY.zaloLabel)}{" "}
          <a
            href={ZALO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-brand no-underline"
          >
            {ZALO}
          </a>
        </span>
      </p>

      {/* 6. Bảo vệ dữ liệu */}
      <SectionTitle>{t(lang, COPY.s6Title)}</SectionTitle>
      <Bullets lang={lang} items={PROTECT} />

      <p className="text-a5-meta leading-snug text-muted-foreground">{t(lang, COPY.footerNote)}</p>
    </div>
  );
}
