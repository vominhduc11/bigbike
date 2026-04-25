import { LoadingGrid } from "@/components/ui/LoadingGrid";

export default function ProductListLoading() {
  return <LoadingGrid title="Đang tải danh sách sản phẩm" count={8} />;
}

