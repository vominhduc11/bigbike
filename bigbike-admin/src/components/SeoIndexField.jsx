import { useTranslation } from 'react-i18next'
import { EyeOff, Info } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useHasPermission } from '../lib/auth'
import { HelpTooltip } from './HelpTooltip'

/**
 * Ô "Cho Google hiển thị trang này" — dùng chung cho Sản phẩm, Danh mục, Thương hiệu
 * và Tin tức. Rule: BUSINESS_RULES `SEO_RULE_001` (cờ tách riêng VI/EN) và `SEO_RULE_002`
 * (ngưỡng đủ nội dung tiếng Anh).
 *
 * Hai điểm cố ý:
 *
 * 1. **Một ô, theo ngôn ngữ đang chọn.** Form đã có nút chuyển VI/EN và mọi trường khác
 *    (tiêu đề, mô tả…) đều đổi theo nút đó — ô này làm y hệt, thay vì bày hai ô cạnh nhau.
 *    Đang ở tab tiếng Việt thì sửa cờ bản Việt, đang ở tab tiếng Anh thì sửa cờ bản Anh.
 *
 * 2. **Nhãn theo chiều KHẲNG ĐỊNH** ("Cho Google hiển thị") trong khi dữ liệu lưu theo
 *    chiều phủ định (`noIndex`). Giọng văn admin tránh thuật ngữ SEO — người vận hành đọc
 *    "cho Google hiển thị" hiểu ngay, đọc "noindex" thì không.
 *
 * `englishReady = false` → hiện cảnh báo bản tiếng Anh vẫn bị ẩn dù có bật, vì chưa đủ
 * nội dung. Ngưỡng do backend tính (SeoIndexPolicy), đây chỉ dựng lại để báo trước.
 */
export function SeoIndexField({
  noIndexVi,
  noIndexEn,
  isEnLang,
  isReadOnly,
  englishReady = true,
  englishReadyHint,
  onChange,
}) {
  const { t } = useTranslation()
  const hasPermission = useHasPermission()
  // Quyền riêng (V372): tắt một trang khỏi Google là thao tác có thể xoá sổ traffic cả
  // nhánh, nên không đi chung quyền sửa nội dung.
  const canEditIndex = hasPermission('seo.index')
  const disabled = isReadOnly || !canEditIndex

  const noIndex = isEnLang ? Boolean(noIndexEn) : Boolean(noIndexVi)
  const visible = !noIndex
  const blockedByContent = isEnLang && !englishReady

  return (
    <div className="flex flex-col gap-2" data-field="seoIndex">
      <div className="flex items-center gap-1">
        <label className="flex w-fit cursor-pointer items-center gap-3 rounded-[var(--admin-radius-control)] border border-border p-3 text-sm hover:bg-muted">
          <Checkbox
            checked={visible}
            onCheckedChange={(checked) =>
              onChange(isEnLang ? 'seoNoIndexEn' : 'seoNoIndex', checked !== true)
            }
            disabled={disabled}
          />
          <span>
            {isEnLang
              ? t('seoIndex.labelEn', { defaultValue: 'Cho Google hiển thị trang tiếng Anh' })
              : t('seoIndex.labelVi', { defaultValue: 'Cho Google hiển thị trang tiếng Việt' })}
          </span>
        </label>
        <HelpTooltip
          content={t('seoIndex.hint', {
            defaultValue:
              'Tắt thì khách vẫn xem được nếu có sẵn đường dẫn, chỉ không xuất hiện trên kết quả tìm kiếm. Khác với chuyển về Nháp — chuyển Nháp là khách cũng không xem được.',
          })}
        />
      </div>

      {!canEditIndex && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Info size={13} aria-hidden="true" />
          {t('seoIndex.noPermission', {
            defaultValue: 'Tài khoản của bạn không có quyền đổi mục này.',
          })}
        </span>
      )}

      {blockedByContent && (
        <span className="flex items-center gap-1 text-xs text-warning">
          <EyeOff size={13} aria-hidden="true" />
          {englishReadyHint ||
            t('seoIndex.englishNotReady', {
              defaultValue:
                'Bản tiếng Anh chưa đủ nội dung nên vẫn chưa hiển thị trên Google dù đã bật. Bổ sung nội dung tiếng Anh để trang được tính là bản dịch thật.',
            })}
        </span>
      )}
    </div>
  )
}
