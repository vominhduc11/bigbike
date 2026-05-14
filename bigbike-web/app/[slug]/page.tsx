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
      title: "Trang không hợp lệ",
      description: "Slug trang không hợp lệ.",
      canonicalPath: toPagePath("invalid"),
      noIndex: true,
    });
  }

  const result = await getPageBySlug(slug);
  if (!result.data) {
    return buildPublicMetadata({
      title: "Không tìm thấy trang",
      description: "Không tìm thấy nội dung trang yêu cầu.",
      canonicalPath: toPagePath(slug),
      noIndex: true,
    });
  }

  const page = result.data;
  return buildPublicMetadata({
    title: page.seo?.title ?? page.title,
    description: page.seo?.description ?? `${page.title} — BigBike.`,
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
          <ErrorState message={result.error?.message ?? "Không tải được nội dung trang."} />
        </div>
      </section>
    );
  }

  const page = result.data;

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <h1>{safeText(page.title, "Nội dung")}</h1>
        </header>

        <article
          className="bb-richtext bb-section"
          dangerouslySetInnerHTML={{
            __html: sanitizeRichHtml(page.body),
          }}
        />
        <p className="text-muted-foreground text-xs mt-4">
          Cập nhật {formatDate(page.updatedAt)}
        </p>
      </div>
    </section>
  );
}
