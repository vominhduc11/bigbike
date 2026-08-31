import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { Container } from "@/components/layout/Container";
import { toHomePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { ReviewInvitationOptOutClient } from "./ReviewInvitationOptOutClient";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("ReviewInvitationOptOut");
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function ReviewInvitationOptOutPage({ params }: PageProps) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("ReviewInvitationOptOut");

  return (
    <StaticPageShell
      title={t("title")}
      breadcrumb={[{ label: "Bigbike.vn", href: toHomePath(locale) }, { label: t("title") }]}
    >
      <Container className="pb-12 md:pb-18">
        <ReviewInvitationOptOutClient />
      </Container>
    </StaticPageShell>
  );
}
