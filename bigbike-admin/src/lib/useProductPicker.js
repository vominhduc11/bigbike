import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchProducts } from './adminApi'
import { useDebounce } from './useDebounce'

/**
 * Logic tìm sản phẩm dùng chung cho các ô ProductPickerCombobox (fetch/debounce/query key).
 * Không quản lý state "open" của popover hay side-effect khi chọn sản phẩm — mỗi màn
 * gọi nơi vẫn tự quyết theo UI riêng (xem FeaturedProductsScreen/HomeHighlightsScreen/
 * SliderListScreen/ProductDetailScreen để biết cách ghép `open`/`onPick`).
 */
export function useProductPicker({
  queryKey,
  contentLang,
  params = {},
  debounceMs = 300,
  staleTime = 30_000,
  minQueryLength = 1,
  enabled = true,
}) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, debounceMs)

  const { data, isFetching } = useQuery({
    queryKey: [queryKey, debouncedSearch, contentLang],
    queryFn: () => fetchProducts({ q: debouncedSearch.trim(), ...params }),
    enabled: enabled && debouncedSearch.trim().length >= minQueryLength,
    staleTime,
  })

  const reset = useCallback(() => setSearch(''), [])

  return {
    search,
    setSearch,
    debouncedSearch,
    items: data?.items ?? [],
    isFetching,
    reset,
  }
}
