import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Trash2, Eye, EyeOff, Plus, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { fetchContactPage, saveContactPage } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { SortableList } from '../components/Sortable'
import { Screen } from '../components/layout/Screen'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { FormField } from '../components/layout/FormField'
import { StickyActionBar } from '../components/layout/StickyActionBar'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Block types and the icon set the storefront knows how to render. Keep this list in sync with the
// lucide map in bigbike-web/app/lien-he/page.tsx.
const TYPE_OPTIONS = ['channel', 'address', 'hours', 'map', 'richtext']
// Icon-name suggestions the storefront can render as lucide. For brand logos (Facebook, Zalo…),
// paste an image URL into the icon field instead.
const ICON_OPTIONS = ['Phone', 'MapPin', 'Clock', 'Mail', 'MessageCircle', 'Music2', 'Send', 'Globe']
// Whitelisted contact setting keys a block can bind to (mirror of ContactPageService.WRITE_THROUGH_KEYS).
const BIND_KEYS = [
  'hotline', 'hotline_2', 'hotline_3', 'contact_email', 'contact_address',
  'zalo_url', 'facebook_url', 'messenger_url', 'instagram_url', 'youtube_url', 'tiktok_url',
]
const HOURS_KEYS = ['opening_hours_weekday', 'opening_hours_weekend', 'opening_hours_holiday']

const CUSTOM = '__custom__'

