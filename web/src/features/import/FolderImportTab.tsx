// web/src/features/import/FolderImportTab.tsx
import { useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderUp, FileArchive } from 'lucide-react'
import { api } from '@/lib/api'
import type { Domain } from '@/lib/types'
import { useAnalyzeZip, useStartFolderImport, type TreeNode } from '@/lib/hooks/useFolderImport'
import PreviewTree from './PreviewTree'
import ImportProgress from './ImportProgress'
import ImportResults from './ImportResults'

interface DocumentType {
  id: string
  name: string
  slug: string
}

const SUPPORTED_EXT = ['.doc', '.docx', '.pdf', '.txt', '.md']

type Step = 'select' | 'preview' | 'progress' | 'results'

export default function FolderImportTab() {
  const [step, setStep] = useState<Step>('select')
  const [mode, setMode] = useState<'root' | 'domain'>('domain')
  const [domainId, setDomainId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [tree, setTree] = useState<TreeNode[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [files, setFiles] = useState<File[]>([])
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [source, setSource] = useState<'directory' | 'zip'>('directory')
  const [jobId, setJobId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [errors, setErrors] = useState<{ filename: string; error: string }[]>([])
  const dirInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const errorsRef = useRef<{ filename: string; error: string }[]>([])

  const { data: domains } = useQuery({
    queryKey: ['domains'],
    queryFn: () => api.get<Domain[]>('/domains'),
  })

  const { data: docTypes } = useQuery({
    queryKey: ['document-types'],
    queryFn: () => api.get<DocumentType[]>('/document-types'),
  })

  const analyzeZip = useAnalyzeZip()
  const startImport = useStartFolderImport()

  const handleDirectorySelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || [])
    const supported = fileList.filter(f => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
      return SUPPORTED_EXT.includes(ext) && !f.webkitRelativePath.split('/').some(p => p.startsWith('.'))
    })

    const entries = supported.map(f => ({
      path: f.webkitRelativePath,
      size: f.size,
    }))

    const treeNodes = buildClientTree(entries)
    setTree(treeNodes)
    setFiles(supported)
    setSource('directory')
    setSelected(new Set(entries.map(e => e.path)))
    setStep('preview')
  }, [])

  const handleZipSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setZipFile(file)
    setSource('zip')
    try {
      const result = await analyzeZip.mutateAsync(file)
      setTree(result.tree)
      const allPaths = getAllFilePaths(result.tree)
      setSelected(new Set(allPaths))
      setStep('preview')
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'analyse du ZIP")
    }
  }, [analyzeZip])

  const handleStartImport = useCallback(async () => {
    const paths = Array.from(selected)
    try {
      const resp = await startImport.mutateAsync({
        mode,
        domainId: mode === 'domain' ? domainId : undefined,
        typeId: typeId || undefined,
        source,
        paths,
        files: source === 'directory' ? files.filter(f => {
          return selected.has(f.webkitRelativePath)
        }) : undefined,
        zipFile: source === 'zip' ? zipFile! : undefined,
      })
      setJobId(resp.job_id)
      errorsRef.current = []
      setStep('progress')
    } catch (err: any) {
      alert(err.message || "Erreur lors du lancement de l'import")
    }
  }, [mode, domainId, typeId, source, files, zipFile, selected, startImport])

  const handleProgressError = useCallback((filename: string, error: string) => {
    errorsRef.current.push({ filename, error })
  }, [])

  const handleDone = useCallback((doneEvt: any) => {
    setResult(doneEvt)
    setErrors([...errorsRef.current])
    setStep('results')
  }, [])

  const handleReset = useCallback(() => {
    setStep('select')
    setTree([])
    setSelected(new Set())
    setFiles([])
    setZipFile(null)
    setJobId('')
    setResult(null)
    setErrors([])
    errorsRef.current = []
  }, [])

  return (
    <div className="space-y-6">
      {step === 'select' && (
        <div className="space-y-4">
          {/* Mode selection with native radio buttons */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-70 mb-1.5">
              Mode d'import
            </label>
            <div className="space-y-2 mt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  value="root"
                  checked={mode === 'root'}
                  onChange={() => setMode('root')}
                  className="accent-blue"
                />
                Importer des domaines (racine)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  value="domain"
                  checked={mode === 'domain'}
                  onChange={() => setMode('domain')}
                  className="accent-blue"
                />
                Importer dans un domaine existant
              </label>
            </div>
            {mode === 'root' && (
              <p className="text-xs text-ink-45 mt-1">
                Les sous-dossiers de premier niveau deviendront des domaines.
              </p>
            )}
          </div>

          {/* Domain selector (only in domain mode) */}
          {mode === 'domain' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-70 mb-1.5">
                Domaine *
              </label>
              <select
                value={domainId}
                onChange={e => setDomainId(e.target.value)}
                className="w-full border border-ink-10 rounded px-3 py-2 text-sm bg-bg text-ink focus:outline-none focus:border-blue"
              >
                <option value="">Choisir un domaine...</option>
                {domains?.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Type selector (optional) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-70 mb-1.5">
              Type de document
            </label>
            <select
              value={typeId}
              onChange={e => setTypeId(e.target.value)}
              className="w-full border border-ink-10 rounded px-3 py-2 text-sm bg-bg text-ink focus:outline-none focus:border-blue"
            >
              <option value="">Aucun (optionnel)</option>
              {docTypes?.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Source selection buttons */}
          <div className="flex gap-3">
            <input
              ref={dirInputRef}
              type="file"
              {...{ webkitdirectory: '', directory: '' } as any}
              multiple
              className="hidden"
              onChange={handleDirectorySelect}
            />
            <button
              onClick={() => dirInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-70 border border-ink-10 rounded hover:bg-ink-05 transition"
            >
              <FolderUp className="h-4 w-4" />
              Sélectionner un dossier
            </button>

            <input
              ref={zipInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleZipSelect}
            />
            <button
              onClick={() => zipInputRef.current?.click()}
              disabled={analyzeZip.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-70 border border-ink-10 rounded hover:bg-ink-05 transition disabled:opacity-40"
            >
              <FileArchive className="h-4 w-4" />
              {analyzeZip.isPending ? 'Analyse...' : 'Uploader un ZIP'}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Aperçu de l'import</h3>
          <PreviewTree tree={tree} mode={mode} selected={selected} onSelectionChange={setSelected} />
          <div className="flex gap-3">
            <button
              onClick={handleStartImport}
              disabled={selected.size === 0 || startImport.isPending || (mode === 'domain' && !domainId)}
              className="px-5 py-2 bg-blue text-white text-sm font-semibold rounded hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {startImport.isPending ? 'Envoi...' : `Lancer l'import (${selected.size} fichiers)`}
            </button>
            <button
              onClick={() => setStep('select')}
              className="px-4 py-2 text-sm font-medium text-ink-70 border border-ink-10 rounded hover:bg-ink-05 transition"
            >
              Retour
            </button>
          </div>
        </div>
      )}

      {step === 'progress' && jobId && (
        <ImportProgress jobId={jobId} onDone={handleDone} onError={handleProgressError} />
      )}

      {step === 'results' && result && (
        <ImportResults result={result} errors={errors} onReset={handleReset} />
      )}
    </div>
  )
}

// Build tree from flat file entries (client-side, for webkitdirectory)
function buildClientTree(entries: { path: string; size: number }[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'dir', children: [] }
  for (const entry of entries) {
    const parts = entry.path.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const fullPath = parts.slice(0, i + 1).join('/')
      if (i === parts.length - 1) {
        current.children!.push({ name: part, path: fullPath, type: 'file', size: entry.size })
      } else {
        let dir = current.children!.find(c => c.type === 'dir' && c.name === part)
        if (!dir) {
          dir = { name: part, path: fullPath, type: 'dir', children: [] }
          current.children!.push(dir)
        }
        current = dir
      }
    }
  }
  sortClientTree(root.children!)
  return root.children!
}

function sortClientTree(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const n of nodes) {
    if (n.children) sortClientTree(n.children)
  }
}

function getAllFilePaths(nodes: TreeNode[]): string[] {
  const paths: string[] = []
  for (const n of nodes) {
    if (n.type === 'file') paths.push(n.path)
    if (n.children) paths.push(...getAllFilePaths(n.children))
  }
  return paths
}
