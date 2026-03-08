import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ReviewItem } from '@/lib/types'

interface UseReviewsOptions {
  domainId?: string
  limit?: number
  offset?: number
}

export function useReviews(options: UseReviewsOptions = {}) {
  const { domainId, limit = 20, offset = 0 } = options

  const params = new URLSearchParams()
  if (domainId) params.set('domain_id', domainId)
  if (limit !== 20) params.set('limit', String(limit))
  if (offset) params.set('offset', String(offset))

  const queryString = params.toString()
  const path = `/reviews/pending${queryString ? `?${queryString}` : ''}`

  return useQuery({
    queryKey: ['reviews', 'pending', domainId, limit, offset],
    queryFn: () => api.get<ReviewItem[]>(path),
  })
}
