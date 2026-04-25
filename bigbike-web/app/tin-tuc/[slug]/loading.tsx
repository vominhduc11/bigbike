import { LoadingGrid } from "@/components/ui/LoadingGrid";

export default function ArticleDetailLoading() {
  return <LoadingGrid title="Đang tải chi tiết bài viết" count={3} />;
}
