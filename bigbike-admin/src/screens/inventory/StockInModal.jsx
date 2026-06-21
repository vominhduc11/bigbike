import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { Modal } from '../../components/layout'
import { useDebounce } from '../../lib/useDebounce'
import { adjustStock, adjustProductStock, fetchInventory } from '../../lib/adminApi'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { SerialListInput } from './SerialListInput'

export function StockInModal({ item, onSuccess, onClose }) {
  const { t } = useTranslation()
  const [selectedItem, setSelectedItem] = useState(item || null)
  const [showPicker, setShowPicker] = useState(!item)
  const [pickerSearch, setPickerSearch] = useState('')
  const debouncedPickerSearch = useDebounce(pickerSearch, 250)
  const [pickerState, setPickerState] = useState({ status: item ? 'idle' : 'loading', items: [] })
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [serials, setSerials] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [qtyError, setQtyError] = useState('')
  const searchRef = useRef(null)
  const qtyRef = useRef(null)

  useEffect(() => {
    const id = setTimeout(() => {
      if (item) qtyRef.current?.focus()
      else searchRef.current?.focus()
    }, 60)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (item) return undefined

    let active = true
    Promise.resolve().then(() => {
      if (active) setPickerState((s) => ({ ...s, status: 'loading' }))
    })

    fetchInventory({
      q: debouncedPickerSearch,
      stockState: 'ALL',
      page: 1,
      pageSize: 8,
    })
      .then((r) => {
        if (!active) return
        setPickerState({ status: 'success', items: r.items || [] })
      })
      .catch((e) => {
        if (!active) return
        setPickerState({ status: 'error', items: [], error: e.message })
      })

    return () => { active = false }
  }, [item, debouncedPickerSearch])

  function handleSelectVariant(candidate) {
    setSelectedItem(candidate)
    setShowPicker(false)
    setQuantity('')
    setSerials([])
    setFormError('')
    setQtyError('')
    setTimeout(() => qtyRef.current?.focus(), 60)
  }

  function handleChangeVariant() {
    setSelectedItem(null)
    setShowPicker(true)
    setQuantity('')
    setSerials([])
    setFormError('')
    setQtyError('')
    setTimeout(() => searchRef.current?.focus(), 60)
  }

  const isVariantItem = Boolean(selectedItem?.variantId)

  // Kiểm tra riêng ô Số lượng — trả về thông báo lỗi (hoặc '' nếu hợp lệ).
  function validateQty() {
    const qty = parseInt(quantity, 10)
    if (!quantity || isNaN(qty) || qty < 1) {
      return t('inventory.stockIn.errorQtyRequired')
    }
    return ''
  }

  // Lỗi cấp form (không gắn với ô cụ thể) — hiển thị ở chân modal.
  function validateForm() {
    const qty = parseInt(quantity, 10)
    if (!selectedItem?.variantId && !selectedItem?.productId) {
      return t('inventory.stockIn.errorVariantRequired', { defaultValue: 'Vui lòng chọn sản phẩm cần nhập hàng.' })
    }
    if (serials.length > qty) {
      return t('inventory.stockIn.errorSerialCount', { serials: serials.length, qty })
    }
    if (serials.length < qty) {
      return t('inventory.stockIn.errorSerialCountTooFew', { serials: serials.length, qty })
    }
    return ''
  }

  function handleQtyBlur() {
    setQtyError(validateQty())
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const qtyValidationError = validateQty()
    setQtyError(qtyValidationError)
    if (qtyValidationError) {
      setFormError('')
      qtyRef.current?.focus()
      return
    }
    const formValidationError = validateForm()
    if (formValidationError) { setFormError(formValidationError); return }
    setFormError('')
    setSubmitting(true)
    try {
      const qty = parseInt(quantity, 10)
      if (isVariantItem) {
        await adjustStock(selectedItem.variantId, qty, 'IN', note.trim() || undefined, serials)
      } else {
        await adjustProductStock(selectedItem.productId, qty, 'IN', note.trim() || undefined, serials)
      }
      toast.success(t('inventory.stockIn.success', { qty }))
      onSuccess()
    } catch (err) {
      setFormError(err.message || t('inventory.stockIn.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  const variantLabel = selectedItem
    ? [selectedItem.variantName, selectedItem.variantSku].filter(Boolean).join(' · ') || '—'
    : '—'

  return (
    <Modal
      open
      wide
      title={t('inventory.stockIn.title')}
      onClose={submitting ? undefined : onClose}
      actions={
        <>
          {formError && (
            <p role="alert" className="field-error mr-auto flex items-center gap-1">
              <AlertCircle size={14} aria-hidden="true" />
              {formError}
            </p>
          )}
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="stock-in-form" className="bb-btn bb-btn-primary bb-btn-sm" disabled={submitting}>
            {submitting ? t('common.saving') : t('inventory.stockIn.submit')}
          </button>
        </>
      }
    >
        <div>

          {/* Variant picker — shown when no pre-selected item and user hasn't chosen yet */}
          {!item && showPicker && (
            <div className="form-group mb-4">
              <label className="form-label" htmlFor="stock-in-variant-search">
                {t('inventory.stockIn.selectItem', { defaultValue: 'Chọn sản phẩm / biến thể' })}
              </label>
              <Input
                id="stock-in-variant-search"
                ref={searchRef}
                type="search"
                value={pickerSearch}
                onChange={(e) => { setPickerSearch(e.target.value); setFormError('') }}
                placeholder={t('inventory.stockIn.searchPlaceholder', { defaultValue: 'Tìm tên sản phẩm, SKU...' })}
                disabled={submitting}
               />
              <div className="variant-picker-list">
                {pickerState.status === 'loading' && (
                  <div className="p-3 text-muted-foreground">
                    {t('common.loading')}
                  </div>
                )}
                {pickerState.status === 'error' && (
                  <div className="p-3 text-danger">
                    {pickerState.error}
                  </div>
                )}
                {pickerState.status === 'success' && pickerState.items.length === 0 && (
                  <div className="p-3 text-muted-foreground">
                    {t('inventory.stockIn.noItemResults', { defaultValue: 'Không tìm thấy sản phẩm phù hợp.' })}
                  </div>
                )}
                {pickerState.status === 'success' && pickerState.items.map((candidate) => {
                  const isSelected = selectedItem?.variantId === candidate.variantId
                  return (
                    <button
                      key={candidate.variantId || candidate.id}
                      type="button"
                      className={cn('variant-picker-item', isSelected && 'bg-primary/10')}
                      onClick={() => handleSelectVariant(candidate)}
                      disabled={submitting}
                    >
                      <span className="variant-picker-item__name">
                        {candidate.productName || '—'}
                        <span className="variant-picker-item__meta">
                          {candidate.variantId
                            ? ([candidate.variantName, candidate.variantSku].filter(Boolean).join(' · ') || '—')
                            : <em className="italic text-muted-foreground">Không có biến thể</em>
                          }
                        </span>
                      </span>
                      <span className="variant-picker-item__qty">
                        {candidate.quantityOnHand ?? 0}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Selected item summary */}
          {selectedItem && (
            <>
              <div className="variant-summary">
                <div className="variant-summary__info">
                  <div>
                    <span className="text-muted-foreground text-xs">
                      {t('inventory.colProduct')}:{' '}
                    </span>
                    <strong className="variant-summary__product-name">
                      {selectedItem.productName || '—'}
                    </strong>
                  </div>
                  {isVariantItem && (
                    <div>
                      <span className="text-muted-foreground text-xs">
                        {t('inventory.colVariant')}:{' '}
                      </span>
                      <strong>{variantLabel}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground text-xs">
                      {t('inventory.stockIn.currentQty')}:{' '}
                    </span>
                    <strong>{selectedItem.quantityOnHand ?? '—'}</strong>
                  </div>
                </div>
                {!item && (
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary bb-btn-sm"
                    onClick={handleChangeVariant}
                    disabled={submitting}
                  >
                    {t('inventory.stockIn.changeItem', { defaultValue: 'Đổi sản phẩm' })}
                  </button>
                )}
              </div>
              {selectedItem.forceOutOfStock && (
                <Alert tone="warning" size="sm" className="mb-3">
                  <strong>Lưu ý:</strong> Sản phẩm đang bị khoá trạng thái "Hết hàng" (forceOutOfStock). Sau khi nhập hàng, sản phẩm vẫn hiển thị là "Hết hàng" trên website cho đến khi tắt cờ này trong trang chỉnh sửa sản phẩm.
                </Alert>
              )}
            </>
          )}

          {/* Form fields — id links to submit button in footer */}
          <form id="stock-in-form" onSubmit={handleSubmit}>
            <div className="form-group mb-4">
              <label className="form-label" htmlFor="stock-in-qty">
                {t('inventory.stockIn.labelQty')}{' '}
                <span aria-hidden="true" className="text-primary">*</span>
              </label>
              <Input
                id="stock-in-qty"
                ref={qtyRef}
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); setFormError(''); if (qtyError) setQtyError('') }}
                onBlur={handleQtyBlur}
                disabled={submitting}
                placeholder="1"
                aria-invalid={qtyError ? true : undefined}
                aria-describedby={qtyError ? 'stock-in-qty-error' : undefined}
               />
              {qtyError && (
                <p id="stock-in-qty-error" role="alert" className="field-error mt-1 flex items-center gap-1">
                  <AlertCircle size={14} aria-hidden="true" />
                  {qtyError}
                </p>
              )}
            </div>

            <div className="form-group mb-4">
              <label className="form-label" htmlFor="stock-in-note">
                {t('inventory.stockIn.labelNote')}
              </label>
              <Input
                id="stock-in-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting}
                placeholder={t('inventory.stockIn.notePlaceholder')}
               />
            </div>

            <div className="form-group">
              <SerialListInput
                onChange={(next) => { setSerials(next); setFormError('') }}
                disabled={submitting}
                maxCount={parseInt(quantity, 10) || 0}
              />
            </div>
          </form>
        </div>
    </Modal>
  )
}
