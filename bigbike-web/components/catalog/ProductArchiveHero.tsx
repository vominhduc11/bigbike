import Image from "next/image";
import Link from "next/link";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";

const DEFAULT_BG = "/wp/page-title-bg.png";
const DEFAULT_ILLUSTRATION = "/wp/mu-bao-hiem.png";

export type ProductArchiveBreadcrumbItem = {
  label: string;
  href?: string;
};

type ProductArchiveHeroProps = {
  title: string;
  breadcrumb: ProductArchiveBreadcrumbItem[];
  imageUrl?: string | null;
  imageAlt?: string | null;
  illustrationUrl?: string | null;
  illustrationAlt?: string | null;
};

function assetUrl(value: string | null | undefined, fallback: string): string {
  const resolved = value?.trim() ? resolveMediaUrl(value.trim()) : null;
  return resolved || fallback;
}

export function ProductArchiveHero({
  title,
  breadcrumb,
  imageUrl,
  imageAlt,
  illustrationUrl,
  illustrationAlt,
}: ProductArchiveHeroProps) {
  const bgSrc = assetUrl(imageUrl, DEFAULT_BG);
  const imgSrc = assetUrl(illustrationUrl, DEFAULT_ILLUSTRATION);

  return (
    <header
      className="page-title bb-archive-hero"
      style={{ backgroundImage: `url(${bgSrc})` }}
      aria-label={safeText(imageAlt, title)}
    >
      <div className="container bb-wp-container">
        <div className="row align-items-center bb-wp-row bb-archive-hero-row">
          <div className="col-md-6 bb-wp-col-md-6 bb-archive-hero-copy">
            <h1>{title}</h1>
            {breadcrumb.length > 0 && (
              <nav className="breadcrumb" aria-label="Breadcrumb">
                <ul>
                  {breadcrumb.map((item, index) => {
                    const isLast = index === breadcrumb.length - 1;
                    return (
                      <li key={`${item.href ?? "current"}-${item.label}`}>
                        {item.href && !isLast ? (
                          <Link href={item.href}>{item.label}</Link>
                        ) : (
                          <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}
          </div>
          <div className="img text-right bb-archive-hero-image" aria-hidden="true">
            <Image
              src={imgSrc}
              alt={safeText(illustrationAlt, "")}
              width={700}
              height={627}
              priority
            />
          </div>
        </div>
      </div>
    </header>
  );
}
