import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FlagReviewRequest, FlagReviewResponse } from '@/lib/types'

export function useFlagReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ documentId, needsReview }: { documentId: string; needsReview: boolean }) =>
      api.post<FlagReviewResponse>(`/documents/${documentId}/flag-review`, {
        needs_review: needsReview,
      } satisfies FlagReviewRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}
