import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Award, EyeOff, Pencil, Plus, RefreshCw, Trash2, Undo2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { showConfirm } from '../lib/confirm'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { AdminTable } from '../components/AdminTable'
import { FilterChips } from '../components/FilterChips'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { FilterBar, Screen, ScreenHeader } from '../components/layout'
import { deleteBrand, fetchBrands, permanentDeleteBrand, restoreBrand } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useContentLang } from '../lib/contentLang'
import { useRecentItems } from '../lib/useRecentItems'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const SYSTEM_BRAND_SLUG = 'uncategorized-brand'
const INITIAL_QUERY = {
  search: '',
  visibility: 'VISIBLE',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 20,
}

function initialBrandQuery() {
  const query = readQueryFromUrl(INITIAL_QUERY)
  return {
    ...INITIAL_QUERY,
    ...query,
    visibility: query.visibility === 'HIDDEN' ? 'HIDDEN' : 'VISIBLE',
  }
}

function brandActionError(t, error, fallback) {
  if (error?.status === 403) {
    return t('brands.actionForbidden', { defaultValue: 'Bạn không có quyền thực hiện thao tác này.' })
  }
  if (error?.status === 404) {
    return t('brands.actionNotFound', { defaultValue: 'Thương hiệu không còn tồn tại. Danh sách đã được làm mới.' })
  }
  if (error?.status === 409) {
    return error.message || t('brands.actionConflict', { defaultValue: 'Thương hiệu không còn ở trạng thái phù hợp để thực hiện thao tác này.' })
  }
  return error?.message || fallback
}

function brandTrashStatus(isVisible) {
  if (isVisible === true) return false
  if (isVisible === false) return true
  return undefined
}

