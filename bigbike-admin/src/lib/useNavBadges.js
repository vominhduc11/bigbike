import { useQuery } from '@tanstack/react-query'
import { fetchOrders } from './adminApi'

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

  return {
    '/admin/orders': pendingOrders?.pagination?.totalItems ?? 0,
  }
}
