import type { ReactNode } from "react";
import Link from "@/i18n/StorefrontLink";
import { translatePath } from "@/lib/utils/routes";

/**
 * Công bố bổ sung trong trang Chính sách bảo mật
 * (/chinh-sach/chinh-sach-bao-mat-thong-tin) — TRANG TĨNH.
 *
 * Công bố đo lường, chia sẻ bên thứ ba, AI/ảnh/video và quyền của khách cố định
 * trong code, song ngữ VI/EN; phần SEO nguyên văn do route hiển thị trước phần này.
 *
 * Đơn vị công bố và kênh liên hệ được route hiển thị qua PolicyContact, dùng nhóm contact chung.
 * Route chép nguyên văn phần SEO trước component này. Component chỉ giữ các công bố
 * bổ sung về đo lường/AI/ảnh/video và quyền của khách (POLICY_PAGE_RULE_003/008).
 */

type Lang = "vi" | "en";

type Bi = { vi: string; en: string };

const t = (lang: Lang, s: Bi) => (lang === "en" ? s.en : s.vi);

const COPY = {
  supplementaryTitle: {
    vi: "Thông tin bổ sung về dữ liệu khi sử dụng website",
    en: "Additional information about data when using the website",
  },
  effectiveDate: {
    vi: "Cập nhật ngày 02/10/2026.",
    en: "Updated on 2 October 2026.",
  },
  marketingConsent: {
    vi: "BigBike chỉ gửi thông tin khuyến mãi khi khách đồng ý; khách có thể hủy nhận bất cứ lúc nào.",
    en: "BigBike sends promotional information only with your consent; you may unsubscribe at any time.",
  },
  s3Title: { vi: "Công cụ đo lường và theo dõi", en: "Measurement and tracking tools" },
  s3Intro: {
    vi: "Website dùng ba công cụ để hiểu phần nào đang hữu ích, cải thiện trải nghiệm mua hàng và đo lường hiệu quả quảng cáo:",
    en: "The website uses three tools to understand what is useful, improve the shopping experience and measure advertising effectiveness:",
  },
  s3Note: {
    vi: "Khi anh/chị đã đăng nhập, BigBike chỉ gửi mã khách hàng nội bộ để nối các lần truy cập trên nhiều thiết bị. Chúng tôi không gửi tên, email, số điện thoại, địa chỉ, nội dung trò chuyện hay nội dung đánh giá cho Google Analytics hoặc Microsoft Clarity.",
    en: "When you are signed in, BigBike sends only your internal customer ID to connect visits across devices. We do not send your name, email, phone number, address, chat content or review content to Google Analytics or Microsoft Clarity.",
  },
  s4Title: { vi: "Chia sẻ thông tin với bên thứ ba", en: "Sharing with third parties" },
  s4Intro: {
    vi: "BigBike chỉ chia sẻ thông tin trong các trường hợp sau:",
    en: "BigBike only shares information in the following cases:",
  },
  s4NoSell: {
    vi: "BigBike tuyệt đối không bán thông tin khách hàng cho bên thứ ba vì mục đích thương mại.",
    en: "BigBike never sells customer information to third parties for commercial purposes.",
  },
  s4Access: {
    vi: "Khách được tiếp cận thông tin của mình. Ban quản trị website và nhân viên được phân quyền chỉ tiếp cận dữ liệu để thực hiện các mục đích đã công bố.",
    en: "You may access your own information. Website administrators and authorized staff access data only for the stated purposes.",
  },
  s5Title: { vi: "Quyền của bạn", en: "Your rights" },
  s5Contact: {
    vi: "Để kiểm tra, cập nhật, điều chỉnh hoặc yêu cầu hủy thông tin cá nhân, khách liên hệ BigBike qua các kênh hỗ trợ được công bố bên dưới hoặc tại trang Liên hệ.",
    en: "To check, update, correct or request deletion of personal information, contact BigBike through the support channels below or on the Contact page.",
  },
  contactLink: { vi: "Mở trang Liên hệ", en: "Open the Contact page" },
  s6Title: { vi: "Bảo vệ dữ liệu", en: "Data protection" },
  s7Title: {
    vi: "Dữ liệu từ chức năng trợ lý trước đây",
    en: "Data from the former assistant feature",
  },
  s7Intro: {
    vi: "Chức năng trợ lý đã được gỡ. Mục này giải thích việc bảo vệ và xóa dữ liệu đã lưu trước đây.",
    en: "The assistant feature has been removed. This section explains how previously stored data is protected and deleted.",
  },
  s8Title: { vi: "Thời gian lưu trữ thông tin", en: "Data retention" },
  s8Body: {
    vi: "Thông tin cá nhân phục vụ tài khoản và giao dịch được lưu trên máy chủ của BigBike cho đến khi khách yêu cầu ban quản trị hủy bỏ. Trong thời gian lưu trữ, thông tin được bảo mật. Chức năng trợ lý đã được gỡ. Dữ liệu hội thoại và ảnh đã lưu trước đây được tự động xóa theo hạn 90 ngày; video theo hạn 7 ngày. Khách có thể liên hệ shop để yêu cầu xóa sớm.",
    en: "Personal information used for accounts and transactions is stored on BigBike's servers until you ask the website administrators to delete it. It remains protected during storage. The assistant feature has been removed. Previously saved conversations and images are automatically deleted at their 90-day expiry; videos at their 7-day expiry. You may contact the shop to request earlier deletion.",
  },
  footerNote: {
    vi: "Chính sách này có thể được cập nhật theo thời gian. Phiên bản mới nhất luôn được đăng tại bigbike.vn.",
    en: "This policy may be updated over time. The latest version is always published at bigbike.vn.",
  },
} satisfies Record<string, Bi>;

