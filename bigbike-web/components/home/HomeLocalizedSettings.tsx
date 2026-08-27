import { RichContent } from "@/components/layout/RichContent";
import { Container } from "@/components/layout/Container";

/** Presentational home sections. All copy is resolved for the URL locale on the server. */
/**
 * Tiêu đề khối trang chủ ("Sản phẩm nổi bật", "Tin tức", "Videos"…) — kicker + title đã
 * hardcode (nhóm setting `public_home`, gỡ khỏi Cài đặt admin 2026-07-03). VI render ở server
 * (khớp HTML đầu, không hydration mismatch); EN chỉ swap ở client theo locale hiện tại.
 * `kicker`/`kickerEn` bỏ trống cho khối chỉ có title (Videos).
 */
export function HomeBlockHeading({
  className,
  kicker,
  title,
}: {
  className: string;
  kicker?: string;
  title: string;
}) {
  return (
    <div className={className}>
      {kicker ? (
        <p className="mb-2 font-cta text-home-kicker font-bold text-home-kicker-label">
          <span className="inline-block">{kicker}</span>
        </p>
      ) : null}
      {title ? <h2 className="font-body text-a1-title font-semibold leading-title text-foreground">{title}</h2> : null}
    </div>
  );
}

/** Khối "Giới thiệu BigBike" — tiêu đề phụ + tiêu đề + nội dung HTML (hardcode, xem HomePage). */
export function HomeAboutSection({
  subtitle,
  title,
  html,
}: {
  subtitle: string;
  title: string;
  html: string;
}) {
  return (
    <section className="py-10">
      <Container>
        <div className="mb-10 text-center">
          {subtitle ? (
            <p className="mb-2 font-cta text-home-kicker font-bold text-home-kicker-label">
              <span className="inline-block">{subtitle}</span>
            </p>
          ) : null}
          {title ? <h1 className="font-body text-a1-title font-semibold leading-title text-foreground">{title}</h1> : null}
        </div>
        {html ? (
          <RichContent html={html} className="mx-auto max-w-4xl text-center text-muted-foreground" />
        ) : null}
      </Container>
    </section>
  );
}

/** Tiêu đề khối "Góc trải nghiệm" — tiêu đề phụ + tiêu đề + mô tả (hardcode, xem HomePage). */
export function HomeExperienceHeading({
  subtitle,
  title,
  desc,
}: {
  subtitle: string;
  title: string;
  desc: string;
}) {
  return (
    <Container>
      <div className="pb-10 text-center">
        {subtitle ? (
          <p className="mb-2 font-cta text-home-kicker font-bold text-home-kicker-label">
            <span className="inline-block">{subtitle}</span>
          </p>
        ) : null}
        {title ? <h2 className="font-body text-a1-title font-semibold leading-title text-foreground">{title}</h2> : null}
        {desc ? (
          <p className="mx-auto mt-8 max-w-4xl text-a4-content leading-relaxed text-foreground">{desc}</p>
        ) : null}
      </div>
    </Container>
  );
}

/** Khối nội dung SEO cuối trang chủ (rich HTML hiển thị). */
export function HomeContentBottom({ html }: { html: string }) {
  if (!html) return null;

  return (
    <section data-bb-full-bleed className="bg-secondary py-8">
      <Container>
        <RichContent html={html} />
      </Container>
    </section>
  );
}
