import type { ReactNode } from "react";
import { Check, Ruler } from "lucide-react";
import { telHref } from "@/lib/utils/format";

const HOTLINE = "0906902404";
const ZALO = "0764640679";
const ZALO_URL = "https://zalo.me/0764640679";

type Lang = "vi" | "en";
type Bi = { vi: string; en: string };

const t = (lang: Lang, s: Bi) => (lang === "en" ? s.en : s.vi);

const COPY = {
  intro: {
    vi: "Đo đúng size giúp đồ bảo hộ bảo vệ đúng vị trí. Giáp lệch ra khỏi khớp khi va chạm vì size sai có thể nguy hiểm hơn không mặc. Đo mất 3 phút, tránh mất công đổi hàng.",
    en: "Choosing the correct size ensures safety armor stays in place. Misaligned armor during a crash due to incorrect sizing can be more dangerous than wearing none at all. It takes 3 minutes and saves you a return.",
  },
  s1Title: { vi: "1. Cách đo size găng tay", en: "1. How to measure glove size" },
  s2Title: { vi: "2. Cách đo size giày bảo hộ", en: "2. How to measure riding boots size" },
  s3Title: { vi: "3. Cách đo size áo giáp", en: "3. How to measure riding jacket size" },
  s4Title: { vi: "4. Cách đo size quần giáp", en: "4. How to measure riding pants size" },
  s5Title: { vi: "Không chắc size? Liên hệ BigBike", en: "Not sure about your size? Contact BigBike" },
  colSize: { vi: "Size", en: "Size" },
  colSizeEu: { vi: "Size EU", en: "Size EU" },
  colHand: { vi: "Vòng bàn tay (cm)", en: "Hand (cm)" },
  colFoot: { vi: "Chiều dài chân (mm)", en: "Foot length (mm)" },
  colChest: { vi: "Vòng ngực (cm)", en: "Chest (cm)" },
  colWaist: { vi: "Vòng eo (cm)", en: "Waist (cm)" },
  colHip: { vi: "Vòng hông (cm)", en: "Hips (cm)" },
  colThigh: { vi: "Vòng đùi (cm)", en: "Thighs (cm)" },
  colFit: { vi: "Phù hợp", en: "Suited for" },
  colFitVn: { vi: "Size VN tương đương", en: "VN size equivalent" },
  gloveNote: {
    vi: "* Taichi và Komine thường nhỏ hơn hãng châu Âu 1 bậc. Xem bảng size trên trang sản phẩm để chính xác nhất.",
    en: "* Taichi and Komine are usually 1 size smaller than European brands. Check the size chart on the product page for accuracy.",
  },
  bootNote: {
    vi: "Lưu ý: Giày bảo hộ nên rộng hơn giày thường 0,5–1 size vì mang tất dày hơn và cần không gian cho cổ chân cử động khi phanh.",
    en: "Note: Riding boots should be 0.5–1 size larger than regular shoes to accommodate thick socks and allow ankle movement when braking.",
  },
  jacketIntro: {
    vi: "Cần đo 3 số: vòng ngực, vòng eo, chiều cao. Lấy số lớn nhất để chọn size — áo giáp cần vừa đủ để giáp đúng vị trí, không bị trượt khi va chạm.",
    en: "Measure three values: chest, waist, and height. Choose the size matching the largest measurement — jackets must fit snugly to ensure armor plates stay in place.",
  },
  jacketNote: {
    vi: "* Komine và Taichi thường nhỏ hơn 1 bậc so với size EU. Xem bảng size cụ thể trên trang sản phẩm.",
    en: "* Komine and Taichi are usually 1 size smaller than European sizing. Check the specific size chart on the product page.",
  },
  pantsIntro: {
    vi: "Cần đo 3 số: vòng hông, vòng đùi, chiều dài đũng. Quần giáp cần vừa sát để giáp đầu gối và hông đúng vị trí — không bị tụt xuống khi phanh gấp.",
    en: "Measure three values: hips, thighs, and inseam. Riding pants must fit snugly to keep knee and hip armor in the correct position.",
  },
  pantsNote: {
    vi: "* Bảng size trên là tham chiếu chung. Xem bảng size cụ thể trên trang sản phẩm vì mỗi hãng có thể khác nhau.",
    en: "* This chart is a general reference. Please check the specific size chart on the product page as each brand may differ.",
  },
  pantsHighlight: {
    vi: "Mặc thử trước khi mua: Nếu có thể ghé shop BigBike, mặc thử và kiểm tra: giáp đầu gối đúng vị trí, giáp hông che đủ khi ngồi lên xe — quan trọng hơn con số đo được.",
    en: "Try on before buying: If you can visit BigBike store, try it on and verify knee armor rests correctly and hip pads cover properly when in a sitting riding position.",
  },
  contactLead: {
    vi: "Gửi số đo qua Zalo — BigBike tư vấn size đúng theo từng thương hiệu và dòng sản phẩm cụ thể.",
    en: "Send your measurements via Zalo — BigBike will advise you on the right size for each brand and product line.",
  },
  contactBar: { vi: "Tư vấn size miễn phí", en: "Free size consulting" },
  hotline: { vi: "Hotline", en: "Hotline" },
  zalo: { vi: "Zalo", en: "Zalo" },
  workingTimeLabel: { vi: "Giờ làm việc", en: "Working hours" },
  workingTimeValue: { vi: "Thứ 2 – Thứ 7: 9:00 – 21:00 · Chủ nhật: 9:00 – 18:00", en: "Mon – Sat: 9:00 AM – 9:00 PM · Sun: 9:00 AM – 6:00 PM" },
} satisfies Record<string, Bi>;