function newBlock(type, column) {
  return {
    id: (window.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.round(Math.random() * 1e6)}`),
    type,
    enabled: true,
    sortOrder: 0,
    column,
    icon: type === 'address' || type === 'map' ? 'MapPin' : type === 'hours' ? 'Clock' : 'Phone',
    labelVi: '',
    labelEn: '',
    bindKey: type === 'address' || type === 'map' ? 'contact_address' : type === 'channel' ? 'hotline' : null,
    value: null,
    href: null,
    htmlVi: null,
    htmlEn: null,
  }
}

export function ContactPageBuilderScreen({ canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [blocks, setBlocks] = useState([])
  // settingValues: { [key]: { value, valueEn } } — single source shared with header/footer.
  const [settingValues, setSettingValues] = useState({})
  const [initialized, setInitialized] = useState(false)

  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['contact-page'],
    queryFn: fetchContactPage,
  })

  useEffect(() => {
    if (data && !initialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBlocks([...(data.blocks ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
      const map = {}
      for (const v of data.values ?? []) map[v.key] = { value: v.value ?? '', valueEn: v.valueEn ?? '' }
      setSettingValues(map)
      setInitialized(true)
    }
  }, [data, initialized])

  const saveMutation = useMutation({
    mutationFn: saveContactPage,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['contact-page'] })
      toast.success(t('contactBuilder.savedSuccess'))
    },
    onError(err) {
      toast.error(err?.message || t('common.errorOccurred'))
    },
  })

  const mainBlocks = useMemo(() => blocks.filter((b) => (b.column ?? 'main') !== 'online'), [blocks])
  const onlineBlocks = useMemo(() => blocks.filter((b) => (b.column ?? 'main') === 'online'), [blocks])

  function patchBlock(id, patch) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }
  async function removeBlock(id) {
    // Xoá khối là hành động phá hủy nội dung đã nhập → xác nhận trước (tiêu chí 7.5).
    const ok = await showConfirm(
      t('contactBuilder.removeBlockConfirm', { defaultValue: 'Xoá khối này? Nội dung đã nhập trong khối sẽ mất khi bạn lưu.' }),
      t('contactBuilder.removeBlockTitle', { defaultValue: 'Xoá khối' }),
      { confirmLabel: t('common.delete', { defaultValue: 'Xoá' }) },
    )
    if (!ok) return
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }
  function addBlock(type, column) {
    setBlocks((prev) => [...prev, newBlock(type, column)])
  }
  function reorderColumn(column, reordered) {
    // Rebuild the flat array keeping the other column in place, main before online (canonical order).
    setBlocks(column === 'online' ? [...mainBlocks, ...reordered] : [...reordered, ...onlineBlocks])
  }
  function setValue(key, field, val) {
    setSettingValues((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { value: '', valueEn: '' }), [field]: val } }))
  }

  function handleSave() {
    const ordered = [...mainBlocks, ...onlineBlocks]
    const payloadBlocks = ordered.map((b, i) => ({ ...b, sortOrder: i, column: b.column ?? 'main' }))
    const values = Object.entries(settingValues).map(([key, v]) => ({
      key,
      value: v.value ?? '',
      valueEn: v.valueEn ? v.valueEn : null,
    }))
    saveMutation.mutate({ blocks: payloadBlocks, values })
  }

  if (isLoading) {
    return (
      <Screen>
        <StatePanel tone="info" title={t('common.loading')} description={t('common.pleaseWait')} />
      </Screen>
    )
  }
  if (isError) {
    return (
      <Screen>
        <StatePanel tone="danger" title={t('common.errorLoading')} description={error?.message} />
      </Screen>
    )
  }

  const disabled = !canUpdate || saveMutation.isPending

  return (
    <Screen maxWidth="980px">
      {!canUpdate && <ReadOnlyBanner />}

      <ScreenHeader
        eyebrow={t('contactBuilder.eyebrow')}
        title={t('contactBuilder.title')}
        description={t('contactBuilder.description')}
        actions={
          <Button onClick={handleSave} disabled={disabled}>
            {saveMutation.isPending ? t('common.saving') : t('contactBuilder.saveButton')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ColumnEditor
          column="main"
          title={t('contactBuilder.columnMain')}
          blocks={mainBlocks}
          disabled={disabled}
          onReorder={(r) => reorderColumn('main', r)}
          onPatch={patchBlock}
          onRemove={removeBlock}
          onAdd={(type) => addBlock(type, 'main')}
          settingValues={settingValues}
          onSetValue={setValue}
          t={t}
        />
        <ColumnEditor
          column="online"
          title={t('contactBuilder.columnOnline')}
          blocks={onlineBlocks}
          disabled={disabled}
          onReorder={(r) => reorderColumn('online', r)}
          onPatch={patchBlock}
          onRemove={removeBlock}
          onAdd={(type) => addBlock(type, 'online')}
          settingValues={settingValues}
          onSetValue={setValue}
          t={t}
        />
      </div>
    </Screen>
  )
}

function ColumnEditor({ title, blocks, disabled, onReorder, onPatch, onRemove, onAdd, settingValues, onSetValue, t }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <AddBlockButton disabled={disabled} onAdd={onAdd} t={t} />
      </div>

      {blocks.length === 0 ? (
        <div className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t('contactBuilder.emptyColumn')}
        </div>
      ) : (
        <SortableList
          items={blocks}
          disabled={disabled}
          onReorder={onReorder}
          className="flex flex-col gap-3"
          renderItem={(block, sortable) => (
            <BlockCard
              block={block}
              sortable={sortable}
              disabled={disabled}
              onPatch={onPatch}
              onRemove={onRemove}
              settingValues={settingValues}
              onSetValue={onSetValue}
              t={t}
            />
          )}
        />
      )}
    </section>
  )
}

function AddBlockButton({ disabled, onAdd, t }) {
  return (
    <Select disabled={disabled} value="" onValueChange={(v) => v && onAdd(v)}>
      <SelectTrigger className="w-auto h-8 text-xs gap-2">
        <Plus size={14} />
        <SelectValue placeholder={t('contactBuilder.addBlock')} />
      </SelectTrigger>
      <SelectContent>
        {TYPE_OPTIONS.map((type) => (
          <SelectItem key={type} value={type}>{t(`contactBuilder.type.${type}`)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function isImageIcon(value) {
  return Boolean(value) && (value.startsWith('/') || value.startsWith('http'))
}

// Icon = a built-in lucide name OR an uploaded image. Images go through the media library
// (stored in MinIO, served as a /media URL) — admins never paste arbitrary URLs.
function IconField({ value, disabled, onChange, t }) {
  const image = isImageIcon(value)
  return (
    <div className="flex flex-col gap-2">
      <Select disabled={disabled} value={image ? '' : (value || '')} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className="h-9"><SelectValue placeholder={t('contactBuilder.iconBuiltin')} /></SelectTrigger>
        <SelectContent>
          {ICON_OPTIONS.map((ic) => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">{t('contactBuilder.iconUpload')}</span>
      <ImageUrlInput value={image ? value : ''} onChange={(url) => onChange(url || '')} disabled={disabled} />
    </div>
  )
}

function BlockCard({ block, sortable, disabled, onPatch, onRemove, settingValues, onSetValue, t }) {
  const bound = block.type === 'channel' || block.type === 'address' || block.type === 'map'
  const bindValue = block.bindKey || CUSTOM

  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : 1 }}
      className="border border-border bg-background p-3 flex flex-col gap-3"
    >
      {/* Header row: drag / type / column / show-hide / delete */}
      <div className="flex items-center gap-2">
        {!disabled && sortable && (
          <button
            type="button"
            {...sortable.handleProps}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground cursor-grab touch-none"
            aria-label={t('contactBuilder.dragHint')}
          >
            <GripVertical size={16} />
          </button>
        )}
        <span className="text-xs font-semibold px-2 py-0.5 bg-muted text-muted-foreground">
          {t(`contactBuilder.type.${block.type}`)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Select
            disabled={disabled}
            value={block.column ?? 'main'}
            onValueChange={(v) => onPatch(block.id, { column: v })}
          >
            <SelectTrigger className="w-auto h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="main">{t('contactBuilder.columnMain')}</SelectItem>
              <SelectItem value="online">{t('contactBuilder.columnOnline')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={disabled}
            onClick={() => onPatch(block.id, { enabled: !block.enabled })}
            aria-label={block.enabled ? t('contactBuilder.hide') : t('contactBuilder.show')}
            title={block.enabled ? t('contactBuilder.hide') : t('contactBuilder.show')}
          >
            {block.enabled ? <Eye size={16} /> : <EyeOff size={16} className="text-muted-foreground" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-danger"
            disabled={disabled}
            onClick={() => onRemove(block.id)}
            aria-label={t('common.delete')}
            title={t('common.delete')}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Icon + labels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label={t('contactBuilder.icon')} helper={t('contactBuilder.iconHint')}>
          <IconField
            value={block.icon}
            disabled={disabled}
            onChange={(icon) => onPatch(block.id, { icon })}
            t={t}
          />
        </FormField>
        <FormField label={t('contactBuilder.labelVi')}>
          <Input
            disabled={disabled}
            value={block.labelVi ?? ''}
            onChange={(e) => onPatch(block.id, { labelVi: e.target.value })}
          />
        </FormField>
        <FormField label={t('contactBuilder.labelEn')}>
          <Input
            disabled={disabled}
            value={block.labelEn ?? ''}
            onChange={(e) => onPatch(block.id, { labelEn: e.target.value })}
          />
        </FormField>
      </div>

      {/* Type-specific value editors */}
      {bound && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={t('contactBuilder.dataSource')}>
            <Select
              disabled={disabled}
              value={bindValue}
              onValueChange={(v) => onPatch(block.id, { bindKey: v === CUSTOM ? null : v })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BIND_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>{t(`contactBuilder.bind.${k}`)}</SelectItem>
                ))}
                <SelectItem value={CUSTOM}>{t('contactBuilder.bindCustom')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {block.bindKey ? (
            <FormField label={t('contactBuilder.value')} helper={t('contactBuilder.sharedHint')}>
              <Input
                disabled={disabled}
                value={settingValues[block.bindKey]?.value ?? ''}
                onChange={(e) => onSetValue(block.bindKey, 'value', e.target.value)}
              />
            </FormField>
          ) : (
            <>
              <FormField label={t('contactBuilder.customValue')}>
                <Input
                  disabled={disabled}
                  value={block.value ?? ''}
                  onChange={(e) => onPatch(block.id, { value: e.target.value })}
                />
              </FormField>
              <FormField label={t('contactBuilder.customHref')}>
                <Input
                  disabled={disabled}
                  value={block.href ?? ''}
                  onChange={(e) => onPatch(block.id, { href: e.target.value })}
                  placeholder="https://…"
                />
              </FormField>
            </>
          )}
        </div>
      )}

      {block.type === 'hours' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {HOURS_KEYS.map((k) => (
            <FormField key={k} label={t(`contactBuilder.bind.${k}`)} helper={t('contactBuilder.sharedHint')}>
              <Input
                disabled={disabled}
                value={settingValues[k]?.value ?? ''}
                onChange={(e) => onSetValue(k, 'value', e.target.value)}
              />
            </FormField>
          ))}
        </div>
      )}

      {block.type === 'richtext' && (
        <div className="grid grid-cols-1 gap-3">
          <FormField label={t('contactBuilder.htmlVi')}>
            <Textarea
              disabled={disabled}
              rows={4}
              value={block.htmlVi ?? ''}
              onChange={(e) => onPatch(block.id, { htmlVi: e.target.value })}
            />
          </FormField>
          <FormField label={t('contactBuilder.htmlEn')}>
            <Textarea
              disabled={disabled}
              rows={4}
              value={block.htmlEn ?? ''}
              onChange={(e) => onPatch(block.id, { htmlEn: e.target.value })}
            />
          </FormField>
        </div>
      )}
    </div>
  )
}
