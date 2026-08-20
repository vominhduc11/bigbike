import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { DropdownPopover } from '../../components/DropdownPopover'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useHasPermission } from '@/lib/auth'
import { createBrand } from '../../lib/adminApi'
import { toSlug } from '../../lib/slug'
import { queryKeys } from '../../lib/queryKeys'

// Sentinel row appended to the option list when the typed search doesn't match
// any existing brand — picking it creates the brand inline and auto-selects it.
const CREATE_ROW = { __create__: true }

/**
 * Ô chọn thương hiệu — combobox tìm kiếm (mirror ProductPickerCombobox: Input
 * ARIA combobox + DropdownPopover + ul/li listbox) cộng thêm dòng "+ Tạo
 * thương hiệu mới" khi tên gõ vào chưa khớp thương hiệu nào. Không dùng modal —
 * tạo ngay bằng tên đang gõ, giống flow "tạo loại thuộc tính mới" ở VariantEditors.
 */
export function BrandCombobox({ displayLabel, options = [], onChange, disabled, placeholder }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const hasPermission = useHasPermission()
  const canCreate = hasPermission('catalog.update') && !disabled

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const listboxId = useId()
  const optionId = (i) => `${listboxId}-opt-${i}`

  const trimmedSearch = search.trim()
  const filteredOptions = useMemo(() => {
    if (!trimmedSearch) return options
    const needle = trimmedSearch.toLowerCase()
    return options.filter((o) => (o.name || '').toLowerCase().includes(needle))
  }, [options, trimmedSearch])
  const hasExactMatch = options.some(
    (o) => (o.name || '').trim().toLowerCase() === trimmedSearch.toLowerCase(),
  )
  const showCreateRow = canCreate && trimmedSearch.length > 0 && !hasExactMatch
  const rows = showCreateRow ? [...filteredOptions, CREATE_ROW] : filteredOptions

  const createMut = useMutation({
    mutationFn: (name) => createBrand({ name, slug: toSlug(name) }),
    onSuccess: (result) => {
      const brand = result.item
      toast.success(
        t('products.detail.brandCreated', {
          name: brand.name,
          defaultValue: `Đã tạo thương hiệu ${brand.name}.`,
        }),
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.brandsAll('vi') })
      queryClient.invalidateQueries({ queryKey: queryKeys.brandsAll('en') })
      onChange(brand.id)
      setOpen(false)
      setSearch('')
    },
    onError: (err) =>
      toast.error(
        err?.message ||
          t('products.detail.brandCreateError', { defaultValue: 'Không tạo được thương hiệu.' }),
      ),
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(-1)
  }, [rows.length, trimmedSearch])

  function pick(row) {
    if (row.__create__) {
      if (!createMut.isPending) createMut.mutate(trimmedSearch)
      return
    }
    onChange(row.id)
    setOpen(false)
    setSearch('')
  }

  function onKeyDown(e) {
    if (!open || !rows.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % rows.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? rows.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      pick(rows[activeIndex])
    }
  }

  return (
    <DropdownPopover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
      anchor={
        <Input
          value={open ? search : displayLabel || ''}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            // Deferred: opening synchronously inside the same mousedown/focus cycle races
            // Radix's DismissableLayer (mounted via PopoverAnchor, not Trigger) into treating
            // the still-in-flight click as "outside" and closing immediately after opening.
            // A 0ms defer lets that cycle finish first.
            setTimeout(() => {
              setOpen(true)
              setSearch('')
            }, 0)
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={Boolean(open)}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground px-3 py-2">
          {t('products.detail.brandEmpty', { defaultValue: 'Không tìm thấy thương hiệu phù hợp.' })}
        </p>
      ) : (
        <ul id={listboxId} role="listbox" className="list-none">
          {rows.map((row, i) => (
            <li
              key={row.__create__ ? '__create__' : row.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => pick(row)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-left text-sm cursor-pointer',
                i === activeIndex && 'bg-muted',
                row.__create__ && 'text-primary font-medium',
              )}
            >
              {row.__create__
                ? t('products.detail.brandCreateOption', {
                    name: trimmedSearch,
                    defaultValue: `+ Tạo thương hiệu mới "${trimmedSearch}"`,
                  })
                : row.name}
            </li>
          ))}
        </ul>
      )}
    </DropdownPopover>
  )
}
