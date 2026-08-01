import type { ReactNode } from "react";
import { Check, Ruler, X } from "lucide-react";
import { telHref } from "@/lib/utils/format";

/**
 * Nội dung trang "Cách xác định size mũ bảo hiểm" (/huong-dan/size-mu) — TRANG TĨNH.
 *
 * Toàn bộ trang là dữ liệu cứng (hardcode) trong code, song ngữ VI/EN — hướng dẫn (cách đo vòng đầu,
 * bảng size tham chiếu, dấu hiệu vừa/không vừa) là nội dung hiển thị cho khách, KHÔNG phải
 * admin-managed data.
 *
 * Số điện thoại / Zalo: theo yêu cầu owner, trang này ĐÓNG CỨNG số liên hệ (không lấy từ
 * site_settings) — giống trang Chính sách bảo mật. Đây là ngoại lệ có chủ ý của guard
 * `check-no-runtime-business-data` — file này được allowlist riêng trong
 * scripts/check-no-runtime-business-data.mjs.
 *
 * Trang này thay cho nội dung WP-import cũ (hotlink ảnh Facebook đã hỏng). Bản dựng theo mockup không
 * dùng ảnh — chỉ layout/typography — nên không phát sinh media nào cần MinIO.
 */

const HOTLINE = "0906902404";
const ZALO = "0764640679";
const ZALO_URL = "https://zalo.me/0764640679";

type Lang = "vi" | "en";

type Bi = { vi: string; en: string };

const t = (lang: Lang, s: Bi) => (lang === "en" ? s.en : s.vi);

const COPY = {
  intro: {
    vi: "Đo đúng vòng đầu giúp chọn size mũ vừa khít — không bị chật đau sau vài tiếng đội, không bị rộng lắc khi phanh gấp. Đo mất 30 giây, tránh mất công đổi hàng.",
    en: "Measuring your head correctly helps you pick a snug fit — not too tight (painful after a few hours), not too loose (wobbles under hard braking). It takes 30 seconds and saves you an exchange.",
  },
  s1Title: { vi: "Cách đo vòng đầu chuẩn", en: "How to measure your head" },
  s2Title: { vi: "Bảng size tham chiếu phổ biến", en: "Common reference size chart" },
  s3Title: { vi: "Mũ mới có nên hơi chật không?", en: "Should a new helmet feel a bit tight?" },
  s4Title: { vi: "Không chắc size? Liên hệ BigBike", en: "Not sure about your size? Contact BigBike" },
  colSize: { vi: "Size", en: "Size" },
  colHead: { vi: "Vòng đầu (cm)", en: "Head (cm)" },
  colFit: { vi: "Phù hợp", en: "Suited for" },
  tableNote: {
    vi: "* Bảng size trên là tham chiếu chung. Mỗi thương hiệu có thể khác nhau đôi chút — xem bảng size cụ thể trên trang sản phẩm.",
    en: "* This chart is a general reference. Each brand may differ slightly — check the specific size chart on the product page.",
  },
  highlightLead: {
    vi: "Mũ vừa đúng cỡ sẽ hơi ôm khi mới — đây là bình thường.",
    en: "A correctly-sized helmet feels a bit snug when new — this is normal.",
  },
  highlight: {
    vi: "Lớp EPS và mút lót bên trong sẽ nén dần theo hình đầu của bạn sau 2–4 tuần đội. Nếu mũ quá rộng từ đầu, sẽ không bảo vệ tốt khi va chạm vì mũ bị dịch chuyển.",
    en: "The inner EPS and comfort foam break in to your head shape after 2–4 weeks. A helmet that is loose from the start won't protect well in a crash because it shifts on impact.",
  },
  fitGood: { vi: "Size vừa đúng", en: "Correct fit" },
  fitBad: { vi: "Size không phù hợp", en: "Wrong fit" },
  contactLead: {
    vi: "Gửi số đo vòng đầu qua Zalo — BigBike tư vấn size đúng theo từng thương hiệu và dòng mũ cụ thể. Đổi size miễn phí trong 30 ngày nếu BigBike đã tư vấn size.",
    en: "Send your head measurement via Zalo — BigBike advises the right size for each brand and helmet line. Free size exchange within 30 days when BigBike has advised the size.",
  },
  contactBar: { vi: "Tư vấn size miễn phí", en: "Free size consulting" },
  hotline: { vi: "Hotline", en: "Hotline" },
  zalo: { vi: "Zalo", en: "Zalo" },
} satisfies Record<string, Bi>;

