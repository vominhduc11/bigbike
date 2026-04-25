import { LoadingGrid } from "@/components/ui/LoadingGrid";

export default function ArticleListLoading() {
  return <LoadingGrid title="Đang tải danh sách bài viết" count={6} />;
}

