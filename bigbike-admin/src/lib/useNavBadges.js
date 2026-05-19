import { useQuery } from '@tanstack/react-query'
import { fetchOrders, fetchReturns } from './adminApi'

const STALE_TIME = 60_000

// Live "needs attention" counts rendered as sidebar nav badges.
// Each query is independent, gated on whether the user can actually see that
// module, and tolerates failure — a failed or still-loading query simply
// yields no badge instead of breaking the shell.
export function useNavBadges(visiblePaths) {
  const { data: pendingOrders } = useQuery({
    queryKey: ['nav-badge', 'orders-pending'],
    queryFn: () => fetchOrders({ orderStatus: 'PENDING', page: 1, pageSize: 1 }),
    enabled: visiblePaths.has('/admin/orders'),
    staleTime: STALE_TIME,
  })

  // Shares the cache key with DashboardScreen's pending-returns query so
  // visiting either screen warms the other.
  const { data: pendingReturns } = useQuery({
    queryKey: ['returns-pending-count'],
    queryFn: () => fetchReturns({ status: 'PENDING', page: 1, pageSize: 1 }),
    enabled: visiblePaths.has('/admin/returns'),
    staleTime: STALE_TIME,
  })

  return {
    '/admin/orders': pendingOrders?.pagination?.totalItems ?? 0,
    '/admin/returns': pendingReturns?.pagination?.totalItems ?? 0,
  }
}
