import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CartographyData } from '@/lib/types'

export function useCartography(domainId?: string) {
  const params = new URLSearchParams()
  if (domainId) params.set('domain_id', domainId)
  const qs = params.toString()
  const path = `/cartography${qs ? `?${qs}` : ''}`
  return useQuery({
    queryKey: ['cartography', domainId],
    queryFn: () => api.get<CartographyData>(path),
  })
}
