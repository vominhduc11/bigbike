import { useState, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { ChevronDown, ChevronUp, Copy, ImageIcon, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createAttribute,
  createAttributeValue,
  deleteAttribute,
  deleteAttributeValue,
  fetchAttributes,
  fetchAttributeValues,
  fetchSizeScaleGroups,
  createSizeScale,
  updateSizeScale,
  deleteSizeScale,
  updateAttribute,
  updateAttributeValueLabel,
} from '../../lib/adminApi'
import { showConfirm } from '../../lib/confirm'
import { normalizeVariantToken, isColorAttributeName } from '../../lib/schemas'
import { Modal, MobileCardList, MobileCard } from '../../components/layout'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '../../components/MoneyInput'
import { parseMoneyInput } from '../../lib/moneyInput'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { generateId } from '@/lib/utils'
import { useMediaAltSync } from '@/lib/useMediaAltSync'
import { SortableList, DragHandle } from '../../components/Sortable'
import { BulkActionBar } from '../../components/BulkActionBar'
import {
  getVariantColorValue,
  getVariantColorKey,
  cloneGallery,
  resolveColorChangeMedia,
  VARIANTS_FILTER_THRESHOLD,
  VARIANTS_RENDER_CAP,
} from './constants'
import { GalleryEditor } from './ContentEditors'
import { MediaPickerModal } from '../../components/MediaPickerModal'
import { MediaRequirementHint } from '../../components/MediaRequirementHint'
import { IMAGE_RECO } from '../../lib/imageRecommendations'
import { parseSizeScaleValues } from './sizeScaleUtils'

// Sentinel value for the "+ Tạo loại thuộc tính mới…" entry appended to the
// attribute-name Select — kept distinct from any real attribute name/code.
const CREATE_NEW_ATTRIBUTE_VALUE = '__create_new_attribute__'

// Resolve an attribute from the catalog by matching option name against code or name
function resolveAttr(attributes, optionName) {
  const norm = normalizeVariantToken(optionName)
  return attributes.find(
    (a) => normalizeVariantToken(a.name) === norm || normalizeVariantToken(a.code) === norm,
  ) ?? null
}

function isSameAttributeSelection(attributes, currentName, nextName) {
  const currentAttr = resolveAttr(attributes, currentName)
  const nextAttr = resolveAttr(attributes, nextName)
  if (currentAttr?.id && nextAttr?.id) return currentAttr.id === nextAttr.id
  if (isColorAttributeName(currentName) && isColorAttributeName(nextName)) return true
  return normalizeVariantToken(currentName) === normalizeVariantToken(nextName)
}

// Variant display name is derived automatically from its attribute values
// (Màu/Size/...) — no manual input. Joins in option order, e.g. "Cam - L".
function deriveVariantName(options) {
  return (options || [])
    .filter((o) => (o.value || '').trim())
    .map((o) => o.value.trim())
    .join(' - ')
}

// Turn an attribute value into an ASCII SKU token: strip Vietnamese diacritics,
// đ→d, drop non-alphanumerics, uppercase. "Đen" → "DEN", "Size M" → "SIZEM".
// Used by the matrix wizard to auto-fill SKUs from a shared prefix so the owner
// no longer has to type a code on every generated row (audit P0-4).
function skuToken(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[đ]/g, 'd')
    .replace(/[Đ]/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

// Rename an attribute's display name. The code/key stays immutable (shown
// read-only) so existing variant options that resolve via the code keep working.
// `onDeleted` fires after a successful delete so the caller can clear the row
// that was pointing at this (now-gone) attribute.
function AttributeRenameModal({ open, onClose, attribute, onDeleted, contentLang }) {
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

  const deleteMut = useMutation({
    mutationFn: () => deleteAttribute(attribute.id),
    onSuccess: () => {
      toast.success(t('products.detail.variant.attrDeleted', { defaultValue: 'Đã xóa loại thuộc tính.' }))
      queryClient.invalidateQueries({ queryKey: ['attributes'] })
      onDeleted?.()
      onClose()
    },
    onError: (err) =>
      toast.error(err?.message || t('products.detail.variant.attrDeleteError', { defaultValue: 'Không xóa được thuộc tính.' })),
  })

  const trimmed = name.trim()
  const dirty = trimmed && (trimmed !== attribute?.name || nameEn.trim() !== (attribute?.nameEn ?? ''))
  const saveRename = () => renameMut.mutate({ name: trimmed, nameEn: nameEn.trim() })
  const busy = renameMut.isPending || deleteMut.isPending

  const handleDelete = async () => {
    const displayName = contentLang === 'en' ? attribute?.nameEn || attribute?.name : attribute?.name
    const confirmed = await showConfirm(
      t('products.detail.variant.attrDeleteConfirm', {
        name: displayName,
        defaultValue: `Xóa hẳn loại thuộc tính "${displayName}" khỏi hệ thống? Không thể hoàn tác.`,
      }),
      t('products.detail.variant.attrDeleteTitle', { defaultValue: 'Xóa loại thuộc tính' }),
    )
    if (confirmed) deleteMut.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('products.detail.variant.attrRenameTitle', { defaultValue: 'Đổi tên thuộc tính' })}
      actions={(
        <>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive mr-auto"
            onClick={handleDelete}
            disabled={busy}
          >
            <Trash2 size={15} /> {t('common.delete', { defaultValue: 'Xóa' })}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.close', { defaultValue: 'Đóng' })}</Button>
          <Button onClick={saveRename} disabled={busy || !dirty}>
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
            disabled={busy}
            onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !busy) saveRename() }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('products.detail.variant.attrNameEnLabel', { defaultValue: 'Tên hiển thị (Tiếng Anh)' })}</span>
          <Input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            disabled={busy}
            placeholder={t('products.detail.variant.attrEnPlaceholder', { defaultValue: 'Để trống sẽ dùng tên tiếng Việt' })}
            onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !busy) saveRename() }}
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

// Create a brand-new attribute type (e.g. "Chất liệu") that doesn't exist yet
// in the shared catalog. Auto-selects the created attribute back into the row.
function CreateAttributeModal({ open, onClose, onCreated }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')

  const createMut = useMutation({
    mutationFn: (vars) => createAttribute(vars),
    onSuccess: (created) => {
      toast.success(t('products.detail.variant.attrCreated', { defaultValue: 'Đã tạo loại thuộc tính mới.' }))
      queryClient.invalidateQueries({ queryKey: ['attributes'] })
      onCreated?.(created)
    },
    onError: (err) =>
      toast.error(err?.message || t('products.detail.variant.attrSaveError', { defaultValue: 'Không lưu được thuộc tính.' })),
  })

  const trimmed = name.trim()
  const submit = () => createMut.mutate({ name: trimmed, nameEn: nameEn.trim() })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('products.detail.variant.attrCreateTitle', { defaultValue: 'Tạo loại thuộc tính mới' })}
      actions={(
        <>
          <Button variant="outline" onClick={onClose} disabled={createMut.isPending}>{t('common.close', { defaultValue: 'Đóng' })}</Button>
          <Button onClick={submit} disabled={createMut.isPending || !trimmed}>
            {t('common.create', { defaultValue: 'Tạo' })}
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
            placeholder={t('products.detail.variant.attrCreatePlaceholder', { defaultValue: 'Ví dụ: Chất liệu' })}
            disabled={createMut.isPending}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && trimmed && !createMut.isPending) submit() }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('products.detail.variant.attrNameEnLabel', { defaultValue: 'Tên hiển thị (Tiếng Anh)' })}</span>
          <Input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            disabled={createMut.isPending}
            placeholder={t('products.detail.variant.attrEnPlaceholder', { defaultValue: 'Để trống sẽ dùng tên tiếng Việt' })}
            onKeyDown={(e) => { if (e.key === 'Enter' && trimmed && !createMut.isPending) submit() }}
          />
        </div>
      </div>
    </Modal>
  )
}

// One editable row in the colour manager: rename an existing value's label,
// or delete it outright (blocked server-side while any variant uses it).
// The slug (shown read-only) stays fixed so variant references keep working.
function AttributeValueEditRow({ value, onSave, onDelete, saving, deleting }) {
  const { t } = useTranslation()
  const [label, setLabel] = useState(value.label)
  const [labelEn, setLabelEn] = useState(value.labelEn ?? '')
  const dirty = label.trim() && (label.trim() !== value.label || labelEn.trim() !== (value.labelEn ?? ''))
  const busy = saving || deleting
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1"
          disabled={busy}
        />
        <span className="font-mono text-xs text-muted-foreground w-28 shrink-0 truncate" title={value.slug}>
          {value.slug}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSave({ label: label.trim(), labelEn: labelEn.trim() })}
          disabled={busy || !dirty}
        >
          {t('common.save', { defaultValue: 'Lưu' })}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive shrink-0"
          onClick={onDelete}
          disabled={busy}
          aria-label={t('common.delete', { defaultValue: 'Xóa' })}
          title={t('common.delete', { defaultValue: 'Xóa' })}
        >
          <Trash2 size={15} />
        </Button>
      </div>
      <Input
        value={labelEn}
        onChange={(e) => setLabelEn(e.target.value)}
        disabled={busy}
        placeholder={t('products.detail.variant.valueEnPlaceholder', { defaultValue: 'Tên tiếng Anh (tùy chọn)' })}
      />
    </div>
  )
}

