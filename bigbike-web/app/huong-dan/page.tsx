import type { Metadata } from "next";
import { GuidePage } from "./GuidePage";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toPagePath } from "@/lib/utils/routes";

export const metadata: Metadata = buildPublicMetadata({
  title: "Hướng dẫn",
  description: "Hướng dẫn mua hàng, sử dụng sản phẩm và dịch vụ từ BigBike.",
  canonicalPath: toPagePath("huong-dan"),
});

export default async function GuideLandingPage() {
  return await GuidePage({});
}
