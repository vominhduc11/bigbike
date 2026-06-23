import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { getPageBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { safeText } from "@/lib/utils/format";
import { toHomePath, toPagePath } from "@/lib/utils/routes";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("StaticPage")]);
  const pageResult = await getPageBySlug("gioi-thieu", locale);
  const page = pageResult.data;

  return buildPublicMetadata({
    title: page?.seo?.title ?? page?.title ?? t("aboutTitle"),
    description: page?.seo?.description ?? t("aboutDescription"),
    canonicalPath: page?.seo?.canonicalUrl ?? toPagePath("gioi-thieu"),
    noIndex: page?.seo?.noIndex ?? false,
  });
}

export default async function AboutPage() {
  const locale = await getLocale();
  const pageResult = await getPageBySlug("gioi-thieu", locale);
  const page = pageResult.data;
  const pageTitle = safeText(page?.title, "Giới thiệu");

  // Trang Giới thiệu soạn bằng module Nội dung (khối) → web render thẳng thân bài, song ngữ qua
  // LHtml (VI: body, EN: body_en). Nội dung cũ ở settings nhóm public_about được giữ làm bản lưu
  // dự phòng nhưng KHÔNG còn dựng trang nữa (xem migration V270).
  return (
    <LocalizedContentProvider kind="page" slug="gioi-thieu">
      <WpStaticShell
        title={page?.heroTitle ?? pageTitle}
        titleNode={<LText field="title">{page?.heroTitle ?? pageTitle}</LText>}
        heroBgUrl={page?.heroImageUrl}
        breadcrumb={[
          { label: "Bigbike.vn", href: toHomePath() },
          { label: pageTitle, labelNode: <LText field="title">{pageTitle}</LText> },
        ]}
      >
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <LHtml field="body" viHtml={sanitizeRichHtml(page?.body)} className="static-page wyswyg" />
            </div>
          </div>
        </div>
      </WpStaticShell>
    </LocalizedContentProvider>
  );
}
