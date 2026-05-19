import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toComparePath } from "@/lib/utils/routes";
import { CompareClient } from "./CompareClient";

// The comparison list lives in the visitor's browser (localStorage), so the
// page has no stable indexable content — keep it out of search results.
export const metadata: Metadata = buildPublicMetadata({
  title: "So sánh sản phẩm",
  description:
    "So sánh thông số kỹ thuật, giá và đánh giá giữa các sản phẩm bảo hộ biker BigBike.",
  canonicalPath: toComparePath(),
  noIndex: true,
});

export default function ComparePage() {
  return <CompareClient />;
}
