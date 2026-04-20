import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toPagePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

type StaticPageDetailProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: StaticPageDetailProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: "Trang khong hop le",
      description: "Slug trang khong hop le.",
      canonicalPath: toPagePath("invalid"),
      noIndex: true,
    });
  }

  const result = await getPageBySlug(slug);
  if (!result.data) {
    return buildPublicMetadata({
      title: "Khong tim thay trang",
      description: "Khong tim thay noi dung trang yeu cau.",
      canonicalPath: toPagePath(slug),
      noIndex: true,
    });
  }

  const page = result.data;
  return buildPublicMetadata({
    title: page.seo?.title ?? page.title,
    description:
      page.seo?.description ??
      `Noi dung static page ${page.slug} theo route legacy /${page.slug}/.`,
    canonicalPath: page.seo?.canonicalUrl ?? toPagePath(page.slug),
    noIndex: page.seo?.noIndex ?? false,
  });
}

export default async function StaticPageDetail({ params }: StaticPageDetailProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const result = await getPageBySlug(slug);
  if (!result.data && result.error?.status === 404) {
    notFound();
  }
  if (!result.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={result.error?.message ?? "Khong tai duoc noi dung page."} />
        </div>
      </section>
    );
  }

  const page = result.data;

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Static Page</p>
          <h1>{safeText(page.title, "Noi dung")}</h1>
          <p className="bb-page-subtitle">
            Trang nay duoc map tu API /api/v1/pages/{'{slug}'} de preserve route legacy.
          </p>
        </header>

        {result.fromFallback ? (
          <p className="bb-status-banner">Dang hien thi du lieu fallback dev cho static page.</p>
        ) : null}

        <div className="bb-metadata">
          <p>
            <strong>Loai trang:</strong> {safeText(page.type, "CUSTOM")}
          </p>
          <p>
            <strong>Ngay cap nhat:</strong> {formatDate(page.updatedAt)}
          </p>
        </div>

        <article
          className="bb-richtext bb-section"
          dangerouslySetInnerHTML={{
            __html: sanitizeRichHtml(page.body),
          }}
        />
      </div>
    </section>
  );
}
