import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { telHref } from "@/lib/utils/format";

/**
 * Nội dung trang Chính sách bảo hành (/chinh-sach/chinh-sach-bao-hanh) — TRANG TĨNH.
 *
 * Toàn bộ điều khoản bảo hành (điều kiện, bảng thời hạn theo thương hiệu, quy trình) cố định trong
 * code, song ngữ VI/EN — đây là cam kết hiển thị cho khách, KHÔNG phải system feature
 * (BUSINESS_RULES.md §"Returns/Exchange", V266). Riêng số điện thoại / Zalo / địa chỉ / giờ làm việc
 * là dữ liệu CHUNG của site (nhóm `contact` trong site_settings, cùng nguồn header/footer) nên truyền
 * vào qua props, KHÔNG hardcode trong code (AGENTS.md §6.5 — guard check-no-runtime-business-data).
 */

export type WarrantyContact = {
  hotline: string;
  zalo: string;
  zaloUrl: string;
  address: string;
  hoursWeekday: string;
  hoursWeekend: string;
};

type Lang = "vi" | "en";

type Bi = { vi: string; en: string };

const t = (lang: Lang, s: Bi) => (lang === "en" ? s.en : s.vi);

const COPY = {
  intro: {
    vi: "BigBike cam kết bảo hành chính hãng theo đúng quy định của từng nhà sản xuất. Thời hạn bảo hành cụ thể hiển thị trên trang chi tiết từng sản phẩm.",
    en: "BigBike provides genuine manufacturer warranty according to each brand's policy. The exact warranty period is shown on each product detail page.",
  },
  s1Title: { vi: "1. Điều kiện được bảo hành", en: "1. Warranty conditions" },
  covered: { vi: "Được bảo hành", en: "Covered" },
  notCovered: { vi: "Không được bảo hành", en: "Not covered" },
  helmetNoteLead: { vi: "Lưu ý quan trọng với mũ bảo hiểm:", en: "Important note for helmets:" },
  helmetNote: {
    vi: "Mũ đã va chạm — dù không thấy hư hỏng bên ngoài — phải thay mới. Lớp EPS bên trong đã mất khả năng hấp thụ lực sau va chạm đầu tiên. Đây là yêu cầu an toàn, không phải chính sách bảo hành.",
    en: "A helmet that has been in an impact — even with no visible external damage — must be replaced. The inner EPS layer loses its energy-absorbing ability after the first impact. This is a safety requirement, not a warranty policy.",
  },
  s2Title: { vi: "2. Thời hạn bảo hành theo thương hiệu", en: "2. Warranty period by brand" },
  helmets: { vi: "Mũ bảo hiểm", en: "Helmets" },
  apparel: { vi: "Áo quần · Găng tay · Giày bảo hộ", en: "Apparel · Gloves · Protective shoes" },
  bags: { vi: "Balo · Túi đeo · Túi treo xe", en: "Backpacks · Bags · Tank bags" },
  appliesTo: {
    vi: "Áp dụng cho: Komine · Taichi · ILM · Hevik · LS2",
    en: "Applies to: Komine · Taichi · ILM · Hevik · LS2",
  },
  hevikNote: { vi: "[Hevik — BigBike đang xác nhận thêm]", en: "[Hevik — BigBike is confirming]" },
  colBrand: { vi: "Thương hiệu", en: "Brand" },
  colItem: { vi: "Hạng mục", en: "Item" },
  colPeriod: { vi: "Thời hạn", en: "Period" },
  colNote: { vi: "Ghi chú", en: "Note" },
  s3Title: { vi: "3. Quy trình bảo hành", en: "3. Warranty process" },
  s4Title: { vi: "4. Liên hệ hỗ trợ bảo hành", en: "4. Warranty support contact" },
  hotline: { vi: "Hotline", en: "Hotline" },
  zalo: { vi: "Zalo tư vấn", en: "Zalo support" },
  hours: { vi: "Giờ làm việc", en: "Working hours" },
  address: { vi: "Địa chỉ", en: "Address" },
  footerNote: {
    vi: "Dữ liệu bảo hành một số thương hiệu đang được bổ sung — sẽ cập nhật trong thời gian sớm nhất.",
    en: "Warranty data for some brands is being updated and will be completed soon.",
  },
} satisfies Record<string, Bi>;

