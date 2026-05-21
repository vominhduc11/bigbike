import Image from "next/image";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/Breadcrumb";

// Ảnh banner đặc (không vùng trong suốt). Cả hai biến thể hero đều tự cắt chéo
// bằng clip-path nên dùng chung ảnh này → zoom/khung hình nền đồng nhất.
const WP_HERO_BG_SOLID = "/wp/page-title-bg-solid.jpg";
// Ảnh gear cut-out mặc định cho hero `welcome` khi trang chưa cấu hình ảnh riêng.
// Áo giáp LS2 Airy — PNG nền trong, đúng tinh thần "đồ bảo hộ" của bản thiết kế.
const WP_HERO_ILLUSTRATION = "/wp/about-hero-gear.png";

export type PageHeroVariant = "welcome" | "contact";

/** Alias giữ tương thích — kiểu breadcrumb dùng chung định nghĩa ở `Breadcrumb`. */
export type PageHeroBreadcrumbItem = BreadcrumbItem;

export type PageHeroIllustration = {
  src?: string | null;
  alt?: string | null;
};

export type PageHeroProps = {
  /**
   * Bố cục hero:
   * - `contact` (mặc định) — banner cắt chéo: chỉ tiêu đề + breadcrumb, ảnh minh hoạ tuỳ chọn bên phải.
   * - `welcome` — banner chào mừng: tiêu đề căn giữa, chữ chìm watermark, ảnh sản phẩm tràn xuống nền dưới.
   */
  variant?: PageHeroVariant;
  imageUrl?: string | null;
  imageAlt?: string | null;
  title: string;
  breadcrumb?: PageHeroBreadcrumbItem[];
  /** Chữ chìm cỡ lớn phía sau tiêu đề — chỉ dùng cho variant `welcome`. */
  watermark?: string | null;
  /** Ảnh minh hoạ nổi trước banner — variant `welcome` (tràn xuống giữa) và `contact` (đặt bên phải). */
  illustration?: PageHeroIllustration | null;
};

export function PageHero(props: PageHeroProps) {
  const variant = props.variant ?? "contact";
  if (variant === "welcome") {
    return <WelcomeHero {...props} />;
  }
  return <ContactHero {...props} />;
}

/* Variant `welcome` — banner chào mừng (gioi-thieu): nền núi đỏ + chữ chìm,
   ảnh sản phẩm cut-out tràn xuống nền trắng bên dưới. */
function WelcomeHero({ title, watermark, illustration }: PageHeroProps) {
  // Ảnh cut-out: ưu tiên ảnh hero của trang; fallback ảnh gear có sẵn trong repo.
  const customSrc = illustration?.src?.trim()
    ? resolveMediaUrl(illustration.src.trim())
    : null;
  const illustrationSrc = customSrc || WP_HERO_ILLUSTRATION;
  const illustrationAlt = safeText(illustration?.alt, "Đồ bảo hộ moto BigBike");

  return (
    <header className="relative bg-[var(--bb-bg-page)]">
      {/* Banner nền núi đỏ — mood racing. Cắt chéo đáy bằng clip-path; cùng ảnh
          và cùng khung hình với hero `contact` để zoom nền đồng nhất. */}
      <div className="relative h-[300px] overflow-hidden md:h-[450px] [clip-path:polygon(0_0,100%_0,100%_75%,0_100%)]">
        <Image
          src={WP_HERO_BG_SOLID}
          alt=""
          fill
          priority
          sizes="100vw"
          aria-hidden="true"
          className="object-cover"
        />
        {/* Hai lớp overlay: lớp đỏ brand giữ mood racing, lớp tối tạo chiều sâu.
            Cả hai mờ dần xuống đáy để không phủ màu lên lát cắt chéo. */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand/35 via-brand/15 to-transparent mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-transparent" />
        {/* Watermark mờ + headline, đặt ~1/3 trên để chừa chỗ cho ảnh cut-out. */}
        <div className="absolute left-1/2 top-[100px] -translate-x-1/2 px-4 text-center md:top-[143px]">
          {watermark ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display font-bold uppercase leading-none tracking-[0.06em] text-white/[0.07] text-[clamp(64px,19vw,200px)]"
            >
              {watermark}
            </span>
          ) : null}
          <h1 className="relative m-0 whitespace-nowrap font-display text-xl font-bold uppercase leading-tight tracking-wide text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.7)] sm:text-3xl lg:text-5xl">
            {title}
          </h1>
        </div>
      </div>
      {/* Ảnh cut-out — layer riêng (z-10), margin âm để chồng lên mép dưới banner
          rồi tràn xuống nền trắng; chiều cao header tự co theo margin âm này. */}
      <div className="pointer-events-none relative z-10 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={illustrationSrc}
          alt={illustrationAlt}
          className="-mt-[136px] max-h-[240px] w-auto max-w-[80%] object-contain drop-shadow-[0_18px_26px_rgba(0,0,0,0.4)] md:-mt-[182px] md:max-h-[300px]"
        />
      </div>
    </header>
  );
}

