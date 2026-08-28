import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { AssignmentBanner } from '@/components/AssignmentBanner'
import { Button } from '@/components/ui/button'
import { fetchProductAssignment } from '../../lib/adminApi'
import { queryKeys } from '../../lib/queryKeys'

// Dùng chung query/cache với banner phân công trên màn sản phẩm.
export function ContentAssignmentBanner() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.productAssignment(),
    queryFn: fetchProductAssignment,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-3 text-xs text-muted-foreground"
        role="status"
      >
        <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden="true" />
        <span>{t('content.detail.assign.loading')}</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div
        className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-muted px-4 py-3 text-xs text-danger"
        role="alert"
      >
        <AlertCircle size={12} className="shrink-0" aria-hidden="true" />
        <span>{t('content.detail.assign.error')}</span>
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  return (
    <AssignmentBanner
      title={data?.title || t('content.detail.assign.title')}
      roles={data?.roles ?? []}
    />
  )
}

export default ContentAssignmentBanner