const COVERED: Bi[] = [
  {
    vi: "Lỗi nhà sản xuất: vật liệu, đường may, kết cấu không đúng tiêu chuẩn",
    en: "Manufacturer defect: substandard material, stitching or construction",
  },
  {
    vi: "Sản phẩm không hoạt động đúng chức năng ngay từ đầu",
    en: "Product does not work correctly from the start",
  },
  {
    vi: "Còn trong thời hạn bảo hành, còn tem/seal/hộp chứng minh nguồn gốc",
    en: "Within the warranty period, with intact tag/seal/box proving origin",
  },
];

const NOT_COVERED: Bi[] = [
  {
    vi: "Va đập, té ngã, tai nạn (kể cả không thấy hư hỏng bên ngoài)",
    en: "Impact, falls, accidents (even with no visible external damage)",
  },
  { vi: "Tự ý sửa chữa, tháo lắp, độ chế", en: "Self-repair, disassembly or modification" },
  {
    vi: "Tiếp xúc nhiệt trên 50°C, hóa chất, chất tẩy rửa",
    en: "Exposure to heat above 50°C, chemicals or detergents",
  },
  {
    vi: "Giặt máy, sấy nóng (áp dụng cho mũ và đồ vải)",
    en: "Machine washing or hot drying (helmets and textile gear)",
  },
  { vi: "Hao mòn tự nhiên trong quá trình sử dụng", en: "Natural wear and tear during use" },
];

type HelmetRow = { brand: string; period: Bi; note: Bi[] };

const HELMET_ROWS: HelmetRow[] = [
  {
    brand: "AGV",
    period: { vi: "24 tháng", en: "24 months" },
    note: [
      {
        vi: "Lỗi xác định từ hãng: gửi hình về AGV tại Ý, xử lý tối đa 2–7 ngày",
        en: "Defect confirmed by brand: photos sent to AGV in Italy, handled within 2–7 days",
      },
    ],
  },
  {
    brand: "Caberg",
    period: { vi: "24 tháng", en: "24 months" },
    note: [{ vi: "Theo chính sách hãng", en: "Per brand policy" }],
  },
  {
    brand: "ILM",
    period: { vi: "12 tháng", en: "12 months" },
    note: [{ vi: "Lỗi kỹ thuật / nhà sản xuất", en: "Technical / manufacturer defect" }],
  },
  {
    brand: "NIC",
    period: { vi: "12 tháng", en: "12 months" },
    note: [{ vi: "Lỗi kỹ thuật / nhà sản xuất", en: "Technical / manufacturer defect" }],
  },
  {
    brand: "LS2",
    period: { vi: "Theo từng linh kiện", en: "By component" },
    note: [
      { vi: "Khóa · cần gạt · dây cáp · dây quai: 24 tháng", en: "Lock · visor lever · cable · strap: 24 months" },
      { vi: "Vải · đệm lót · kính chắn · Pinlock · sơn: 6 tháng", en: "Fabric · lining · visor · Pinlock · paint: 6 months" },
      { vi: "EPS · vỏ nón · đuôi gió: không bảo hành (chỉ sửa có phí)", en: "EPS · shell · spoiler: no warranty (paid repair only)" },
    ],
  },
  {
    brand: "SCS",
    period: { vi: "24 tháng", en: "24 months" },
    note: [
      {
        vi: "Toàn bộ sản phẩm · Không BH: va đập, cấn, móp, bể, vào nước do sử dụng",
        en: "Full product · Excludes: impact, dents, cracks, water ingress from use",
      },
    ],
  },
];

const APPAREL_ROWS: { item: Bi; period: Bi }[] = [
  { item: { vi: "Đường chỉ, mối nối hàn nhiệt (áo / quần)", en: "Stitching, heat-welded seams (jacket / pants)" }, period: { vi: "6 tháng", en: "6 months" } },
  { item: { vi: "Dây khóa kéo, khóa dán", en: "Zippers, velcro" }, period: { vi: "6 tháng", en: "6 months" } },
  { item: { vi: "Da thật, da lộn, phần chống thấm, phản quang", en: "Genuine leather, suede, waterproofing, reflective parts" }, period: { vi: "6 tháng", en: "6 months" } },
  { item: { vi: "Keo đế giày", en: "Shoe sole adhesive" }, period: { vi: "12 tháng", en: "12 months" } },
];

const BAG_ROWS: { item: Bi; period: Bi }[] = [
  { item: { vi: "Đường chỉ, dây khóa kéo", en: "Stitching, zippers" }, period: { vi: "3 tháng", en: "3 months" } },
];