type Step = { title: Bi; body: Bi };

const STEPS: Step[] = [
  {
    title: { vi: "Chuẩn bị thước dây mềm", en: "Prepare a soft measuring tape" },
    body: {
      vi: "Dùng thước dây may đo (thước vải). Nếu không có, dùng sợi dây hoặc giấy — đo rồi đặt lên thước cứng.",
      en: "Use a sewing tape (cloth tape). No tape? Use a string or strip of paper, then lay it against a ruler.",
    },
  },
  {
    title: { vi: "Xác định đường đo", en: "Find the measuring line" },
    body: {
      vi: "Đặt thước ngang qua trán, cách lông mày khoảng 2cm. Vòng quanh đầu qua phần rộng nhất phía sau (thường là đỉnh chỏm phía sau đầu).",
      en: "Place the tape across the forehead, about 2cm above the eyebrows. Wrap around the widest part at the back of the head.",
    },
  },
  {
    title: { vi: "Đọc số đo", en: "Read the measurement" },
    body: {
      vi: "Giữ thước sát da đầu, không quá chặt. Đọc số tại điểm giao nhau — đây là vòng đầu của bạn (đơn vị: cm).",
      en: "Keep the tape against the scalp, not too tight. Read the number where it meets — that is your head circumference (in cm).",
    },
  },
  {
    title: { vi: "Đối chiếu với bảng size", en: "Compare with the size chart" },
    body: {
      vi: "Nếu số đo nằm giữa 2 size — chọn size lớn hơn. Mũ mới hơi ôm là bình thường — lớp mút sẽ nén vừa hơn sau 2–4 tuần đội.",
      en: "If your measurement falls between two sizes — choose the larger one. A new helmet feeling snug is normal; the foam settles after 2–4 weeks.",
    },
  },
];

type SizeRow = { size: string; head: string; fit: Bi };

const SIZE_ROWS: SizeRow[] = [
  { size: "XS", head: "53 – 54", fit: { vi: "Đầu nhỏ, phụ nữ vóc nhỏ", en: "Small head, petite women" } },
  { size: "S", head: "55 – 56", fit: { vi: "Phổ biến với nữ, nam đầu nhỏ", en: "Common for women, small-headed men" } },
  { size: "M", head: "57 – 58", fit: { vi: "Phổ biến nhất — nam trung bình", en: "Most common — average men" } },
  { size: "L", head: "59 – 60", fit: { vi: "Nam đầu lớn", en: "Larger-headed men" } },
  { size: "XL", head: "61 – 62", fit: { vi: "Nam đầu rất lớn", en: "Very large heads" } },
  { size: "XXL", head: "63 – 64", fit: { vi: "Đặc biệt", en: "Special" } },
];

const FIT_GOOD: Bi[] = [
  { vi: "Ôm đều quanh đầu", en: "Even snugness all around" },
  { vi: "Má dính nhẹ vào đệm má", en: "Cheeks lightly touch the cheek pads" },
  { vi: "Không thể xoay mũ trái phải", en: "Can't rotate the helmet left or right" },
  { vi: "Hơi khó tháo lần đầu", en: "A bit hard to take off the first time" },
];

const FIT_BAD: Bi[] = [
  { vi: "Quá chật: đau đầu sau 30 phút", en: "Too tight: headache after 30 minutes" },
  { vi: "Quá rộng: xoay được khi đội", en: "Too loose: rotates while worn" },
  { vi: "Có điểm áp lực bất thường", en: "Unusual pressure points" },
  { vi: "Nhấc lên được mà không cần tháo khóa", en: "Lifts off without unbuckling" },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 font-body text-a2-page font-bold leading-title text-brand">
      {children}
    </h2>
  );
}

