import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Trash2, Eye, EyeOff, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { fetchGuidePage, saveGuidePage } from '../lib/adminApi'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { SortableList } from '../components/Sortable'
import { Screen } from '../components/layout/Screen'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { FormField } from '../components/layout/FormField'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Icon-name suggestions the storefront can render as lucide. For a custom image, upload it via the
// media library (stored in MinIO, served as a /media URL) — keep this list in sync with the lucide
// map in bigbike-web/app/huong-dan/GuidePage.tsx.
const ICON_OPTIONS = [
  'BookOpen', 'ShoppingCart', 'Ruler', 'Hand', 'HardHat', 'ShieldCheck', 'Wrench', 'Info', 'HelpCircle', 'FileText',
]

function slugify(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function newEntry() {
  return {
    id: (window.crypto?.randomUUID?.() ?? `g-${Date.now()}-${Math.round(Math.random() * 1e6)}`),
    enabled: true,
    sortOrder: 0,
    pathSegment: '',
    pageSlug: '',
    icon: 'BookOpen',
    titleVi: '',
    titleEn: '',
    descriptionVi: '',
    descriptionEn: '',
  }
}

export function GuidePageBuilderScreen({ canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [hero, setHero] = useState({ heroTitleVi: '', heroTitleEn: '', heroImageUrl: '' })
  const [entries, setEntries] = useState([])
  const [initialized, setInitialized] = useState(false)

  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['guide-page'],
    queryFn: fetchGuidePage,
  })

  useEffect(() => {
    if (data && !initialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHero({
        heroTitleVi: data.heroTitleVi ?? '',
        heroTitleEn: data.heroTitleEn ?? '',
        heroImageUrl: data.heroImageUrl ?? '',
      })
      setEntries([...(data.entries ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
      setInitialized(true)
    }
  }, [data, initialized])

  const saveMutation = useMutation({
    mutationFn: saveGuidePage,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['guide-page'] })
      toast.success(t('guideBuilder.savedSuccess'))
    },
    onError(err) {
      toast.error(err?.message || t('common.errorOccurred'))
    },
  })

  function patchEntry(id, patch) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }
  function removeEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }
  function addEntry() {
    setEntries((prev) => [...prev, newEntry()])
  }
  function setHeroField(field, value) {
    setHero((prev) => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    const payloadEntries = entries.map((e, i) => ({
      ...e,
      sortOrder: i,
      pathSegment: slugify(e.pathSegment) || slugify(e.titleVi),
    }))
    saveMutation.mutate({
      heroTitleVi: hero.heroTitleVi,
      heroTitleEn: hero.heroTitleEn,
      heroImageUrl: hero.heroImageUrl,
      entries: payloadEntries,
    })
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
        eyebrow={t('guideBuilder.eyebrow')}
        title={t('guideBuilder.title')}
        description={t('guideBuilder.description')}
        actions={
          <Button onClick={handleSave} disabled={disabled}>
            {saveMutation.isPending ? t('common.saving') : t('guideBuilder.saveButton')}
          </Button>
        }
      />

      {/* Hero */}
      <section className="border border-border bg-background p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('guideBuilder.heroSection')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={t('guideBuilder.heroTitleVi')}>
            <Input
              disabled={disabled}
              value={hero.heroTitleVi}
              onChange={(e) => setHeroField('heroTitleVi', e.target.value)}
            />
          </FormField>
          <FormField label={t('guideBuilder.heroTitleEn')}>
            <Input
              disabled={disabled}
              value={hero.heroTitleEn}
              onChange={(e) => setHeroField('heroTitleEn', e.target.value)}
            />
          </FormField>
        </div>
        <FormField label={t('guideBuilder.heroImage')} helper={t('guideBuilder.heroImageHint')}>
          <ImageUrlInput
            value={hero.heroImageUrl}
            onChange={(url) => setHeroField('heroImageUrl', url || '')}
            disabled={disabled}
          />
        </FormField>
      </section>

      {/* Cards */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('guideBuilder.cardsSection')}
          </h2>
          <Button type="button" variant="secondary" size="sm" className="gap-2" disabled={disabled} onClick={addEntry}>
            <Plus size={14} />
            {t('guideBuilder.addCard')}
          </Button>
        </div>

        {entries.length === 0 ? (
          <div className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t('guideBuilder.emptyCards')}
          </div>
        ) : (
          <SortableList
            items={entries}
            disabled={disabled}
            onReorder={setEntries}
            className="flex flex-col gap-3"
            renderItem={(entry, sortable) => (
              <EntryCard
                entry={entry}
                sortable={sortable}
                disabled={disabled}
                onPatch={patchEntry}
                onRemove={removeEntry}
                t={t}
              />
            )}
          />
        )}
      </section>
    </Screen>
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
        <SelectTrigger className="h-9"><SelectValue placeholder={t('guideBuilder.iconBuiltin')} /></SelectTrigger>
        <SelectContent>
          {ICON_OPTIONS.map((ic) => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">{t('guideBuilder.iconUpload')}</span>
      <ImageUrlInput value={image ? value : ''} onChange={(url) => onChange(url || '')} disabled={disabled} />
    </div>
  )
}

function EntryCard({ entry, sortable, disabled, onPatch, onRemove, t }) {
  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : 1 }}
      className="border border-border bg-background p-3 flex flex-col gap-3"
    >
      {/* Header row: drag / show-hide / delete */}
      <div className="flex items-center gap-2">
        {!disabled && sortable && (
          <button
            type="button"
            {...sortable.handleProps}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground cursor-grab touch-none"
            aria-label={t('guideBuilder.dragHint')}
          >
            <GripVertical size={16} />
          </button>
        )}
        <span className="text-xs font-semibold px-2 py-0.5 bg-muted text-muted-foreground">
          {entry.titleVi || t('guideBuilder.cardLabel')}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={disabled}
            onClick={() => onPatch(entry.id, { enabled: !entry.enabled })}
            aria-label={entry.enabled ? t('guideBuilder.hide') : t('guideBuilder.show')}
            title={entry.enabled ? t('guideBuilder.hide') : t('guideBuilder.show')}
          >
            {entry.enabled ? <Eye size={16} /> : <EyeOff size={16} className="text-muted-foreground" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-danger"
            disabled={disabled}
            onClick={() => onRemove(entry.id)}
            aria-label={t('common.delete')}
            title={t('common.delete')}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Icon + titles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label={t('guideBuilder.icon')} helper={t('guideBuilder.iconHint')}>
          <IconField value={entry.icon} disabled={disabled} onChange={(icon) => onPatch(entry.id, { icon })} t={t} />
        </FormField>
        <FormField label={t('guideBuilder.titleVi')}>
          <Input
            disabled={disabled}
            value={entry.titleVi ?? ''}
            onChange={(e) => onPatch(entry.id, { titleVi: e.target.value })}
          />
        </FormField>
        <FormField label={t('guideBuilder.titleEn')}>
          <Input
            disabled={disabled}
            value={entry.titleEn ?? ''}
            onChange={(e) => onPatch(entry.id, { titleEn: e.target.value })}
          />
        </FormField>
      </div>

      {/* Descriptions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label={t('guideBuilder.descriptionVi')}>
          <Textarea
            disabled={disabled}
            rows={2}
            value={entry.descriptionVi ?? ''}
            onChange={(e) => onPatch(entry.id, { descriptionVi: e.target.value })}
          />
        </FormField>
        <FormField label={t('guideBuilder.descriptionEn')}>
          <Textarea
            disabled={disabled}
            rows={2}
            value={entry.descriptionEn ?? ''}
            onChange={(e) => onPatch(entry.id, { descriptionEn: e.target.value })}
          />
        </FormField>
      </div>

      {/* Routing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label={t('guideBuilder.pathSegment')} helper={t('guideBuilder.pathSegmentHint')}>
          <Input
            disabled={disabled}
            value={entry.pathSegment ?? ''}
            onChange={(e) => onPatch(entry.id, { pathSegment: e.target.value })}
            placeholder="mua-hang"
          />
        </FormField>
        <FormField label={t('guideBuilder.pageSlug')} helper={t('guideBuilder.pageSlugHint')}>
          <Input
            disabled={disabled}
            value={entry.pageSlug ?? ''}
            onChange={(e) => onPatch(entry.id, { pageSlug: e.target.value })}
            placeholder="huong-dan-mua-hang"
          />
        </FormField>
      </div>
    </div>
  )
}