function steps(lang: Lang, contact: WarrantyContact): { title: Bi; body: ReactNode }[] {
  const phone = (label: string, num: string) =>
    num ? (
      <>
        {label} <a href={telHref(num)} className="font-bold text-foreground no-underline">{num}</a>
      </>
    ) : (
      label
    );
  return [
    {
      title: { vi: "Liên hệ BigBike trước", en: "Contact BigBike first" },
      body: (
        <>
          {phone(lang === "en" ? "Message Zalo" : "Nhắn Zalo", contact.zalo)}
          {contact.zalo ? (lang === "en" ? " (Mrs. Thư) or call Hotline " : " (Mrs. Thư) hoặc gọi Hotline ") : lang === "en" ? "Call Hotline " : "Gọi Hotline "}
          {phone("", contact.hotline)}
          {lang === "en" ? " — describe the issue and send photos / video of the product." : " — mô tả lỗi và gửi ảnh / video sản phẩm."}
        </>
      ),
    },
    {
      title: { vi: "BigBike xác nhận lỗi", en: "BigBike confirms the defect" },
      body: t(lang, {
        vi: "Phản hồi trong 2–4 giờ (trong giờ làm việc). Nếu thuộc diện bảo hành, BigBike hướng dẫn bước tiếp theo.",
        en: "We respond within 2–4 hours (business hours). If covered, BigBike guides you through the next steps.",
      }),
    },
    {
      title: { vi: "Gửi sản phẩm về BigBike", en: "Send the product to BigBike" },
      body: t(lang, {
        vi: `Mang trực tiếp đến shop (nội thành TP.HCM) hoặc gửi bưu điện theo hướng dẫn.${contact.address ? ` Địa chỉ: ${contact.address}.` : ""}`,
        en: `Bring it directly to the shop (inner-city HCMC) or ship by post as instructed.${contact.address ? ` Address: ${contact.address}.` : ""}`,
      }),
    },
    {
      title: { vi: "Xử lý và trả sản phẩm", en: "Processing and return" },
      body: t(lang, {
        vi: "BigBike xử lý hoặc chuyển về hãng. Thời gian: 3–7 ngày làm việc với đa số sản phẩm. Riêng LS2 qua BBI: tối đa 7 ngày làm việc kể từ khi BBI nhận hàng.",
        en: "BigBike handles it or forwards it to the brand. Time: 3–7 business days for most products. For LS2 via BBI: up to 7 business days from when BBI receives the item.",
      }),
    },
  ];
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 font-cta text-a2-page font-bold uppercase leading-title tracking-wide text-brand">
      {children}
    </h2>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-cta text-a4-content font-bold uppercase tracking-wide text-foreground">
      {children}
    </p>
  );
}

