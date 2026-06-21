import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'

export function ContentAssignmentBanner() {
  const { t } = useTranslation()
  return (
    <div className="px-4 py-3 bg-surface-muted border-b border-border">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Users size={12} />
        <span>{t('content.detail.assign.title', { defaultValue: 'Phân công bài viết' })}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-primary)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {t('content.detail.assign.roleContent', { defaultValue: 'Content' })}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {t('content.detail.assign.itemsContent', { defaultValue: 'Tiêu đề · Ảnh đại diện · Nội dung chính · Tags & danh mục · Liên kết sản phẩm' })}
          </div>
        </div>
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-status-warning-text)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {t('content.detail.assign.roleSeo', { defaultValue: 'SEO' })}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {t('content.detail.assign.itemsSeo', { defaultValue: 'Tiêu đề SEO · Meta description · Slug · OG image · Kiểm tra trước khi đăng' })}
          </div>
        </div>
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-text-primary)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {t('content.detail.assign.roleManager', { defaultValue: 'Quản lý' })}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {t('content.detail.assign.itemsManager', { defaultValue: 'Phê duyệt · Đăng bài · Ẩn / xóa bài' })}
          </div>
        </div>
      </div>
    </div>
  )
}
