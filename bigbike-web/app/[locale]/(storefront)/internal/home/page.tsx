import type { Metadata } from "next";
import HomePage, {
  generateMetadata as generateHomeMetadata,
} from "@/app/[locale]/(storefront)/(home)/page";

type InternalHomePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: InternalHomePageProps): Promise<Metadata> {
  return generateHomeMetadata({ params });
}

export default function InternalHomePage({
  params,
}: InternalHomePageProps) {
  return HomePage({ params });
}
