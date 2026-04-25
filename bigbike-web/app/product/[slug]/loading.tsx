import { LoadingGrid } from "@/components/ui/LoadingGrid";

export default function ProductDetailLoading() {
  return <LoadingGrid title="Đang tải chi tiết sản phẩm" count={4} />;
}

