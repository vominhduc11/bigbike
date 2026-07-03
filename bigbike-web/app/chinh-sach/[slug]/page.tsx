import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getStaticPage, staticPageSlugs } from "@/lib/content/static-pages";
import { listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { PolicyPageClient } from "@/components/policy/PolicyPageClient";

const POLICY_BASE_PATH = "/chinh-sach";

export async function generateStaticParams() {
  return staticPageSlugs().map((slug) => ({ slug }));
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale, t] = await Promise.all([
    params,
    getLocale(),
    getTranslations("StaticPage"),
  ]);
  const page = getStaticPage(slug, locale);
  if (!page) return {};
  return buildPublicMetadata({
    title: page.seoTitle ?? page.title ?? t("policy.title"),
    description: page.seoDescription ?? t("policy.title"),
    canonicalPath: page.seoCanonicalUrl ?? `${POLICY_BASE_PATH}/${slug}/`,
    noIndex: false,
  });
}

export default async function PolicyPage({ params }: Props) {
  const [{ slug }, locale] = await Promise.all([
    params,
    getLocale(),
  ]);

  const page = getStaticPage(slug, locale);
  if (!page) {
    notFound();
  }

  const settingsResult = await listPublicSettings(locale);

  return (
    <PolicyPageClient
      slug={slug}
      initialPage={page}
      initialSettings={settingsResult?.data ?? []}
    />
  );
}


