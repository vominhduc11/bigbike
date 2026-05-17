import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { WarrantyContent } from "./WarrantyContent";

export const metadata: Metadata = buildPublicMetadata({
  title: "Tra cứu bảo hành",
  description: "Tra cứu thông tin bảo hành sản phẩm BigBike bằng số serial trên tem sản phẩm.",
  canonicalPath: "/bao-hanh/",
  noIndex: false,
});

export default function WarrantyLookupPage() {
  return <WarrantyContent />;
}