/* Variant `contact` (mặc định) — banner cắt chéo: ảnh nền + clip-path chéo,
   tiêu đề căn trái + breadcrumb, ảnh minh hoạ tuỳ chọn đặt bên phải. */
function ContactHero({ imageUrl, imageAlt, title, breadcrumb, illustration }: PageHeroProps) {
  const trimmedUrl = imageUrl?.trim();
  // Không có ảnh riêng → fallback bản banner đặc để clip-path cắt chéo gọn,
  // không lộ mảng đen do lát cắt trong suốt của ảnh PNG gốc.
  const bgSrc = (trimmedUrl ? resolveMediaUrl(trimmedUrl) : null) || WP_HERO_BG_SOLID;
  const passedIllustration = illustration?.src?.trim() || null;

  // Trang truyền ảnh straddle (vd điện thoại) → cần thêm khoảng dưới banner;
  // còn lại dùng ảnh gear mặc định nằm gọn trong banner → cao bằng banner.
  return (
    <div className={`relative h-[300px] ${passedIllustration ? "md:h-[560px]" : "md:h-[450px]"}`}>
      {/* Banner ảnh nền, cắt chéo đáy bằng clip-path. */}
      <div className="absolute inset-x-0 top-0 h-[300px] overflow-hidden bg-black md:h-[450px] [clip-path:polygon(0_0,100%_0,100%_75%,0_100%)]">
        <Image
          src={bgSrc}
          alt={safeText(imageAlt, title)}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
      </div>

      <div className="absolute inset-x-0 top-0 flex h-[300px] items-center md:h-[450px]">
        <div className="bb-container">
          <h1 className="bb-cat-hero-title" style={{ fontSize: "clamp(2.5rem, 5vw, 4.375rem)", lineHeight: 1.05 }}>
            {title}
          </h1>
          <Breadcrumb items={breadcrumb ?? []} variant="onHero" className="mt-4" />
        </div>
      </div>

      {passedIllustration ? (
        /* Ảnh trang tự truyền — kiểu cao, vắt qua mép cắt (vd điện thoại trang Liên hệ). */
        <div className="absolute right-[4%] top-[34px] z-10 hidden w-[340px] md:block" aria-hidden="true">
          <Image
            src={passedIllustration}
            alt=""
            width={1024}
            height={1536}
            className="h-auto w-full"
            priority
          />
        </div>
      ) : (
        /* Mặc định — ảnh gear cut-out ở góc phải, vắt qua đường cắt chéo. */
        <div className="pointer-events-none absolute right-[3%] bottom-0 z-10 hidden w-[220px] md:block lg:w-[300px]" aria-hidden="true">
          <Image
            src={WP_HERO_ILLUSTRATION}
            alt=""
            width={700}
            height={627}
            className="h-auto w-full drop-shadow-[0_14px_22px_rgba(0,0,0,0.45)]"
          />
        </div>
      )}
    </div>
  );
}
