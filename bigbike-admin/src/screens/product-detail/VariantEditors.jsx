import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { Pencil, Plus } from 'lucide-react'
import {
  createAttributeValue,
  fetchAttributes,
  fetchAttributeValues,
  updateAttribute,
  updateAttributeValueLabel,
} from '../../lib/adminApi'
import { showConfirm } from '../../lib/confirm'
import { normalizeVariantToken, isColorAttributeName } from '../../lib/schemas'
import { Modal } from '../../components/layout'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { generateId } from '@/lib/utils'
import { SortableList, DragHandle } from '../../components/Sortable'
import {
  getVariantColorValue,
  getVariantColorKey,
  cloneGallery,
  hasGalleryImages,
  VARIANTS_FILTER_THRESHOLD,
} from './constants'
import { IconChevronDown, IconChevronUp, GalleryEditor } from './ContentEditors'

// Resolve an attribute from the catalog by matching option name against code or name
function resolveAttr(attributes, optionName) {
  const norm = normalizeVariantToken(optionName)
  return attributes.find(
    (a) => normalizeVariantToken(a.name) === norm || normalizeVariantToken(a.code) === norm,
  ) ?? null
}

// Variant display name is derived automatically from its attribute values
// (Màu/Size/...) — no manual input. Joins in option order, e.g. "Cam - L".
function deriveVariantName(options) {
  return (options || [])
    .filter((o) => (o.value || '').trim())
    .map((o) => o.value.trim())
    .join(' - ')
}

// Rename an attribute's display name. The code/key stays immutable (shown
// read-only) so existing variant options that resolve via the code keep working.
function AttributeRenameModal({ open, onClose, attribute }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // Mounted only while open (see caller), so initialising from the current name
  // is correct on every open — no effect-sync needed.
  const [name, setName] = useState(attribute?.name ?? '')
  const [nameEn, setNameEn] = useState(attribute?.nameEn ?? '')

  const renameMut = useMutation({
    mutationFn: (vars) => updateAttribute(attribute.id, vars),
    onSuccess: () => {
      toast.success(t('products.detail.variant.attrRenamed', { defaultValue: 'Đã đổi tên thuộc tính.' }))
      queryClient.invalidateQueries({ queryKey: ['attributes'] })
      onClose()
    },
    onError: (err) =>
      toast.error(err?.message || t('products.detail.variant.attrSaveError', { defaultValue: 'Không lưu được thuộc tính.' })),
  })

  const trimmed = name.trim()
  const dirty = trimmed && (trimmed !== attribute?.name || nameEn.trim() !== (attribute?.nameEn ?? ''))
  const saveRename = () => renameMut.mutate({ name: trimmed, nameEn: nameEn.trim() })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('products.detail.variant.attrRenameTitle', { defaultValue: 'Đổi tên thuộc tính' })}
      actions={(
        <>
          <Button variant="outline" onClick={onClose}>{t('common.close', { defaultValue: 'Đóng' })}</Button>
          <Button onClick={saveRename} disabled={renameMut.isPending || !dirty}>
            {t('common.save', { defaultValue: 'Lưu' })}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('products.detail.variant.attrNameLabel', { defaultValue: 'Tên hiển thị' })}</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={renameMut.isPending}
            onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !renameMut.isPending) saveRename() }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('products.detail.variant.attrNameEnLabel', { defaultValue: 'Tên hiển thị (Tiếng Anh)' })}</span>
          <Input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            disabled={renameMut.isPending}
            placeholder={t('products.detail.variant.attrEnPlaceholder', { defaultValue: 'Để trống sẽ dùng tên tiếng Việt' })}
            onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !renameMut.isPending) saveRename() }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('products.detail.variant.attrCodeLabel', { defaultValue: 'Mã (không đổi):' })}</span>
          <span className="font-mono">{attribute?.code}</span>
        </div>
      </div>
    </Modal>
  )
}