type Step = { title: Bi; body: Bi };

const GLOVE_STEPS: Step[] = [
  {
    title: { vi: "Dùng thước dây đo vòng bàn tay", en: "Measure hand circumference with soft tape" },
    body: {
      vi: "Đặt thước dây quanh phần rộng nhất của bàn tay — qua gốc 4 ngón, không tính ngón cái. Bàn tay xòe tự nhiên, không căng.",
      en: "Wrap the tape around the widest part of your hand — across knuckles of 4 fingers, excluding thumb. Hold hand naturally relaxed.",
    },
  },
  {
    title: { vi: "Đọc số đo và đối chiếu bảng", en: "Read measurement and compare with chart" },
    body: {
      vi: "Ghi lại số cm tại điểm giao nhau. Đối chiếu bảng size bên dưới.",
      en: "Read the measurement in cm where the tape overlaps. Compare it with the size chart below.",
    },
  },
];

const GLOVE_ROWS = [
  { size: "S", head: "17 – 18", fit: { vi: "Tay nhỏ, nữ", en: "Small hand, women" } },
  { size: "M", head: "19 – 20", fit: { vi: "Nam trung bình", en: "Average men" } },
  { size: "L", head: "21 – 22", fit: { vi: "Nam tay lớn", en: "Large hand, men" } },
  { size: "XL", head: "23 – 24", fit: { vi: "Nam tay rất lớn", en: "Very large hand, men" } },
  { size: "XXL", head: "25+", fit: { vi: "Đặc biệt", en: "Special size" } },
];

const BOOT_STEPS: Step[] = [
  {
    title: { vi: "Đặt chân lên tờ giấy A4", en: "Place foot on A4 paper" },
    body: {
      vi: "Đứng thẳng, trọng lượng dồn đều 2 chân. Dùng bút vẽ đường viền bàn chân.",
      en: "Stand straight, distribute weight evenly on both feet. Trace the outline of your foot with a pen.",
    },
  },
  {
    title: { vi: "Đo chiều dài bàn chân", en: "Measure foot length" },
    body: {
      vi: "Đo từ gót đến đầu ngón dài nhất. Đo cả hai chân — chọn size theo chân lớn hơn.",
      en: "Measure from heel to the tip of your longest toe. Measure both feet and use the larger value.",
    },
  },
];

const BOOT_ROWS = [
  { eu: "38", head: "240 – 245", vn: "37 – 38" },
  { eu: "39", head: "246 – 251", vn: "38 – 39" },
  { eu: "40", head: "252 – 257", vn: "39 – 40" },
  { eu: "41", head: "258 – 263", vn: "40 – 41" },
  { eu: "42", head: "264 – 269", vn: "41 – 42" },
  { eu: "43", head: "270 – 275", vn: "42 – 43" },
  { eu: "44", head: "276 – 281", vn: "43 – 44" },
  { eu: "45", head: "282+", vn: "44+" },
];

