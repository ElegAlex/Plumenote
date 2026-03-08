import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MindMapData } from '@/lib/types'

export function useMindMap(domainId?: string) {
  const params = new URLSearchParams()
  if (domainId) params.set('domain_id', domainId)
  const qs = params.toString()
  const path = `/mindmap${qs ? `?${qs}` : ''}`
  return useQuery({
    queryKey: ['mindmap', domainId],
    queryFn: () => api.get<MindMapData>(path),
  })
}
