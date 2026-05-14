import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/PageHero";
import { PolicySidebar } from "@/components/layout/PolicySidebar";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath } from "@/lib/utils/routes";

// Map URL slug → backend page slug
const POLICY_SLUG_MAP: Record<string, string> = {
  "bao-mat": "chinh-sach-bao-ve-thong-tin-ca-nhan",
  "bao-hanh": "chinh-sach-bao-hanh",
  "doi-tra": "chinh-sach-doi-tra-hang",
  "dieu-khoan": "cac-dieu-kien-va-dieu-khoan",
};

const POLICY_META: Record<string, { title: string; description: string }> = {
  "bao-mat": {
    title: "Chính sách bảo mật thông tin",
    description: "Chính sách bảo vệ thông tin cá nhân khách hàng tại BigBike.",
  },
  "bao-hanh": {
    title: "Chính sách bảo hành",
    description: "Chính sách bảo hành sản phẩm tại BigBike — cam kết bảo hành chính hãng.",
  },
  "doi-tra": {
    title: "Chính sách đổi trả hàng",
    description: "Chính sách đổi trả sản phẩm tại BigBike trong vòng 7 ngày.",
  },
  "dieu-khoan": {
    title: "Điều khoản sử dụng",
    description: "Điều khoản và điều kiện sử dụng dịch vụ BigBike.vn.",
  },
};

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = POLICY_META[slug];
  if (!meta) return {};
  return buildPublicMetadata({
    title: meta.title,
    description: meta.description,
    canonicalPath: `/chinh-sach/${slug}/`,
  });
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const backendSlug = POLICY_SLUG_MAP[slug];
  if (!backendSlug) notFound();

  const result = await getPageBySlug(backendSlug);
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
  const meta = POLICY_META[slug] ?? {};
  const pageTitle = safeText(page.title, meta.title ?? "Chính sách");

  return (
    <section className="bb-page">
      <PageHero
        imageUrl={page.heroImageUrl}
        imageAlt={page.heroImageAlt}
        kicker={page.heroKicker ?? "CHÍNH SÁCH"}
        title={page.heroTitle ?? pageTitle}
        description={page.heroDescription}
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: "Chính sách" },
          { label: pageTitle },
        ]}
      />
      <div className="bb-container grid grid-cols-1 gap-[30px] pt-10 pb-[60px] items-start lg:grid-cols-[3fr_9fr]">
        <PolicySidebar activeHref={`/chinh-sach/${slug}`} title="CHÍNH SÁCH" />
        <div className="min-w-0">
          <article
            className="bb-richtext"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
          />
          <p className="text-muted-foreground text-xs text-right mb-10">Cập nhật {formatDate(page.updatedAt)}</p>
        </div>
      </div>
    </section>
  );
}
