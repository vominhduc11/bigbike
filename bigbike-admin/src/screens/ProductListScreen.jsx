import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { useHasPermission } from '@/lib/auth'
import {
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
} from 'lucide-react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { ExportButton } from '@/components/ExportButton'
import { ProductExportDialog } from '@/components/ProductExportDialog'
import { ImportProductsDialog } from '@/components/ImportProductsDialog'
import { StatePanel } from '../components/StatePanel'
import { BulkActionBar } from '../components/BulkActionBar'
import { FilterChips } from '../components/FilterChips'
import { FilterSelect } from '../components/FilterSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { AdminTable } from '../components/AdminTable'
import { PublishStatusBadge } from '../components/StatusBadge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { publishRowAccent } from '../lib/statusTone'
import { showConfirm } from '../lib/confirm'
import {
  ApiClientError,
  exportFullProductCatalogCsv,
  exportProductJson,
  fetchBrands,
  fetchCategoryTree,
  fetchProductDetail,
  fetchProducts,
  publishProduct,
  restoreProduct,
  softDeleteProduct,
  permanentDeleteProduct,
} from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { useRecentItems } from '../lib/useRecentItems'
import { useProductExportPreferences } from '../lib/productExport'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { queryKeys } from '../lib/queryKeys'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PaginationControls } from '../components/PaginationControls'
import { FilterBar, Screen, ScreenHeader } from '../components/layout'
import {
  HOMEPAGE_BLOCK_LABEL_KEYS,
  HOMEPAGE_BLOCK_LIMITS,
  INITIAL_QUERY,
  buildCategoryTreeOrder,
  categoryLabel,
} from './product-list/constants'
import { StockCell } from './product-list/cells'
import { buildFormFromItem } from './product-detail/constants'
import { PublishChecklistModal } from './product-detail/Modals'

const CATEGORY_FILTER_INDENT_CLASSES = [
  'ps-0',
  'ps-4',
  'ps-8',
  'ps-12',
  'ps-16',
  'ps-20',
  'ps-24',
  'ps-28',
]

