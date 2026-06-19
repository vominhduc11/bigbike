import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn, generateId } from '@/lib/utils'
import { SIZE_COL2_DEFAULT, SIZE_COL3_PLACEHOLDER, SIZE_COL4_PLACEHOLDER } from '@/lib/sizeChart'

/**
 * Bảng size nhập theo DÒNG (giống "Thông số kỹ thuật"), KHÔNG dùng rich-text.
 * Dữ liệu vẫn lưu vào field chuỗi `sizeGuide` dưới dạng <table> HTML để web render
 * thành bảng (web đã có style `.bb-wp-pdp-page .wyswyg table`). Không đổi backend.
 *
 * Model nội bộ: { col2, col3, col4, rows:[{_key,size,value,value3,value4}], note }.
 * Cột 1 luôn "Size"; cột 2 (số đo) luôn có; cột 3 & 4 TÙY CHỌN — chỉ hiện ô nhập khi
 * admin đặt tên cột. Hàm parse/serialize ở `@/lib/sizeChart`; ProductDetailScreen lo load/payload.
 */
export function SizeChartEditor({ value, onChange, disabled, hasError }) {
  const { t } = useTranslation()
  const model = value && typeof value === 'object'
    ? {
        col2: value.col2 ?? SIZE_COL2_DEFAULT,
        col3: value.col3 ?? '',
        col4: value.col4 ?? '',
        rows: value.rows ?? [],
        note: value.note ?? '',
      }
    : { col2: SIZE_COL2_DEFAULT, col3: '', col4: '', rows: [], note: '' }
  const { col2, col3, col4, rows, note } = model

  const showCol3 = (col3 || '').trim().length > 0
  const showCol4 = (col4 || '').trim().length > 0

  const emit = (patch) => onChange?.({ ...model, ...patch })

  function updateRow(index, field, v) {
    emit({ rows: rows.map((r, i) => (i === index ? { ...r, [field]: v } : r)) })
  }
  function addRow() {
    emit({ rows: [...rows, { _key: generateId(), size: '', value: '', value3: '', value4: '' }] })
  }
  function removeRow(index) {
    emit({ rows: rows.filter((_, i) => i !== index) })
  }
  function moveRow(index, dir) {
    const next = [...rows]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    emit({ rows: next })
  }

  return (
    <div className={cn('list-editor', hasError && 'rounded-md border-[1.5px] border-danger-border p-2')}>
      {/* Tên các cột (cột 1 luôn là "Size"). Cột 3 & 4 để trống = ẩn. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
            {t('products.detail.sizeGuide.col2Label', { defaultValue: 'Tên cột số đo' })}
          </span>
          <Input
            className="max-w-[200px]"
            value={col2}
            onChange={(e) => emit({ col2: e.target.value })}
            placeholder={SIZE_COL2_DEFAULT}
            disabled={disabled}
            maxLength={60}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
            {t('products.detail.sizeGuide.col3Label', { defaultValue: 'Tên cột 3 (tùy chọn)' })}
          </span>
          <Input
            className="max-w-[200px]"
            value={col3}
            onChange={(e) => emit({ col3: e.target.value })}
            placeholder={SIZE_COL3_PLACEHOLDER}
            disabled={disabled}
            maxLength={60}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
            {t('products.detail.sizeGuide.col4Label', { defaultValue: 'Tên cột 4 (tùy chọn)' })}
          </span>
          <Input
            className="max-w-[200px]"
            value={col4}
            onChange={(e) => emit({ col4: e.target.value })}
            placeholder={SIZE_COL4_PLACEHOLDER}
            disabled={disabled}
            maxLength={60}
          />
        </label>
      </div>

      {/* Tiêu đề các cột */}
      {rows.length > 0 && (
        <div className="list-editor-row list-editor-row--stack mb-1 items-center">
          <div className="list-editor-reorder invisible">
            <Button variant="outline" size="icon" aria-hidden tabIndex={-1}>▲</Button>
          </div>
          <div className="flex flex-1 gap-2">
            <span className="flex-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Size</span>
            <span className="flex-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {col2.trim() || SIZE_COL2_DEFAULT}
            </span>
            {showCol3 && (
              <span className="flex-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{col3.trim()}</span>
            )}
            {showCol4 && (
              <span className="flex-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{col4.trim()}</span>
            )}
          </div>
          <span className="w-9" />
        </div>
      )}

      {rows.length === 0 && (
        <p className="list-editor-empty">
          {t('products.detail.sizeGuide.empty', { defaultValue: 'Chưa có dòng size nào. Bấm "Thêm size" để tạo bảng.' })}
        </p>
      )}

      {rows.map((row, index) => (
        <div key={row._key} className="list-editor-row list-editor-row--stack items-center">
          <div className="list-editor-reorder">
            <Button variant="outline" size="icon" onClick={() => moveRow(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
            <Button variant="outline" size="icon" onClick={() => moveRow(index, 1)} disabled={disabled || index === rows.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
          </div>
          <div className="flex flex-1 gap-2">
            <Input
              className="flex-1"
              placeholder={t('products.detail.sizeGuide.sizePlaceholder', { defaultValue: 'VD: M' })}
              aria-label="Size"
              value={row.size || ''}
              onChange={(e) => updateRow(index, 'size', e.target.value)}
              disabled={disabled}
              maxLength={40}
            />
            <Input
              className="flex-1"
              placeholder={t('products.detail.sizeGuide.valuePlaceholder', { defaultValue: 'VD: 57 – 58 cm' })}
              aria-label={col2.trim() || SIZE_COL2_DEFAULT}
              value={row.value || ''}
              onChange={(e) => updateRow(index, 'value', e.target.value)}
              disabled={disabled}
              maxLength={120}
            />
            {showCol3 && (
              <Input
                className="flex-1"
                placeholder={t('products.detail.sizeGuide.value3Placeholder', { defaultValue: 'VD: Shell nhỏ (XS–M)' })}
                aria-label={col3.trim()}
                value={row.value3 || ''}
                onChange={(e) => updateRow(index, 'value3', e.target.value)}
                disabled={disabled}
                maxLength={120}
              />
            )}
            {showCol4 && (
              <Input
                className="flex-1"
                placeholder={t('products.detail.sizeGuide.value4Placeholder', { defaultValue: 'VD: Bán chạy nhất' })}
                aria-label={col4.trim()}
                value={row.value4 || ''}
                onChange={(e) => updateRow(index, 'value4', e.target.value)}
                disabled={disabled}
                maxLength={120}
              />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeRow(index)}
            disabled={disabled}
            aria-label={t('products.detail.sizeGuide.removeRow', { defaultValue: 'Xoá dòng' })}
          >
            ✕
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addRow} disabled={disabled} className="mt-1">
        + {t('products.detail.sizeGuide.addRow', { defaultValue: 'Thêm size' })}
      </Button>

      {/* Ghi chú/hướng dẫn đo (tùy chọn, văn bản thường — hiện dưới bảng) */}
      <div className="mt-4">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">
          {t('products.detail.sizeGuide.noteLabel', { defaultValue: 'Ghi chú / hướng dẫn đo (tùy chọn)' })}
        </span>
        <Textarea
          value={note}
          onChange={(e) => emit({ note: e.target.value })}
          placeholder={t('products.detail.sizeGuide.notePlaceholder', { defaultValue: 'VD: Đo vòng đầu nơi rộng nhất; nếu ở giữa 2 size, chọn size lớn hơn.' })}
          disabled={disabled}
          rows={2}
          maxLength={600}
        />
      </div>
    </div>
  )
}