const JACKET_STEPS: Step[] = [
  {
    title: { vi: "Đo vòng ngực", en: "Measure chest circumference" },
    body: {
      vi: "Đặt thước ngang qua điểm rộng nhất của ngực, giữ thước song song với sàn. Thở bình thường, không hít vào hoặc ép ngực.",
      en: "Place tape around the widest part of your chest, parallel to the floor. Breathe normally, do not puff or squeeze chest.",
    },
  },
  {
    title: { vi: "Đo vòng eo", en: "Measure waist circumference" },
    body: {
      vi: "Đặt thước quanh phần nhỏ nhất của eo (thường trên rốn 2–3cm). Đứng thẳng, không co bụng.",
      en: "Wrap tape around the narrowest part of your waist (2-3cm above navel). Stand straight, do not pull in stomach.",
    },
  },
  {
    title: { vi: "Đo chiều cao", en: "Measure height" },
    body: {
      vi: "Dùng để kiểm tra độ dài thân áo có đủ che đến thắt lưng và bảo vệ vùng lưng dưới không.",
      en: "Used to verify jacket length is sufficient to cover your lower back area when in riding positions.",
    },
  },
];

const JACKET_ROWS = [
  { size: "S", chest: "86 – 90", waist: "72 – 76", fit: { vi: "Nam / nữ vóc nhỏ", en: "Petite men/women" } },
  { size: "M", chest: "91 – 96", waist: "77 – 82", fit: { vi: "Nam trung bình", en: "Average men" } },
  { size: "L", chest: "97 – 102", waist: "83 – 88", fit: { vi: "Nam to con", en: "Large men" } },
  { size: "XL", chest: "103 – 108", waist: "89 – 94", fit: { vi: "Nam to lớn", en: "Very large men" } },
  { size: "XXL", chest: "109 – 114", waist: "95 – 100", fit: { vi: "Đặc biệt", en: "Special size" } },
  { size: "XXXL", chest: "115+", waist: "101+", fit: { vi: "Đặc biệt", en: "Special size" } },
];

const PANTS_STEPS: Step[] = [
  {
    title: { vi: "Đo vòng hông", en: "Measure hip circumference" },
    body: {
      vi: "Đặt thước ngang qua phần rộng nhất của hông và mông. Đứng thẳng tự nhiên, không ưỡn hay co người.",
      en: "Wrap tape around the widest part of your hips and buttocks. Stand naturally straight.",
    },
  },
  {
    title: { vi: "Đo vòng đùi", en: "Measure thigh circumference" },
    body: {
      vi: "Đặt thước quanh phần to nhất của đùi, ngay dưới bẹn. Đứng thẳng, hai chân khép tự nhiên.",
      en: "Wrap tape around the thickest part of your thigh, just below the groin. Stand with legs naturally closed.",
    },
  },
  {
    title: { vi: "Đo chiều dài đũng", en: "Measure inseam length" },
    body: {
      vi: "Đo từ đáy đũng quần đến mắt cá chân bên trong. Dùng để kiểm tra ống quần có đủ dài che bảo vệ đến đầu giày không.",
      en: "Measure from the groin to the inner ankle bone. Used to check if pant legs are long enough to overlap riding boots.",
    },
  },
];

const PANTS_ROWS = [
  { size: "S", hips: "82 – 86", thighs: "50 – 54", fit: { vi: "Nam / nữ vóc nhỏ", en: "Petite men/women" } },
  { size: "M", hips: "87 – 92", thighs: "55 – 59", fit: { vi: "Nam trung bình", en: "Average men" } },
  { size: "L", hips: "93 – 98", thighs: "60 – 64", fit: { vi: "Nam to con", en: "Large men" } },
  { size: "XL", hips: "99 – 104", thighs: "65 – 69", fit: { vi: "Nam to lớn", en: "Very large men" } },
  { size: "XXL", hips: "105 – 110", thighs: "70 – 74", fit: { vi: "Đặc biệt", en: "Special size" } },
  { size: "XXXL", hips: "111+", thighs: "75+", fit: { vi: "Đặc biệt", en: "Special size" } },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 mt-8 font-cta text-ui-22 font-bold uppercase leading-title tracking-wide text-brand first:mt-0">
      {children}
    </h2>
  );
}

