import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locale";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { ReviewLinkRedirect } from "@/components/analytics/ReviewLinkRedirect";
import { GOOGLE_REVIEW_URL } from "@/lib/review-link";
import { buildPublicMetadata } from "@/lib/seo/metadata";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "GoogleReviewLink" });
  return {
    ...buildPublicMetadata({
      title: t("title"),
      description: t("waiting"),
      canonicalPath: locale === "en" ? "/review/" : "/danh-gia/",
      locale,
      noIndex: true,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function GoogleReviewLinkPage({ params }: PageProps) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "GoogleReviewLink" });
  return (
    <main className="flex flex-1 items-center py-8 md:py-18">
      <Container className="space-y-6 text-center">
        <h1 className="text-2xl font-bold uppercase">{t("title")}</h1>
        <p role="status">{t("waiting")}</p>
        <Button asChild>
          <a href={GOOGLE_REVIEW_URL}>{t("continue")}</a>
        </Button>
        <noscript>
          <meta httpEquiv="refresh" content={`2;url=${GOOGLE_REVIEW_URL}`} />
        </noscript>
        <ReviewLinkRedirect destination={GOOGLE_REVIEW_URL} />
      </Container>
    </main>
  );
}
