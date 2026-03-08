import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { RelationType, RelationCreatePayload } from '@/lib/types'

export function useRelationTypes() {
  return useQuery({
    queryKey: ['relation-types'],
    queryFn: () => api.get<RelationType[]>('/relation-types'),
  })
}

export function useCreateRelation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RelationCreatePayload) =>
      api.post('/entity-relations', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] })
      qc.invalidateQueries({ queryKey: ['cartography'] })
    },
  })
}

export function useDeleteRelation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/entity-relations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] })
      qc.invalidateQueries({ queryKey: ['cartography'] })
    },
  })
}
