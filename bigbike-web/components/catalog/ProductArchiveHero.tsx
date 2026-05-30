import { PageHero, type PageHeroBreadcrumbItem } from "@/components/layout/PageHero";

export type ProductArchiveBreadcrumbItem = PageHeroBreadcrumbItem;

type ProductArchiveHeroProps = {
  title: string;
  breadcrumb: ProductArchiveBreadcrumbItem[];
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  imageAlt?: string | null;
  illustrationUrl?: string | null;
  illustrationAlt?: string | null;
  defaultBgUrl?: string | null;
  defaultIllustrationUrl?: string | null;
};

export function ProductArchiveHero({
  title,
  breadcrumb,
  imageUrl,
  mobileImageUrl,
  imageAlt,
  illustrationUrl,
  illustrationAlt,
  defaultBgUrl,
  defaultIllustrationUrl,
}: ProductArchiveHeroProps) {
  const illustration = illustrationUrl?.trim()
    ? { src: illustrationUrl, alt: illustrationAlt ?? null }
    : null;

  return (
    <PageHero
      title={title}
      breadcrumb={breadcrumb}
      imageUrl={imageUrl}
      mobileImageUrl={mobileImageUrl}
      imageAlt={imageAlt}
      illustration={illustration}
      defaultBgUrl={defaultBgUrl}
      defaultIllustrationUrl={defaultIllustrationUrl}
    />
  );
}
