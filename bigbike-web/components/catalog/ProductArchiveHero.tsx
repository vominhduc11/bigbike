import { PageHero, type PageHeroBreadcrumbItem } from "@/components/layout/PageHero";

export type ProductArchiveBreadcrumbItem = PageHeroBreadcrumbItem;

type ProductArchiveHeroProps = {
  title: string;
  breadcrumb: ProductArchiveBreadcrumbItem[];
  imageUrl?: string | null;
  imageAlt?: string | null;
  illustrationUrl?: string | null;
  illustrationAlt?: string | null;
};

export function ProductArchiveHero({
  title,
  breadcrumb,
  imageUrl,
  imageAlt,
  illustrationUrl,
  illustrationAlt,
}: ProductArchiveHeroProps) {
  const illustration = illustrationUrl?.trim()
    ? { src: illustrationUrl, alt: illustrationAlt ?? null }
    : null;

  return (
    <PageHero
      title={title}
      breadcrumb={breadcrumb}
      imageUrl={imageUrl}
      imageAlt={imageAlt}
      illustration={illustration}
    />
  );
}
