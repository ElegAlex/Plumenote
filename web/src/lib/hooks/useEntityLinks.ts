import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useLinkDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityId, documentId }: { entityId: string; documentId: string }) =>
      api.post(`/entities/${entityId}/link-document`, { document_id: documentId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['entities', variables.entityId] })
    },
  })
}

export function useUnlinkDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityId, documentId }: { entityId: string; documentId: string }) =>
      api.delete(`/entities/${entityId}/link-document/${documentId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['entities', variables.entityId] })
    },
  })
}

export function useLinkBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityId, bookmarkId }: { entityId: string; bookmarkId: string }) =>
      api.post(`/entities/${entityId}/link-bookmark`, { bookmark_id: bookmarkId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['entities', variables.entityId] })
    },
  })
}

export function useUnlinkBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityId, bookmarkId }: { entityId: string; bookmarkId: string }) =>
      api.delete(`/entities/${entityId}/link-bookmark/${bookmarkId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['entities', variables.entityId] })
    },
  })
}
