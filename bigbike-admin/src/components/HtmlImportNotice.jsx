import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/** Shared non-destructive status and explicit apply actions for product HTML editors. */
export function HtmlImportNotice({
  result,
  dirty = false,
  disabled = false,
  onApply,
  onUseRaw,
  allowRaw = false,
  extraNotice,
}) {
  const { t } = useTranslation()
  if (!dirty) return null

  const readable = result.acceptedCount > 0
  const tone = readable ? 'info' : 'warning'
  const summary = readable
    ? result.skippedCount > 0
      ? t('products.detail.htmlImport.readWithSkipped', {
          count: result.acceptedCount,
          skipped: result.skippedCount,
        })
      : t('products.detail.htmlImport.read', { count: result.acceptedCount })
    : result.hasInput
      ? t('products.detail.htmlImport.unreadable')
      : t('products.detail.htmlImport.empty')

  return (
    <div className="flex flex-col gap-2">
      <Alert tone={tone} size="sm">
        <p>{summary}</p>
        <p className="mt-1">{t('products.detail.htmlImport.pending')}</p>
        {extraNotice ? <p className="mt-1">{extraNotice}</p> : null}
      </Alert>
      {readable ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onApply}
          disabled={disabled}
          className="self-start"
        >
          {t('products.detail.htmlImport.apply')}
        </Button>
      ) : allowRaw ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUseRaw}
          disabled={disabled}
          className="self-start"
        >
          {t('products.detail.htmlImport.useRaw')}
        </Button>
      ) : null}
    </div>
  )
}