const ANALYTICS: string[] = [
  "Google Analytics 4 (GA4)",
  "Microsoft Clarity",
  "Meta Pixel (Facebook)",
];

const MEASUREMENT: Bi[] = [
  {
    vi: "Google Analytics 4 ghi nhận trang và sản phẩm đã xem, tìm kiếm, cuộn trang, giỏ hàng, xác nhận COD, đặt/huỷ đơn, bấm gọi/Zalo/Messenger, bộ lọc, banner, bảng size, video, đăng nhập/đăng ký và gửi đánh giá. Dữ liệu đơn hàng chỉ gồm mã đơn, thông tin sản phẩm, số lượng và giá trị.",
    en: "Google Analytics 4 records pages and products viewed, searches, scrolling, cart activity, COD confirmation, placed/cancelled orders, phone/Zalo/Messenger clicks, filters, banners, the size tool, videos, login/sign-up and review submission. Order data is limited to order number, product details, quantity and value.",
  },
  {
    vi: "Microsoft Clarity tạo bản xem lại thao tác như bấm, cuộn và cách di chuyển trên trang để BigBike tìm điểm khó sử dụng. Các vùng đăng nhập, tài khoản, thanh toán, đơn hàng, đánh giá  được che trước khi ghi.",
    en: "Microsoft Clarity provides session replays of actions such as clicks, scrolling and page movement so BigBike can find usability problems. Login, account, checkout, order, review areas are masked before recording.",
  },
  {
    vi: "Meta Pixel (Facebook) ghi nhận lượt xem trang và sản phẩm, thêm giỏ thành công, vào bước thanh toán, xác nhận COD, đặt hàng thành công, tìm kiếm và bấm gọi/Zalo/Messenger để BigBike đo lường hiệu quả quảng cáo và xây dựng tệp tiếp thị phù hợp.",
    en: "Meta Pixel (Facebook) records page and product views, successful add-to-cart actions, checkout entry, COD confirmation, completed orders, searches and phone/Zalo/Messenger clicks so BigBike can measure advertising effectiveness and build relevant marketing audiences.",
  },
  {
    vi: "Ba công cụ có thể dùng cookie hoặc mã nhận diện trình duyệt để phân biệt phiên truy cập, thiết bị và người dùng quay lại.",
    en: "These tools may use cookies or browser identifiers to distinguish sessions, devices and returning visitors.",
  },
];

