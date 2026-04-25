import type { Metadata } from "next";
import { GuidePage } from "../GuidePage";
import { buildPublicMetadata } from "@/lib/seo/metadata";

type Props = {
  params: Promise<{ sub: string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sub } = await params;
  const canonicalPath = `/huong-dan/${sub.map((segment) => encodeURIComponent(segment)).join("/")}/`;

  return buildPublicMetadata({
    title: "Hướng dẫn",
    description: "Hướng dẫn mua hàng, sử dụng sản phẩm và dịch vụ từ BigBike.",
    canonicalPath,
    noIndex: false,
  });
}

export default async function GuideSubPage({ params }: Props) {
  const { sub } = await params;
  return await GuidePage({ subSegments: sub });
}