// One editable row in the colour manager: rename an existing value's label.
// The slug (shown read-only) stays fixed so variant references keep working.
function AttributeValueEditRow({ value, onSave, saving }) {
  const { t } = useTranslation()
  const [label, setLabel] = useState(value.label)
  const [labelEn, setLabelEn] = useState(value.labelEn ?? '')
  const dirty = label.trim() && (label.trim() !== value.label || labelEn.trim() !== (value.labelEn ?? ''))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1"
          disabled={saving}
        />
        <span className="font-mono text-xs text-muted-foreground w-28 shrink-0 truncate" title={value.slug}>
          {value.slug}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSave({ label: label.trim(), labelEn: labelEn.trim() })}
          disabled={saving || !dirty}
        >
          {t('common.save', { defaultValue: 'Lưu' })}
        </Button>
      </div>
      <Input
        value={labelEn}
        onChange={(e) => setLabelEn(e.target.value)}
        disabled={saving}
        placeholder={t('products.detail.variant.valueEnPlaceholder', { defaultValue: 'Tên tiếng Anh (tùy chọn)' })}
      />
    </div>
  )
}

// Modal to add a new colour to the catalog and rename existing ones. Scoped to
// one attribute; on add it auto-selects the new value back into the variant row.
function AttributeValueManagerModal({ open, onClose, attribute, values, onPicked }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [newLabel, setNewLabel] = useState('')
  const [newLabelEn, setNewLabelEn] = useState('')

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['attributeValues', attribute?.id] })

  const createMut = useMutation({
    mutationFn: (vars) => createAttributeValue(attribute.id, vars),
    onSuccess: (created) => {
      toast.success(t('products.detail.variant.colorAdded', { defaultValue: 'Đã thêm màu mới.' }))
      setNewLabel('')
      setNewLabelEn('')
      invalidate()
      if (created?.slug) onPicked?.(created)
    },
    onError: (err) =>
      toast.error(err?.message || t('products.detail.variant.colorSaveError', { defaultValue: 'Không lưu được màu.' })),
  })

  const renameMut = useMutation({
    mutationFn: ({ id, label, labelEn }) => updateAttributeValueLabel(id, { label, labelEn }),
    onSuccess: () => {
      toast.success(t('products.detail.variant.colorRenamed', { defaultValue: 'Đã đổi tên màu.' }))
      invalidate()
    },
    onError: (err) =>
      toast.error(err?.message || t('products.detail.variant.colorSaveError', { defaultValue: 'Không lưu được màu.' })),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={t('products.detail.variant.colorManagerTitle', { defaultValue: 'Quản lý màu' })}
      actions={<Button variant="outline" onClick={onClose}>{t('common.close', { defaultValue: 'Đóng' })}</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('products.detail.variant.colorAddLabel', { defaultValue: 'Thêm màu mới' })}</span>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t('products.detail.variant.colorAddPlaceholder', { defaultValue: 'Ví dụ: Đỏ đô' })}
                onKeyDown={(e) => { if (e.key === 'Enter' && newLabel.trim() && !createMut.isPending) createMut.mutate({ label: newLabel.trim(), labelEn: newLabelEn.trim() }) }}
                className="flex-1"
              />
              <Button onClick={() => createMut.mutate({ label: newLabel.trim(), labelEn: newLabelEn.trim() })} disabled={createMut.isPending || !newLabel.trim()}>
                <Plus size={16} /> {t('products.detail.variant.colorAddButton', { defaultValue: 'Thêm' })}
              </Button>
            </div>
            <Input
              value={newLabelEn}
              onChange={(e) => setNewLabelEn(e.target.value)}
              placeholder={t('products.detail.variant.valueEnPlaceholder', { defaultValue: 'Tên tiếng Anh (tùy chọn)' })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="text-sm font-medium">{t('products.detail.variant.colorListLabel', { defaultValue: 'Đổi tên màu hiện có' })}</span>
          <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto pr-1">
            {values.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('products.detail.variant.colorEmpty', { defaultValue: 'Chưa có màu nào.' })}</p>
            ) : (
              values.map((v) => (
                <AttributeValueEditRow
                  key={v.id}
                  value={v}
                  saving={renameMut.isPending}
                  onSave={(vals) => renameMut.mutate({ id: v.id, ...vals })}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// One variant-attribute row. Extracted so color rows can fetch the attribute's
// catalog values via a hook (hooks can't run inside the parent's .map()).
function VariantOptionRow({ opt, attributes, onUpdate, onRemove, disabled }) {
  const { t } = useTranslation()
  const attr = resolveAttr(attributes, opt.name)
  const isColor = Boolean(attr?.kind === 'color' || isColorAttributeName(opt.name))
  const [managerOpen, setManagerOpen] = useState(false)
  const [renameAttrOpen, setRenameAttrOpen] = useState(false)

  // Catalog values for the selected color attribute (e.g. Đen / Đỏ / Xanh lá).
  const { data: attrValues = [] } = useQuery({
    queryKey: ['attributeValues', attr?.id],
    queryFn: () => fetchAttributeValues(attr.id),
    enabled: isColor && Boolean(attr?.id),
    staleTime: 5 * 60 * 1000,
  })

  // The read API returns the value as a display label ("Đen"), not the stored slug
  // ("den"). Resolve the current value back to a catalog slug so the Select selects the
  // right entry and a re-save round-trips the slug (kept in sync with web color filters).
  const matchedValue = attrValues.find(
    (v) =>
      v.slug === opt.value ||
      v.label === opt.value ||
      normalizeVariantToken(v.slug) === normalizeVariantToken(opt.value) ||
      normalizeVariantToken(v.label) === normalizeVariantToken(opt.value),
  )
  const selectValue = matchedValue ? matchedValue.slug : opt.value

  return (
    <div className="list-editor-row variant-option-row">
      {/* Name — Select from attribute catalog; falls back to text input when catalog not loaded */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 min-w-0">
        {attributes.length > 0 ? (
          <Select
            value={opt.name}
            onValueChange={(val) =>
              onUpdate({
                name: val,
                value: '',
                attributeValueId: null,
              })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('products.detail.variant.optionNamePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {opt.name && !attributes.some((a) => a.name === opt.name) && (
                <SelectItem value={opt.name}>{opt.name}</SelectItem>
              )}
              {attributes.map((a) => (
                <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder={t('products.detail.variant.optionNamePlaceholder')}
            value={opt.name}
            onChange={(e) =>
              onUpdate({
                name: e.target.value,
                value: '',
                attributeValueId: null,
              })
            }
            disabled={disabled}
          />
        )}
        </div>
        {attr?.id && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setRenameAttrOpen(true)}
            disabled={disabled}
            aria-label={t('products.detail.variant.attrRenameTitle', { defaultValue: 'Đổi tên thuộc tính' })}
            title={t('products.detail.variant.attrRenameTitle', { defaultValue: 'Đổi tên thuộc tính' })}
          >
            <Pencil size={15} />
          </Button>
        )}
        {attr?.id && renameAttrOpen && (
          <AttributeRenameModal
            open
            onClose={() => setRenameAttrOpen(false)}
            attribute={attr}
          />
        )}
      </div>

      {/* Value — for color attributes a Select from the catalog colour list
          (sets value + attributeValueId); for other attributes a plain text value. */}
      <div className="flex flex-col gap-1 flex-1">
        {isColor ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Select
                  value={selectValue}
                  onValueChange={(val) => {
                    const picked = attrValues.find((v) => v.slug === val)
                    onUpdate({
                      value: val,
                      attributeValueId: picked?.id || null,
                    })
                  }}
                  disabled={disabled || !attr?.id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('products.detail.variant.optionValuePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectValue && !attrValues.some((v) => v.slug === selectValue) && (
                      <SelectItem value={selectValue}>{opt.value}</SelectItem>
                    )}
                    {attrValues.map((v) => (
                      <SelectItem key={v.id} value={v.slug}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {attr?.id && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setManagerOpen(true)}
                  disabled={disabled}
                  aria-label={t('products.detail.variant.colorManagerTitle', { defaultValue: 'Quản lý màu' })}
                  title={t('products.detail.variant.colorManagerTitle', { defaultValue: 'Quản lý màu' })}
                >
                  <Pencil size={15} />
                </Button>
              )}
            </div>
            {attr?.id && (
              <AttributeValueManagerModal
                open={managerOpen}
                onClose={() => setManagerOpen(false)}
                attribute={attr}
                values={attrValues}
                onPicked={(created) => onUpdate({ value: created.slug, attributeValueId: created.id })}
              />
            )}
          </>
        ) : (
          <Input
            className="flex-1"
            placeholder={t('products.detail.variant.optionValuePlaceholder')}
            value={opt.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            disabled={disabled}
          />
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive"
        onClick={onRemove}
        disabled={disabled}
        aria-label={t('products.detail.variant.removeOption')}
      >
        ✕
      </Button>
    </div>
  )
}

function VariantOptionsEditor({ options, onChange, disabled }) {
  const { t } = useTranslation()

  const { data: attributes = [] } = useQuery({
    queryKey: ['attributes'],
    queryFn: fetchAttributes,
    staleTime: 5 * 60 * 1000,
  })

  function updateOptionFields(i, updates) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...updates } : o)))
  }

  function addOption() {
    onChange([...options, { name: '', value: '', attributeValueId: null }])
  }

  function removeOption(i) {
    onChange(options.filter((_, idx) => idx !== i))
  }

  return (
    <div className="variant-options-editor">
      {options.map((opt, i) => (
        <VariantOptionRow
          key={i}
          opt={opt}
          attributes={attributes}
          onUpdate={(updates) => updateOptionFields(i, updates)}
          onRemove={() => removeOption(i)}
          disabled={disabled}
        />
      ))}
      <Button variant="outline" size="sm" onClick={addOption} disabled={disabled}>
        + {t('products.detail.variant.addOption')}
      </Button>
    </div>
  )
}

function VariantCard({
  variant,
  index,
  expanded,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
  disabled,
  fieldErrors = {},
  sortable,
}) {
  const { t } = useTranslation()
  function updateField(field, value) {
    onChange(variant._key, { [field]: value })
  }

  const label = variant.name.trim() || t('products.detail.variant.defaultLabel', { index: index + 1 })
  const optionSummary = variant.options.filter((o) => o.name && o.value).map((o) => `${o.name}: ${o.value}`).join(', ')
  const hasErrors = Object.keys(fieldErrors).length > 0
  const colorValue = getVariantColorValue(variant)
  const hasColor = Boolean(colorValue)

  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : undefined }}
      className={`variant-card${hasErrors ? ' variant-card--error' : ''}`}
    >
      <div className="variant-card-header">
        <DragHandle
          handleProps={sortable?.handleProps}
          disabled={disabled}
          label={t('products.detail.dragToReorder')}
        />
        {/* Vùng click/Enter/Space để toggle — không bao bọc các nút action */}
        <button
          type="button"
          className="variant-card-toggle-area"
          onClick={() => onToggle(variant._key)}
          aria-expanded={expanded}
        >
          <div className="variant-card-title">
            <span className="variant-card-index">#{index + 1}</span>
            <span>{label}</span>
            {optionSummary && <span className="variant-card-summary">{optionSummary}</span>}
            {hasErrors && <span className="variant-card-error-badge" title={t('products.detail.variant.hasError')}>!</span>}
          </div>
          <span className="variant-card-toggle" aria-hidden="true">{expanded ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        <div className="variant-card-actions">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(variant._key)}
            disabled={disabled}
            aria-label={t('products.detail.variant.duplicate')}
            title={t('products.detail.variant.duplicate')}
          >
            ⎘
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(variant._key)}
            disabled={disabled}
            aria-label={t('products.detail.variant.remove')}
          >
            ✕
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="variant-card-body form-grid">
          <label className="form-field">
            <span>{t('products.detail.variant.sku')}</span>
            <Input
              value={variant.sku}
              onChange={(e) => updateField('sku', e.target.value)}
              disabled={disabled}
              aria-invalid={fieldErrors.sku ? true : undefined}
             />
            {fieldErrors.sku && <small className="field-error" role="alert">{fieldErrors.sku}</small>}
          </label>

          {/* Variant price inputs removed: storefront, cart, and checkout use
              the parent product price regardless of variant, so collecting
              per-variant prices here would silently diverge from what the
              customer sees and pays. */}

          <div className="form-field form-field-wide flex items-center gap-2.5">
            <Switch
              checked={variant.isAvailable}
              onCheckedChange={(checked) => updateField('isAvailable', checked)}
              disabled={disabled}
              aria-label={t('products.detail.variant.isAvailable')}
             />
            <span className={variant.isAvailable ? 'text-success font-medium' : 'text-danger font-medium'}>
              {variant.isAvailable ? t('status.stock.IN_STOCK') : t('status.stock.OUT_OF_STOCK')}
            </span>
          </div>

          <div className="form-field form-field-wide">
            <span className="form-field-label">{t('products.detail.variant.optionsLabel')}</span>
            <VariantOptionsEditor
              options={variant.options}
              onChange={(opts) => updateField('options', opts)}
              disabled={disabled}
            />
            {fieldErrors.options && <small className="field-error" role="alert">{fieldErrors.options}</small>}
          </div>

          <div className="form-field form-field-wide">
            <span className="form-field-label">
              {hasColor
                ? t('products.detail.variant.colorGalleryLabelWithValue', { color: colorValue })
                : t('products.detail.variant.colorGalleryLabel')}
            </span>
            <p className="detail-section-desc mt-0 mb-2">
              {hasColor
                ? t('products.detail.variant.colorGalleryHintWithColor')
                : t('products.detail.variant.colorGalleryHintNoColor')}
            </p>
            {fieldErrors.gallery && <small className="field-error" role="alert">{fieldErrors.gallery}</small>}
            {hasColor && (
              <GalleryEditor
                items={variant.gallery ?? []}
                onChange={(next) => updateField('gallery', next)}
                disabled={disabled}
                validationErrors={fieldErrors}
                allowVideo={false}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function VariantsEditor({ items, onChange, disabled, validationErrors = {}, onOpenMatrixWizard }) {
  const { t } = useTranslation()
  // Single-open accordion: only one card body is expanded at a time. With
  // 50–500 biến thể, having all open at once produces unmanageable scroll.
  const [expandedKey, setExpandedKey] = useState(() => items[0]?._key ?? null)
  const [filter, setFilter] = useState('')

  // ── Auto-expand the card whose validation key surfaces ───────────────
  // Adjusts state during render (not in an Effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // Without this, submit on a card that's collapsed would silently fail to
  // focus the offending input — the input doesn't exist in the DOM yet.
  const errKey = Object.keys(validationErrors).find((k) => k.startsWith('variants.'))
  const [seenErrKey, setSeenErrKey] = useState(errKey)
  if (errKey !== seenErrKey) {
    setSeenErrKey(errKey)
    if (errKey) {
      const m = errKey.match(/^variants\.(\d+)\./)
      if (m) {
        const offending = items[Number(m[1])]
        if (offending?._key) setExpandedKey(offending._key)
      }
    }
  }

  function toggleExpanded(key) {
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  function updateVariant(key, partial) {
    const current = items.find((v) => v._key === key)
    if (!current) return

    let nextCurrent = { ...current, ...partial }
    if (Object.prototype.hasOwnProperty.call(partial, 'options')) {
      nextCurrent = { ...nextCurrent, name: deriveVariantName(nextCurrent.options) }
    }

    if (Object.prototype.hasOwnProperty.call(partial, 'gallery')) {
      const colorKey = getVariantColorKey(nextCurrent)
      const gallery = colorKey ? cloneGallery(partial.gallery) : []
      onChange(items.map((v) => (
        v._key === key || (colorKey && getVariantColorKey(v) === colorKey)
          ? { ...v, ...(v._key === key ? partial : {}), gallery: cloneGallery(gallery) }
          : v
      )))
      return
    }

    if (Object.prototype.hasOwnProperty.call(partial, 'options')) {
      const previousColorKey = getVariantColorKey(current)
      const nextColorKey = getVariantColorKey(nextCurrent)
      if (previousColorKey !== nextColorKey) {
        const applyColorChange = () => {
          const existingColorGallery = nextColorKey
            ? items.find((v) => v._key !== key && getVariantColorKey(v) === nextColorKey && hasGalleryImages(v.gallery))?.gallery
            : []
          onChange(items.map((v) => (
            v._key === key
              ? { ...nextCurrent, gallery: cloneGallery(existingColorGallery || []) }
              : v
          )))
        }
        const hasData = hasGalleryImages(current.gallery)
        if (hasData) {
          showConfirm(
            t('products.detail.variant.changeColorConfirm'),
            t('products.detail.variant.changeColorTitle'),
          ).then((confirmed) => { if (confirmed) applyColorChange() })
          return
        }
        applyColorChange()
        return
      }
    }

    onChange(items.map((v) => v._key === key ? nextCurrent : v))
  }

  function buildEmptyVariant() {
    return {
      _key: generateId(),
      id: '',
      sku: '',
      name: '',
      isAvailable: true,
      options: [],
      gallery: [],
    }
  }

  function addVariant() {
    const created = buildEmptyVariant()
    onChange([...items, created])
    setExpandedKey(created._key)
  }

  function duplicateVariant(key) {
    const idx = items.findIndex((v) => v._key === key)
    if (idx === -1) return
    const original = items[idx]

    // Generate a non-colliding copy SKU: base-COPY, base-COPY-2, base-COPY-3…
    const existingSkus = new Set(items.map((v) => v.sku).filter(Boolean))
    function makeCopySku(sku) {
      if (!sku) return ''
      const base = sku.replace(/-COPY(?:-\d+)?$/, '')
      const candidate = `${base}-COPY`
      if (!existingSkus.has(candidate)) return candidate
      let n = 2
      while (existingSkus.has(`${candidate}-${n}`)) n++
      return `${candidate}-${n}`
    }

    const copy = {
      ...original,
      _key: generateId(),
      id: '',
      sku: makeCopySku(original.sku),
      name: deriveVariantName(original.options),
      options: original.options.map((o) => ({ ...o })),
      gallery: (original.gallery ?? []).map((img) => ({ ...img })),
    }
    const next = [...items.slice(0, idx + 1), copy, ...items.slice(idx + 1)]
    onChange(next)
    setExpandedKey(copy._key)
  }

  async function removeVariant(key) {
    const idx = items.findIndex((v) => v._key === key)
    if (idx === -1) return
    const variant = items[idx]
    const label = variant.name.trim() || t('products.detail.variant.defaultLabel', { index: idx + 1 })
    const confirmed = await showConfirm(
      t('products.detail.variant.removeConfirm', { label }),
      t('products.detail.variant.remove'),
    )
    if (!confirmed) return
    onChange(items.filter((v) => v._key !== key))
    if (expandedKey === key) setExpandedKey(null)
  }

  // ── Filter (rendered only above threshold) ────────────────────────────
  const filterTerm = filter.trim().toLowerCase()
  const visible = filterTerm
    ? items.flatMap((v, originalIdx) => {
        const haystack = [
          v.name,
          v.sku,
          ...v.options.flatMap((o) => [o.name, o.value]),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(filterTerm) ? [{ v, originalIdx }] : []
      })
    : items.map((v, i) => ({ v, originalIdx: i }))

  // Effective expanded key — if the filter hides the user's choice, render
  // as if the first visible card were expanded so the editor isn't "stuck"
  // showing nothing. Done by deriving rather than syncing via Effect.
  const effectiveExpandedKey =
    filterTerm && visible.length > 0 && !visible.some(({ v }) => v._key === expandedKey)
      ? visible[0].v._key
      : expandedKey

  const showFilter = items.length >= VARIANTS_FILTER_THRESHOLD

  return (
    <div className="variants-editor">
      <div className="variants-editor-toolbar">
        {showFilter && (
          <Input
            type="search" className="variants-filter-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('products.detail.variant.filterPlaceholder', { count: items.length })}
            disabled={disabled}
            aria-label={t('products.detail.variant.filterAria')}
           />
        )}
        {showFilter && filterTerm && (
          <span className="variants-filter-status">
            {t('products.detail.variant.filterMatch', { visible: visible.length, total: items.length })}
          </span>
        )}
        {!disabled && onOpenMatrixWizard && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMatrixWizard}
            title={t('products.detail.variant.generateMatrixTitle')}
          >
            ⊞ {t('products.detail.variant.generateMatrix')}
          </Button>
        )}
      </div>

      {filterTerm ? (
        // Đang lọc theo từ khoá: `visible` là tập con với originalIdx lệch khỏi
        // vị trí thật trong `items` — không cho kéo-thả vì sẽ tính sai vị trí.
        visible.map(({ v, originalIdx }) => {
          const prefix = `variants.${originalIdx}.`
          const fieldErrors = Object.fromEntries(
            Object.entries(validationErrors)
              .filter(([k]) => k.startsWith(prefix))
              .map(([k, val]) => [k.slice(prefix.length), val])
          )
          return (
            <VariantCard
              key={v._key}
              variant={v}
              index={originalIdx}
              expanded={effectiveExpandedKey === v._key}
              onToggle={toggleExpanded}
              onChange={updateVariant}
              onRemove={removeVariant}
              onDuplicate={duplicateVariant}
              disabled={disabled}
              fieldErrors={fieldErrors}
            />
          )
        })
      ) : (
        <SortableList
          items={items}
          getId={(v) => v._key}
          onReorder={(next) => onChange(next)}
          disabled={disabled}
          className="list-editor"
          renderItem={(v, sortable, index) => {
            const prefix = `variants.${index}.`
            const fieldErrors = Object.fromEntries(
              Object.entries(validationErrors)
                .filter(([k]) => k.startsWith(prefix))
                .map(([k, val]) => [k.slice(prefix.length), val])
            )
            return (
              <VariantCard
                variant={v}
                index={index}
                expanded={effectiveExpandedKey === v._key}
                onToggle={toggleExpanded}
                onChange={updateVariant}
                onRemove={removeVariant}
                onDuplicate={duplicateVariant}
                disabled={disabled}
                fieldErrors={fieldErrors}
                sortable={sortable}
              />
            )
          }}
        />
      )}

      {filterTerm && visible.length === 0 && (
        <p className="variants-empty">{t('products.detail.variant.filterEmpty', { filter })}</p>
      )}

      <Button variant="outline" size="sm" onClick={addVariant} disabled={disabled}>
        + {t('products.detail.variant.addVariant')}
      </Button>
    </div>
  )
}

// ── Variant matrix wizard ──────────────────────────────────────────────────────

export function VariantMatrixWizard({ onGenerate, onClose }) {
  const { t } = useTranslation()
  const [attributes, setAttributes] = useState([
    { name: t('products.detail.matrix.defaultColor'), values: '' },
    { name: t('products.detail.matrix.defaultSize'), values: '' },
  ])

  function updateAttr(i, field, value) {
    setAttributes((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }
  function addAttr() {
    if (attributes.length >= 5) return
    setAttributes((prev) => [...prev, { name: '', values: '' }])
  }
  function removeAttr(i) {
    setAttributes((prev) => prev.filter((_, idx) => idx !== i))
  }

  const parsed = attributes
    .map((a) => ({ name: a.name.trim(), values: a.values.split(',').map((v) => v.trim()).filter(Boolean) }))
    .filter((a) => a.name && a.values.length > 0)

  const estimatedCount = parsed.length > 0
    ? parsed.reduce((acc, a) => acc * a.values.length, 1)
    : 0

  function cartesian(arrays) {
    return arrays.reduce((acc, arr) => acc.flatMap((x) => arr.map((y) => [...x, y])), [[]])
  }

  const MATRIX_HARD_CAP = 200

  function generate() {
    if (!parsed.length) return
    if (estimatedCount > MATRIX_HARD_CAP) return
    const combos = cartesian(parsed.map((a) => a.values.map((v) => ({ name: a.name, value: v }))))
    const newVariants = combos.map((combo) => ({
      _key: generateId(),
      id: '',
      sku: '',
      name: deriveVariantName(combo),
      isAvailable: true,
      options: combo.map((o) => ({ name: o.name, value: o.value })),
      gallery: [],
    }))
    onGenerate(newVariants)
    onClose()
  }

  const isValid = estimatedCount > 0 && estimatedCount <= MATRIX_HARD_CAP

  return (
    <Modal
      open
      wide
      title={t('products.detail.matrix.title')}
      onClose={onClose}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="button"
            variant={isValid ? 'default' : 'outline'}
            size="sm"
            onClick={generate}
            disabled={!isValid}
          >
            {estimatedCount === 0
              ? t('products.detail.matrix.generateButtonEmpty')
              : t('products.detail.matrix.generateButton', { count: estimatedCount })}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground mb-4">
        {t('products.detail.matrix.description')}
      </p>

      <div className="flex flex-col gap-3 mb-4">
        {attributes.map((attr, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('products.detail.matrix.attributePlaceholder')}
                value={attr.name}
                onChange={(e) => updateAttr(i, 'name', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder={t('products.detail.matrix.valuesPlaceholder')}
                value={attr.values}
                onChange={(e) => updateAttr(i, 'values', e.target.value)}
                className="flex-[2]"
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={() => removeAttr(i)}
                disabled={attributes.length <= 1}
                aria-label={t('products.detail.variant.removeOption')}
              >
                ✕
              </Button>
            </div>
            <p className="text-xs text-muted-foreground ml-0">
              {t('products.detail.matrix.valuesHelp')}
            </p>
            {attr.name.trim() && !attr.values.trim() && (
              <p className="text-xs text-warning">
                {t('products.detail.matrix.rowValuesEmpty')}
              </p>
            )}
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={addAttr}
        disabled={attributes.length >= 5}
      >
        + {t('products.detail.variant.addOption')}
      </Button>

      {estimatedCount > 0 && (
        <p className={`text-sm mt-3 ${estimatedCount > MATRIX_HARD_CAP ? 'text-danger font-medium' : estimatedCount > 50 ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
          {estimatedCount > MATRIX_HARD_CAP
            ? t('products.detail.matrix.estimateHardCap', { count: estimatedCount, cap: MATRIX_HARD_CAP })
            : estimatedCount > 50
              ? t('products.detail.matrix.estimateWarn', { count: estimatedCount })
              : t('products.detail.matrix.estimate', { count: estimatedCount })}
        </p>
      )}
    </Modal>
  )
}