export function HelmetSizeGuideContent({ locale }: { locale: string }) {
  const lang: Lang = locale === "en" ? "en" : "vi";

  return (
    <div className="max-w-none text-a4-content leading-body text-foreground">
      {/* Lead */}
      <p className="mb-6 border-l-4 border-border bg-secondary p-4 text-a4-content leading-body">
        {t(lang, COPY.intro)}
      </p>

      {/* 1. Cách đo vòng đầu */}
      <SectionTitle>{t(lang, COPY.s1Title)}</SectionTitle>
      <ol className="mb-8 space-y-3">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-4 border border-border p-4">
            <span className="font-body text-a2-page font-bold leading-none text-brand">{i + 1}</span>
            <div className="leading-body">
              <strong className="text-foreground">{t(lang, s.title)}</strong>
              <br />
              <span>{t(lang, s.body)}</span>
            </div>
          </li>
        ))}
      </ol>

      {/* 2. Bảng size */}
      <SectionTitle>{t(lang, COPY.s2Title)}</SectionTitle>
      <div className="mb-3 overflow-x-auto">
        <table className="w-full border-collapse text-a4-content">
          <thead>
            <tr className="bg-secondary">
              <th className="w-1/6 border border-border p-3 text-left font-bold">{t(lang, COPY.colSize)}</th>
              <th className="w-1/4 border border-border p-3 text-left font-bold">{t(lang, COPY.colHead)}</th>
              <th className="border border-border p-3 text-left font-bold">{t(lang, COPY.colFit)}</th>
            </tr>
          </thead>
          <tbody>
            {SIZE_ROWS.map((r) => (
              <tr key={r.size}>
                <td className="border border-border p-3 font-bold">{r.size}</td>
                <td className="border border-border p-3">{r.head}</td>
                <td className="border border-border p-3 text-muted-foreground">{t(lang, r.fit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-8 text-a5-meta leading-snug text-muted-foreground">{t(lang, COPY.tableNote)}</p>

      {/* 3. Mũ mới có nên hơi chật */}
      <SectionTitle>{t(lang, COPY.s3Title)}</SectionTitle>
      <div className="mb-6 border border-border border-l-4 border-l-brand bg-white p-4">
        <p className="leading-body">
          <strong className="text-brand">{t(lang, COPY.highlightLead)}</strong>{" "}
          {t(lang, COPY.highlight)}
        </p>
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="border border-border p-4">
          <p className="mb-3 flex items-center gap-2 font-body text-a4-content font-bold text-foreground">
            <Check className="size-5 shrink-0 text-pros-accent" aria-hidden /> {t(lang, COPY.fitGood)}
          </p>
          <ul className="list-disc space-y-2 pl-5 leading-snug">
            {FIT_GOOD.map((c, i) => (
              <li key={i}>{t(lang, c)}</li>
            ))}
          </ul>
        </div>
        <div className="border border-border p-4">
          <p className="mb-3 flex items-center gap-2 font-body text-a4-content font-bold text-foreground">
            <X className="size-5 shrink-0 text-cons-accent" aria-hidden /> {t(lang, COPY.fitBad)}
          </p>
          <ul className="list-disc space-y-2 pl-5 leading-snug">
            {FIT_BAD.map((c, i) => (
              <li key={i}>{t(lang, c)}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 4. Liên hệ */}
      <SectionTitle>{t(lang, COPY.s4Title)}</SectionTitle>
      <p className="mb-4 leading-body">{t(lang, COPY.contactLead)}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-border border-l-4 border-l-brand bg-secondary p-4">
        <span className="flex items-center gap-2 font-cta font-bold uppercase tracking-wide text-foreground">
          <Ruler className="size-5 shrink-0 text-brand" aria-hidden /> {t(lang, COPY.contactBar)}
        </span>
        <span>
          {t(lang, COPY.zalo)}:{" "}
          <a href={ZALO_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-brand no-underline">
            {ZALO}
          </a>{" "}
          <span className="text-muted-foreground">(Mrs. Thư)</span>
        </span>
        <span>
          {t(lang, COPY.hotline)}:{" "}
          <a href={telHref(HOTLINE)} className="font-bold text-brand no-underline">
            {HOTLINE}
          </a>
        </span>
      </div>
    </div>
  );
}
