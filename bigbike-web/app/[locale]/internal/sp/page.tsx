import type { Metadata } from "next";
import ProductListPage, {
  generateMetadata as generateProductListMetadata,
} from "@/app/[locale]/sp/page";

type InternalProductListPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: InternalProductListPageProps): Promise<Metadata> {
  return generateProductListMetadata({ params });
}

export default function InternalProductListPage({
  params,
}: InternalProductListPageProps) {
  return ProductListPage({ params });
}