// Modal to add a new colour to the catalog, rename existing ones, or delete
// one outright. Scoped to one attribute; on add it auto-selects the new value
// back into the variant row. `onValueDeleted` lets the caller clear the row's
// current selection if the deleted value was the one in use there.
function AttributeValueManagerModal({ open, onClose, attribute, values, onPicked, onValueDeleted, contentLang }) {
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

  const deleteMut = useMutation({
    mutationFn: (id) => deleteAttributeValue(id),
    onSuccess: (_, id) => {
      toast.success(t('products.detail.variant.colorDeleted', { defaultValue: 'Đã xóa màu.' }))
      invalidate()
      onValueDeleted?.(id)
    },
    onError: (err) =>
      toast.error(err?.message || t('products.detail.variant.colorDeleteError', { defaultValue: 'Không xóa được màu.' })),
  })

  const handleDelete = async (v) => {
    const displayLabel = contentLang === 'en' ? v.labelEn || v.label : v.label
    const confirmed = await showConfirm(
      t('products.detail.variant.colorDeleteConfirm', {
        label: displayLabel,
        defaultValue: `Xóa hẳn màu "${displayLabel}" khỏi hệ thống? Không thể hoàn tác.`,
      }),
      t('products.detail.variant.colorDeleteTitle', { defaultValue: 'Xóa màu' }),
    )
    if (confirmed) deleteMut.mutate(v.id)
  }

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
                  deleting={deleteMut.isPending && deleteMut.variables === v.id}
                  onSave={(vals) => renameMut.mutate({ id: v.id, ...vals })}
                  onDelete={() => handleDelete(v)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function LegacySizeScaleManagerModal({ open: _open, onClose: _onClose, scales: _scales, contentLang: _contentLang }) {
  return null
}

/*
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['size-scale-groups'],
    queryFn: fetchSizeScaleGroups,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })
  const [selectedScaleId, setSelectedScaleId] = useState('')
  const [draft, setDraft] = useState({ code: '', name: '', nameEn: '', groupId: '', filterNamespace: '', sortOrder: '100' })
  const [newValue, setNewValue] = useState({ valueKey: '', label: '', labelEn: '', subgroupKey: '', subgroupLabel: '', subgroupLabelEn: '', sortOrder: '100' })
  const selectedScale = scales.find((scale) => scale.id === selectedScaleId) || null

  useEffect(() => {
    if (!open) return
    if (selectedScaleId === '__new__') return
    const next = selectedScaleId && scales.some((scale) => scale.id === selectedScaleId)
      ? selectedScaleId
      : scales[0]?.id || ''
    setSelectedScaleId(next)
  }, [open, scales, selectedScaleId])

  useEffect(() => {
    if (!selectedScale) return
    setDraft({
      code: selectedScale.code || '',
      name: selectedScale.name || '',
      nameEn: selectedScale.nameEn || '',
      groupId: selectedScale.group?.id || '',
      filterNamespace: selectedScale.filterNamespace || '',
      sortOrder: String(selectedScale.sortOrder ?? 100),
    })
  }, [selectedScale])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['size-scales'] })
  }
  const createScaleMut = useMutation({
    mutationFn: (input) => createSizeScale(input),
    onSuccess: (created) => {
      toast.success(t('products.detail.sizeScale.created', { defaultValue: 'Đã tạo scale kích cỡ.' }))
      invalidate()
      setSelectedScaleId(created?.id || '')
    },
    onError: (error) => toast.error(error?.message || t('products.detail.sizeScale.saveError', { defaultValue: 'Không lưu được scale kích cỡ.' })),
  })
  const updateScaleMut = useMutation({
    mutationFn: ({ id, input }) => updateSizeScale(id, input),
    onSuccess: () => {
      toast.success(t('products.detail.sizeScale.saved', { defaultValue: 'Đã lưu scale kích cỡ.' }))
      invalidate()
    },
    onError: (error) => toast.error(error?.message || t('products.detail.sizeScale.saveError', { defaultValue: 'Không lưu được scale kích cỡ.' })),
  })
  const deleteScaleMut = useMutation({
    mutationFn: (id) => deleteSizeScale(id),
    onSuccess: () => {
      toast.success(t('products.detail.sizeScale.deleted', { defaultValue: 'Đã xóa scale kích cỡ.' }))
      invalidate()
      setSelectedScaleId('')
    },
    onError: (error) => toast.error(error?.message || t('products.detail.sizeScale.deleteError', { defaultValue: 'Không xóa được scale kích cỡ.' })),
  })
  const createValueMut = useMutation({
    mutationFn: ({ scaleId, input }) => createSizeScaleValue(scaleId, input),
    onSuccess: () => {
      toast.success(t('products.detail.sizeScale.valueCreated', { defaultValue: 'Đã thêm giá trị cỡ.' }))
      setNewValue({ valueKey: '', label: '', labelEn: '', subgroupKey: '', subgroupLabel: '', subgroupLabelEn: '', sortOrder: '100' })
      invalidate()
    },
    onError: (error) => toast.error(error?.message || t('products.detail.sizeScale.saveError', { defaultValue: 'Không lưu được giá trị cỡ.' })),
  })
  const updateValueMut = useMutation({
    mutationFn: ({ id, input }) => updateSizeScaleValue(id, input),
    onSuccess: () => { toast.success(t('products.detail.sizeScale.saved', { defaultValue: 'Đã lưu scale kích cỡ.' })); invalidate() },
    onError: (error) => toast.error(error?.message || t('products.detail.sizeScale.saveError', { defaultValue: 'Không lưu được giá trị cỡ.' })),
  })
  const deleteValueMut = useMutation({
    mutationFn: (id) => deleteSizeScaleValue(id),
    onSuccess: () => { toast.success(t('products.detail.sizeScale.valueDeleted', { defaultValue: 'Đã xóa giá trị cỡ.' })); invalidate() },
    onError: (error) => toast.error(error?.message || t('products.detail.sizeScale.deleteError', { defaultValue: 'Không xóa được giá trị cỡ.' })),
  })

  const scaleInput = {
    ...draft,
    sortOrder: Number(draft.sortOrder) || 100,
    active: true,
  }
  const valueInput = {
    ...newValue,
    sortOrder: Number(newValue.sortOrder) || 100,
    active: true,
  }
  const busy = createScaleMut.isPending || updateScaleMut.isPending || deleteScaleMut.isPending
    || createValueMut.isPending || updateValueMut.isPending || deleteValueMut.isPending

  const createNewScale = () => {
    setSelectedScaleId('__new__')
    setDraft({ code: '', name: '', nameEn: '', groupId: groups[0]?.id || '', filterNamespace: '', sortOrder: '100' })
    setNewValue({ valueKey: '', label: '', labelEn: '', subgroupKey: '', subgroupLabel: '', subgroupLabelEn: '', sortOrder: '100' })
  }
  const saveScale = () => {
    if (!draft.code.trim() || !draft.name.trim() || !draft.nameEn.trim() || !draft.groupId || !draft.filterNamespace.trim()) return
    if (selectedScale) updateScaleMut.mutate({ id: selectedScale.id, input: scaleInput })
    else createScaleMut.mutate(scaleInput)
  }
  const confirmDeleteScale = async () => {
    if (!selectedScale) return
    const ok = await showConfirm(
      t('products.detail.sizeScale.deleteConfirm', { name: selectedScale.name, defaultValue: `Xóa scale "${selectedScale.name}"? Chỉ scale chưa được sản phẩm sử dụng mới xóa được.` }),
      t('products.detail.sizeScale.deleteTitle', { defaultValue: 'Xóa scale kích cỡ' }),
    )
    if (ok) deleteScaleMut.mutate(selectedScale.id)
  }

  const handleClose = () => {
    setSelectedScaleId(selectedScale?.id || '')
    setDraftState({ scaleId: '', name: '', groupId: '', valuesText: '' })
    setValueError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      wide
      title={t('products.detail.sizeScale.managerTitle', { defaultValue: 'Quản lý scale kích cỡ' })}
      description={t('products.detail.sizeScale.managerDescription', { defaultValue: 'Mỗi sản phẩm có option cỡ phải gắn một scale rõ ràng; không dùng suy luận từ số.' })}
      actions={<Button variant="outline" onClick={handleClose}>{t('common.close', { defaultValue: 'Đóng' })}</Button>}
    >
      <div className="grid gap-5 @xl:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t('products.detail.sizeScale.listTitle', { defaultValue: 'Scale hiện có' })}</h3>
            <Button variant="outline" size="sm" onClick={createNewScale} disabled={busy}><Plus size={14} />{t('common.create', { defaultValue: 'Tạo' })}</Button>
          </div>
          {scales.map((scale) => (
            <Button key={scale.id} variant={scale.id === selectedScale?.id ? 'secondary' : 'ghost'} className="h-auto justify-start whitespace-normal text-left" onClick={() => setSelectedScaleId(scale.id)}>
              <span className="min-w-0"><span className="block font-semibold">{contentLang === 'en' ? scale.nameEn || scale.name : scale.name}</span><span className="block font-mono text-xs text-muted-foreground">{scale.code}</span></span>
            </Button>
          ))}
          {!scales.length ? <p className="text-sm text-muted-foreground">{t('products.detail.sizeScale.empty', { defaultValue: 'Chưa có scale kích cỡ.' })}</p> : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-3 @xl:grid-cols-2">
            <label className="text-sm font-medium">{t('products.detail.sizeScale.code', { defaultValue: 'Mã scale' })}<Input value={draft.code} onChange={(e) => setDraft((v) => ({ ...v, code: e.target.value }))} disabled={busy} /></label>
            <label className="text-sm font-medium">{t('products.detail.sizeScale.namespace', { defaultValue: 'Namespace lọc' })}<Input value={draft.filterNamespace} onChange={(e) => setDraft((v) => ({ ...v, filterNamespace: e.target.value }))} disabled={busy} /></label>
            <label className="text-sm font-medium">{t('products.detail.sizeScale.name', { defaultValue: 'Tên tiếng Việt' })}<Input value={draft.name} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} disabled={busy} /></label>
            <label className="text-sm font-medium">{t('products.detail.sizeScale.nameEn', { defaultValue: 'Tên tiếng Anh' })}<Input value={draft.nameEn} onChange={(e) => setDraft((v) => ({ ...v, nameEn: e.target.value }))} disabled={busy} /></label>
            <label className="text-sm font-medium">{t('products.detail.sizeScale.group', { defaultValue: 'Nhóm hiển thị' })}
              <Select value={draft.groupId || '__none__'} onValueChange={(value) => setDraft((v) => ({ ...v, groupId: value === '__none__' ? '' : value }))} disabled={busy || groupsLoading}>
                <SelectTrigger><SelectValue placeholder={t('products.detail.sizeScale.groupPlaceholder', { defaultValue: 'Chọn nhóm' })} /></SelectTrigger>
                <SelectContent><SelectItem value="__none__">{t('products.detail.sizeScale.groupPlaceholder', { defaultValue: 'Chọn nhóm' })}</SelectItem>{groups.map((group) => <SelectItem key={group.id} value={group.id}>{contentLang === 'en' ? group.labelEn || group.label : group.label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="text-sm font-medium">{t('products.detail.sizeScale.sortOrder', { defaultValue: 'Thứ tự' })}<Input type="number" value={draft.sortOrder} onChange={(e) => setDraft((v) => ({ ...v, sortOrder: e.target.value }))} disabled={busy} /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveScale} disabled={busy || !draft.code.trim() || !draft.name.trim() || !draft.nameEn.trim() || !draft.groupId || !draft.filterNamespace.trim()}>{t('common.save', { defaultValue: 'Lưu' })}</Button>
            {selectedScale ? <Button variant="danger" onClick={confirmDeleteScale} disabled={busy}><Trash2 size={14} />{t('common.delete', { defaultValue: 'Xóa' })}</Button> : null}
          </div>

          {selectedScale ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">{t('products.detail.sizeScale.valuesTitle', { defaultValue: 'Giá trị trong scale' })}</h3>
              <div className="grid gap-2 @xl:grid-cols-[minmax(90px,0.6fr)_minmax(120px,1fr)_minmax(120px,1fr)_72px_auto] text-xs font-semibold text-muted-foreground">
                <span>{t('products.detail.sizeScale.valueKey', { defaultValue: 'Mã giá trị' })}</span><span>{t('products.detail.sizeScale.valueLabel', { defaultValue: 'Nhãn tiếng Việt' })}</span><span>{t('products.detail.sizeScale.valueLabelEn', { defaultValue: 'Nhãn tiếng Anh' })}</span><span>{t('products.detail.sizeScale.sortOrder', { defaultValue: 'Thứ tự' })}</span><span />
              </div>
              {(selectedScale.values || []).map((value) => (
                <SizeScaleValueEditRow key={value.id} value={value} saving={updateValueMut.isPending && updateValueMut.variables?.id === value.id} deleting={deleteValueMut.isPending && deleteValueMut.variables === value.id} onSave={(input) => updateValueMut.mutate({ id: value.id, input: { ...input, active: value.active } })} onDelete={() => deleteValueMut.mutate(value.id)} />
              ))}
              <div className="flex flex-col gap-2 border border-dashed border-border p-2">
                <div className="grid gap-2 @xl:grid-cols-[minmax(90px,0.6fr)_minmax(120px,1fr)_minmax(120px,1fr)_72px_auto]">
                <Input value={newValue.valueKey} onChange={(e) => setNewValue((v) => ({ ...v, valueKey: e.target.value }))} placeholder="M" aria-label={t('products.detail.sizeScale.valueKey', { defaultValue: 'Mã giá trị' })} disabled={busy} />
                <Input value={newValue.label} onChange={(e) => setNewValue((v) => ({ ...v, label: e.target.value }))} placeholder="M" aria-label={t('products.detail.sizeScale.valueLabel', { defaultValue: 'Nhãn tiếng Việt' })} disabled={busy} />
                <Input value={newValue.labelEn} onChange={(e) => setNewValue((v) => ({ ...v, labelEn: e.target.value }))} placeholder="M" aria-label={t('products.detail.sizeScale.valueLabelEn', { defaultValue: 'Nhãn tiếng Anh' })} disabled={busy} />
                <Input type="number" value={newValue.sortOrder} onChange={(e) => setNewValue((v) => ({ ...v, sortOrder: e.target.value }))} aria-label={t('products.detail.sizeScale.sortOrder', { defaultValue: 'Thứ tự' })} disabled={busy} />
                <Button variant="outline" size="sm" onClick={() => createValueMut.mutate({ scaleId: selectedScale.id, input: valueInput })} disabled={busy || !newValue.valueKey.trim() || !newValue.label.trim() || !newValue.labelEn.trim()}><Plus size={14} />{t('common.create', { defaultValue: 'Tạo' })}</Button>
                </div>
                <div className="grid gap-2 @xl:grid-cols-3">
                  <Input value={newValue.subgroupKey} onChange={(e) => setNewValue((v) => ({ ...v, subgroupKey: e.target.value }))} placeholder={t('products.detail.sizeScale.subgroupKey', { defaultValue: 'Mã nhóm phụ' })} aria-label={t('products.detail.sizeScale.subgroupKey', { defaultValue: 'Mã nhóm phụ' })} disabled={busy} />
                  <Input value={newValue.subgroupLabel} onChange={(e) => setNewValue((v) => ({ ...v, subgroupLabel: e.target.value }))} placeholder={t('products.detail.sizeScale.subgroupLabel', { defaultValue: 'Tên nhóm phụ tiếng Việt' })} aria-label={t('products.detail.sizeScale.subgroupLabel', { defaultValue: 'Tên nhóm phụ tiếng Việt' })} disabled={busy} />
                  <Input value={newValue.subgroupLabelEn} onChange={(e) => setNewValue((v) => ({ ...v, subgroupLabelEn: e.target.value }))} placeholder={t('products.detail.sizeScale.subgroupLabelEn', { defaultValue: 'Tên nhóm phụ tiếng Anh' })} aria-label={t('products.detail.sizeScale.subgroupLabelEn', { defaultValue: 'Tên nhóm phụ tiếng Anh' })} disabled={busy} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
*/

function SizeScaleManagerModal({ open, onClose, scales, contentLang }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: groups = [], isLoading: groupsLoading, isError: groupsError } = useQuery({
    queryKey: ['size-scale-groups'],
    queryFn: fetchSizeScaleGroups,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })
  const availableScales = Array.isArray(scales) ? scales : []
  const [selectedScaleId, setSelectedScaleId] = useState('')
  const [draftState, setDraftState] = useState({ scaleId: '', name: '', groupId: '', valuesText: '' })
  const [valueError, setValueError] = useState('')
  const effectiveSelectedScaleId = selectedScaleId || availableScales[0]?.id || ''
  const selectedScale = availableScales.find((scale) => scale.id === effectiveSelectedScaleId) || null
  const draft = draftState.scaleId === effectiveSelectedScaleId
    ? draftState
    : selectedScale
      ? {
          scaleId: effectiveSelectedScaleId,
          name: selectedScale.name || '',
          groupId: selectedScale.group?.id || '',
          valuesText: (selectedScale.values || []).map((value) => value.label || value.valueKey).join(', '),
        }
      : draftState

  const draftFromScale = (scale, scaleId = scale?.id || '') => ({
    scaleId,
    name: scale?.name || '',
    groupId: scale?.group?.id || '',
    valuesText: (scale?.values || []).map((value) => value.label || value.valueKey).join(', '),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['size-scales'] })
  const createScaleMut = useMutation({
    mutationFn: (input) => createSizeScale(input),
    onSuccess: (created) => {
      toast.success(t('products.detail.sizeScale.created', { defaultValue: 'Đã tạo scale kích cỡ.' }))
      invalidate()
      setSelectedScaleId(created?.id || '')
      setDraftState(draftFromScale(created))
      setValueError('')
    },
    onError: (error) => {
      const message = error?.details?.find((detail) => detail?.field === 'values')?.message || error?.message
      setValueError(message || '')
      toast.error(message || t('products.detail.sizeScale.saveError', { defaultValue: 'Không lưu được scale kích cỡ.' }))
    },
  })
  const updateScaleMut = useMutation({
    mutationFn: ({ id, input }) => updateSizeScale(id, input),
    onSuccess: (updated) => {
      toast.success(t('products.detail.sizeScale.saved', { defaultValue: 'Đã lưu scale kích cỡ.' }))
      invalidate()
      setDraftState(draftFromScale(updated, effectiveSelectedScaleId))
      setValueError('')
    },
    onError: (error) => {
      const message = error?.details?.find((detail) => detail?.field === 'values')?.message || error?.message
      setValueError(message || '')
      toast.error(message || t('products.detail.sizeScale.saveError', { defaultValue: 'Không lưu được scale kích cỡ.' }))
    },
  })
  const deleteScaleMut = useMutation({
    mutationFn: (id) => deleteSizeScale(id),
    onSuccess: () => {
      toast.success(t('products.detail.sizeScale.deleted', { defaultValue: 'Đã xóa scale kích cỡ.' }))
      invalidate()
      setSelectedScaleId('')
    },
    onError: (error) => toast.error(error?.message || t('products.detail.sizeScale.deleteError', { defaultValue: 'Không xóa được scale kích cỡ.' })),
  })

  const busy = createScaleMut.isPending || updateScaleMut.isPending || deleteScaleMut.isPending
  const createNewScale = () => {
    setSelectedScaleId('__new__')
    setDraftState({ scaleId: '__new__', name: '', groupId: groups[0]?.id || '', valuesText: '' })
    setValueError('')
  }

  const saveScale = () => {
    const name = draft.name.trim()
    const parsed = parseSizeScaleValues(draft.valuesText)
    if (!name || !draft.groupId || !parsed.values.length) {
      setValueError(t('products.detail.sizeScale.invalidValues', { defaultValue: 'Hãy nhập tên, nhóm và ít nhất một cỡ.' }))
      return
    }
    if (parsed.duplicate) {
      setValueError(t('products.detail.sizeScale.duplicateValue', {
        value: parsed.duplicate,
        defaultValue: `Cỡ ${parsed.duplicate} bị lặp lại`,
      }))
      return
    }
    setValueError('')
    const input = { name, groupId: draft.groupId, values: parsed.values }
    if (selectedScale) updateScaleMut.mutate({ id: selectedScale.id, input })
    else createScaleMut.mutate(input)
  }

  const confirmDeleteScale = async () => {
    if (!selectedScale) return
    const ok = await showConfirm(
      t('products.detail.sizeScale.deleteConfirm', { name: selectedScale.name, defaultValue: `Xóa scale "${selectedScale.name}"? Chỉ scale chưa được sản phẩm sử dụng mới xóa được.` }),
      t('products.detail.sizeScale.deleteTitle', { defaultValue: 'Xóa scale kích cỡ' }),
    )
    if (ok) deleteScaleMut.mutate(selectedScale.id)
  }

  const handleClose = () => {
    setSelectedScaleId(selectedScale?.id || '')
    setDraftState({ scaleId: '', name: '', groupId: '', valuesText: '' })
    setValueError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      wide
      title={t('products.detail.sizeScale.managerTitle', { defaultValue: 'Quản lý scale kích cỡ' })}
      description={t('products.detail.sizeScale.managerDescription', { defaultValue: 'Mỗi scale chỉ cần tên, nhóm lọc và danh sách cỡ theo đúng thứ tự.' })}
      actions={<Button variant="outline" onClick={handleClose}>{t('common.close', { defaultValue: 'Đóng' })}</Button>}
    >
      <div className="grid gap-5 @xl:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t('products.detail.sizeScale.listTitle', { defaultValue: 'Scale hiện có' })}</h3>
            <Button variant="outline" size="sm" onClick={createNewScale} disabled={busy}>
              <Plus size={14} />{t('common.create', { defaultValue: 'Tạo' })}
            </Button>
          </div>
          {availableScales.map((scale) => (
            <Button
              key={scale.id}
              variant={scale.id === selectedScale?.id ? 'secondary' : 'ghost'}
              className="h-auto justify-start whitespace-normal text-left"
              onClick={() => { setSelectedScaleId(scale.id); setDraftState(draftFromScale(scale)) }}
              disabled={busy}
            >
              <span className="min-w-0">
                <span className="block font-semibold">{scale.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {contentLang === 'en' ? scale.group?.labelEn || scale.group?.label : scale.group?.label || scale.group?.key}
                </span>
              </span>
            </Button>
          ))}
          {!availableScales.length ? <p className="text-sm text-muted-foreground">{t('products.detail.sizeScale.empty', { defaultValue: 'Chưa có scale kích cỡ.' })}</p> : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {groupsError ? <p className="text-sm text-destructive" role="alert">{t('products.detail.sizeScale.groupsError', { defaultValue: 'Không tải được nhóm lọc.' })}</p> : null}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('products.detail.sizeScale.name', { defaultValue: 'Tên scale' })}
            <Input
              value={draft.name}
              onChange={(e) => setDraftState({ ...draft, scaleId: effectiveSelectedScaleId, name: e.target.value })}
              disabled={busy}
              placeholder={t('products.detail.sizeScale.namePlaceholder', { defaultValue: 'Ví dụ: Cỡ áo nam' })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('products.detail.sizeScale.group', { defaultValue: 'Nhóm lọc' })}
            <Select
              value={draft.groupId || '__none__'}
              onValueChange={(value) => setDraftState({ ...draft, scaleId: effectiveSelectedScaleId, groupId: value === '__none__' ? '' : value })}
              disabled={busy || groupsLoading}
            >
              <SelectTrigger><SelectValue placeholder={t('products.detail.sizeScale.groupPlaceholder', { defaultValue: 'Chọn nhóm' })} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('products.detail.sizeScale.groupPlaceholder', { defaultValue: 'Chọn nhóm' })}</SelectItem>
                {groups.map((group) => <SelectItem key={group.id} value={group.id}>{contentLang === 'en' ? group.labelEn || group.label : group.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('products.detail.sizeScale.valuesLabel', { defaultValue: 'Danh sách cỡ theo thứ tự' })}
            <Textarea
              value={draft.valuesText}
              onChange={(e) => { setDraftState({ ...draft, scaleId: effectiveSelectedScaleId, valuesText: e.target.value }); setValueError('') }}
              disabled={busy}
              rows={5}
              placeholder={t('products.detail.sizeScale.valuesPlaceholder', { defaultValue: 'Ví dụ: XS, S, M, L, XL' })}
              aria-label={t('products.detail.sizeScale.valuesLabel', { defaultValue: 'Danh sách cỡ theo thứ tự' })}
            />
            <span className="text-xs font-normal text-muted-foreground">{t('products.detail.sizeScale.valuesHint', { defaultValue: 'Phân cách bằng dấu phẩy. Thứ tự nhập là thứ tự hiển thị.' })}</span>
          </label>
          {valueError ? <p className="text-sm text-destructive" role="alert">{valueError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveScale} disabled={busy || !draft.name.trim() || !draft.groupId || !draft.valuesText.trim()}>{t('common.save', { defaultValue: 'Lưu' })}</Button>
            {selectedScale ? <Button variant="danger" onClick={confirmDeleteScale} disabled={busy}><Trash2 size={14} />{t('common.delete', { defaultValue: 'Xóa' })}</Button> : null}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// One variant-attribute row. Extracted so color rows can fetch the attribute's
// catalog values via a hook (hooks can't run inside the parent's .map()).
function VariantOptionRow({ opt, attributes, onUpdate, onRemove, disabled, contentLang }) {
  const { t } = useTranslation()
  const attr = resolveAttr(attributes, opt.name)
  const isColor = Boolean(attr?.kind === 'color' || isColorAttributeName(opt.name))
  const [managerOpen, setManagerOpen] = useState(false)
  const [renameAttrOpen, setRenameAttrOpen] = useState(false)
  const [createAttrOpen, setCreateAttrOpen] = useState(false)

  // Catalog values for the selected color attribute (e.g. Đen / Đỏ / Xanh lá).
  const { data: attrValues = [], isError: attrValuesError } = useQuery({
    queryKey: ['attributeValues', attr?.id],
    queryFn: () => fetchAttributeValues(attr.id),
    enabled: isColor && Boolean(attr?.id),
    staleTime: 5 * 60 * 1000,
  })

  // The stored option value is the display label ("Đen"), matching the read API and
  // what the web storefront matches on (variant-match.ts). Resolve it back to the
  // catalog slug purely so the Select can select the right entry by its slug key —
  // the value written on pick stays the label (see onValueChange below).
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
            onValueChange={(val) => {
              // Radix can emit an empty value while synchronizing a controlled Select
              // during mount. Treat that as a no-op; clearing the attribute here also
              // clears the option value and drops the row label to "Biến thể N".
              if (!val) return
              if (val === CREATE_NEW_ATTRIBUTE_VALUE) {
                setCreateAttrOpen(true)
                return
              }
              // Idempotent reselect: picking the same underlying attribute must never
              // wipe value/attributeValueId. Legacy rows can differ only by alias or
              // casing ("màu sắc" vs "Màu sắc"), while Radix may re-emit that value on
              // mount; compare the resolved catalog attribute instead of raw text.
              if (isSameAttributeSelection(attributes, opt.name, val)) return
              onUpdate({
                name: val,
                value: '',
                attributeValueId: null,
              })
            }}
            disabled={disabled}
          >
            <SelectTrigger aria-label={t('products.detail.variant.optionNameLabel', { defaultValue: 'Tên thuộc tính' })}>
              <SelectValue placeholder={t('products.detail.variant.optionNamePlaceholder')}>
                {opt.name ? (contentLang === 'en' ? (resolveAttr(attributes, opt.name)?.nameEn || opt.name) : (resolveAttr(attributes, opt.name)?.name || opt.name)) : ''}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {opt.name && !attributes.some((a) => a.name === opt.name) && (
                <SelectItem value={opt.name}>{contentLang === 'en' ? opt.nameEn || opt.name : opt.name}</SelectItem>
              )}
              {attributes.map((a) => (
                <SelectItem key={a.id} value={a.name}>{contentLang === 'en' ? a.nameEn || a.name : a.name}</SelectItem>
              ))}
              <SelectItem value={CREATE_NEW_ATTRIBUTE_VALUE}>
                + {t('products.detail.variant.attrCreateTitle', { defaultValue: 'Tạo loại thuộc tính mới' })}
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder={t('products.detail.variant.optionNamePlaceholder')}
            aria-label={t('products.detail.variant.optionNameLabel', { defaultValue: 'Tên thuộc tính' })}
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
            onDeleted={() => onUpdate({ name: '', value: '', attributeValueId: null })}
            contentLang={contentLang}
          />
        )}
        {createAttrOpen && (
          <CreateAttributeModal
            open
            onClose={() => setCreateAttrOpen(false)}
            onCreated={(created) => {
              onUpdate({ name: created.name, value: '', attributeValueId: null })
              setCreateAttrOpen(false)
            }}
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
                    // Same controlled-Select mount guard as the attribute name field:
                    // an empty emission is not a user choice and must not clear color.
                    if (!val) return
                    // The Select item key is the slug (stable), but the stored
                    // option value must be the human display LABEL — the web
                    // storefront matches variants by normalized label, not slug
                    // (bigbike-web/lib/utils/variant-match.ts getOptionValue), and
                    // the derived variant name reads this value. Storing the slug
                    // here surfaced legacy WP slugs (e.g. "e3-denhongblackpink")
                    // as the variant name and broke web color matching. The
                    // attributeValueId keeps the stable catalog reference.
                    const picked = attrValues.find((v) => v.slug === val)
                    const nextValue = picked?.label || val
                    const nextId = picked?.id || null
                    // Idempotent reselect: don't emit (and dirty the form) when the
                    // resolved value + id already match what's stored.
                    if (nextValue === opt.value && nextId === (opt.attributeValueId || null)) return
                    onUpdate({
                      value: nextValue,
                      attributeValueId: nextId,
                    })
                  }}
                  disabled={disabled || !attr?.id}
                >
                  <SelectTrigger aria-label={t('products.detail.variant.optionValueLabel', { defaultValue: 'Giá trị thuộc tính' })}>
                    <SelectValue placeholder={t('products.detail.variant.optionValuePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectValue && !attrValues.some((v) => v.slug === selectValue) && (
                      <SelectItem value={selectValue}>{contentLang === 'en' ? opt.valueEn || opt.value : opt.value}</SelectItem>
                    )}
                    {attrValues.map((v) => (
                      <SelectItem key={v.id} value={v.slug}>{contentLang === 'en' ? v.labelEn || v.label : v.label}</SelectItem>
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
            {attrValuesError && (
              <small className="field-error" role="alert">
                {t('products.detail.variant.colorLoadError', { defaultValue: 'Không tải được danh sách màu. Vui lòng thử tải lại trang.' })}
              </small>
            )}
            {attr?.id && (
              <AttributeValueManagerModal
                open={managerOpen}
                onClose={() => setManagerOpen(false)}
                attribute={attr}
                values={attrValues}
                onPicked={(created) => onUpdate({ value: created.label || created.slug, attributeValueId: created.id })}
                onValueDeleted={(deletedId) => {
                  if (deletedId === matchedValue?.id) onUpdate({ value: '', attributeValueId: null })
                }}
                contentLang={contentLang}
              />
            )}
          </>
        ) : (
          <Input
            className="flex-1"
            placeholder={t('products.detail.variant.optionValuePlaceholder')}
            aria-label={t('products.detail.variant.optionValueLabel', { defaultValue: 'Giá trị thuộc tính' })}
            value={opt.value}
            onChange={(e) => onUpdate({ value: e.target.value, attributeValueId: null })}
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
        <X size={14} aria-hidden="true" />
      </Button>
    </div>
  )
}

function VariantOptionsEditor({ options, onChange, disabled, contentLang }) {
  const { t } = useTranslation()

  const { data: attributes = [], isError: attributesError } = useQuery({
    queryKey: ['attributes'],
    queryFn: fetchAttributes,
    staleTime: 5 * 60 * 1000,
  })

  function updateOptionFields(i, updates) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...updates } : o)))
  }

  function addOption() {
    onChange([...options, { _key: generateId(), name: '', value: '', attributeValueId: null }])
  }

  function removeOption(i) {
    onChange(options.filter((_, idx) => idx !== i))
  }

  return (
    <div className="variant-options-editor">
      {attributesError && (
        <p className="field-error" role="alert">
          {t('products.detail.variant.attrLoadError', { defaultValue: 'Không tải được danh sách thuộc tính. Bạn vẫn có thể nhập tay tên và giá trị bên dưới.' })}
        </p>
      )}
      {options.map((opt, i) => (
        <VariantOptionRow
          key={opt._key ?? i}
          opt={opt}
          attributes={attributes}
          onUpdate={(updates) => updateOptionFields(i, updates)}
          onRemove={() => removeOption(i)}
          disabled={disabled}
          contentLang={contentLang}
        />
      ))}
      <Button variant="outline" size="sm" onClick={addOption} disabled={disabled}>
        + {t('products.detail.variant.addOption')}
      </Button>
    </div>
  )
}

function getVariantRowErrorLabels(fieldErrors, t) {
  const labels = []
  const entries = Object.entries(fieldErrors)

  if (fieldErrors.sku) {
    labels.push(
      fieldErrors.sku === t('products.detail.errVariantSkuDuplicate')
        ? t('products.detail.variant.rowErrorDuplicateSku')
        : t('products.detail.variant.rowErrorMissingSku'),
    )
  }
  if (fieldErrors.retailPrice) {
    labels.push(
      fieldErrors.retailPrice === t('products.detail.variant.errRetailPriceRequired')
        ? t('products.detail.variant.rowErrorMissingPrice')
        : t('products.detail.variant.rowErrorInvalidPrice'),
    )
  }
  if (fieldErrors.salePrice) labels.push(t('products.detail.variant.rowErrorInvalidSalePrice'))
  if (entries.some(([key]) => key === 'options' || key.startsWith('options.'))) {
    labels.push(t('products.detail.variant.rowErrorOptions'))
  }
  if (entries.some(([key]) => key === 'imageUrl' || key.startsWith('gallery'))) {
    labels.push(t('products.detail.variant.rowErrorImage'))
  }

  const knownPrefixes = ['sku', 'retailPrice', 'salePrice', 'options', 'imageUrl', 'gallery']
  entries.forEach(([key, message]) => {
    if (!knownPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`))) {
      labels.push(message)
    }
  })

  return [...new Set(labels.filter(Boolean))]
}

// Panel chi tiết của một biến thể (thuộc tính + ảnh theo màu) — dùng chung cho hàng bảng
// (desktop, khi mở rộng) và thẻ trên mobile để không lặp lại markup/logic.
function VariantDetailFields({ variant, onChange, disabled, fieldErrors = {}, contentLang, label }) {
  const { t } = useTranslation()
  const { pickAlt } = useMediaAltSync()
  const [pickerOpen, setPickerOpen] = useState(false)
  const updateField = (field, value) => onChange(variant._key, { [field]: value })
  const colorValue = getVariantColorValue(variant)
  const hasColor = Boolean(colorValue)

  return (
    <>
      <div className="grid gap-6 @xl:grid-cols-2">
        <div className="space-y-2">
          <span className="form-field-label">{t('products.detail.variant.optionsLabel')}</span>
          <VariantOptionsEditor
            options={variant.options}
            onChange={(opts) => updateField('options', opts)}
            disabled={disabled}
            contentLang={contentLang}
          />
          {Object.entries(fieldErrors)
            .filter(([key]) => key === 'options' || key.startsWith('options.'))
            .map(([key, error]) => <small key={key} className="field-error" role="alert">{error}</small>)}
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <span className="form-field-label">
              {hasColor
                ? t('products.detail.variant.colorGalleryLabelWithValue', { color: colorValue })
                : t('products.detail.variant.colorGalleryLabel')}
            </span>
            <p className="detail-section-desc m-0">
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

          {hasColor && (
            <div className="space-y-2">
              <span className="form-field-label">{t('products.detail.variant.colorRepresentationImageLabel')}</span>
              <p className="detail-section-desc m-0">
                {t('products.detail.variant.colorRepresentationImageHint')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  disabled={disabled}
                >
                  {variant.imageUrl ? t('imageInput.changeImage') : t('imageInput.pickFromLibrary')}
                </Button>
                {variant.imageUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger-bg"
                    onClick={() => {
                      onChange(variant._key, {
                        imageUrl: '',
                        imageAlt: '',
                        imageWidth: null,
                        imageHeight: null,
                        imageMimeType: null,
                      })
                    }}
                    disabled={disabled}
                  >
                    {t('imageInput.removeImage')}
                  </Button>
                )}
              </div>
              <MediaRequirementHint recommend={IMAGE_RECO.productImage} />
              {fieldErrors.imageUrl && <small className="field-error" role="alert">{fieldErrors.imageUrl}</small>}
              {variant.imageUrl && (
                <img
                  src={variant.imageUrl}
                  alt={variant.imageAlt || label}
                  className="max-h-40 rounded-[var(--admin-radius-thumb)] border border-border object-contain"
                />
              )}
            </div>
          )}
        </div>
      </div>
      {pickerOpen && (
        <MediaPickerModal
          recommend={IMAGE_RECO.productImage}
          kind="image"
          onSelect={(url, media) => {
            onChange(variant._key, {
              imageUrl: url,
              imageAlt: pickAlt(variant.imageAlt, media),
              imageWidth: media?.width ?? null,
              imageHeight: media?.height ?? null,
              imageMimeType: media?.mimeType ?? null,
            })
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  )
}

function VariantRow({
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
  contentLang,
  selected,
  onSelect,
}) {
  const { t } = useTranslation()

  function updateField(field, value) {
    onChange(variant._key, { [field]: value })
  }

  const label = (variant.name || '').trim() || t('products.detail.variant.defaultLabel', { index: index + 1 })
  const optionSummary = (variant.options || []).filter((o) => o.name && o.value).map((o) => `${o.name}: ${o.value}`).join(', ')
  const errorLabels = getVariantRowErrorLabels(fieldErrors, t)
  const hasErrors = errorLabels.length > 0
  const galleryImage = (variant.gallery || []).find((item) => item.mediaType !== 'video' && item.url)
  const thumbnailUrl = variant.imageUrl || galleryImage?.url || ''

  function stopRowToggle(event) {
    event.stopPropagation()
  }

  return (
    <>
      <TableRow
        ref={sortable?.setNodeRef}
        style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : undefined }}
        className={hasErrors ? 'border-danger bg-danger-bg/40' : undefined}
        data-state={selected ? 'selected' : undefined}
        onClick={() => onToggle(variant._key)}
      >
        <TableCell className="w-10 px-1" onClick={stopRowToggle}>
          <DragHandle
            handleProps={sortable?.handleProps}
            disabled={disabled || !sortable}
            label={t('products.detail.dragToReorder')}
          />
        </TableCell>
        <TableCell className="w-10 px-2" onClick={stopRowToggle}>
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(variant._key, checked === true)}
            disabled={disabled}
            aria-label={t('products.detail.variant.selectRow', { label })}
          />
        </TableCell>
        <TableCell className="w-16">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={variant.imageAlt || label}
              className="h-12 w-12 rounded-[var(--admin-radius-thumb)] border border-border object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-[var(--admin-radius-thumb)] border border-dashed border-border bg-surface-muted text-muted-foreground">
              <ImageIcon className="size-5" aria-hidden="true" />
            </span>
          )}
        </TableCell>
        <TableCell className="min-w-52">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-start p-0 text-left font-normal hover:bg-transparent"
            onClick={(event) => {
              stopRowToggle(event)
              onToggle(variant._key)
            }}
            aria-expanded={expanded}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span className="text-xs font-normal text-muted-foreground">#{index + 1}</span>
                <span className="truncate">{label}</span>
              </span>
              {optionSummary && <span className="mt-1 block text-xs text-muted-foreground">{optionSummary}</span>}
              {hasErrors && (
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-danger" role="alert">
                  {errorLabels.map((error) => <span key={error}>{error}</span>)}
                </span>
              )}
            </span>
            {expanded ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
          </Button>
        </TableCell>
        <TableCell className="min-w-36" onClick={stopRowToggle}>
          <Input
            value={variant.sku}
            onChange={(event) => updateField('sku', event.target.value)}
            disabled={disabled}
            aria-label={t('products.detail.variant.sku')}
            aria-invalid={fieldErrors.sku ? true : undefined}
            className="font-mono"
          />
          {fieldErrors.sku && <small className="mt-1 block text-xs text-danger" role="alert">{fieldErrors.sku}</small>}
        </TableCell>
        <TableCell className="min-w-36" onClick={stopRowToggle}>
          <MoneyInput
            value={variant.retailPrice}
            onValueChange={(value) => updateField('retailPrice', value)}
            disabled={disabled}
            aria-label={t('products.detail.variant.retailPrice')}
            aria-invalid={fieldErrors.retailPrice ? true : undefined}
          />
          {fieldErrors.retailPrice && <small className="mt-1 block text-xs text-danger" role="alert">{fieldErrors.retailPrice}</small>}
        </TableCell>
        <TableCell className="min-w-36" onClick={stopRowToggle}>
          <MoneyInput
            value={variant.salePrice}
            onValueChange={(value) => updateField('salePrice', value)}
            zeroAsEmpty
            disabled={disabled}
            aria-label={t('products.detail.variant.salePrice')}
            aria-invalid={fieldErrors.salePrice ? true : undefined}
          />
          {fieldErrors.salePrice && <small className="mt-1 block text-xs text-danger" role="alert">{fieldErrors.salePrice}</small>}
        </TableCell>
        <TableCell className="min-w-32" onClick={stopRowToggle}>
          <div className="flex items-center gap-2">
            <Switch
              checked={variant.isAvailable}
              onCheckedChange={(checked) => updateField('isAvailable', checked)}
              disabled={disabled}
              aria-label={t('products.detail.variant.isAvailable')}
            />
            <span className={variant.isAvailable ? 'text-xs font-medium text-success' : 'text-xs font-medium text-danger'}>
              {variant.isAvailable ? t('status.stock.IN_STOCK') : t('status.stock.OUT_OF_STOCK')}
            </span>
          </div>
        </TableCell>
        <TableCell className="w-12" onClick={stopRowToggle}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={t('products.detail.variant.actions', { label })}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onDuplicate(variant._key)}>
                <Copy aria-hidden="true" />
                {t('products.detail.variant.duplicate')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onRemove(variant._key)}
              >
                <Trash2 aria-hidden="true" />
                {t('products.detail.variant.remove')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-surface-muted hover:bg-surface-muted">
          <TableCell colSpan={9} className="border-b border-border p-5">
            <VariantDetailFields
              variant={variant}
              onChange={onChange}
              disabled={disabled}
              fieldErrors={fieldErrors}
              contentLang={contentLang}
              label={label}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// Thẻ biến thể cho màn hình hẹp (mobile) — bảng 9 cột không xem/sửa tốt trên điện thoại.
// Giữ đủ mã SKU, giá niêm yết/khuyến mãi, tình trạng, ảnh và (khi mở) thuộc tính + ảnh theo màu.
function VariantMobileCard({
  variant, index, expanded, onToggle, onChange, onRemove, onDuplicate,
  disabled, fieldErrors = {}, contentLang, selected, onSelect,
}) {
  const { t } = useTranslation()
  const updateField = (field, value) => onChange(variant._key, { [field]: value })
  const label = (variant.name || '').trim() || t('products.detail.variant.defaultLabel', { index: index + 1 })
  const optionSummary = (variant.options || []).filter((o) => o.name && o.value).map((o) => `${o.name}: ${o.value}`).join(', ')
  const errorLabels = getVariantRowErrorLabels(fieldErrors, t)
  const galleryImage = (variant.gallery || []).find((item) => item.mediaType !== 'video' && item.url)
  const thumbnailUrl = variant.imageUrl || galleryImage?.url || ''

  const thumb = thumbnailUrl ? (
    <img src={thumbnailUrl} alt="" className="h-9 w-9 shrink-0 rounded-[var(--admin-radius-thumb)] border border-border object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-thumb)] border border-dashed border-border text-muted-foreground">
      <ImageIcon className="size-4" aria-hidden="true" />
    </span>
  )

  return (
    <Fragment>
      <MobileCard
        selectable
        selected={selected}
        onSelectChange={(checked) => onSelect(variant._key, checked === true)}
        title={(
          <span className="flex items-center gap-2">
            {thumb}
            <span className="min-w-0">
              <span className="text-xs font-normal text-muted-foreground">#{index + 1}</span>{' '}
              {label}
            </span>
          </span>
        )}
        subtitle={(optionSummary || errorLabels.length > 0) ? (
          <>
            {optionSummary}
            {errorLabels.length > 0 && (
              <span className="mt-1 block font-medium text-danger" role="alert">{errorLabels.join(' · ')}</span>
            )}
          </>
        ) : undefined}
        status={(
          <span className="flex items-center gap-2">
            <Switch
              checked={variant.isAvailable}
              onCheckedChange={(checked) => updateField('isAvailable', checked)}
              disabled={disabled}
              aria-label={t('products.detail.variant.isAvailable')}
            />
            <span className={variant.isAvailable ? 'text-xs font-medium text-success' : 'text-xs font-medium text-danger'}>
              {variant.isAvailable ? t('status.stock.IN_STOCK') : t('status.stock.OUT_OF_STOCK')}
            </span>
          </span>
        )}
        meta={[
          {
            label: t('products.detail.variant.columnSku'),
            value: (
              <Input
                value={variant.sku}
                onChange={(event) => updateField('sku', event.target.value)}
                disabled={disabled}
                aria-label={t('products.detail.variant.sku')}
                aria-invalid={fieldErrors.sku ? true : undefined}
                className="font-mono"
              />
            ),
          },
          {
            label: t('products.detail.variant.columnRetailPrice'),
            value: (
              <MoneyInput
                value={variant.retailPrice}
                onValueChange={(value) => updateField('retailPrice', value)}
                disabled={disabled}
                aria-label={t('products.detail.variant.retailPrice')}
                aria-invalid={fieldErrors.retailPrice ? true : undefined}
              />
            ),
          },
          {
            label: t('products.detail.variant.columnSalePrice'),
            value: (
              <MoneyInput
                value={variant.salePrice}
                onValueChange={(value) => updateField('salePrice', value)}
                zeroAsEmpty
                disabled={disabled}
                aria-label={t('products.detail.variant.salePrice')}
                aria-invalid={fieldErrors.salePrice ? true : undefined}
              />
            ),
          },
        ]}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => onToggle(variant._key)} aria-expanded={expanded}>
              {expanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
              {expanded
                ? t('products.detail.variant.collapseDetails', { defaultValue: 'Thu gọn' })
                : t('products.detail.variant.editDetails', { defaultValue: 'Sửa chi tiết' })}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDuplicate(variant._key)} disabled={disabled}>
              <Copy className="size-4" aria-hidden="true" />
              {t('products.detail.variant.duplicate')}
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onRemove(variant._key)} disabled={disabled}>
              <Trash2 className="size-4" aria-hidden="true" />
              {t('products.detail.variant.remove')}
            </Button>
          </>
        )}
      />
      {expanded && (
        <li className="mobile-card">
          <VariantDetailFields
            variant={variant}
            onChange={onChange}
            disabled={disabled}
            fieldErrors={fieldErrors}
            contentLang={contentLang}
            label={label}
          />
        </li>
      )}
    </Fragment>
  )
}

export function VariantsEditor({
  items,
  onChange,
  disabled,
  validationErrors = {},
  onOpenMatrixWizard,
  contentLang,
  sizeScaleId = '',
  sizeScales = [],
  sizeScalesLoading = false,
  onSizeScaleChange,
}) {
  const { t } = useTranslation()
  // Chỉ mở một panel nặng (ảnh + thuộc tính) tại một thời điểm để bảng vẫn gọn
  // khi sản phẩm có hàng chục hoặc hàng trăm biến thể.
  const [expandedKey, setExpandedKey] = useState(() => items[0]?._key ?? null)
  const [filter, setFilter] = useState('')
  const [selectedKeys, setSelectedKeys] = useState([])
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false)
  const [bulkRetailPrice, setBulkRetailPrice] = useState('')
  const [bulkSalePrice, setBulkSalePrice] = useState('')
  const [sizeScaleManagerOpen, setSizeScaleManagerOpen] = useState(false)
  // Cho phép xoá giá khuyến mãi hàng loạt (đưa về trống) — ô nhập giá không thể diễn đạt "để trống".
  const [bulkClearSale, setBulkClearSale] = useState(false)

  // ── Render-count cap (A7) ──────────────────────────────────────────────
  // Chỉ render N dòng đầu (tiền tố items[0..revealCount)) — dù đang lọc hay không.
  // Vì luôn là một tiền tố liên tục, index hiển thị khớp đúng index gốc trong `items`
  // nên kéo-thả (SortableList) và việc map lỗi validate theo `variants.{index}.` không lệch.
  const [revealCount, setRevealCount] = useState(VARIANTS_RENDER_CAP)
  function ensureRevealed(minCount) {
    setRevealCount((prev) => (prev < minCount ? minCount : prev))
  }

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
        const idx = Number(m[1])
        const offending = items[idx]
        if (offending?._key) setExpandedKey(offending._key)
        // Bỏ bộ lọc để dòng sai luôn hiện ra ngay sau khi bấm lưu.
        if (filter) setFilter('')
        // Dòng lỗi nằm sau ngưỡng cap hiện tại — mở rộng cap để nó thật sự render ra.
        ensureRevealed(idx + 1)
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

    const isImageUpdate = ['imageUrl', 'imageAlt', 'imageWidth', 'imageHeight', 'imageMimeType'].some(
      (k) => Object.prototype.hasOwnProperty.call(partial, k)
    )
    if (isImageUpdate) {
      const colorKey = getVariantColorKey(nextCurrent)
      onChange(items.map((v) => {
        if (v._key === key || (colorKey && getVariantColorKey(v) === colorKey)) {
          return {
            ...v,
            ...partial
          }
        }
        return v
      }))
      return
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
        // Đổi giá trị màu (vd "Đen" → "Đen bóng") giữ/kế thừa ảnh, không xoá trắng — nên
        // không còn confirm cảnh báo xoá ảnh. Nhóm màu đích đã có media thì kế thừa;
        // chưa có thì giữ media hiện tại làm media của nhóm màu mới (resolveColorChangeMedia).
        const media = resolveColorChangeMedia(current, items, key, nextColorKey)
        onChange(items.map((v) => (
          v._key === key ? { ...nextCurrent, ...media } : v
        )))
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
      retailPrice: '',
      salePrice: '',
      isAvailable: true,
      options: [],
      gallery: [],
      imageUrl: '',
      imageAlt: '',
      imageWidth: null,
      imageHeight: null,
      imageMimeType: null,
    }
  }

  function addVariant() {
    const created = buildEmptyVariant()
    onChange([...items, created])
    setExpandedKey(created._key)
    // Biến thể mới luôn ở cuối danh sách — mở rộng cap để thẻ vừa mở thật sự render ra.
    ensureRevealed(items.length + 1)
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
    // Bản sao chèn ngay sau bản gốc (vị trí idx+1) — mở rộng cap vừa đủ để nó render ra.
    ensureRevealed(idx + 2)
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
    setSelectedKeys((keys) => keys.filter((selectedKey) => selectedKey !== key))
    if (expandedKey === key) setExpandedKey(null)
  }

  function setVariantSelected(key, selected) {
    setSelectedKeys((keys) => {
      if (selected) return keys.includes(key) ? keys : [...keys, key]
      return keys.filter((selectedKey) => selectedKey !== key)
    })
  }

  function applyBulkAvailability(isAvailable) {
    const selected = new Set(selectedKeys)
    onChange(items.map((variant) => (
      selected.has(variant._key) ? { ...variant, isAvailable } : variant
    )))
  }

  async function applyBulkDelete() {
    const selected = new Set(activeSelectedKeys)
    const count = selected.size
    if (!count) return

    const confirmed = await showConfirm(
      t('products.detail.variant.bulkDeleteConfirm', { count }),
      t('products.detail.variant.bulkDelete'),
      { variant: 'danger', confirmLabel: t('products.detail.variant.bulkDelete') },
    )
    if (!confirmed) return

    const remaining = items.filter((variant) => !selected.has(variant._key))
    onChange(remaining)
    setSelectedKeys([])
    if (expandedKey && selected.has(expandedKey)) {
      setExpandedKey(remaining[0]?._key ?? null)
    }
  }

  function applyBulkPrices() {
    const selected = new Set(selectedKeys)
    const retailPrice = bulkRetailPrice
    // Giá sale bằng 0 trong giao diện admin có cùng nghĩa với để trống.
    const salePrice = parseMoneyInput(bulkSalePrice) === 0 ? '' : bulkSalePrice
    if (!retailPrice && !salePrice && !bulkClearSale) return
    onChange(items.map((variant) => {
      if (!selected.has(variant._key)) return variant
      return {
        ...variant,
        ...(retailPrice ? { retailPrice } : {}),
        // bulkClearSale thắng ô nhập: đưa giá khuyến mãi về trống cho biến thể đã chọn.
        ...(bulkClearSale ? { salePrice: '' } : (salePrice ? { salePrice } : {})),
      }
    }))
    setBulkPriceOpen(false)
    setBulkRetailPrice('')
    setBulkSalePrice('')
    setBulkClearSale(false)
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

  // Nếu filter che mất dòng đang mở, mở panel của dòng khớp đầu tiên.
  const effectiveExpandedKey =
    filterTerm && visible.length > 0 && !visible.some(({ v }) => v._key === expandedKey)
      ? visible[0].v._key
      : expandedKey

  const showFilter = items.length >= VARIANTS_FILTER_THRESHOLD

  // Tổng số dòng đang "đủ điều kiện hiển thị" theo nhánh hiện tại (đã lọc hay chưa) và
  // số dòng còn ẩn sau ngưỡng cap — dùng để hiện/ẩn nút "Hiện thêm".
  const activeTotal = filterTerm ? visible.length : items.length
  const remainingCount = Math.max(0, activeTotal - revealCount)
  const renderedRows = (filterTerm ? visible : items.map((v, originalIdx) => ({ v, originalIdx }))).slice(0, revealCount)
  const selectableKeys = renderedRows.map(({ v }) => v._key)
  const itemKeySet = new Set(items.map((variant) => variant._key))
  const activeSelectedKeys = selectedKeys.filter((key) => itemKeySet.has(key))
  const selectedSet = new Set(activeSelectedKeys)
  const selectedVisibleCount = selectableKeys.filter((key) => selectedSet.has(key)).length
  const allVisibleSelected = selectableKeys.length > 0 && selectedVisibleCount === selectableKeys.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  function setAllRenderedSelected(checked) {
    setSelectedKeys((keys) => {
      const next = new Set(keys.filter((key) => itemKeySet.has(key)))
      selectableKeys.forEach((key) => {
        if (checked) next.add(key)
        else next.delete(key)
      })
      return [...next]
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {onSizeScaleChange ? (
        <div className="border border-border p-3">
          <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="product-size-scale">
            {t('products.detail.sizeScale.label', { defaultValue: 'Scale kích cỡ' })}
          </label>
          <div className="mb-2 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setSizeScaleManagerOpen(true)} disabled={disabled}>
              {t('products.detail.sizeScale.manage', { defaultValue: 'Quản lý scale' })}
            </Button>
          </div>
          <Select
            value={sizeScaleId || '__none__'}
            onValueChange={(value) => onSizeScaleChange(value === '__none__' ? '' : value)}
            disabled={disabled || sizeScalesLoading}
          >
            <SelectTrigger id="product-size-scale" className="w-full">
              <SelectValue placeholder={t('products.detail.sizeScale.placeholder', { defaultValue: 'Chọn scale kích cỡ' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                {t('products.detail.sizeScale.none', { defaultValue: 'Không dùng scale (sản phẩm không có cỡ)' })}
              </SelectItem>
              {sizeScales.map((scale) => (
                <SelectItem key={scale.id} value={scale.id}>
                  {scale.name}
                  {' · '}{scale.group?.label || scale.group?.key || scale.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('products.detail.sizeScale.hint', { defaultValue: 'Sản phẩm có option tên Size/Kích cỡ phải chọn đúng scale để lọc ngoài website.' })}
          </p>
          {validationErrors.sizeScaleId ? (
            <p className="mt-1 text-xs font-semibold text-danger" role="alert">{validationErrors.sizeScaleId}</p>
          ) : null}
        </div>
      ) : null}
      <SizeScaleManagerModal
        open={sizeScaleManagerOpen}
        onClose={() => setSizeScaleManagerOpen(false)}
        scales={sizeScales}
        contentLang={contentLang}
      />
      <div className="sticky top-0 z-[var(--admin-z-sticky)] flex flex-wrap items-center gap-2 bg-background py-2">
        {showFilter && (
          <Input
            type="search"
            className="min-w-52 flex-1"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('products.detail.variant.filterPlaceholder', { count: items.length })}
            disabled={disabled}
            aria-label={t('products.detail.variant.filterAria')}
           />
        )}
        {showFilter && filterTerm && (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {t('products.detail.variant.filterMatch', { visible: visible.length, total: items.length })}
          </span>
        )}
        {!disabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="size-4" aria-hidden="true" />
                {t('products.detail.variant.addVariant')}
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={addVariant}>
                <Plus aria-hidden="true" />
                {t('products.detail.variant.addSingle')}
              </DropdownMenuItem>
              {onOpenMatrixWizard && (
                <DropdownMenuItem onSelect={onOpenMatrixWizard}>
                  {t('products.detail.variant.addMatrix')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <BulkActionBar
        selectedCount={activeSelectedKeys.length}
        onClear={() => setSelectedKeys([])}
        actions={[
          {
            label: t('products.detail.variant.bulkFillPrice'),
            onClick: () => setBulkPriceOpen(true),
          },
          {
            label: t('products.detail.variant.bulkMarkOutOfStock'),
            onClick: () => applyBulkAvailability(false),
          },
          {
            label: t('products.detail.variant.bulkMarkInStock'),
            onClick: () => applyBulkAvailability(true),
          },
          {
            label: t('products.detail.variant.bulkDelete'),
            tone: 'danger',
            onClick: applyBulkDelete,
          },
        ]}
      />

      <Table containerClassName="hide-on-mobile rounded-[var(--admin-radius-card)] border border-border">
        <TableHeader>
          <TableRow className="hover:bg-surface-muted">
            <TableHead className="w-10 px-1">
              <span className="sr-only">{t('products.detail.dragToReorder')}</span>
            </TableHead>
            <TableHead className="w-10 px-2">
              <Checkbox
                checked={allVisibleSelected ? true : (someVisibleSelected ? 'indeterminate' : false)}
                onCheckedChange={(checked) => setAllRenderedSelected(checked === true)}
                disabled={disabled || selectableKeys.length === 0}
                aria-label={t('products.detail.variant.selectAllRows')}
              />
            </TableHead>
            <TableHead className="w-16">{t('products.detail.variant.columnImage')}</TableHead>
            <TableHead className="min-w-52">{t('products.detail.variant.columnVariant')}</TableHead>
            <TableHead className="min-w-36">{t('products.detail.variant.columnSku')}</TableHead>
            <TableHead className="min-w-36">{t('products.detail.variant.columnRetailPrice')}</TableHead>
            <TableHead className="min-w-36">{t('products.detail.variant.columnSalePrice')}</TableHead>
            <TableHead className="min-w-32">{t('products.detail.variant.columnStatus')}</TableHead>
            <TableHead className="w-12 text-center">
              <span className="sr-only">{t('products.detail.variant.columnActions')}</span>
              <MoreHorizontal className="mx-auto size-4" aria-hidden="true" />
            </TableHead>
          </TableRow>
        </TableHeader>

        {filterTerm ? (
          <TableBody>
            {renderedRows.map(({ v, originalIdx }) => {
              const prefix = `variants.${originalIdx}.`
              const fieldErrors = Object.fromEntries(
                Object.entries(validationErrors)
                  .filter(([key]) => key.startsWith(prefix))
                  .map(([key, value]) => [key.slice(prefix.length), value])
              )
              return (
                <VariantRow
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
                  contentLang={contentLang}
                  selected={selectedSet.has(v._key)}
                  onSelect={setVariantSelected}
                />
              )
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  {t('products.detail.variant.filterEmpty', { filter })}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        ) : (
          <SortableList
            items={items.slice(0, revealCount)}
            getId={(variant) => variant._key}
            onReorder={(next) => onChange([...next, ...items.slice(revealCount)])}
            disabled={disabled}
            as="tbody"
            renderItem={(variant, sortable, index) => {
              const prefix = `variants.${index}.`
              const fieldErrors = Object.fromEntries(
                Object.entries(validationErrors)
                  .filter(([key]) => key.startsWith(prefix))
                  .map(([key, value]) => [key.slice(prefix.length), value])
              )
              return (
                <VariantRow
                  variant={variant}
                  index={index}
                  expanded={effectiveExpandedKey === variant._key}
                  onToggle={toggleExpanded}
                  onChange={updateVariant}
                  onRemove={removeVariant}
                  onDuplicate={duplicateVariant}
                  disabled={disabled}
                  fieldErrors={fieldErrors}
                  sortable={sortable}
                  contentLang={contentLang}
                  selected={selectedSet.has(variant._key)}
                  onSelect={setVariantSelected}
                />
              )
            }}
          />
        )}
      </Table>

      <MobileCardList>
        {renderedRows.map(({ v, originalIdx }) => {
          const prefix = `variants.${originalIdx}.`
          const fieldErrors = Object.fromEntries(
            Object.entries(validationErrors)
              .filter(([key]) => key.startsWith(prefix))
              .map(([key, value]) => [key.slice(prefix.length), value])
          )
          return (
            <VariantMobileCard
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
              contentLang={contentLang}
              selected={selectedSet.has(v._key)}
              onSelect={setVariantSelected}
            />
          )
        })}
        {renderedRows.length === 0 && filterTerm && (
          <li className="mobile-card text-center text-sm text-muted-foreground">
            {t('products.detail.variant.filterEmpty', { filter })}
          </li>
        )}
      </MobileCardList>

      {remainingCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRevealCount((c) => c + VARIANTS_RENDER_CAP)}
        >
          {t('products.detail.variant.showMore', { count: remainingCount })}
        </Button>
      )}

      <Modal
        open={bulkPriceOpen}
        onClose={() => setBulkPriceOpen(false)}
        title={t('products.detail.variant.bulkPriceTitle', { count: activeSelectedKeys.length })}
        actions={(
          <>
            <Button variant="ghost" onClick={() => setBulkPriceOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={applyBulkPrices} disabled={!bulkRetailPrice && !bulkSalePrice && !bulkClearSale}>
              {t('products.detail.variant.bulkApplyPrice')}
            </Button>
          </>
        )}
      >
        <p className="mb-4 text-sm text-muted-foreground">{t('products.detail.variant.bulkPriceHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="form-field">
            <span>{t('products.detail.variant.columnRetailPrice')}</span>
            <MoneyInput
              value={bulkRetailPrice}
              onValueChange={setBulkRetailPrice}
            />
          </label>
          <label className="form-field">
            <span>{t('products.detail.variant.columnSalePrice')}</span>
            <MoneyInput
              value={bulkSalePrice}
              onValueChange={setBulkSalePrice}
              zeroAsEmpty
              disabled={bulkClearSale}
            />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <Checkbox
            checked={bulkClearSale}
            onCheckedChange={(checked) => setBulkClearSale(checked === true)}
          />
          <span>{t('products.detail.variant.bulkClearSale', { defaultValue: 'Xóa giá khuyến mãi (đưa về trống) cho các biến thể đã chọn' })}</span>
        </label>
      </Modal>
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
  // Optional smart-defaults applied to every generated variant so the owner doesn't have
  // to type a SKU / price on each row afterwards (audit P0-4). Both opt-in: leave blank to
  // keep the old behaviour (empty sku/price).
  const [skuPrefix, setSkuPrefix] = useState('')
  const [sharedPrice, setSharedPrice] = useState('')

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
    const prefix = skuPrefix.trim()
    const price = sharedPrice
    const newVariants = combos.map((combo) => {
      const tokens = combo.map((o) => skuToken(o.value)).filter(Boolean)
      return {
        _key: generateId(),
        id: '',
        // Auto-fill SKU only when a prefix is given; else keep old empty behaviour.
        sku: prefix ? [prefix, ...tokens].join('-').slice(0, 100) : '',
        name: deriveVariantName(combo),
        retailPrice: price,
        salePrice: '',
        isAvailable: true,
        options: combo.map((o) => ({ name: o.name, value: o.value })),
        gallery: [],
      }
    })
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
                aria-label={t('products.detail.matrix.attributeLabel', { defaultValue: 'Tên thuộc tính' })}
                value={attr.name}
                onChange={(e) => updateAttr(i, 'name', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder={t('products.detail.matrix.valuesPlaceholder')}
                aria-label={t('products.detail.matrix.valuesLabel', { defaultValue: 'Các giá trị, phân tách bằng dấu phẩy' })}
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
                <X size={16} aria-hidden="true" />
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

      {/* Điền sẵn (tùy chọn): mã hàng + giá — để không phải gõ tay từng biến thể (P0-4) */}
      <div className="mt-4 rounded-[var(--admin-radius-control)] border border-border bg-muted/40 p-3">
        <p className="text-sm font-medium mb-2">
          {t('products.detail.matrix.smartFillTitle', { defaultValue: 'Điền sẵn cho tất cả biến thể (tùy chọn)' })}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('products.detail.matrix.skuPrefixLabel', { defaultValue: 'Tiền tố mã hàng' })}
            </label>
            <Input
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value)}
              placeholder={t('products.detail.matrix.skuPrefixPlaceholder', { defaultValue: 'vd: AGV-K1S' })}
              className="font-mono"
              maxLength={80}
            />
            {skuPrefix.trim() && parsed.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('products.detail.matrix.skuSamplePreview', {
                  defaultValue: 'Ví dụ mã: {{sku}}',
                  sku: [skuPrefix.trim(), ...parsed.map((a) => skuToken(a.values[0])).filter(Boolean)].join('-'),
                })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('products.detail.matrix.skuPrefixHelp', { defaultValue: 'Tự tạo mã hàng theo mẫu: tiền tố + giá trị thuộc tính. Để trống nếu muốn tự nhập sau.' })}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('products.detail.matrix.sharedPriceLabel', { defaultValue: 'Giá bán chung' })}
            </label>
            <MoneyInput
              value={sharedPrice}
              onValueChange={setSharedPrice}
              placeholder={t('products.detail.matrix.sharedPricePlaceholder', { defaultValue: 'vd: 5.900.000' })}
            />
            <p className="text-xs text-muted-foreground">
              {t('products.detail.matrix.sharedPriceHelp', { defaultValue: 'Áp cùng một giá cho mọi biến thể (sửa từng dòng sau nếu cần). Để trống nếu giá khác nhau.' })}
            </p>
          </div>
        </div>
      </div>

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