const SHARE: Bi[] = [
  {
    vi: "Cơ quan có thẩm quyền tại Việt Nam như Viện kiểm sát, tòa án, cơ quan công an điều tra — khi có yêu cầu liên quan đến hành vi vi phạm pháp luật",
    en: "Competent Vietnamese authorities, including the procuracy, courts and investigating police, when requested in connection with a suspected violation of the law",
  },
  {
    vi: "Đơn vị vận chuyển (GHN, GHTK…) — chỉ thông tin giao hàng",
    en: "Delivery partners (GHN, GHTK…) — shipping information only",
  },
  {
    vi: "Google Analytics, Microsoft Clarity và Meta (Facebook) — dữ liệu đo lường và quảng cáo giới hạn như mô tả ở phần công cụ đo lường, bao gồm cookie hoặc mã nhận diện trình duyệt",
    en: "Google Analytics, Microsoft Clarity and Meta (Facebook) — limited measurement and advertising data described in the measurement tools section, including cookies or browser identifiers",
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

const FORMER_ASSISTANT_DATA: Bi[] = [
  {
    vi: "Chức năng trợ lý đã được gỡ; website không còn nhận câu hỏi, ảnh hoặc video để gửi tới dịch vụ AI tư vấn.",
    en: "The assistant feature has been removed; the website no longer accepts questions, images or videos for AI assistance.",
  },
  {
    vi: "Dữ liệu hội thoại và ảnh đã lưu trước đây được tự động xóa theo hạn 90 ngày; video theo hạn 7 ngày. Tệp còn trong thời hạn lưu được giữ riêng tư, không có đường dẫn công khai.",
    en: "Previously saved conversations and images are automatically deleted at their 90-day expiry; videos at their 7-day expiry. Files within their retention period remain private and have no public URL.",
  },
  {
    vi: "Khách có thể liên hệ BigBike để yêu cầu xem hoặc xóa dữ liệu đã lưu trước đây.",
    en: "You may contact BigBike to request access to or deletion of previously stored data.",
  },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 font-body text-a3-section font-bold uppercase leading-title text-brand">
      {children}
    </h3>
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
    <section className="mt-8 max-w-none border-t border-border pt-6 text-a4-content leading-body text-foreground">
      <h2 className="mb-4 font-body text-a2-page font-bold uppercase leading-title text-brand">
        {t(lang, COPY.supplementaryTitle)}
      </h2>
      <p className="mb-6 text-a5-meta font-semibold leading-body text-muted-foreground">
        {t(lang, COPY.effectiveDate)}
      </p>
      <p className="mb-6 leading-body">{t(lang, COPY.marketingConsent)}</p>

      {/* 3. Công cụ đo lường */}
      <SectionTitle>{t(lang, COPY.s3Title)}</SectionTitle>
      <p className="mb-3 leading-body">{t(lang, COPY.s3Intro)}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {ANALYTICS.map((label, i) => (
          <span
            key={i}
            className="inline-block border border-border bg-secondary px-3 py-1 text-a5-meta font-bold text-foreground"
          >
            {label}
          </span>
        ))}
      </div>
      <Bullets lang={lang} items={MEASUREMENT} />
      <p className="mb-6 text-a5-meta leading-snug text-muted-foreground">{t(lang, COPY.s3Note)}</p>

      {/* 4. Chia sẻ bên thứ ba */}
      <SectionTitle>{t(lang, COPY.s4Title)}</SectionTitle>
      <p className="mb-3 leading-body">{t(lang, COPY.s4Intro)}</p>
      <Bullets lang={lang} items={SHARE} />
      <p className="mb-6 leading-body">{t(lang, COPY.s4Access)}</p>
      <div className="mb-6 border border-border border-l-4 border-l-brand bg-white p-4">
        <p className="font-bold leading-body text-brand">{t(lang, COPY.s4NoSell)}</p>
      </div>

      {/* 5. Quyền của bạn */}
      <SectionTitle>{t(lang, COPY.s5Title)}</SectionTitle>
      <Bullets lang={lang} items={RIGHTS} />
      <p className="mb-6 leading-body">
        {t(lang, COPY.s5Contact)}{" "}
        <Link
          href={translatePath("/lien-he/", lang)}
          className="text-brand underline underline-offset-4"
        >
          {t(lang, COPY.contactLink)}
        </Link>
      </p>

      {/* 6. Bảo vệ dữ liệu */}
      <SectionTitle>{t(lang, COPY.s6Title)}</SectionTitle>
      <Bullets lang={lang} items={PROTECT} />

      {/* 7. Dữ liệu từ chức năng trợ lý trước đây */}
      <SectionTitle>{t(lang, COPY.s7Title)}</SectionTitle>
      <p className="mb-3 leading-body">{t(lang, COPY.s7Intro)}</p>
      <Bullets lang={lang} items={FORMER_ASSISTANT_DATA} />

      <SectionTitle>{t(lang, COPY.s8Title)}</SectionTitle>
      <p className="mb-6 leading-body">{t(lang, COPY.s8Body)}</p>
      <p className="text-a5-meta leading-snug text-muted-foreground">{t(lang, COPY.footerNote)}</p>
    </section>
  );
}