export function ClothingSizeGuideContent({ locale }: { locale: string }) {
  const lang: Lang = locale === "en" ? "en" : "vi";

  return (
    <div className="max-w-none text-ui-16 max-md:text-ui-14 leading-body text-foreground">
      {/* Lead */}
      <p className="mb-6 border-l-4 border-border bg-secondary p-4 text-ui-18 max-md:text-ui-16 leading-body">
        {t(lang, COPY.intro)}
      </p>

      {/* 1. GĂNG TAY */}
      <SectionTitle>{t(lang, COPY.s1Title)}</SectionTitle>
      <ol className="mb-4 space-y-3">
        {GLOVE_STEPS.map((s, i) => (
          <li key={i} className="flex gap-4 border border-border p-4">
            <span className="font-cta text-ui-22 font-bold leading-none text-brand">{i + 1}</span>
            <div className="leading-body">
              <strong className="text-foreground">{t(lang, s.title)}</strong>
              <br />
              <span>{t(lang, s.body)}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mb-3 overflow-x-auto">
        <table className="w-full border-collapse text-ui-16 max-md:text-ui-14">
          <thead>
            <tr className="bg-secondary">
              <th className="w-1/6 border border-border p-3 text-left font-bold">{t(lang, COPY.colSize)}</th>
              <th className="w-1/3 border border-border p-3 text-left font-bold">{t(lang, COPY.colHand)}</th>
              <th className="border border-border p-3 text-left font-bold">{t(lang, COPY.colFit)}</th>
            </tr>
          </thead>
          <tbody>
            {GLOVE_ROWS.map((r) => (
              <tr key={r.size}>
                <td className="border border-border p-3 font-bold">{r.size}</td>
                <td className="border border-border p-3">{r.head}</td>
                <td className="border border-border p-3 text-muted-foreground">{t(lang, r.fit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-8 text-ui-14 leading-snug text-muted-foreground">{t(lang, COPY.gloveNote)}</p>

      <hr className="border-none border-t border-border my-6" />

      {/* 2. GIÀY */}
      <SectionTitle>{t(lang, COPY.s2Title)}</SectionTitle>
      <ol className="mb-4 space-y-3">
        {BOOT_STEPS.map((s, i) => (
          <li key={i} className="flex gap-4 border border-border p-4">
            <span className="font-cta text-ui-22 font-bold leading-none text-brand">{i + 1}</span>
            <div className="leading-body">
              <strong className="text-foreground">{t(lang, s.title)}</strong>
              <br />
              <span>{t(lang, s.body)}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mb-3 overflow-x-auto">
        <table className="w-full border-collapse text-ui-16 max-md:text-ui-14">
          <thead>
            <tr className="bg-secondary">
              <th className="w-1/5 border border-border p-3 text-left font-bold">{t(lang, COPY.colSizeEu)}</th>
              <th className="w-2/5 border border-border p-3 text-left font-bold">{t(lang, COPY.colFoot)}</th>
              <th className="border border-border p-3 text-left font-bold">{t(lang, COPY.colFitVn)}</th>
            </tr>
          </thead>
          <tbody>
            {BOOT_ROWS.map((r) => (
              <tr key={r.eu}>
                <td className="border border-border p-3 font-bold">{r.eu}</td>
                <td className="border border-border p-3">{r.head}</td>
                <td className="border border-border p-3 text-muted-foreground">{r.vn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-8 border border-border border-l-4 border-l-brand bg-white p-4">
        <p className="m-0 leading-body font-body text-ui-15 max-md:text-ui-14">
          {t(lang, COPY.bootNote)}
        </p>
      </div>

      <hr className="border-none border-t border-border my-6" />

      {/* 3. ÁO GIÁP */}
      <SectionTitle>{t(lang, COPY.s3Title)}</SectionTitle>
      <p className="mb-4 leading-body">{t(lang, COPY.jacketIntro)}</p>
      <ol className="mb-4 space-y-3">
        {JACKET_STEPS.map((s, i) => (
          <li key={i} className="flex gap-4 border border-border p-4">
            <span className="font-cta text-ui-22 font-bold leading-none text-brand">{i + 1}</span>
            <div className="leading-body">
              <strong className="text-foreground">{t(lang, s.title)}</strong>
              <br />
              <span>{t(lang, s.body)}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mb-3 overflow-x-auto">
        <table className="w-full border-collapse text-ui-16 max-md:text-ui-14">
          <thead>
            <tr className="bg-secondary">
              <th className="w-1/6 border border-border p-3 text-left font-bold">{t(lang, COPY.colSize)}</th>
              <th className="w-1/4 border border-border p-3 text-left font-bold">{t(lang, COPY.colChest)}</th>
              <th className="w-1/4 border border-border p-3 text-left font-bold">{t(lang, COPY.colWaist)}</th>
              <th className="border border-border p-3 text-left font-bold">{t(lang, COPY.colFit)}</th>
            </tr>
          </thead>
          <tbody>
            {JACKET_ROWS.map((r) => (
              <tr key={r.size}>
                <td className="border border-border p-3 font-bold">{r.size}</td>
                <td className="border border-border p-3">{r.chest}</td>
                <td className="border border-border p-3">{r.waist}</td>
                <td className="border border-border p-3 text-muted-foreground">{t(lang, r.fit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-8 text-ui-14 leading-snug text-muted-foreground">{t(lang, COPY.jacketNote)}</p>

      <hr className="border-none border-t border-border my-6" />

      {/* 4. QUẦN GIÁP */}
      <SectionTitle>{t(lang, COPY.s4Title)}</SectionTitle>
      <p className="mb-4 leading-body">{t(lang, COPY.pantsIntro)}</p>
      <ol className="mb-4 space-y-3">
        {PANTS_STEPS.map((s, i) => (
          <li key={i} className="flex gap-4 border border-border p-4">
            <span className="font-cta text-ui-22 font-bold leading-none text-brand">{i + 1}</span>
            <div className="leading-body">
              <strong className="text-foreground">{t(lang, s.title)}</strong>
              <br />
              <span>{t(lang, s.body)}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mb-3 overflow-x-auto">
        <table className="w-full border-collapse text-ui-16 max-md:text-ui-14">
          <thead>
            <tr className="bg-secondary">
              <th className="w-1/6 border border-border p-3 text-left font-bold">{t(lang, COPY.colSize)}</th>
              <th className="w-1/4 border border-border p-3 text-left font-bold">{t(lang, COPY.colHip)}</th>
              <th className="w-1/4 border border-border p-3 text-left font-bold">{t(lang, COPY.colThigh)}</th>
              <th className="border border-border p-3 text-left font-bold">{t(lang, COPY.colFit)}</th>
            </tr>
          </thead>
          <tbody>
            {PANTS_ROWS.map((r) => (
              <tr key={r.size}>
                <td className="border border-border p-3 font-bold">{r.size}</td>
                <td className="border border-border p-3">{r.hips}</td>
                <td className="border border-border p-3">{r.thighs}</td>
                <td className="border border-border p-3 text-muted-foreground">{t(lang, r.fit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-ui-14 leading-snug text-muted-foreground">{t(lang, COPY.pantsNote)}</p>
      <div className="mb-8 border border-border border-l-4 border-l-brand bg-white p-4">
        <p className="m-0 leading-body font-body text-ui-15 max-md:text-ui-14">
          <strong className="text-brand">{t(lang, { vi: "Mặc thử trước khi mua:", en: "Try on before buying:" })}</strong>{" "}
          {t(lang, COPY.pantsHighlight)}
        </p>
      </div>

      <hr className="border-none border-t border-border my-6" />

      {/* 5. LIÊN HỆ */}
      <SectionTitle>{t(lang, COPY.s5Title)}</SectionTitle>
      <p className="mb-4 leading-body">{t(lang, COPY.contactLead)}</p>
      <div className="border border-border border-l-4 border-l-brand bg-secondary p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
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
        <div className="text-ui-14 text-muted-foreground leading-normal border-t border-border/50 pt-3">
          <strong>{t(lang, COPY.workingTimeLabel)}:</strong> {t(lang, COPY.workingTimeValue)}
        </div>
      </div>
    </div>
  );
}
