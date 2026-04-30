import { useQuery, keepPreviousData } from '@tanstack/react-query'

/**
 * Wraps useQuery for paginated admin list screens.
 * Returns the same { status, items, pagination, warning, error } shape
 * the screens already use, so JSX rendering stays identical.
 */
export function useAdminList(queryKey, queryFn) {
  const result = useQuery({
    queryKey,
    queryFn,
    placeholderData: keepPreviousData,
  })

  const { data, isLoading, isFetching, isError, error } = result

  const status = isLoading ? 'loading' : isError ? 'error' : 'success'

  return {
    status,
    isFetching,
    items: data?.items ?? [],
    pagination: data?.pagination ?? null,
    warning: data?.mode === 'mock' ? (data?.warning ?? '') : '',
    error: error?.message ?? '',
    refetch: result.refetch,
  }
}