export function ProductListScreen({ navigate, canUpdate, canReadCatalog, adminUserId }) {
  const { t } = useTranslation()
  const hasPermission = useHasPermission()
  const canExport = hasPermission('reports.export')
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  const [deletingId, setDeletingId] = useState(null)
  const [restoringId, setRestoringId] = useState(null)
  const [togglingPublishId, setTogglingPublishId] = useState(null)
  const [exportingJsonId, setExportingJsonId] = useState(null)
  const [publishChecklist, setPublishChecklist] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const importFileInputRef = useRef(null)
  const { preferences: exportPreferences, updatePreferences: updateExportPreferences } =
    useProductExportPreferences(adminUserId)

  function handleImportFileChange(e) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    setImportFile(picked)
  }

  const state = useAdminList(['products', query, contentLang], () => fetchProducts(query))

  // O9: sản phẩm vừa mở gần đây (ghi lại từ ProductDetailScreen khi mount).
  const recentProductItems = useRecentItems('recent:products')

  // T7: cho phép ẩn/hiện các cột phụ trên bảng sản phẩm, lưu lựa chọn theo trình duyệt.
  const {
    hiddenKeys: hiddenColumnKeys,
    toggle: toggleColumn,
    allColumns: allColumnDefs,
  } = useColumnVisibility(
    [
      { key: 'sku', label: 'SKU' },
      { key: 'category', label: t('products.colCategory') },
      { key: 'brand', label: t('products.colBrand') },
      { key: 'homepage', label: t('products.colHomepage') },
      { key: 'updatedAt', label: t('products.colUpdated') },
    ],
    'columns:products',
  )

  // PRODUCT_RULE_004: mọi bản ghi vẫn xuất hiện ở chế độ tiếng Anh; mục chưa dịch
  // dùng tên tiếng Việt để người vận hành không mất khả năng tìm và chọn dữ liệu.
  // Key riêng brandsFilter() (khác brandsAll() của ProductDetailScreen) vì params
  // khác nhau (sort:'name:asc' vs không sort) — dùng chung key trước đây khiến 2
  // màn hình đọc nhầm cache của nhau khi cùng contentLang.
  const { data: brandsData } = useQuery({
    queryKey: queryKeys.brandsFilter(contentLang),
    queryFn: () => fetchBrands({ pageSize: 100, sort: 'name:asc' }),
    enabled: canReadCatalog,
    staleTime: 5 * 60_000,
  })
  const { data: categoriesData } = useQuery({
    queryKey: queryKeys.categoriesTree(contentLang),
    queryFn: () => fetchCategoryTree(),
    enabled: canReadCatalog,
    staleTime: 5 * 60_000,
  })
  const brands = useMemo(() => brandsData?.items ?? [], [brandsData])
  const categories = useMemo(() => categoriesData?.items ?? [], [categoriesData])
  // Depth-annotated (parent-first, child indented) order for the category filter dropdown —
  // categories is already flattened parent-before-children, this just adds `depth` per item.
  const categoryTreeOptions = useMemo(() => buildCategoryTreeOrder(categories), [categories])

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    setSelected(new Set())
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const handleDelete = useCallback(
    async (product) => {
      const confirmed = await showConfirm(
        t('products.deleteConfirm', { name: product.name }),
        t('common.moveToTrashTitle'),
        { confirmLabel: t('common.moveToTrash'), variant: 'default' },
      )
      if (!confirmed) return

      setDeletingId(product.id)
      try {
        await softDeleteProduct(product.id)
        queryClient.invalidateQueries({ queryKey: ['products'] })
        queryClient.invalidateQueries({ queryKey: ['product', product.id] })
        toast.success(t('products.deleteSuccess'))
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : error?.message || t('products.deleteError')
        toast.error(message)
      } finally {
        setDeletingId(null)
      }
    },
    [queryClient, t],
  )

  const handleRestore = useCallback(
    async (product) => {
      const confirmed = await showConfirm(
        t('products.restoreConfirm', { name: product.name }),
        t('products.restoreConfirmTitle'),
        { variant: 'default', confirmLabel: t('products.restore') },
      )
      if (!confirmed) return

      setRestoringId(product.id)
      try {
        await restoreProduct(product.id)
        queryClient.invalidateQueries({ queryKey: ['products'] })
        queryClient.invalidateQueries({ queryKey: ['product', product.id] })
        toast.success(t('products.restoreSuccess'))
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : error?.message || t('products.restoreError')
        toast.error(message)
      } finally {
        setRestoringId(null)
      }
    },
    [queryClient, t],
  )

  const handlePermanentDelete = useCallback(
    async (product) => {
      const confirmed = await showConfirm(
        t('products.permanentDeleteConfirm', {
          name: product.name,
          defaultValue: `Xoá vĩnh viễn sản phẩm ${product.name}. Thao tác này không thể hoàn tác.`,
        }),
        t('common.permanentDeleteTitle'),
        { confirmLabel: t('common.permanentDelete'), variant: 'danger' },
      )
      if (!confirmed) return

      setDeletingId(product.id)
      try {
        await permanentDeleteProduct(product.id)
        queryClient.invalidateQueries({ queryKey: ['products'] })
        queryClient.invalidateQueries({ queryKey: ['product', product.id] })
        toast.success(
          t('products.permanentDeleteSuccess', {
            defaultValue: 'Xoá vĩnh viễn sản phẩm thành công.',
          }),
        )
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : error?.message ||
              t('products.permanentDeleteError', {
                defaultValue: 'Không thể xoá vĩnh viễn sản phẩm.',
              })
        toast.error(message)
      } finally {
        setDeletingId(null)
      }
    },
    [queryClient, t],
  )

  const handleExportJson = useCallback(
    async (product) => {
      if (!canUpdate || exportingJsonId) return
      setExportingJsonId(product.id)
      try {
        await exportProductJson(product.id)
        toast.success(t('export.success'))
      } catch {
        toast.error(t('export.error'))
      } finally {
        setExportingJsonId(null)
      }
    },
    [canUpdate, exportingJsonId, t],
  )

  // O4/N7: toggle nhanh Xuất bản/Ẩn ngay trên bảng, không cần mở trang chi tiết —
  // cùng ý tưởng handleToggleVisibility đã có cho Danh mục (CategoryListScreen).
  // N7: cập nhật lạc quan (onMutate + rollback) — badge đổi ngay khi bấm thay vì
  // chỉ sau khi request thành công, mượn đúng mẫu của toggleVisibilityMutation
  // bên CategoryListScreen thay vì await xong mới invalidate như trước.
  const togglePublishMutation = useMutation({
    mutationFn: ({ id, nextStatus }) => publishProduct(id, nextStatus),
    onMutate: async ({ id, nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['products'] })
      const previousQueries = queryClient.getQueriesData({ queryKey: ['products'] })
      queryClient.setQueriesData({ queryKey: ['products'] }, (old) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.map((p) => (p.id === id ? { ...p, publishStatus: nextStatus } : p)),
        }
      })
      return { previousQueries }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] })
      toast.success(
        t('products.publishToggleSuccess', { defaultValue: 'Đã đổi trạng thái xuất bản.' }),
      )
      setTogglingPublishId(null)
    },
    onError: (error, _variables, context) => {
      context?.previousQueries?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      const message =
        error instanceof ApiClientError ? error.message : error?.message || t('common.error')
      toast.error(message)
      setTogglingPublishId(null)
    },
  })

  // Đăng bán (DRAFT→PUBLISHED) giờ chỉ làm được từ đây (trang sửa đã bỏ nút Lưu &
  // Đăng bán) — nên bảng kiểm chất lượng PRODUCT_RULE_005 chuyển hẳn từ trang sửa
  // sang đây: tải đủ dữ liệu sản phẩm rồi chạy đúng getPublishReadiness/PublishChecklistModal
  // cũ (Tên/Tên EN/Đường dẫn/Danh mục/Thương hiệu/SKU/Giá/Ảnh/Ảnh biến thể màu),
  // không chỉ 5 trường tóm tắt sẵn có ở dòng bảng. Ẩn sản phẩm (PUBLISHED→DRAFT) không cần kiểm.
  const handleTogglePublish = useCallback(
    async (product) => {
      if (!canUpdate) return
      const nextStatus = product.publishStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
      if (nextStatus === 'DRAFT') {
        setTogglingPublishId(product.id)
        togglePublishMutation.mutate({ id: product.id, nextStatus })
        return
      }
      setTogglingPublishId(product.id)
      try {
        const detail = await fetchProductDetail(product.id)
        setPublishChecklist({ productId: product.id, form: buildFormFromItem(detail.item) })
      } catch (error) {
        const message =
          error instanceof ApiClientError ? error.message : error?.message || t('common.error')
        toast.error(message)
      } finally {
        setTogglingPublishId(null)
      }
    },
    [canUpdate, togglePublishMutation, t],
  )

  const confirmPublishFromChecklist = useCallback(() => {
    if (!publishChecklist) return
    const { productId } = publishChecklist
    setPublishChecklist(null)
    setTogglingPublishId(productId)
    togglePublishMutation.mutate({ id: productId, nextStatus: 'PUBLISHED' })
  }, [publishChecklist, togglePublishMutation])

  const emptyState =
    query.publishStatus === 'TRASH'
      ? {
          title: t('products.emptyTrash', { defaultValue: 'Không có sản phẩm trong Thùng rác' }),
          description: t('products.emptyTrashDesc', {
            defaultValue: 'Xoá bộ lọc hoặc chuyển sang trạng thái khác.',
          }),
        }
      : {
          title: t('products.empty'),
          description: t('products.emptyDesc'),
        }

  function updateQuery(partial, options = { resetPage: false }) {
    setSelected(new Set())
    setQuery((previous) => {
      const next = { ...previous, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setQuery(INITIAL_QUERY)
  }

  const items = useMemo(() => state.items || [], [state.items])
  const pagination = state.pagination

  useEffect(() => {
    if (state.status !== 'success' || state.isFetching || !pagination) return
    const lastPage = Math.max(1, Number(pagination.totalPages) || 1)
    if (query.page <= lastPage) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set())
    setQuery((previous) => ({ ...previous, page: lastPage }))
  }, [pagination, query.page, state.isFetching, state.status])

  const isTrashView = query.publishStatus === 'TRASH'

  // In-header sort: maps a column to query.sort (định dạng "field:dir" như endpoint
  // sản phẩm đang dùng). AdminTable tự đảo chiều khi click lại cùng cột.
  const [sortField, sortDir] = (query.sort || '').split(':')
  const handleSortChange = useCallback((field, nextDir) => {
    updateQuery({ sort: `${field}:${nextDir}` }, { resetPage: true })
  }, [])

  const totalItems = pagination?.totalItems ?? items.length

  const handleProductCsvExport = useCallback(
    async ({ scope, preset, columns, includeDraft, includeTrash }) => {
      const exportOptions = {
        scope,
        preset,
        columns,
        includeDraft,
        includeTrash,
      }
      if (scope !== 'ALL') {
        exportOptions.q = query.search || undefined
        exportOptions.categoryId = query.categoryId || undefined
        exportOptions.brandId = query.brandId || undefined
        exportOptions.publishStatus = query.publishStatus || 'ALL'
        exportOptions.stockState = query.stockState || 'ALL'
        exportOptions.filterGender = query.gender || undefined
        if (scope === 'SELECTED') exportOptions.ids = [...selected]
      }
      try {
        await exportFullProductCatalogCsv(exportOptions)
      } catch {
        throw new Error(t('export.error'))
      }
      setExportDialogOpen(false)
      toast.success(t('export.success'))
    },
    [query, selected, t],
  )

  const runBulk = useCallback(
    async ({ confirmKey, titleKey, confirmLabel, variant, action, successKey }) => {
      const ids = [...selected]
      if (ids.length === 0) return
      const confirmed = await showConfirm(t(confirmKey, { count: ids.length }), t(titleKey), {
        confirmLabel: t(confirmLabel),
        variant,
      })
      if (!confirmed) return
      setBulkBusy(true)
      try {
        const results = await Promise.allSettled(ids.map((id) => action(id)))
        const ok = results.filter((r) => r.status === 'fulfilled').length
        const fail = results.length - ok
        queryClient.invalidateQueries({ queryKey: ['products'] })
        setSelected(new Set())
        if (fail === 0) toast.success(t(successKey, { count: ok }))
        else toast.error(t('products.bulkPartial', { ok, fail }))
      } finally {
        setBulkBusy(false)
      }
    },
    [selected, queryClient, t],
  )

  const handleBulkDelete = useCallback(
    () =>
      runBulk({
        confirmKey: 'products.bulkDeleteConfirm',
        titleKey: 'common.moveToTrashTitle',
        confirmLabel: 'common.moveToTrash',
        variant: 'default',
        action: softDeleteProduct,
        successKey: 'products.bulkDeleteSuccess',
      }),
    [runBulk],
  )

  const handleBulkRestore = useCallback(
    () =>
      runBulk({
        confirmKey: 'products.bulkRestoreConfirm',
        titleKey: 'products.restoreConfirmTitle',
        confirmLabel: 'products.restore',
        variant: 'default',
        action: restoreProduct,
        successKey: 'products.bulkRestoreSuccess',
      }),
    [runBulk],
  )

  const handleBulkPermanentDelete = useCallback(
    () =>
      runBulk({
        confirmKey: 'products.bulkPermanentDeleteConfirm',
        titleKey: 'common.permanentDeleteTitle',
        confirmLabel: 'common.permanentDelete',
        variant: 'danger',
        action: permanentDeleteProduct,
        successKey: 'products.bulkPermanentDeleteSuccess',
      }),
    [runBulk],
  )

  const bulkActions = canUpdate
    ? isTrashView
      ? [
          { label: t('products.bulkRestore'), onClick: handleBulkRestore, disabled: bulkBusy },
          {
            label: t('products.bulkPermanentDelete', { defaultValue: 'Xoá vĩnh viễn' }),
            tone: 'danger',
            onClick: handleBulkPermanentDelete,
            disabled: bulkBusy,
          },
        ]
      : [
          {
            label: t('products.bulkDelete'),
            onClick: handleBulkDelete,
            tone: 'danger',
            disabled: bulkBusy,
          },
        ]
    : []

  // Chip bộ lọc đang bật (ngoài mặc định) — mỗi chip có nút X để gỡ riêng.
  const filterChips = useMemo(() => {
    const chips = []
    if (query.search) {
      chips.push({
        key: 'search',
        label: `${t('common.search', { defaultValue: 'Tìm kiếm' })}: ${query.search}`,
        onRemove: () => {
          setSearchInput(INITIAL_QUERY.search)
        },
      })
    }
    if (query.categoryId) {
      const cat = categories.find((c) => c.id === query.categoryId)
      chips.push({
        key: 'category',
        label: `${t('products.filterCategory')}: ${cat?.name || query.categoryId}`,
        onRemove: () => updateQuery({ categoryId: '' }, { resetPage: true }),
      })
    }
    if (query.brandId) {
      const br = brands.find((b) => b.id === query.brandId)
      chips.push({
        key: 'brand',
        label: `${t('products.filterBrand')}: ${br?.name || query.brandId}`,
        onRemove: () => updateQuery({ brandId: '' }, { resetPage: true }),
      })
    }
    if (query.gender) {
      chips.push({
        key: 'gender',
        label: `${t('products.filterGender')}: ${query.gender}`,
        onRemove: () => updateQuery({ gender: '' }, { resetPage: true }),
      })
    }
    if (query.publishStatus !== 'ALL') {
      chips.push({
        key: 'publish',
        label: `${t('products.filterPublish')}: ${t(`status.publish.${query.publishStatus}`, { defaultValue: query.publishStatus })}`,
        onRemove: () => updateQuery({ publishStatus: 'ALL' }, { resetPage: true }),
      })
    }
    if (query.stockState !== 'ALL') {
      chips.push({
        key: 'stock',
        label: `${t('products.filterStock')}: ${t(`status.stock.${query.stockState}`, { defaultValue: query.stockState })}`,
        onRemove: () => updateQuery({ stockState: 'ALL' }, { resetPage: true }),
      })
    }
    return chips
  }, [
    query.search,
    query.categoryId,
    query.brandId,
    query.gender,
    query.publishStatus,
    query.stockState,
    categories,
    brands,
    t,
  ])

  const allColumns = [
    {
      key: 'name',
      label: t('products.colProduct'),
      sortable: true,
      render: (product) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="bb-product-thumb h-10 w-10 shrink-0">
            {product.image?.url ? (
              <img
                src={product.image.url}
                alt={product.image.alt || product.name}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <Package size={22} />
            )}
          </span>
          {formatText(product.name)}
        </div>
      ),
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (product) => (
        <span className="mono">{formatText(product.sku, t('products.skuFallback'))}</span>
      ),
    },
    {
      key: 'price',
      label: t('products.colPrice'),
      align: 'right',
      sortable: true,
      render: (product) => {
        const sale = product.price?.salePrice
        return (
          <div className="whitespace-nowrap font-bold">
            {sale > 0 ? (
              <>
                {formatCurrencyVnd(sale)}
                <div className="bb-cell-sub line-through">
                  {formatCurrencyVnd(product.price.retailPrice)}
                </div>
              </>
            ) : (
              formatCurrencyVnd(product.price?.retailPrice)
            )}
          </div>
        )
      },
    },
    {
      key: 'stock',
      label: t('products.colStock'),
      render: (product) => <StockCell state={product.stockState} />,
    },
    {
      key: 'category',
      label: t('products.colCategory'),
      render: (product) => {
        const catName = categoryLabel(product, t('products.uncategorized'))
        return formatText(catName)
      },
    },
    {
      key: 'brand',
      label: t('products.colBrand'),
      render: (product) =>
        product.brand?.name ? formatText(product.brand.name) : <span className="bb-muted">—</span>,
    },
    {
      key: 'homepage',
      label: t('products.colHomepage'),
      render: (product) => {
        const block = product.homepageBlock
        if (!block || block === 'NONE') return <span className="bb-muted">—</span>
        return (
          <span className="text-xs font-semibold">
            {t('products.homepageFeatured')}
            {Number.isFinite(product.homepageOrder) ? ` · #${product.homepageOrder}` : ''}
          </span>
        )
      },
    },
    {
      key: 'publish',
      label: t('products.colPublish'),
      render: (product) => <PublishStatusBadge value={product.publishStatus} />,
    },
    {
      key: 'updatedAt',
      label: t('products.colUpdated'),
      align: 'right',
      sortable: true,
      render: (product) => (
        <span className="bb-muted text-xs">{formatDateTime(product.updatedAt)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (product) => {
        const isTrashed = product.publishStatus === 'TRASH'
        const isBusy = deletingId === product.id || restoringId === product.id
        const isPublished = product.publishStatus === 'PUBLISHED'
        const detailPath = `/admin/products/${product.id}`
        const detailActionLabel = canUpdate ? t('common.edit') : t('common.view')
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="min-h-11 min-w-11"
              title={detailActionLabel}
              aria-label={detailActionLabel}
              onClick={() => navigate(detailPath)}
            >
              {canUpdate ? (
                <Pencil size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </Button>
            {/* P1-1: bật/tắt xuất bản ngay trên dòng (1 chạm) — đồng bộ với Danh mục/Thương hiệu */}
            {canUpdate && !isTrashed && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="min-h-11 min-w-11"
                loading={togglingPublishId === product.id}
                title={
                  isPublished
                    ? t('products.unpublishAction', { defaultValue: 'Chuyển về Nháp' })
                    : t('products.publishAction', { defaultValue: 'Xuất bản' })
                }
                aria-label={
                  isPublished
                    ? t('products.unpublishAction', { defaultValue: 'Chuyển về Nháp' })
                    : t('products.publishAction', { defaultValue: 'Xuất bản' })
                }
                onClick={() => handleTogglePublish(product)}
              >
                {isPublished ? (
                  <EyeOff size={16} aria-hidden="true" />
                ) : (
                  <Eye size={16} aria-hidden="true" />
                )}
              </Button>
            )}
            {/* P1-2: menu chuẩn (Radix) — điều hướng bàn phím, Escape đóng, quản lý focus */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="min-h-11 min-w-11"
                  title={t('common.actions')}
                  aria-label={t('common.actions')}
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => window.open(detailPath, '_blank', 'noopener')}>
                  <ExternalLink size={13} className="mr-2" />
                  {t('common.openInNewTab')}
                </DropdownMenuItem>
                {canUpdate && !isTrashed && (
                  <DropdownMenuItem
                    disabled={exportingJsonId === product.id}
                    onSelect={() => handleExportJson(product)}
                  >
                    <Download size={13} className="mr-2" />
                    {exportingJsonId === product.id
                      ? t('export.exporting', { defaultValue: 'Đang xuất...' })
                      : t('products.exportJson', { defaultValue: 'Xuất dữ liệu sản phẩm' })}
                  </DropdownMenuItem>
                )}
                {canUpdate && isTrashed && (
                  <>
                    <DropdownMenuItem disabled={isBusy} onSelect={() => handleRestore(product)}>
                      <Undo2 size={13} className="mr-2" />
                      {restoringId === product.id
                        ? t('products.restoringLabel')
                        : t('products.restore')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isBusy}
                      onSelect={() => handlePermanentDelete(product)}
                      className="text-danger focus:text-danger"
                    >
                      <Trash2 size={13} className="mr-2" />
                      {t('common.permanentDelete', { defaultValue: 'Xoá vĩnh viễn' })}
                    </DropdownMenuItem>
                  </>
                )}
                {canUpdate && !isTrashed && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isBusy}
                      onSelect={() => handleDelete(product)}
                      className="text-danger focus:text-danger"
                    >
                      <Trash2 size={13} className="mr-2" />
                      {deletingId === product.id ? t('products.deletingLabel') : t('common.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
  const columns = allColumns.filter((c) => !hiddenColumnKeys.includes(c.key))

  function mobileCard(product) {
    const isTrashed = product.publishStatus === 'TRASH'
    const isBusy = deletingId === product.id || restoringId === product.id
    const isPublished = product.publishStatus === 'PUBLISHED'
    const block = product.homepageBlock
    const detailPath = `/admin/products/${product.id}`
    const sale = product.price?.salePrice
    const catName = categoryLabel(product, t('products.uncategorized'))
    const detailActionLabel = canUpdate ? t('common.edit') : t('common.view')
    return {
      title: (
        <span className="flex items-center gap-2">
          <span className="bb-product-thumb h-8 w-8 shrink-0">
            {product.image?.url ? (
              <img
                src={product.image.url}
                alt={product.image.alt || product.name}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <Package size={18} />
            )}
          </span>
          {formatText(product.name)}
        </span>
      ),
      subtitle: formatText(product.sku, t('products.skuFallback')),
      status: <PublishStatusBadge value={product.publishStatus} />,
      meta: [
        {
          label: t('products.colPrice'),
          value:
            sale > 0 ? (
              <span>
                {formatCurrencyVnd(sale)}
                <span className="ms-2 line-through">
                  {formatCurrencyVnd(product.price.retailPrice)}
                </span>
              </span>
            ) : (
              formatCurrencyVnd(product.price?.retailPrice)
            ),
          tone: 'strong',
        },
        { label: t('products.colStock'), value: <StockCell state={product.stockState} /> },
        { label: t('products.colCategory'), value: formatText(catName) },
        {
          label: t('products.colBrand'),
          value: product.brand?.name ? (
            formatText(product.brand.name)
          ) : (
            <span className="bb-muted">—</span>
          ),
        },
        {
          label: t('products.colHomepage'),
          value:
            !block || block === 'NONE' ? (
              <span className="bb-muted">—</span>
            ) : (
              <span className="text-xs font-semibold">
                {t('products.homepageFeatured')}
                {Number.isFinite(product.homepageOrder) ? ` · #${product.homepageOrder}` : ''}
              </span>
            ),
        },
        { label: t('products.colUpdated'), value: formatDateTime(product.updatedAt) },
      ],
      actions: (
        <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="min-h-11 min-w-11"
            title={detailActionLabel}
            aria-label={detailActionLabel}
            onClick={() => navigate(detailPath)}
          >
            {canUpdate ? (
              <Pencil size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
          </Button>
          {canUpdate && !isTrashed && (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="min-h-11 min-w-11"
              loading={togglingPublishId === product.id}
              title={isPublished ? t('products.unpublishAction') : t('products.publishAction')}
              aria-label={isPublished ? t('products.unpublishAction') : t('products.publishAction')}
              onClick={() => handleTogglePublish(product)}
            >
              {isPublished ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </Button>
          )}
          {canUpdate && !isTrashed && (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="min-h-11 min-w-11"
              loading={exportingJsonId === product.id}
              title={t('products.exportJson')}
              aria-label={t('products.exportJson')}
              onClick={() => handleExportJson(product)}
            >
              <Download size={16} aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="min-h-11 min-w-11"
            title={t('common.openInNewTab')}
            aria-label={t('common.openInNewTab')}
            onClick={() => window.open(detailPath, '_blank', 'noopener')}
          >
            <ExternalLink size={16} aria-hidden="true" />
          </Button>
          {canUpdate && isTrashed && (
            <>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="min-h-11 min-w-11"
                loading={restoringId === product.id}
                disabled={isBusy && restoringId !== product.id}
                title={
                  restoringId === product.id ? t('products.restoringLabel') : t('products.restore')
                }
                aria-label={
                  restoringId === product.id ? t('products.restoringLabel') : t('products.restore')
                }
                onClick={() => handleRestore(product)}
              >
                <Undo2 size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="min-h-11 min-w-11 text-destructive hover:text-destructive"
                disabled={isBusy}
                title={t('common.permanentDelete', { defaultValue: 'Xoá vĩnh viễn' })}
                aria-label={t('common.permanentDelete', { defaultValue: 'Xoá vĩnh viễn' })}
                onClick={() => handlePermanentDelete(product)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </>
          )}
          {canUpdate && !isTrashed && (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="min-h-11 min-w-11 text-destructive hover:text-destructive"
              disabled={isBusy}
              title={deletingId === product.id ? t('products.deletingLabel') : t('common.delete')}
              aria-label={
                deletingId === product.id ? t('products.deletingLabel') : t('common.delete')
              }
              onClick={() => handleDelete(product)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
      onClick: () => navigate(detailPath),
    }
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('products.eyebrow')}
        title={t('products.title')}
        description={t('products.description')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              disabled={!canExport}
              title={!canExport ? t('products.requireExportPermission') : undefined}
              onExport={async () => setExportDialogOpen(true)}
            >
              {t('common.exportCsv', { defaultValue: 'Xuất dữ liệu' })}
            </ExportButton>
            <Input
              ref={importFileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => importFileInputRef.current?.click()}
              disabled={!canUpdate}
              title={!canUpdate ? t('products.requirePermission') : undefined}
            >
              {t('products.importFromFile')}
            </Button>
            <Button
              type="button"
              onClick={() => navigate('/admin/products/new')}
              disabled={!canUpdate}
              title={!canUpdate ? t('products.requirePermission') : undefined}
            >
              <Plus size={14} />
              {canUpdate ? t('products.create') : t('common.noPermission')}
            </Button>
          </div>
        }
      />

      <ProductExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        query={query}
        totalItems={totalItems}
        selectedIds={[...selected]}
        preferences={exportPreferences}
        onPreferencesChange={updateExportPreferences}
        onExport={handleProductCsvExport}
      />

      <ImportProductsDialog
        key={
          importFile ? `${importFile.name}-${importFile.lastModified}-${importFile.size}` : 'none'
        }
        file={importFile}
        open={Boolean(importFile)}
        onClose={() => setImportFile(null)}
      />

      {publishChecklist && (
        <PublishChecklistModal
          form={publishChecklist.form}
          onConfirm={confirmPublishFromChecklist}
          onCancel={() => setPublishChecklist(null)}
        />
      )}

      {/* O9 — Vừa xem gần đây */}
      <RecentItemsChips
        items={recentProductItems}
        onSelect={(item) => navigate(`/admin/products/${item.id}`)}
      />

      {!canUpdate ? (
        <ReadOnlyBanner
          warning={t('products.readOnly', {
            defaultValue:
              'Bạn chỉ có quyền xem sản phẩm. Cần quyền cập nhật danh mục để thay đổi dữ liệu.',
          })}
        />
      ) : state.warning ? (
        <ReadOnlyBanner warning={state.warning} />
      ) : null}

      {/* O5: preset lọc nhanh 1-click cho các view thường dùng nhất, thay vì phải
          mở dropdown FilterSelect rồi chọn giá trị. */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Button
          type="button"
          variant={query.stockState === 'OUT_OF_STOCK' ? 'default' : 'outline'}
          size="sm"
          onClick={() =>
            updateQuery(
              { stockState: query.stockState === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK' },
              { resetPage: true },
            )
          }
        >
          {t('products.presetOutOfStock', { defaultValue: 'Hết hàng' })}
        </Button>
        <Button
          type="button"
          variant={query.publishStatus === 'DRAFT' ? 'default' : 'outline'}
          size="sm"
          onClick={() =>
            updateQuery(
              { publishStatus: query.publishStatus === 'DRAFT' ? 'ALL' : 'DRAFT' },
              { resetPage: true },
            )
          }
        >
          {t('products.presetDraft', { defaultValue: 'Chưa xuất bản' })}
        </Button>
      </div>

      <FilterBar
        ariaLabel={t('products.filterAria', { defaultValue: 'Bộ lọc sản phẩm' })}
        className="mt-4"
      >
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('products.searchPlaceholder')}
          wrapperClassName="min-w-52 flex-1"
        />
        <FilterSelect
          value={query.categoryId || 'ALL'}
          onValueChange={(v) =>
            updateQuery({ categoryId: v === 'ALL' ? '' : v }, { resetPage: true })
          }
          ariaLabel={t('products.filterCategory')}
          options={[
            { value: 'ALL', label: t('products.filterCategory') },
            ...categoryTreeOptions.map((c) => ({
              value: c.id,
              label: (
                <span
                  className={
                    CATEGORY_FILTER_INDENT_CLASSES[
                      Math.min(c.depth, CATEGORY_FILTER_INDENT_CLASSES.length - 1)
                    ]
                  }
                >
                  {c.name}
                </span>
              ),
            })),
          ]}
        />
        <FilterSelect
          value={query.brandId || 'ALL'}
          onValueChange={(v) => updateQuery({ brandId: v === 'ALL' ? '' : v }, { resetPage: true })}
          ariaLabel={t('products.filterBrand')}
          options={[
            { value: 'ALL', label: t('products.filterBrand') },
            ...brands.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
        <FilterSelect
          value={query.gender || 'ALL'}
          onValueChange={(v) => updateQuery({ gender: v === 'ALL' ? '' : v }, { resetPage: true })}
          ariaLabel={t('products.filterGender')}
          options={[
            { value: 'ALL', label: t('products.filterGender') },
            { value: 'Nam', label: t('products.genderMale') },
            { value: 'Nữ', label: t('products.genderFemale') },
          ]}
        />
        <FilterSelect
          value={query.publishStatus}
          onValueChange={(v) => updateQuery({ publishStatus: v }, { resetPage: true })}
          ariaLabel={t('products.filterPublish')}
          options={[
            { value: 'ALL', label: t('products.filterPublish') },
            { value: 'DRAFT', label: t('status.publish.DRAFT') },
            { value: 'PUBLISHED', label: t('status.publish.PUBLISHED') },
            { value: 'TRASH', label: t('status.publish.TRASH') },
          ]}
        />
        <FilterSelect
          value={query.stockState}
          onValueChange={(v) => updateQuery({ stockState: v }, { resetPage: true })}
          ariaLabel={t('products.filterStock')}
          options={[
            { value: 'ALL', label: t('products.filterStock') },
            { value: 'IN_STOCK', label: t('status.stock.IN_STOCK') },
            { value: 'OUT_OF_STOCK', label: t('status.stock.OUT_OF_STOCK') },
          ]}
        />
        <FilterSelect
          value={query.sort}
          onValueChange={(v) => updateQuery({ sort: v }, { resetPage: true })}
          ariaLabel={t('products.filterSort')}
          options={[
            { value: 'updatedAt:desc', label: t('sort.newestUpdated') },
            { value: 'updatedAt:asc', label: t('sort.oldestUpdated') },
            { value: 'name:asc', label: t('sort.nameAZ') },
            { value: 'name:desc', label: t('sort.nameZA') },
            { value: 'homepageOrder:asc', label: t('products.sortHomepageOrder') },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
        />
        <ColumnVisibilityToggle
          allColumns={allColumnDefs}
          hiddenKeys={hiddenColumnKeys}
          onToggle={toggleColumn}
        />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={state.isFetching}
          onClick={() => state.refetch()}
        >
          <RefreshCw
            size={16}
            className={state.isFetching ? 'animate-spin' : undefined}
            aria-hidden="true"
          />
          {t('common.refresh', { defaultValue: 'Làm mới' })}
        </Button>
        {state.isFetching && state.status === 'success' ? (
          <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {t('products.refreshing', { defaultValue: 'Đang cập nhật' })}
          </span>
        ) : null}
      </FilterBar>

      <FilterChips
        chips={filterChips}
        onClearAll={filterChips.length > 1 ? resetFilters : undefined}
        clearAllLabel={t('common.resetFilters')}
        removeChipLabel={t('common.resetFilters')}
        ariaLabel={t('products.activeFilters', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {/* Vùng thông báo cho trình đọc màn hình: báo số kết quả sau khi lọc/sắp xếp. */}
      <span className="sr-only" role="status" aria-live="polite">
        {state.status === 'success'
          ? t('products.resultsAnnounce', {
              count: totalItems,
              defaultValue: `Đã lọc: ${totalItems} sản phẩm`,
            })
          : ''}
      </span>

      <BulkActionBar
        selectedCount={selected.size}
        onClear={() => setSelected(new Set())}
        actions={bulkActions}
      />

      {state.status === 'success' && HOMEPAGE_BLOCK_LIMITS[query.homepageBlock]
        ? (() => {
            const totalFlagged = pagination?.totalItems ?? items.length
            const limit = HOMEPAGE_BLOCK_LIMITS[query.homepageBlock]
            const blockLabel = t(
              HOMEPAGE_BLOCK_LABEL_KEYS[query.homepageBlock] ?? query.homepageBlock,
            )
            if (totalFlagged <= limit) return null
            return (
              <Alert tone="warning" role="status" className="my-3">
                <strong>{t('products.homepageWarnCount', { count: totalFlagged })}</strong>{' '}
                {t('products.homepageWarnDetail', { limit, block: blockLabel })}
              </Alert>
            )
          })()
        : null}

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('products.loadError')}
          description={state.error || t('common.unknownError')}
          actionLabel={t('common.retry')}
          onAction={() => state.refetch()}
        />
      ) : null}

      {state.status === 'success' && items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={emptyState.title}
          description={emptyState.description}
          actionLabel={t('common.resetFilters')}
          onAction={resetFilters}
        />
      ) : null}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <AdminTable
              columns={columns}
              rows={items}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              sortKey={sortField}
              sortDir={sortDir}
              onSortChange={handleSortChange}
              selectable
              selectedIds={[...selected]}
              onSelectionChange={(ids) => setSelected(new Set(ids))}
              onRowClick={(product) => navigate(`/admin/products/${product.id}`)}
              rowHref={(product) => `/admin/products/${product.id}`}
              mobileCard={mobileCard}
              rowClassName={(product) => publishRowAccent(product.publishStatus)}
            />
          </div>
          {state.status === 'success' && pagination && (
            <PaginationControls
              pagination={pagination}
              disabled={
                state.isFetching ||
                bulkBusy ||
                Boolean(deletingId) ||
                Boolean(restoringId) ||
                Boolean(togglingPublishId)
              }
              onPageChange={(p) => updateQuery({ page: p })}
            />
          )}
        </div>
      )}
    </Screen>
  )
}
