import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Bookmark, BookmarkCreatePayload } from '@/lib/types'

export function useBookmarks(domainId?: string) {
  const params = new URLSearchParams()
  if (domainId) params.set('domain_id', domainId)
  const qs = params.toString()
  const path = `/bookmarks${qs ? `?${qs}` : ''}`

  return useQuery({
    queryKey: ['bookmarks', domainId],
    queryFn: () => api.get<Bookmark[]>(path),
  })
}

export function useCreateBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BookmarkCreatePayload) => api.post<Bookmark>('/bookmarks', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookmarks'] }) },
  })
}

export function useUpdateBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: BookmarkCreatePayload & { id: string }) =>
      api.put<Bookmark>(`/bookmarks/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookmarks'] }) },
  })
}

export function useDeleteBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/bookmarks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookmarks'] }) },
  })
}
