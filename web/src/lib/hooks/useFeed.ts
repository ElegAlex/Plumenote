import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FeedItem } from '@/lib/types'

interface UseFeedOptions {
  domainId?: string
  limit?: number
  offset?: number
}

export function useFeed(options: UseFeedOptions = {}) {
  const { domainId, limit = 20, offset = 0 } = options

  const params = new URLSearchParams()
  if (domainId) params.set('domain_id', domainId)
  if (limit !== 20) params.set('limit', String(limit))
  if (offset) params.set('offset', String(offset))

  const queryString = params.toString()
  const path = `/feed${queryString ? `?${queryString}` : ''}`

  return useQuery({
    queryKey: ['feed', domainId, limit, offset],
    queryFn: () => api.get<FeedItem[]>(path),
  })
}
