import { useMutation } from '@tanstack/react-query'
import type { ImportResult, BatchImportResponse } from '@/lib/types'

export function useImportFile() {
  return useMutation({
    mutationFn: async (params: { file: File; domainId: string; typeId?: string }): Promise<ImportResult> => {
      const formData = new FormData()
      formData.append('file', params.file)
      formData.append('domain_id', params.domainId)
      if (params.typeId) formData.append('type_id', params.typeId)

      const token = localStorage.getItem('token')
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      return data
    },
  })
}

export function useImportBatch() {
  return useMutation({
    mutationFn: async (params: { files: File[]; domainId: string; typeId?: string }): Promise<BatchImportResponse> => {
      const formData = new FormData()
      for (const file of params.files) {
        formData.append('files[]', file)
      }
      formData.append('domain_id', params.domainId)
      if (params.typeId) formData.append('type_id', params.typeId)

      const token = localStorage.getItem('token')
      const res = await fetch('/api/import/batch', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      return data
    },
  })
}
