import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { toast } from 'sonner'
import { AlertTriangle, Download } from 'lucide-react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { FilterChips } from '../components/FilterChips'
import { useContentLang } from '../lib/contentLang'
import {
  fetchInventoryGrouped,
  fetchInventorySummary,
  fetchSerialInventoryOnly,
  downloadInventoryCsv,
} from '../lib/adminApi'
import { PaginationControls } from '../components/PaginationControls'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { STOCK_STATES, INITIAL_QUERY } from './inventory/constants'
import { SummaryBanner } from './inventory/shared'
import { StockInModal } from './inventory/StockInModal'
import { SerialManageModal } from './inventory/SerialManageModal'
import { InventoryGroupedTable } from './inventory/InventoryGroupedTable'
import { MovementHistoryModal } from './inventory/MovementHistoryModal'

export function InventoryScreen({ canUpdate = false }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [summary, setSummary] = useState(null)
  const [stockInTarget, setStockInTarget] = useState(null)
  const [isStockInOpen, setIsStockInOpen] = useState(false)
  const [serialTarget, setSerialTarget] = useState(null)
  const [isSerialOpen, setIsSerialOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [csvDownloading, setCsvDownloading] = useState(false)
  const [serialOnlyMode, setSerialOnlyMode] = useState(false)

  const state = useAdminList(['inventory', query], () => fetchInventoryGrouped(query))
  // Admin VI/EN switch (strict English): ở EN ẩn nhóm SP chưa có tên tiếng Anh và
  // hiển thị tên tiếng Anh. Lọc phía client (response luôn kèm productNameEn) — số
  // trang theo tổng chưa lọc nên ở EN trang có thể ít dòng hơn (chấp nhận, chế độ rà soát).
  const contentLang = useContentLang()
  const visibleGroups = useMemo(() => {
    const groups = state.items || []
    if (contentLang !== 'en') return groups
    return groups
      .filter((g) => (g.productNameEn || '').trim() !== '')
      .map((g) => ({ ...g, productName: g.productNameEn }))
  }, [state.items, contentLang])

  // Bộ lọc đang áp dụng (để hiển thị chip + phân biệt empty-state lọc/rỗng).
  const isFiltered = Boolean(query.q) || query.stockState !== 'ALL'

  function resetFilters() {
    setSearchInput('')
    setQuery(INITIAL_QUERY)
  }

  const filterChips = []
  if (query.stockState !== 'ALL') {
    filterChips.push({
      key: 'stockState',
      label: t(`status.stock.${query.stockState}`, { defaultValue: query.stockState }),
      onRemove: () => setQuery((q) => ({ ...q, stockState: 'ALL', page: 1 })),
    })
  }
  if (query.q) {
    filterChips.push({
      key: 'q',
      label: t('inventory.chipSearch', { defaultValue: 'Tìm: {{term}}', term: query.q }),
      onRemove: () => { setSearchInput(''); setQuery((q) => ({ ...q, q: '', page: 1 })) },
    })
  }

  useEffect(() => {
    fetchInventorySummary()
      .then(setSummary)
      .catch((e) => toast.error(e.message || t('common.error')))
    fetchSerialInventoryOnly()
      .then(setSerialOnlyMode)
      .catch((e) => toast.error(e.message || t('common.error')))
  }, [t])

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  function handleStockInSuccess() {
    setIsStockInOpen(false)
    setStockInTarget(null)
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
    fetchInventorySummary()
      .then(setSummary)
      .catch((e) => toast.error(e.message || t('common.error')))
  }

  function openStockIn(item = null) {
    if (serialOnlyMode || item?.trackSerials) {
      openSerialManage(item)
      return
    }
    setStockInTarget(item)
    setIsStockInOpen(true)
  }

  function closeStockIn() {
    setIsStockInOpen(false)
    setStockInTarget(null)
  }

  function openSerialManage(item) {
    setSerialTarget(item)
    setIsSerialOpen(true)
  }

  function closeSerialManage() {
    setIsSerialOpen(false)
    setSerialTarget(null)
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
    fetchInventorySummary()
      .then(setSummary)
      .catch((e) => toast.error(e.message || t('common.error')))
  }


  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('inventory.eyebrow')}</p>
          <h1>{t('inventory.title')}</h1>
          <p className="bb-muted">{t('inventory.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            disabled={csvDownloading}
            onClick={() => {
              setCsvDownloading(true)
              downloadInventoryCsv()
                .catch((err) => toast.error('Xuất CSV thất bại: ' + (err?.message || 'Lỗi không xác định')))
                .finally(() => setCsvDownloading(false))
            }}
          >
            <Download size={14} />{csvDownloading ? 'Đang xuất…' : 'Xuất CSV'}
          </button>
        </div>
      </div>

      <SummaryBanner summary={summary} />

      {/* Derived-field info banner — stockState is auto-computed. */}
      <div className="inv-info-banner">
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ display: 'block', marginBottom: 2 }}>Trạng thái kho được cập nhật tự động theo số lượng tồn</strong>
          <span style={{ color: 'var(--admin-color-text-secondary)' }}>
            {serialOnlyMode
              ? 'Tồn kho đang được tính tự động từ serial. Không thể sửa số lượng thủ công.'
              : 'Tồn bằng 0 là “Hết hàng” · tồn thấp dưới ngưỡng cảnh báo là “Sắp hết hàng” · còn lại là “Còn hàng”.'}
          </span>
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('inventory.searchPlaceholder')}
          wrapperClassName="flex-1 min-w-[200px]"
        />
        <FilterSelect
          value={query.stockState}
          onValueChange={(v) => setQuery((q) => ({ ...q, stockState: v, page: 1 }))}
          ariaLabel={t('inventory.filterStock')}
          options={STOCK_STATES.map((s) => ({
            value: s,
            label: s === 'ALL' ? t('inventory.filterStock') : t(`status.stock.${s}`),
          }))}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => setQuery((q) => ({ ...q, pageSize: n, page: 1 }))}
        />
      </div>

      <FilterChips
        chips={filterChips}
        onClearAll={filterChips.length > 1 ? resetFilters : undefined}
        clearAllLabel={t('common.resetFilters', { defaultValue: 'Xoá bộ lọc' })}
        ariaLabel={t('inventory.activeFilters', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('inventory.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => setQuery((q) => ({ ...q }))} />
      )}
      {state.status === 'success' && visibleGroups.length === 0 && (
        <StatePanel tone="neutral"
          title={isFiltered
            ? t('inventory.emptyFiltered', { defaultValue: 'Không có sản phẩm khớp bộ lọc' })
            : t('inventory.empty')}
          description={isFiltered
            ? t('inventory.emptyFilteredDesc', { defaultValue: 'Không tìm thấy sản phẩm nào khớp bộ lọc.' })
            : t('inventory.emptyDesc', { defaultValue: 'Chưa có sản phẩm nào trong kho.' })}
          actionLabel={isFiltered ? t('common.resetFilters', { defaultValue: 'Xoá bộ lọc' }) : undefined}
          onAction={isFiltered ? resetFilters : undefined} />
      )}
      {(state.status === 'loading' || (state.status === 'success' && visibleGroups.length > 0)) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <InventoryGroupedTable
              groups={visibleGroups}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              canUpdate={canUpdate}
              serialOnlyMode={serialOnlyMode}
              onStockIn={openStockIn}
              onSerialManage={openSerialManage}
              onViewHistory={setHistoryTarget}
            />
          </div>
          {state.status === 'success' && state.pagination && (
            <PaginationControls pagination={state.pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
          )}
        </div>
      )}

      {isStockInOpen && !serialOnlyMode && (
        <StockInModal
          item={stockInTarget}
          onSuccess={handleStockInSuccess}
          onClose={closeStockIn}
        />
      )}

      {isSerialOpen && serialTarget && (
        <SerialManageModal
          item={serialTarget}
          onClose={closeSerialManage}
        />
      )}

      {historyTarget && (
        <MovementHistoryModal
          scope={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}
