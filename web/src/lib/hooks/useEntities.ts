import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  EntityLabelConfig,
  EntityType,
  EntitySummary,
  EntityDetail,
  EntityCreatePayload,
} from '@/lib/types'

// === Entity Label ===
export function useEntityLabel() {
  return useQuery({
    queryKey: ['config', 'entity-label'],
    queryFn: () => api.get<EntityLabelConfig>('/entities/config/entity-label'),
    staleTime: 5 * 60 * 1000,
  })
}

// === Entity Types ===
export function useEntityTypes() {
  return useQuery({
    queryKey: ['entity-types'],
    queryFn: () => api.get<EntityType[]>('/entity-types'),
  })
}

export function useEntityType(id: string) {
  return useQuery({
    queryKey: ['entity-types', id],
    queryFn: () => api.get<EntityType>(`/entity-types/${id}`),
    enabled: !!id,
  })
}

// === Entities ===
export function useEntities(options: { domainId?: string; typeId?: string; q?: string } = {}) {
  const { domainId, typeId, q } = options
  const params = new URLSearchParams()
  if (domainId) params.set('domain_id', domainId)
  if (typeId) params.set('type_id', typeId)
  if (q) params.set('q', q)
  const qs = params.toString()
  const path = `/entities${qs ? `?${qs}` : ''}`
  return useQuery({
    queryKey: ['entities', domainId, typeId, q],
    queryFn: () => api.get<EntitySummary[]>(path),
  })
}

export function useEntity(id: string) {
  return useQuery({
    queryKey: ['entities', id],
    queryFn: () => api.get<EntityDetail>(`/entities/${id}`),
    enabled: !!id,
  })
}

export function useCreateEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: EntityCreatePayload) =>
      api.post<EntityDetail>('/entities', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] })
      qc.invalidateQueries({ queryKey: ['entity-types'] })
    },
  })
}

export function useUpdateEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: EntityCreatePayload & { id: string }) =>
      api.put<EntityDetail>(`/entities/${id}`, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['entities'] })
      qc.invalidateQueries({ queryKey: ['entities', variables.id] })
    },
  })
}

export function useDeleteEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/entities/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] })
      qc.invalidateQueries({ queryKey: ['entity-types'] })
    },
  })
}
