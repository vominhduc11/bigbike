import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Pencil, Plus, RefreshCw } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { AdminTable } from '@/components/AdminTable'
import { ColumnVisibilityToggle } from '@/components/ColumnVisibilityToggle'
import { FilterSearchInput } from '@/components/FilterSearchInput'
import { FilterSelect } from '@/components/FilterSelect'
import { PaginationControls } from '@/components/PaginationControls'
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'
import { StatePanel } from '@/components/StatePanel'
import { FilterBar, FormField, Screen, ScreenHeader } from '@/components/layout'
import {
  createLegacyDiscontinuedProduct,
  fetchLegacyDiscontinuedProducts,
  updateLegacyDiscontinuedProduct,
} from '@/lib/adminApi'
import { formatDateTime } from '@/lib/formatters'
import { useAdminList } from '@/lib/useAdminList'
import { useDebounce } from '@/lib/useDebounce'
import { useColumnVisibility } from '@/lib/useColumnVisibility'
import { enabledRowAccent } from '@/lib/statusTone'

const INITIAL_QUERY = { search: '', enabled: 'ALL', page: 1, pageSize: 20 }
const EMPTY_FORM = {
  slug: '', name: '', nameEn: '', brandName: '', categorySlug: '', imageUrl: '', enabled: true,
}

function enabledBadge(enabled) {
  return enabled
    ? <span className="inline-flex items-center gap-2 text-sm text-success"><span className="h-2 w-2 rounded-full bg-success" />Đang hiển thị</span>
    : <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><span className="h-2 w-2 rounded-full bg-muted-foreground" />Đã tắt</span>
}

