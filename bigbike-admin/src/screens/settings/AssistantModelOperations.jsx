import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Gauge, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '@/components/AdminTable'
import { DetailSection } from '@/components/DetailSection'
import { StatePanel } from '@/components/StatePanel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  createAssistantEvaluationDraft,
  fetchAssistantEvaluationDatasets,
  fetchAssistantEvaluationRuns,
  fetchAssistantModels,
  startAssistantEvaluation,
  updateAssistantModel,
} from '@/lib/adminApi'
import { useHasPermission } from '@/lib/auth'
import { formatDateTime } from '@/lib/formatters'
import { AssistantOperationalStats } from './AssistantOperationalStats'

function formatUsd(value, locale, digits = 4) {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'USD', maximumFractionDigits: digits,
  }).format(Number(value) || 0)
}

function formatPercent(value, locale) {
  return new Intl.NumberFormat(locale, {
    style: 'percent', maximumFractionDigits: 1,
  }).format(Number(value) || 0)
}

function statusTone(status) {
  if (status === 'COMPLETED') return 'bb-badge bb-badge-success'
  if (status === 'FAILED' || status === 'COST_LIMIT_REACHED') return 'bb-badge bb-badge-warning'
  return 'bb-badge bb-badge-neutral'
}

export function AssistantModelOperations({ canUpdate }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'vi-VN'
  const isEnglish = locale === 'en-US'
  const hasPermission = useHasPermission()
  const canReadChat = hasPermission('chat.read')
  const queryClient = useQueryClient()
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedEvaluationModels, setSelectedEvaluationModels] = useState(null)
  const [costCap, setCostCap] = useState('2.00')
  const [savingModel, setSavingModel] = useState(false)
  const [startingRun, setStartingRun] = useState(false)
  const [downloadingDraft, setDownloadingDraft] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')

  const modelsQuery = useQuery({
    queryKey: ['assistant-models'],
    queryFn: () => fetchAssistantModels(false),
  })
  const datasetsQuery = useQuery({
    queryKey: ['assistant-evaluation-datasets'],
    queryFn: fetchAssistantEvaluationDatasets,
  })
  const runsQuery = useQuery({
    queryKey: ['assistant-evaluation-runs'],
    queryFn: fetchAssistantEvaluationRuns,
    refetchInterval: 10_000,
  })

  const catalog = modelsQuery.data
  const selectableModels = useMemo(
    () => (catalog?.models || []).filter((model) => model.selectable),
    [catalog?.models],
  )
  const defaultEvaluationModels = useMemo(
    () => [...new Set([catalog?.currentModel, catalog?.fallbackModel])]
      .filter((id) => id && selectableModels.some((model) => model.id === id))
      .slice(0, 4),
    [catalog?.currentModel, catalog?.fallbackModel, selectableModels],
  )
  const activeSelectedModel = selectedModel || catalog?.currentModel || ''
  const activeEvaluationModels = selectedEvaluationModels ?? defaultEvaluationModels
  const datasets = Array.isArray(datasetsQuery.data) ? datasetsQuery.data : []
  const runs = useMemo(
    () => (Array.isArray(runsQuery.data) ? runsQuery.data : []),
    [runsQuery.data],
  )
  const dataset = datasets[0]
  const newestRun = runs[0]
  const comparisonRun = useMemo(
    () => runs.find((run) => run.results?.length > 0),
    [runs],
  )

  async function refreshCatalog() {
    setActionError('')
    setActionNotice('')
    try {
      const refreshed = await fetchAssistantModels(true)
      queryClient.setQueryData(['assistant-models'], refreshed)
      setSelectedModel('')
      setSelectedEvaluationModels(null)
      setActionNotice(t('settings.assistantModels.refreshed'))
    } catch (error) {
      setActionError(error?.message || t('settings.assistantModels.loadError'))
    }
  }

  async function saveModel() {
    if (!activeSelectedModel || activeSelectedModel === catalog?.currentModel) return
    setSavingModel(true)
    setActionError('')
    setActionNotice('')
    try {
      const updated = await updateAssistantModel(activeSelectedModel)
      queryClient.setQueryData(['assistant-models'], updated)
      setSelectedModel('')
      setActionNotice(t('settings.assistantModels.saved'))
    } catch (error) {
      setActionError(error?.message || t('settings.assistantModels.saveError'))
    } finally {
      setSavingModel(false)
    }
  }

  function toggleEvaluationModel(id) {
    setSelectedEvaluationModels((current) => {
      const selection = current ?? defaultEvaluationModels
      return selection.includes(id)
        ? selection.filter((item) => item !== id)
        : selection.length < 4 ? [...selection, id] : selection
    })
  }

  async function startRun() {
    if (!dataset || activeEvaluationModels.length < 1) return
    setStartingRun(true)
    setActionError('')
    setActionNotice('')
    try {
      await startAssistantEvaluation({
        datasetVersion: dataset.version,
        modelIds: activeEvaluationModels,
        maxCostUsd: Number(costCap),
      })
      await queryClient.invalidateQueries({ queryKey: ['assistant-evaluation-runs'] })
      setActionNotice(t('settings.assistantEvaluation.started'))
    } catch (error) {
      setActionError(error?.message || t('settings.assistantEvaluation.startError'))
    } finally {
      setStartingRun(false)
    }
  }

  async function downloadDraft() {
    setDownloadingDraft(true)
    setActionError('')
    setActionNotice('')
    try {
      const draft = await createAssistantEvaluationDraft()
      const blob = new Blob([draft.draftJson], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `assistant-evaluation-draft-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setActionNotice(draft.notice || t('settings.assistantEvaluation.draftReady'))
    } catch (error) {
      setActionError(error?.message || t('settings.assistantEvaluation.draftError'))
    } finally {
      setDownloadingDraft(false)
    }
  }

  const comparisonColumns = useMemo(() => {
    const columns = [{ key: 'metric', label: t('settings.assistantEvaluation.metric') }]
    for (const result of comparisonRun?.results || []) {
      columns.push({ key: result.modelId, label: result.modelId, align: 'right' })
    }
    return columns
  }, [comparisonRun?.results, t])
  const comparisonRows = useMemo(() => {
    if (!comparisonRun?.results?.length) return []
    const metrics = [
      ['passed', t('settings.assistantEvaluation.passed'), (result) => `${result.passedCases}/${result.totalCases}`],
      ['numeric', t('settings.assistantEvaluation.numeric'), (result) => result.numericCaseCount > 0 ? formatPercent(result.numericAccuracy, locale) : '—'],
      ['intent', t('settings.assistantEvaluation.intent'), (result) => formatPercent(result.intentAccuracy, locale)],
      ['nonFabrication', t('settings.assistantEvaluation.nonFabrication'), (result) => result.nonFabricationCaseCount > 0 ? formatPercent(result.nonFabricationRate, locale) : '—'],
      ['giveUp', t('settings.assistantEvaluation.giveUp'), (result) => formatPercent(result.giveUpRate, locale)],
      ['p50', t('settings.assistantEvaluation.p50'), (result) => result.p50LatencyMs == null ? '—' : `${result.p50LatencyMs} ms`],
      ['p95', t('settings.assistantEvaluation.p95'), (result) => result.p95LatencyMs == null ? '—' : `${result.p95LatencyMs} ms`],
      ['averageCost', t('settings.assistantEvaluation.averageCost'), (result) => formatUsd(result.averageCostUsd, locale, 6)],
      ['totalCost', t('settings.assistantEvaluation.totalCost'), (result) => formatUsd(result.estimatedCostUsd, locale, 6)],
    ]
    return metrics.map(([id, metric, render]) => ({
      id,
      metric,
      ...Object.fromEntries(comparisonRun.results.map((result) => [result.modelId, render(result)])),
    }))
  }, [comparisonRun, locale, t])

  return (
    <div className="mb-6 space-y-6">
      <AssistantOperationalStats />
      {actionError ? (
        <StatePanel tone="danger" title={t('settings.assistantModels.actionError')} description={actionError} />
      ) : null}
      {actionNotice ? (
        <div className="flex items-start gap-2 rounded-md bg-success-bg p-3 text-sm text-success" role="status">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{actionNotice}</span>
        </div>
      ) : null}

      <DetailSection
        headingLevel={3}
        title={t('settings.assistantModels.title')}
        description={t('settings.assistantModels.description')}
        action={(
          <Button type="button" variant="secondary" size="sm" onClick={refreshCatalog} disabled={modelsQuery.isFetching}>
            <RefreshCw className={modelsQuery.isFetching ? 'animate-spin' : undefined} size={15} aria-hidden="true" />
            {t('settings.assistantModels.checkAgain')}
          </Button>
        )}
      >
        {modelsQuery.isError ? (
          <StatePanel tone="danger" title={t('settings.assistantModels.loadError')} description={modelsQuery.error?.message} actionLabel={t('common.retry')} onAction={modelsQuery.refetch} />
        ) : modelsQuery.isLoading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {t('common.loading')}
          </div>
        ) : selectableModels.length === 0 ? (
          <StatePanel tone="warning" title={t('settings.assistantModels.empty')} description={t('settings.assistantModels.emptyDescription')} />
        ) : (
          <div className="space-y-4">
            {catalog.stale ? (
              <div className="flex items-start gap-2 rounded-md bg-warning-bg p-3 text-sm text-warning" role="status">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t('settings.assistantModels.stale')}
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                {t('settings.assistantModels.current')}
                <Select value={activeSelectedModel || undefined} onValueChange={setSelectedModel} disabled={!canUpdate || savingModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {selectableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>{model.displayName || model.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <Button type="button" className="min-h-11" onClick={saveModel} loading={savingModel} disabled={!canUpdate || activeSelectedModel === catalog.currentModel}>
                {t('settings.assistantModels.apply')}
              </Button>
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              {t('settings.assistantModels.independent', { model: catalog.reviewModerationModel || '—' })}
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              {selectableModels.map((model) => (
                <article key={model.id} className="rounded-md border border-border bg-surface-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-foreground">{model.displayName || model.id}</strong>
                    {model.id === catalog.currentModel ? <span className="bb-badge bb-badge-success">{t('settings.assistantModels.inUse')}</span> : null}
                  </div>
                  <p className="mb-0 mt-2 text-sm text-muted-foreground">
                    {isEnglish ? model.speedDescriptionEn : model.speedDescriptionVi}
                    {' · '}{isEnglish ? model.costDescriptionEn : model.costDescriptionVi}
                  </p>
                  <p className="mb-0 mt-2 text-xs text-muted-foreground">
                    {t('settings.assistantModels.pricing', {
                      input: formatUsd(model.inputUsdPerMillion, locale, 2),
                      output: formatUsd(model.outputUsdPerMillion, locale, 2),
                    })}
                  </p>
                </article>
              ))}
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              {t('settings.assistantModels.verifiedAt', { time: formatDateTime(catalog.refreshedAt) })}
            </p>
            <p className="m-0 text-xs text-muted-foreground">
              {t('settings.assistantModels.descriptionsAreEstimates')}
            </p>
          </div>
        )}
      </DetailSection>

      <DetailSection
        headingLevel={3}
        title={t('settings.assistantEvaluation.title')}
        description={t('settings.assistantEvaluation.description')}
        badge={newestRun ? <span className={statusTone(newestRun.status)}>{t(`settings.assistantEvaluation.status.${newestRun.status}`, { defaultValue: newestRun.status })}</span> : null}
      >
        {datasetsQuery.isError || runsQuery.isError ? (
          <StatePanel tone="danger" title={t('settings.assistantEvaluation.loadError')} description={datasetsQuery.error?.message || runsQuery.error?.message} />
        ) : datasetsQuery.isLoading || runsQuery.isLoading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {t('common.loading')}
          </div>
        ) : !dataset ? (
          <StatePanel tone="warning" title={t('settings.assistantEvaluation.noDataset')} />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border border-border bg-surface-muted p-3">
                <p className="m-0 text-xs text-muted-foreground">{t('settings.assistantEvaluation.dataset')}</p>
                <p className="mb-0 mt-1 font-semibold text-foreground">{dataset.version}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-muted p-3">
                <p className="m-0 text-xs text-muted-foreground">{t('settings.assistantEvaluation.modelCaseCount')}</p>
                <p className="mb-0 mt-1 font-display text-xl font-bold text-foreground">{dataset.caseCount}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-muted p-3">
                <p className="m-0 text-xs text-muted-foreground">{t('settings.assistantEvaluation.acceptanceCheckCount')}</p>
                <p className="mb-0 mt-1 font-display text-xl font-bold text-foreground">{dataset.acceptanceCheckCount}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-muted p-3">
                <p className="m-0 text-xs text-muted-foreground">{t('settings.assistantEvaluation.coverage')}</p>
                <p className="mb-0 mt-1 font-semibold text-foreground">
                  {dataset.acceptanceRegistryComplete ? t('common.yes') : t('common.no')}
                </p>
              </div>
            </div>
            {dataset.needsRealQuestionReview ? (
              <div className="flex items-start gap-2 rounded-md bg-warning-bg p-3 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t('settings.assistantEvaluation.realQuestionsMissing')}</span>
              </div>
            ) : null}
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">{t('settings.assistantEvaluation.chooseModels')}</legend>
              <div className="grid gap-3 lg:grid-cols-2">
                {selectableModels.map((model) => (
                  <label key={model.id} className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm">
                    <Checkbox
                      checked={activeEvaluationModels.includes(model.id)}
                      onCheckedChange={() => toggleEvaluationModel(model.id)}
                      disabled={!canUpdate || (!activeEvaluationModels.includes(model.id) && activeEvaluationModels.length >= 4)}
                    />
                    <span className="min-w-0">
                      <strong className="block truncate text-foreground">{model.displayName || model.id}</strong>
                      <span className="text-xs text-muted-foreground">{model.id}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 lg:grid-cols-[12rem_1fr_auto] lg:items-end">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                {t('settings.assistantEvaluation.costCap')}
                <Input type="number" min="0.01" max="2" step="0.01" value={costCap} onChange={(event) => setCostCap(event.target.value)} disabled={!canUpdate} />
              </label>
              <p className="m-0 text-sm text-muted-foreground">{t('settings.assistantEvaluation.costWarning')}</p>
              <Button type="button" className="min-h-11" onClick={startRun} loading={startingRun} disabled={!canUpdate || activeEvaluationModels.length < 1 || Number(costCap) <= 0 || Number(costCap) > 2}>
                <Gauge size={16} aria-hidden="true" /> {t('settings.assistantEvaluation.run')}
              </Button>
            </div>
            {canReadChat && canUpdate ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-4">
                <p className="m-0 max-w-2xl text-sm text-muted-foreground">{t('settings.assistantEvaluation.draftDescription')}</p>
                <Button type="button" variant="secondary" onClick={downloadDraft} loading={downloadingDraft}>
                  <Download size={16} aria-hidden="true" /> {t('settings.assistantEvaluation.downloadDraft')}
                </Button>
              </div>
            ) : null}
            {comparisonRun ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="m-0 text-sm font-semibold text-foreground">{t('settings.assistantEvaluation.latestComparison')}</h4>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(comparisonRun.completedAt || comparisonRun.startedAt)} · {formatUsd(comparisonRun.actualCostUsd, locale, 6)}
                  </span>
                </div>
                <AdminTable
                  caption={t('settings.assistantEvaluation.comparisonCaption')}
                  columns={comparisonColumns}
                  rows={comparisonRows}
                  pageSize={comparisonRows.length}
                />
              </div>
            ) : (
              <StatePanel tone="neutral" title={t('settings.assistantEvaluation.noRuns')} description={t('settings.assistantEvaluation.noRunsDescription')} />
            )}
          </div>
        )}
      </DetailSection>
    </div>
  )
}
