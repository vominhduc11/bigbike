import { QueryClient } from '@tanstack/react-query'

export function shouldRetryQuery(failureCount, error) {
  const status = Number(error?.status)
  // 429 is intentionally not retried by the browser: Retry-After belongs to an explicit,
  // user-visible retry action. Other 4xx responses also require a user correction.
  if (status === 429 || (status >= 400 && status < 500)) return false
  return failureCount < 2
}

export function retryDelay(attemptIndex) {
  const exponential = Math.min(1_000 * (2 ** attemptIndex), 8_000)
  return exponential + Math.floor(Math.random() * 250)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetryQuery,
      retryDelay,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})
