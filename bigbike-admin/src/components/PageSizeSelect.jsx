import { useTranslation } from 'react-i18next'
import { FilterSelect } from './FilterSelect'
import { persistPageSizePreference } from '../lib/pageSizePreference'

const DEFAULT_OPTIONS = [20, 50, 100]

/**
 * Bộ chọn số dòng/trang dùng chung cho mọi filter bar của list screen.
 * Bọc FilterSelect để giữ một nguồn duy nhất cho nhãn "N / trang" + aria-label,
 * thay vì lặp lại block FilterSelect ở từng màn hình.
 *
 * @param {number} value           pageSize hiện tại
 * @param {(n:number)=>void} onChange  nhận số nguyên (đã ép từ chuỗi)
 * @param {number[]} [options]      danh sách lựa chọn (mặc định 20/50/100)
 */
export function PageSizeSelect({ value, onChange, options = DEFAULT_OPTIONS, disabled, className }) {
  const { t } = useTranslation()
  return (
    <FilterSelect
      value={String(value)}
      onValueChange={(v) => {
        const nextValue = Number(v)
        persistPageSizePreference(nextValue, { options })
        onChange(nextValue)
      }}
      ariaLabel={t('common.rowsPerPage')}
      disabled={disabled}
      className={className}
      options={options.map((n) => ({ value: String(n), label: `${n} / ${t('common.page')}` }))}
    />
  )
}
