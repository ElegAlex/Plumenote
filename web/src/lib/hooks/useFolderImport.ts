import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface AnalyzeZipResponse {
  tree: TreeNode[]
}

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  children?: TreeNode[]
}

interface FolderImportResponse {
  job_id: string
}

export function useAnalyzeZip() {
  return useMutation({
    mutationFn: async (file: File): Promise<AnalyzeZipResponse> => {
      const fd = new FormData()
      fd.append('file', file)
      return api.upload<AnalyzeZipResponse>('/import/analyze-zip', fd)
    },
  })
}

export function useStartFolderImport() {
  return useMutation({
    mutationFn: async (params: {
      mode: 'root' | 'domain'
      domainId?: string
      typeId?: string
      source: 'directory' | 'zip'
      files?: File[]
      paths: string[]
      zipFile?: File
    }): Promise<FolderImportResponse> => {
      const fd = new FormData()
      fd.append('mode', params.mode)
      fd.append('source', params.source)
      if (params.domainId) fd.append('domain_id', params.domainId)
      if (params.typeId) fd.append('type_id', params.typeId)

      params.paths.forEach(p => fd.append('paths[]', p))

      if (params.source === 'directory' && params.files) {
        // Use full webkitRelativePath as filename for server matching
        params.files.forEach(f => {
          fd.append('files[]', f, f.webkitRelativePath)
        })
      } else if (params.source === 'zip' && params.zipFile) {
        fd.append('file', params.zipFile)
      }

      return api.upload<FolderImportResponse>('/import/folder', fd)
    },
  })
}