export function LegacyDiscontinuedProductsScreen({ canUpdate }) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)
  const firstSearch = useRef(true)
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')

  const state = useAdminList(
    ['legacy-discontinued-products', query.search, query.enabled, query.page, query.pageSize],
    () => fetchLegacyDiscontinuedProducts(query),
  )

  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false
      return
    }
    setQuery((previous) => ({ ...previous, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    if (state.status !== 'success' || !state.pagination) return
    if (query.page <= Math.max(1, state.pagination.totalPages || 1)) return
    const timer = window.setTimeout(() => setQuery((previous) => ({ ...previous, page: 1 })), 0)
    return () => window.clearTimeout(timer)
  }, [query.page, state.pagination, state.status])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        nameEn: form.nameEn.trim() || null,
        brandName: form.brandName.trim() || null,
        categorySlug: form.categorySlug.trim(),
        imageUrl: form.imageUrl.trim() || null,
        enabled: form.enabled,
      }
      return editing
        ? updateLegacyDiscontinuedProduct(editing.id, payload)
        : createLegacyDiscontinuedProduct(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legacy-discontinued-products'] })
      closeForm()
      toast.success(editing ? 'Đã cập nhật trang hàng ngừng bán.' : 'Đã thêm trang hàng ngừng bán.')
    },
    onError: (error) => setFormError(error?.message || 'Không thể lưu. Vui lòng kiểm tra lại các thông tin.'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }) => updateLegacyDiscontinuedProduct(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legacy-discontinued-products'] })
      toast.success('Đã cập nhật trạng thái hiển thị.')
    },
    onError: (error) => toast.error(error?.message || 'Không thể cập nhật trạng thái.'),
  })
  const { mutate: toggleProduct, isPending: isTogglePending } = toggleMutation

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function openCreate() {
    setFormOpen(true)
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function openEdit(item) {
    setFormOpen(true)
    setEditing(item)
    setForm({
      slug: item.slug || '', name: item.name || '', nameEn: item.nameEn || '', brandName: item.brandName || '',
      categorySlug: item.categorySlug || '', imageUrl: item.imageUrl || '', enabled: item.enabled !== false,
    })
    setFormError('')
  }

  function changeForm(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setFormError('')
  }

  function submit(event) {
    event.preventDefault()
    if (!canUpdate || saveMutation.isPending) return
    if (!form.slug.trim() || !form.name.trim() || !form.categorySlug.trim()) {
      setFormError('Cần nhập địa chỉ cũ, tên hàng và nhóm hàng để khách nhận được gợi ý phù hợp.')
      return
    }
    saveMutation.mutate()
  }

  const columns = useMemo(() => [
    {
      key: 'name', label: 'Mặt hàng cũ',
      render: (item) => <div className="min-w-0"><p className="m-0 font-medium text-foreground">{item.name || 'Chưa có tên'}</p><p className="m-0 mt-1 break-all font-mono text-xs text-muted-foreground">/sp/{item.slug}.html</p></div>,
    },
    { key: 'categorySlug', label: 'Nhóm hàng', render: (item) => <span className="font-mono text-sm">{item.categorySlug}</span> },
    { key: 'imageUrl', label: 'Ảnh', render: (item) => item.imageUrl ? <span className="text-sm text-success">Đã có ảnh</span> : <span className="text-sm text-warning">Chưa có ảnh</span> },
    { key: 'enabled', label: 'Trạng thái', render: (item) => enabledBadge(item.enabled) },
    { key: 'updatedAt', label: 'Cập nhật', render: (item) => <span className="text-xs text-muted-foreground">{formatDateTime(item.updatedAt)}</span> },
    ...(canUpdate ? [{
      key: 'actions', label: '', align: 'right',
      render: (item) => <span className="inline-flex items-center gap-1">
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={item.enabled ? 'Tắt hiển thị' : 'Bật hiển thị'} disabled={isTogglePending} onClick={() => toggleProduct({ id: item.id, enabled: !item.enabled })}>
          {item.enabled ? <EyeOff size={16} /> : <Eye size={16} />}
        </Button>
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Sửa ${item.name}`} onClick={() => openEdit(item)}>
          <Pencil size={16} />
        </Button>
      </span>,
    }] : []),
  ], [canUpdate, isTogglePending, toggleProduct])
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:legacy-discontinued')

  if (state.status === 'error') {
    return <Screen><StatePanel tone="danger" title="Không tải được danh sách hàng ngừng bán" description={state.error} actionLabel="Thử lại" onAction={() => state.refetch()} /></Screen>
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Sản phẩm"
        title="Hàng đã ngừng bán"
        description="Giữ các địa chỉ mặt hàng cũ có giá trị tìm kiếm. Khách sẽ thấy tên, ảnh và gợi ý hàng đang bán cùng nhóm; không tạo giá hay tồn kho giả."
        actions={canUpdate ? <Button className="min-h-11" onClick={openCreate} disabled={saveMutation.isPending}><Plus size={16} />Thêm hàng cũ</Button> : null}
      />

      {!canUpdate ? <ReadOnlyBanner warning="Bạn chỉ có quyền xem; không thể thêm, sửa hoặc bật/tắt trang hàng đã ngừng bán." /> : null}

      {formOpen ? (
        <section className="rounded-md border border-border bg-surface" aria-labelledby="legacy-history-form-title">
          <div className="border-b border-border px-4 py-3"><h2 id="legacy-history-form-title" className="m-0 text-base font-semibold">{editing ? 'Sửa hàng cũ' : 'Thêm hàng cũ'}</h2></div>
          <form onSubmit={submit} className="p-4">
            {formError ? <Alert tone="danger" size="sm" className="mb-4">{formError}</Alert> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Địa chỉ cũ (slug)" required helper="Chỉ phần sau /sp/ và trước .html, ví dụ gang-tay-cu.">
                <Input value={form.slug} maxLength={255} onChange={(event) => changeForm('slug', event.target.value)} placeholder="gang-tay-cu" disabled={!canUpdate} />
              </FormField>
              <FormField label="Tên mặt hàng" required>
                <Input value={form.name} maxLength={255} onChange={(event) => changeForm('name', event.target.value)} placeholder="Tên tiếng Việt" disabled={!canUpdate} />
              </FormField>
              <FormField label="Tên tiếng Anh" helper="Bỏ trống nếu chưa có; website sẽ dùng tên tiếng Việt.">
                <Input value={form.nameEn} maxLength={255} onChange={(event) => changeForm('nameEn', event.target.value)} placeholder="English name" disabled={!canUpdate} />
              </FormField>
              <FormField label="Thương hiệu cũ">
                <Input value={form.brandName} maxLength={255} onChange={(event) => changeForm('brandName', event.target.value)} placeholder="Không bắt buộc" disabled={!canUpdate} />
              </FormField>
              <FormField label="Slug nhóm hàng" required helper="Dùng nhóm đang hiển thị để gợi ý tối đa 3 hàng thay thế đúng chủ đề.">
                <Input value={form.categorySlug} maxLength={255} onChange={(event) => changeForm('categorySlug', event.target.value)} placeholder="gang-tay-xe-may-moto" disabled={!canUpdate} />
              </FormField>
              <FormField label="Đường dẫn ảnh đã kiểm chứng" helper="Chỉ dùng đường dẫn từ thư viện ảnh BigBike. Bỏ trống nếu chưa tìm được ảnh chính xác.">
                <Input value={form.imageUrl} maxLength={2048} onChange={(event) => changeForm('imageUrl', event.target.value)} placeholder="/media/uploads/..." disabled={!canUpdate} />
              </FormField>
              <div className="flex items-center gap-3 md:col-span-2">
                <Checkbox checked={form.enabled} onCheckedChange={(checked) => changeForm('enabled', checked === true)} disabled={!canUpdate} id="legacy-enabled" />
                <label htmlFor="legacy-enabled" className="text-sm font-medium text-foreground">Hiển thị trang “Đã ngừng bán”</label>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="secondary" className="min-h-11" onClick={closeForm} disabled={saveMutation.isPending}>Hủy</Button>
              <Button type="submit" className="min-h-11" disabled={!canUpdate || saveMutation.isPending}>{saveMutation.isPending ? 'Đang lưu…' : 'Lưu'}</Button>
            </div>
          </form>
        </section>
      ) : null}

      <FilterBar ariaLabel="Lọc hàng đã ngừng bán">
        <FilterSearchInput value={searchInput} onChange={setSearchInput} placeholder="Tìm tên hoặc địa chỉ cũ" wrapperClassName="min-w-64 flex-1" />
        <FilterSelect value={query.enabled} onValueChange={(enabled) => setQuery((previous) => ({ ...previous, enabled, page: 1 }))} ariaLabel="Trạng thái hiển thị" options={[{ value: 'ALL', label: 'Tất cả trạng thái' }, { value: 'true', label: 'Đang hiển thị' }, { value: 'false', label: 'Đã tắt' }]} />
        <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
        <Button type="button" variant="secondary" className="min-h-11" onClick={() => state.refetch()} disabled={state.isFetching}><RefreshCw size={16} className={state.isFetching ? 'animate-spin' : ''} />Làm mới</Button>
      </FilterBar>

      {state.status === 'success' && state.items.length === 0 ? (
        <StatePanel tone="neutral" title="Chưa có hàng cũ phù hợp" description="Thử đổi bộ lọc hoặc thêm một trang lịch sử mới." actionLabel={canUpdate ? 'Thêm hàng cũ' : undefined} onAction={canUpdate ? openCreate : undefined} />
      ) : (
        <AdminTable columns={visibleColumns} rows={state.items} loading={state.status === 'loading'} pageSize={query.pageSize} caption="Danh sách trang mặt hàng đã ngừng bán" rowClassName={(item) => enabledRowAccent(item.enabled)} onRowClick={canUpdate ? openEdit : undefined} />
      )}
      <PaginationControls pagination={state.pagination} disabled={state.isFetching} onPageChange={(page) => setQuery((previous) => ({ ...previous, page }))} />
    </Screen>
  )
}
