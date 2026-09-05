import type { Metadata } from "next";
import ProductListPage, {
  generateMetadata as generateProductListMetadata,
} from "@/app/[locale]/(storefront)/sp/page";
import type { RouteSearchParams } from "@/lib/utils/query";

export const dynamic = "force-dynamic";

type InternalProductListPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<RouteSearchParams>;
};

export async function generateMetadata({
  params,
}: InternalProductListPageProps): Promise<Metadata> {
  return generateProductListMetadata({ params });
}

export default function InternalProductListPage({
  params,
  searchParams,
}: InternalProductListPageProps) {
  return ProductListPage({ params, searchParams });
}
