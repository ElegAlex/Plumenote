import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { OrphansResponse } from '@/lib/types'

export function useOrphans() {
  return useQuery({
    queryKey: ['admin', 'orphans'],
    queryFn: () => api.get<OrphansResponse>('/admin/analytics/orphans'),
  })
}
