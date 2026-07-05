import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { fetchProductAssignment } from '../../lib/adminApi'
import { AssignmentBanner } from '@/components/AssignmentBanner'

// Đọc CHUNG 1 nguồn dữ liệu với banner phân công trên product-detail (queryKey/staleTime khớp
// đúng ProductDetailScreen — QueryClientProvider dùng chung toàn app nên 2 màn hình share thẳng
// 1 cache entry, không cần nâng AssignmentConfigContext lên layout chung). Trước đây banner này
// hardcode hoàn toàn qua i18n, không gọi API — nay Super Admin sửa vai trò ở Settings sẽ cập
// nhật đồng thời cả banner sản phẩm lẫn banner bài viết.
export function ContentAssignmentBanner() {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['product-assignment'],
    queryFn: fetchProductAssignment,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <AssignmentBanner
      title={data?.title || t('content.detail.assign.title', { defaultValue: 'Phân công bài viết' })}
      roles={data?.roles ?? []}
    />
  )
}

export default ContentAssignmentBanner
