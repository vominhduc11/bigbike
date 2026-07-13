import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { fetchProductAssignment } from '../../lib/adminApi'
import { AssignmentBanner } from '@/components/AssignmentBanner'
import { Button } from '@/components/ui/button'

// Đọc CHUNG 1 nguồn dữ liệu với banner phân công trên product-detail (queryKey/staleTime khớp
// đúng ProductDetailScreen — QueryClientProvider dùng chung toàn app nên 2 màn hình share thẳng
// 1 cache entry, không cần nâng AssignmentConfigContext lên layout chung). Trước đây banner này
// hardcode hoàn toàn qua i18n, không gọi API — nay Super Admin sửa vai trò ở Settings sẽ cập
// nhật đồng thời cả banner sản phẩm lẫn banner bài viết.
export function ContentAssignmentBanner() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['product-assignment'],
    queryFn: fetchProductAssignment,
    staleTime: 5 * 60 * 1000,
  })

  const title = t('content.detail.assign.title', { defaultValue: 'Phân công bài viết' })

  // Trạng thái tải/lỗi hiển thị rõ ràng — trước đây im lặng nên admin dễ hiểu nhầm
  // là "chưa có ai được phân công" trong khi thực chất đang tải hoặc gọi API lỗi.
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted px-4 py-3 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin shrink-0" aria-hidden="true" />
        <span>{t('content.detail.assign.loading', { defaultValue: 'Đang tải thông tin phân công…' })}</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-muted px-4 py-3 text-xs text-[var(--admin-color-status-danger-text)]">
        <AlertCircle size={12} className="shrink-0" aria-hidden="true" />
        <span>{t('content.detail.assign.error', { defaultValue: 'Không tải được thông tin phân công.' })}</span>
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => refetch()}>
          {t('common.retry', { defaultValue: 'Thử lại' })}
        </Button>
      </div>
    )
  }

  return (
    <AssignmentBanner
      title={data?.title || title}
      roles={data?.roles ?? []}
    />
  )
}

export default ContentAssignmentBanner
