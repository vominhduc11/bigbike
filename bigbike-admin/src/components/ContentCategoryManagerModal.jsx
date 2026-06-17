import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Plus, Loader2, Trash2 } from 'lucide-react'
import { Modal } from './layout/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  fetchContentCategories,
  createContentCategory,
  updateContentCategory,
  deleteContentCategory,
  mapValidationErrors,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'

const CATEGORIES_QUERY_KEY = ['content-reference', 'categories']

// Derive a backend-valid slug (^[a-z0-9]+(?:-[a-z0-9]+)*$) from a Vietnamese name.
function toSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const EMPTY_FORM = { id: null, name: '', slug: '', slugTouched: false }

// Quản lý danh mục bài viết — list + create/edit/delete on
// /admin/content/content-categories. Delete is blocked server-side (CATEGORY_IN_USE)
// when the category is still assigned to articles.
export function ContentCategoryManagerModal({ open, onClose }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  const categoriesQuery = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchContentCategories,
    enabled: open,
  })

  const isEditing = Boolean(form.id)

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing
        ? updateContentCategory(form.id, payload)
        : createContentCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY })
      toast.success(
        isEditing
          ? t('content.categoryManager.updated', { defaultValue: 'Đã cập nhật danh mục' })
          : t('content.categoryManager.created', { defaultValue: 'Đã tạo danh mục' }),
      )
      resetForm()
    },
    onError: (error) => {
      setErrors(mapValidationErrors(error))
      toast.error(error?.message || t('content.categoryManager.saveFailed', { defaultValue: 'Lưu danh mục thất bại' }))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (categoryId) => deleteContentCategory(categoryId),
    onSuccess: (_data, categoryId) => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY })
      toast.success(t('content.categoryManager.deleted', { defaultValue: 'Đã xoá danh mục' }))
      // If we were editing the category we just deleted, clear the form.
      if (form.id === categoryId) resetForm()
    },
    onError: (error) => {
      // CATEGORY_IN_USE arrives as a validation detail (top-level code is VALIDATION_ERROR).
      const inUse = Array.isArray(error?.details) && error.details.some((d) => d?.code === 'CATEGORY_IN_USE')
      const message = inUse
        ? t('content.categoryManager.deleteInUse', { defaultValue: 'Không thể xoá: danh mục vẫn đang gắn với bài viết. Hãy gỡ bài khỏi danh mục trước.' })
        : (error?.message || t('content.categoryManager.deleteFailed', { defaultValue: 'Xoá danh mục thất bại' }))
      toast.error(message)
    },
  })

  async function handleDelete(category) {
    const confirmed = await showConfirm(
      t('content.categoryManager.deleteConfirm', { defaultValue: `Xoá danh mục "${category.name}"?`, name: category.name }),
      t('content.categoryManager.deleteConfirmTitle', { defaultValue: 'Xoá danh mục' }),
    )
    if (!confirmed) return
    deleteMutation.mutate(category.id)
  }

  const categories = useMemo(
    () => (Array.isArray(categoriesQuery.data) ? categoriesQuery.data : []),
    [categoriesQuery.data],
  )

  function resetForm() {
    setForm(EMPTY_FORM)
    setErrors({})
  }

  function handleClose() {
    resetForm()
    onClose?.()
  }

  function onNameChange(value) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: prev.slugTouched ? prev.slug : toSlug(value),
    }))
  }

  function startEdit(category) {
    setForm({ id: category.id, name: category.name, slug: category.slug, slugTouched: true })
    setErrors({})
  }

  function handleSubmit(event) {
    event.preventDefault()
    const name = form.name.trim()
    const slug = (form.slug || toSlug(name)).trim()
    const nextErrors = {}
    if (!name) nextErrors.name = t('content.categoryManager.nameRequired', { defaultValue: 'Tên danh mục là bắt buộc' })
    if (!slug) nextErrors.slug = t('content.categoryManager.slugRequired', { defaultValue: 'Slug là bắt buộc' })
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    mutation.mutate({ name, slug })
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('content.categoryManager.title', { defaultValue: 'Quản lý danh mục bài viết' })}
      closeLabel={t('common.close', { defaultValue: 'Đóng' })}
    >
      <div className="flex flex-col gap-5">
        {/* Existing categories */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('content.categoryManager.existing', { defaultValue: 'Danh mục hiện có' })}
          </p>
          {categoriesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 size={15} className="animate-spin" />
              {t('common.loading', { defaultValue: 'Đang tải...' })}
            </div>
          ) : categoriesQuery.isError ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <span>{t('content.categoryManager.loadFailed', { defaultValue: 'Không tải được danh mục' })}</span>
              <Button variant="outline" size="sm" onClick={() => categoriesQuery.refetch()}>
                {t('common.retry', { defaultValue: 'Thử lại' })}
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              {t('content.categoryManager.empty', { defaultValue: 'Chưa có danh mục nào. Hãy thêm danh mục đầu tiên bên dưới.' })}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {categories.map((category) => (
                <li key={category.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{category.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{category.slug}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(category)}
                    >
                      <Pencil size={14} />
                      {t('common.edit', { defaultValue: 'Sửa' })}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(category)}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === category.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                      {t('common.delete', { defaultValue: 'Xoá' })}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Create / edit form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isEditing
              ? t('content.categoryManager.editTitle', { defaultValue: 'Sửa danh mục' })
              : t('content.categoryManager.addTitle', { defaultValue: 'Thêm danh mục mới' })}
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              {t('content.categoryManager.name', { defaultValue: 'Tên danh mục' })}
            </span>
            <Input
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('content.categoryManager.namePlaceholder', { defaultValue: 'Ví dụ: Tin khuyến mãi' })}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? <span className="text-xs text-destructive">{errors.name}</span> : null}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              {t('content.categoryManager.slug', { defaultValue: 'Slug (đường dẫn)' })}
            </span>
            <Input
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value, slugTouched: true }))}
              placeholder="tin-khuyen-mai"
              className="font-mono"
              aria-invalid={Boolean(errors.slug)}
            />
            {errors.slug ? <span className="text-xs text-destructive">{errors.slug}</span> : null}
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            {isEditing ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm} disabled={mutation.isPending}>
                {t('common.cancel', { defaultValue: 'Huỷ' })}
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {isEditing
                ? t('common.save', { defaultValue: 'Lưu' })
                : t('content.categoryManager.add', { defaultValue: 'Thêm danh mục' })}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
