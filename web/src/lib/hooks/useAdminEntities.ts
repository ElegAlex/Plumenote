import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { EntityTypeSchemaField } from '@/lib/types'

export function useCreateEntityType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; icon: string; schema: EntityTypeSchemaField[] }) =>
      api.post('/admin/entity-types', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entity-types'] }) },
  })
}

export function useUpdateEntityType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name: string; icon: string; schema: EntityTypeSchemaField[] }) =>
      api.put(`/admin/entity-types/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entity-types'] }) },
  })
}

export function useDeleteEntityType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/entity-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entity-types'] }) },
  })
}

export function useCreateRelationType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; slug: string; inverse_name: string; inverse_slug: string }) =>
      api.post('/admin/relation-types', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['relation-types'] }) },
  })
}

export function useDeleteRelationType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/relation-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['relation-types'] }) },
  })
}

export function useUpdateEntityLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (label: string) =>
      api.put('/admin/config/entity-label', { label }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config', 'entity-label'] }) },
  })
}
