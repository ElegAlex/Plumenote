import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { StatsHealth } from '@/lib/types'

export function useStatsHealth() {
  return useQuery({
    queryKey: ['stats', 'health'],
    queryFn: () => api.get<StatsHealth>('/stats/health'),
  })
}
