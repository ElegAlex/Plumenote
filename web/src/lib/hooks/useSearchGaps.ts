import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SearchGap } from '@/lib/types'

export function useSearchGaps(limit = 20) {
  return useQuery({
    queryKey: ['admin', 'search-gaps', limit],
    queryFn: () => api.get<SearchGap[]>(`/admin/analytics/search-gaps?limit=${limit}`),
  })
}