export function BrandListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(initialBrandQuery)
  const [searchInput, setSearchInput] = useState(() => query.search)
  const [activeAction, setActiveAction] = useState(null)
  const isFirstSearchRender = useRef(true)
  const debouncedSearch = useDebounce(searchInput, 300)
  // O9: thương hiệu vừa mở gần đây — BrandDetailScreen đã ghi vào 'recent:brands'
  // nhưng trước đây không màn nào đọc ra, nên dữ liệu ghi xong bị bỏ không.
  const recentBrandItems = useRecentItems('recent:brands')
  const state = useAdminList(['brands', query, contentLang], () => fetchBrands(query))

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    setQuery((previous) => ({ ...previous, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  function updateQuery(partial, resetPage = false) {
    setQuery((previous) => ({
      ...previous,
      ...partial,
      ...(resetPage ? { page: 1 } : {}),
    }))
  }

  function resetFilters() {
    setSearchInput('')
    setQuery(INITIAL_QUERY)
  }

  const items = (state.items || []).filter((brand) => brand.slug !== SYSTEM_BRAND_SLUG)
  const isTrash = query.visibility === 'HIDDEN'
  const isFiltered = Boolean(query.search) || isTrash
  const isActionBusy = Boolean(activeAction)

  async function hideBrand(brand) {
    if (!canUpdate || isActionBusy) return
    const confirmed = await showConfirm(
      t('brands.hideConfirm', {
        name: formatText(brand.name),
        defaultValue: 'Chuyển thương hiệu "{{name}}" vào Thùng rác? Đây là xóa mềm và có thể khôi phục sau.',
      }),
      t('brands.hideConfirmTitle', { defaultValue: 'Chuyển vào Thùng rác?' }),
      { variant: 'danger', confirmLabel: t('brands.hideAction', { defaultValue: 'Chuyển vào Thùng rác' }) },
    )
    if (!confirmed) return

    setActiveAction(`hide:${brand.id}`)
    try {
      await deleteBrand(brand.id)
      await queryClient.invalidateQueries({ queryKey: ['brands'] })
      toast.success(t('brands.hideSuccess', { defaultValue: 'Đã chuyển thương hiệu vào Thùng rác.' }))
    } catch (error) {
      toast.error(brandActionError(t, error, t('common.error')))
      if (error?.status === 404) queryClient.invalidateQueries({ queryKey: ['brands'] })
    } finally {
      setActiveAction(null)
    }
  }

  async function restoreBrandFromTrash(brand) {
    if (!canUpdate || isActionBusy) return
    const confirmed = await showConfirm(
      t('brands.restoreConfirm', {
        name: formatText(brand.name),
        defaultValue: 'Khôi phục thương hiệu "{{name}}"? Thương hiệu sẽ hiển thị lại trên website.',
      }),
      t('brands.restoreConfirmTitle', { defaultValue: 'Khôi phục thương hiệu?' }),
      { variant: 'default', confirmLabel: t('products.restore', { defaultValue: 'Khôi phục' }) },
    )
    if (!confirmed) return

    setActiveAction(`restore:${brand.id}`)
    try {
      await restoreBrand(brand.id)
      await queryClient.invalidateQueries({ queryKey: ['brands'] })
      toast.success(t('brands.restoreSuccess', { defaultValue: 'Đã khôi phục và hiển thị lại thương hiệu.' }))
    } catch (error) {
      toast.error(brandActionError(t, error, t('common.error')))
      if (error?.status === 404) queryClient.invalidateQueries({ queryKey: ['brands'] })
    } finally {
      setActiveAction(null)
    }
  }

  async function permanentlyDeleteBrand(brand) {
    if (!canUpdate || isActionBusy) return
    const confirmed = await showConfirm(
      t('brands.permanentDeleteConfirm', {
        name: formatText(brand.name),
        defaultValue: 'Xóa vĩnh viễn thương hiệu "{{name}}"? Không thể hoàn tác. Sản phẩm đang gắn thương hiệu này sẽ được chuyển sang “Chưa phân loại”.',
      }),
      t('brands.permanentDeleteConfirmTitle', { defaultValue: 'Xóa vĩnh viễn thương hiệu?' }),
      { variant: 'danger', confirmLabel: t('common.permanentDelete', { defaultValue: 'Xóa vĩnh viễn' }) },
    )
    if (!confirmed) return

    setActiveAction(`permanent:${brand.id}`)
    try {
      const { reassignedProductCount } = await permanentDeleteBrand(brand.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['brands'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ])
      toast.success(t('brands.permanentDeleteSuccessWithProducts', {
        count: reassignedProductCount,
        defaultValue: 'Đã xóa vĩnh viễn thương hiệu. {{count}} sản phẩm đã được chuyển sang “Chưa phân loại”.',
      }))
    } catch (error) {
      toast.error(brandActionError(t, error, t('common.error')))
      if (error?.status === 404) queryClient.invalidateQueries({ queryKey: ['brands'] })
    } finally {
      setActiveAction(null)
    }
  }

  function renderRowActions(brand) {
    const actionForBrand = activeAction?.endsWith(`:${brand.id}`)
    const disabled = isActionBusy || brand.isVisible !== true

    if (!canUpdate || brand.isVisible === null || brand.slug === SYSTEM_BRAND_SLUG) return null

    if (brand.isVisible === false) {
      return (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            title={t('products.restore', { defaultValue: 'Khôi phục' })}
            aria-label={t('products.restore', { defaultValue: 'Khôi phục' })}
            aria-busy={actionForBrand || undefined}
            disabled={isActionBusy}
            onClick={() => restoreBrandFromTrash(brand)}
          >
            <Undo2 size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 text-destructive hover:text-destructive"
            title={t('common.permanentDelete', { defaultValue: 'Xóa vĩnh viễn' })}
            aria-label={t('common.permanentDelete', { defaultValue: 'Xóa vĩnh viễn' })}
            aria-busy={actionForBrand || undefined}
            disabled={isActionBusy}
            onClick={() => permanentlyDeleteBrand(brand)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      )
    }

    return (
      <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          title={t('common.edit', { defaultValue: 'Chỉnh sửa' })}
          aria-label={t('common.edit', { defaultValue: 'Chỉnh sửa' })}
          disabled={disabled}
          onClick={() => navigate(`/admin/brands/${brand.id}`)}
        >
          <Pencil size={16} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 text-destructive hover:text-destructive"
          title={t('brands.hideAction', { defaultValue: 'Chuyển vào Thùng rác' })}
          aria-label={t('brands.hideAction', { defaultValue: 'Chuyển vào Thùng rác' })}
          aria-busy={actionForBrand || undefined}
          disabled={disabled}
          onClick={() => hideBrand(brand)}
        >
          <EyeOff size={16} aria-hidden="true" />
        </Button>
      </div>
    )
  }

  const columns = [
    {
      key: 'brand',
      label: t('brands.colBrand', { defaultValue: 'Thương hiệu' }),
      render: (brand) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-border bg-surface-muted text-muted-foreground">
            <Award size={18} aria-hidden="true" />
            {brand.logo?.url ? (
              <img
                src={brand.logo.url}
                alt={brand.logo.alt || `Logo ${formatText(brand.name)}`}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="absolute inset-0 h-full w-full bg-background object-contain"
                onError={(event) => { event.currentTarget.hidden = true }}
              />
            ) : null}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{formatText(brand.name)}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">/{formatText(brand.slug)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'visibility',
      label: t('brands.colVisibility', { defaultValue: 'Hiển thị' }),
      render: (brand) => <StatusBadge type="trash" status={brandTrashStatus(brand.isVisible)} />,
    },
    {
      key: 'showOnHomepage',
      label: t('brands.detail.showOnHomepage', { defaultValue: 'Hiển thị trên trang chủ' }),
      render: (brand) => (
        <span className="text-sm text-foreground">
          {brand.showOnHomepage === true
            ? t('common.yes', { defaultValue: 'Có' })
            : brand.showOnHomepage === false
              ? t('common.no', { defaultValue: 'Không' })
              : t('common.unknown', { defaultValue: 'Không xác định' })}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      label: t('brands.colUpdated', { defaultValue: 'Cập nhật' }),
      align: 'right',
      render: (brand) => <span className="text-xs text-muted-foreground">{formatDateTime(brand.updatedAt)}</span>,
    },
    {
      key: 'actions',
      label: t('common.actions', { defaultValue: 'Thao tác' }),
      align: 'right',
      render: renderRowActions,
    },
  ]

  const activeFilterChips = [
    ...(query.search ? [{
      key: 'search',
      label: t('brands.filterChipSearch', { value: query.search, defaultValue: 'Tìm: "{{value}}"' }),
      removeLabel: t('brands.removeFilter', { filter: t('common.search'), defaultValue: 'Bỏ lọc {{filter}}' }),
      onRemove: () => {
        setSearchInput('')
        updateQuery({ search: '' }, true)
      },
    }] : []),
    ...(isTrash ? [{
      key: 'visibility',
      label: t('brands.filterChipVisibility', { value: t('brands.filterVisibilityHidden', { defaultValue: 'Thùng rác' }), defaultValue: 'Hiển thị: {{value}}' }),
      removeLabel: t('brands.removeFilter', { filter: t('brands.filterVisibility'), defaultValue: 'Bỏ lọc {{filter}}' }),
      onRemove: () => updateQuery({ visibility: 'VISIBLE' }, true),
    }] : []),
  ]

  const mobileCard = (brand) => ({
    title: formatText(brand.name),
    subtitle: `/${formatText(brand.slug)}`,
    status: <StatusBadge type="trash" status={brandTrashStatus(brand.isVisible)} />,
    meta: [
      {
        label: t('brands.detail.showOnHomepage', { defaultValue: 'Hiển thị trên trang chủ' }),
        value: brand.showOnHomepage === true
          ? t('common.yes', { defaultValue: 'Có' })
          : brand.showOnHomepage === false
            ? t('common.no', { defaultValue: 'Không' })
            : t('common.unknown', { defaultValue: 'Không xác định' }),
      },
      { label: t('brands.colUpdated', { defaultValue: 'Cập nhật' }), value: formatDateTime(brand.updatedAt) },
    ],
    actions: renderRowActions(brand),
    onClick: () => navigate(`/admin/brands/${brand.id}`),
  })

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('brands.eyebrow')}
        title={t('brands.title')}
        description={t('brands.description')}
        actions={canUpdate ? (
          <Button type="button" className="min-h-11" onClick={() => navigate('/admin/brands/new')}>
            <Plus size={16} aria-hidden="true" />
            {t('brands.create')}
          </Button>
        ) : null}
      />

      {/* O9 — Vừa xem gần đây */}
      <RecentItemsChips items={recentBrandItems} onSelect={(item) => navigate(`/admin/brands/${item.id}`)} />

      {!canUpdate ? (
        <ReadOnlyBanner warning={t('brands.readOnly', { defaultValue: 'Bạn chỉ có quyền xem thương hiệu. Cần quyền cập nhật danh mục để thay đổi dữ liệu.' })} />
      ) : null}

      <FilterBar ariaLabel={t('brands.filterAria', { defaultValue: 'Bộ lọc thương hiệu' })} className="items-center">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('brands.searchPlaceholder')}
          ariaLabel={t('brands.searchPlaceholder')}
          className="min-h-11"
          wrapperClassName="min-w-48 flex-1"
        />
        <FilterSelect
          value={query.visibility}
          onValueChange={(value) => updateQuery({ visibility: value }, true)}
          ariaLabel={t('brands.filterVisibility')}
          className="min-h-11"
          options={[
            { value: 'VISIBLE', label: t('brands.filterVisibilityVisible', { defaultValue: 'Đang hiển thị' }) },
            { value: 'HIDDEN', label: t('brands.filterVisibilityHidden', { defaultValue: 'Thùng rác' }) },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(pageSize) => updateQuery({ pageSize }, true)}
          className="min-h-11"
        />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={state.isFetching}
          onClick={() => state.refetch()}
        >
          <RefreshCw size={16} className={state.isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
          {t('common.refresh', { defaultValue: 'Làm mới' })}
        </Button>
        {state.isFetching && state.status === 'success' ? (
          <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {t('brands.refreshing', { defaultValue: 'Đang cập nhật' })}
          </span>
        ) : null}
      </FilterBar>

      <FilterChips
        chips={activeFilterChips}
        onClearAll={resetFilters}
        clearAllLabel={t('common.resetFilters', { defaultValue: 'Làm mới bộ lọc' })}
        removeChipLabel={t('common.clear', { defaultValue: 'Bỏ lọc' })}
        ariaLabel={t('brands.activeFiltersAria', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('brands.loadError')}
          description={state.error || t('brands.loadErrorDesc', { defaultValue: 'Không thể tải danh sách thương hiệu. Vui lòng thử lại.' })}
          actionLabel={t('common.retry', { defaultValue: 'Thử lại' })}
          onAction={() => state.refetch()}
          className="mt-4"
        />
      ) : null}

      {state.status === 'success' && items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={isFiltered
            ? t('brands.emptyFiltered', { defaultValue: 'Không có thương hiệu phù hợp' })
            : t('brands.empty', { defaultValue: 'Chưa có thương hiệu' })}
          description={isFiltered
            ? t('brands.emptyFilteredDesc', { defaultValue: 'Hãy thay đổi từ khóa hoặc bộ lọc để xem kết quả khác.' })
            : t('brands.emptyDesc', { defaultValue: 'Tạo thương hiệu đầu tiên để quản lý danh mục sản phẩm.' })}
          actionLabel={isFiltered ? t('common.resetFilters', { defaultValue: 'Làm mới bộ lọc' }) : canUpdate ? t('brands.create') : undefined}
          onAction={isFiltered ? resetFilters : canUpdate ? () => navigate('/admin/brands/new') : undefined}
          className="mt-4"
        />
      ) : null}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) ? (
        <div className="mt-4 overflow-hidden rounded-md border border-border bg-surface">
          <AdminTable
            columns={columns}
            rows={items}
            caption={t('brands.tableCaption', { defaultValue: 'Danh sách thương hiệu' })}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
            onRowClick={(brand) => navigate(`/admin/brands/${brand.id}`)}
            rowHref={(brand) => `/admin/brands/${brand.id}`}
            mobileCard={mobileCard}
          />
          {state.status === 'success' && state.pagination ? (
            <div className="px-4">
              <PaginationControls
                pagination={state.pagination}
                disabled={state.isFetching || isActionBusy}
                onPageChange={(page) => updateQuery({ page })}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </Screen>
  )
}