export function WarrantyPolicyContent({
  locale,
  contact,
}: {
  locale: string;
  contact: WarrantyContact;
}) {
  const lang: Lang = locale === "en" ? "en" : "vi";
  const hours = [contact.hoursWeekday, contact.hoursWeekend].filter(Boolean).join("  ·  ");

  const contactRows: { label: string; value: ReactNode }[] = [
    contact.hotline
      ? { label: t(lang, COPY.hotline), value: <a href={telHref(contact.hotline)} className="font-bold text-brand no-underline">{contact.hotline}</a> }
      : null,
    contact.zalo
      ? {
          label: t(lang, COPY.zalo),
          value: (
            <span className="font-bold text-brand">
              {contact.zaloUrl ? (
                <a href={contact.zaloUrl} target="_blank" rel="noopener noreferrer" className="text-brand no-underline">{contact.zalo}</a>
              ) : (
                contact.zalo
              )}{" "}
              <span className="font-normal text-muted-foreground">(Mrs. Thư)</span>
            </span>
          ),
        }
      : null,
    hours ? { label: t(lang, COPY.hours), value: hours } : null,
    contact.address ? { label: t(lang, COPY.address), value: contact.address } : null,
  ].filter(Boolean) as { label: string; value: ReactNode }[];

  return (
    <div className="max-w-none text-a4-content leading-body text-foreground">
      {/* Intro */}
      <p className="mb-6 text-a4-content leading-body">{t(lang, COPY.intro)}</p>

      {/* 1. Điều kiện */}
      <SectionTitle>{t(lang, COPY.s1Title)}</SectionTitle>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="border border-border p-4">
          <p className="mb-3 flex items-center gap-2 font-cta text-a4-content font-bold uppercase tracking-wide text-foreground">
            <Check className="size-5 shrink-0 text-pros-accent" aria-hidden /> {t(lang, COPY.covered)}
          </p>
          <ul className="list-disc space-y-2 pl-5 leading-snug">
            {COVERED.map((c, i) => (
              <li key={i}>{t(lang, c)}</li>
            ))}
          </ul>
        </div>
        <div className="border border-border p-4">
          <p className="mb-3 flex items-center gap-2 font-cta text-a4-content font-bold uppercase tracking-wide text-foreground">
            <X className="size-5 shrink-0 text-cons-accent" aria-hidden /> {t(lang, COPY.notCovered)}
          </p>
          <ul className="list-disc space-y-2 pl-5 leading-snug">
            {NOT_COVERED.map((c, i) => (
              <li key={i}>{t(lang, c)}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Lưu ý mũ va chạm */}
      <div className="mb-6 border border-border border-l-4 border-l-brand bg-white p-4">
        <p className="leading-body">
          <strong className="text-brand">{t(lang, COPY.helmetNoteLead)}</strong>{" "}
          {t(lang, COPY.helmetNote)}
        </p>
      </div>

      {/* 2. Thời hạn theo thương hiệu */}
      <SectionTitle>{t(lang, COPY.s2Title)}</SectionTitle>

      {/* Mũ bảo hiểm */}
      <SubLabel>{t(lang, COPY.helmets)}</SubLabel>
      <div className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse text-a4-content">
          <thead>
            <tr className="bg-secondary">
              <th className="w-1/5 border border-border p-3 text-left font-bold">{t(lang, COPY.colBrand)}</th>
              <th className="w-1/4 border border-border p-3 text-left font-bold">{t(lang, COPY.colPeriod)}</th>
              <th className="border border-border p-3 text-left font-bold">{t(lang, COPY.colNote)}</th>
            </tr>
          </thead>
          <tbody>
            {HELMET_ROWS.map((r) => (
              <tr key={r.brand}>
                <td className="border border-border p-3 align-top font-bold">{r.brand}</td>
                <td className="border border-border p-3 align-top">{t(lang, r.period)}</td>
                <td className="border border-border p-3 align-top text-a5-meta text-muted-foreground">
                  {r.note.map((n, i) => (
                    <span key={i} className="block">{t(lang, n)}</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Áo / Găng / Giày */}
      <SubLabel>{t(lang, COPY.apparel)}</SubLabel>
      <p className="mb-2 text-a5-meta text-muted-foreground">
        {t(lang, COPY.appliesTo)} <span className="text-brand">{t(lang, COPY.hevikNote)}</span>
      </p>
      <div className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse text-a4-content">
          <thead>
            <tr className="bg-secondary">
              <th className="border border-border p-3 text-left font-bold">{t(lang, COPY.colItem)}</th>
              <th className="w-1/4 border border-border p-3 text-left font-bold">{t(lang, COPY.colPeriod)}</th>
            </tr>
          </thead>
          <tbody>
            {APPAREL_ROWS.map((r, i) => (
              <tr key={i}>
                <td className="border border-border p-3">{t(lang, r.item)}</td>
                <td className="border border-border p-3">{t(lang, r.period)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Balo / Túi */}
      <SubLabel>{t(lang, COPY.bags)}</SubLabel>
      <div className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse text-a4-content">
          <thead>
            <tr className="bg-secondary">
              <th className="border border-border p-3 text-left font-bold">{t(lang, COPY.colItem)}</th>
              <th className="w-1/4 border border-border p-3 text-left font-bold">{t(lang, COPY.colPeriod)}</th>
            </tr>
          </thead>
          <tbody>
            {BAG_ROWS.map((r, i) => (
              <tr key={i}>
                <td className="border border-border p-3">{t(lang, r.item)}</td>
                <td className="border border-border p-3">{t(lang, r.period)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Quy trình */}
      <SectionTitle>{t(lang, COPY.s3Title)}</SectionTitle>
      <ol className="mb-6 space-y-3">
        {steps(lang, contact).map((s, i) => (
          <li key={i} className="flex gap-4 border border-border p-4">
            <span className="font-cta text-a2-page font-bold leading-none text-brand">{i + 1}</span>
            <div className="leading-body">
              <strong className="text-foreground">{t(lang, s.title)}</strong>
              <br />
              <span>{s.body}</span>
            </div>
          </li>
        ))}
      </ol>

      {/* 4. Liên hệ */}
      <SectionTitle>{t(lang, COPY.s4Title)}</SectionTitle>
      <div className="mb-4 overflow-x-auto">
        <table className="w-full border-collapse text-a4-content">
          <tbody>
            {contactRows.map((row, i) => (
              <tr key={i}>
                <td className="w-1/3 border border-border p-3 font-bold align-top">{row.label}</td>
                <td className="border border-border p-3 align-top">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-a5-meta leading-snug text-muted-foreground">{t(lang, COPY.footerNote)}</p>
    </div>
  );
}
