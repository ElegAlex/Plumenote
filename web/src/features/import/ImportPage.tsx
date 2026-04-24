// web/src/features/import/ImportPage.tsx
// Page /import — gabarit g8 (flux 4 étapes : Source -> Aperçu -> Conversion -> Rapport).
//
// Data flow strictement préservé par rapport à l'ancienne version :
//  - FormData upload via useStartFolderImport (POST /api/import/folder)
//  - analyse ZIP via useAnalyzeZip (POST /api/import/analyze-zip)
//  - SSE progress via EventSource (/api/import/folder/progress/:jobId), géré dans ImportProgress.
import { useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderUp, FileArchive } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHead,
  CardTitle,
  PageTitle,
  Step,
  Stepper,
  TitleEyebrow,
} from '@/components/ui'
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

const SUPPORTED_EXT = ['.doc', '.docx', '.pptx', '.pdf', '.txt', '.md']

type Phase = 'select' | 'preview' | 'progress' | 'results'

interface DoneEvent {
  type: 'progress' | 'done'
  total: number
  success?: number
  failed?: number
  domains_created?: string[]
  folders_created?: number
}

export default function ImportPage() {
  const [phase, setPhase] = useState<Phase>('select')
  const [mode, setMode] = useState<'root' | 'domain'>('domain')
  const [domainId, setDomainId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [tree, setTree] = useState<TreeNode[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [files, setFiles] = useState<File[]>([])
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [source, setSource] = useState<'directory' | 'zip'>('directory')
  const [jobId, setJobId] = useState('')
  const [result, setResult] = useState<DoneEvent | null>(null)
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
    setPhase('preview')
  }, [])

  const handleZipSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setZipFile(file)
    setSource('zip')
    try {
      const resp = await analyzeZip.mutateAsync(file)
      setTree(resp.tree)
      const allPaths = getAllFilePaths(resp.tree)
      setSelected(new Set(allPaths))
      setPhase('preview')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'analyse du ZIP"
      alert(message)
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
        files: source === 'directory' ? files.filter(f => selected.has(f.webkitRelativePath)) : undefined,
        zipFile: source === 'zip' ? zipFile! : undefined,
      })
      setJobId(resp.job_id)
      errorsRef.current = []
      setPhase('progress')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors du lancement de l'import"
      alert(message)
    }
  }, [mode, domainId, typeId, source, files, zipFile, selected, startImport])

  const handleProgressError = useCallback((filename: string, error: string) => {
    errorsRef.current.push({ filename, error })
  }, [])

  const handleDone = useCallback((doneEvt: DoneEvent) => {
    setResult(doneEvt)
    setErrors([...errorsRef.current])
    setPhase('results')
  }, [])

  const handleReset = useCallback(() => {
    setPhase('select')
    setTree([])
    setSelected(new Set())
    setFiles([])
    setZipFile(null)
    setJobId('')
    setResult(null)
    setErrors([])
    errorsRef.current = []
  }, [])

  // --- Statuts dynamiques du Stepper -----------------------------------------------------
  const stepStatus = (target: Phase): 'done' | 'current' | 'todo' => {
    const order: Phase[] = ['select', 'preview', 'progress', 'results']
    const tIdx = order.indexOf(target)
    const pIdx = order.indexOf(phase)
    if (tIdx < pIdx) return 'done'
    if (tIdx === pIdx) return 'current'
    return 'todo'
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-8 py-7 flex flex-col gap-[22px]">
      {/* ============ Title block ============ */}
      <PageTitle
        eyebrow={<TitleEyebrow>Import par lot · Pipeline Pandoc + pdftotext</TitleEyebrow>}
        description="Convertissez en un clic un dossier complet de documentation (.docx, .pdf, .pptx, .txt, .md) vers PlumeNote. La structure de dossiers devient l'arborescence de domaines. Conversion 80/20 acceptée, validation manuelle possible après import."
      >
        Importer un dossier <em>dans la base</em>
      </PageTitle>

      {/* ============ Stepper 4 étapes ============ */}
      <Stepper columns={4}>
        <Step status={stepStatus('select')} index={1} label={`Étape 1 · ${statusLabel(stepStatus('select'))}`} title="Source" />
        <Step status={stepStatus('preview')} index={2} label={`Étape 2 · ${statusLabel(stepStatus('preview'))}`} title="Aperçu" />
        <Step status={stepStatus('progress')} index={3} label={`Étape 3 · ${statusLabel(stepStatus('progress'))}`} title="Conversion" />
        <Step status={stepStatus('results')} index={4} label={`Étape 4 · ${statusLabel(stepStatus('results'))}`} title="Rapport" />
      </Stepper>

      {/* ============ Phase Source ============ */}
      {phase === 'select' && (
        <Card>
          <CardHead>
            <CardTitle>Choisir la source</CardTitle>
          </CardHead>
          <CardBody>
            <div className="flex flex-col gap-5">
              {/* Mode d'import (radio) */}
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft mb-2">
                  Mode d'import
                </span>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-ink">
                    <input
                      type="radio"
                      name="import-mode"
                      value="root"
                      checked={mode === 'root'}
                      onChange={() => setMode('root')}
                      className="accent-coral"
                    />
                    Importer des domaines (racine)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-ink">
                    <input
                      type="radio"
                      name="import-mode"
                      value="domain"
                      checked={mode === 'domain'}
                      onChange={() => setMode('domain')}
                      className="accent-coral"
                    />
                    Importer dans un domaine existant
                  </label>
                </div>
                {mode === 'root' && (
                  <p className="text-xs text-ink-muted mt-2">
                    Les sous-dossiers de premier niveau deviendront des domaines.
                  </p>
                )}
              </div>

              {/* Domaine (si mode domain) */}
              {mode === 'domain' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft mb-1.5">
                    Domaine <span className="text-coral">*</span>
                  </label>
                  <select
                    value={domainId}
                    onChange={e => setDomainId(e.target.value)}
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-navy-700"
                  >
                    <option value="">Choisir un domaine...</option>
                    {domains?.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Type optionnel */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft mb-1.5">
                  Type de document
                </label>
                <select
                  value={typeId}
                  onChange={e => setTypeId(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-navy-700"
                >
                  <option value="">Aucun (optionnel)</option>
                  {docTypes?.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Boutons source : dossier local / ZIP */}
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft mb-2">
                  Sélectionner la source
                </span>
                <div className="flex flex-wrap gap-3">
                  <input
                    ref={dirInputRef}
                    type="file"
                    {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                    multiple
                    className="hidden"
                    onChange={handleDirectorySelect}
                  />
                  <Button
                    variant="secondary"
                    leftIcon={<FolderUp />}
                    onClick={() => dirInputRef.current?.click()}
                  >
                    Dossier local
                  </Button>

                  <input
                    ref={zipInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={handleZipSelect}
                  />
                  <Button
                    variant="secondary"
                    leftIcon={<FileArchive />}
                    onClick={() => zipInputRef.current?.click()}
                    disabled={analyzeZip.isPending}
                  >
                    {analyzeZip.isPending ? 'Analyse…' : 'Archive ZIP'}
                  </Button>
                </div>
                <p className="text-xs text-ink-muted mt-2">
                  Formats acceptés : .doc, .docx, .pptx, .pdf, .txt, .md. Les fichiers temporaires (~$, .DS_Store, Thumbs.db) sont ignorés automatiquement.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ============ Phase Aperçu ============ */}
      {phase === 'preview' && (
        <Card>
          <CardHead>
            <CardTitle>Aperçu de l'import</CardTitle>
            <button
              type="button"
              onClick={() => setPhase('select')}
              className="text-[11.5px] font-semibold text-navy-700 hover:text-coral transition"
            >
              Modifier la source
            </button>
          </CardHead>
          <CardBody>
            <PreviewTree
              tree={tree}
              mode={mode}
              selected={selected}
              onSelectionChange={setSelected}
            />
            <div className="flex flex-wrap gap-3 mt-5">
              <Button
                variant="cta"
                onClick={handleStartImport}
                disabled={selected.size === 0 || startImport.isPending || (mode === 'domain' && !domainId)}
              >
                {startImport.isPending
                  ? 'Envoi…'
                  : `Lancer l'import (${selected.size} fichier${selected.size > 1 ? 's' : ''})`}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPhase('select')}
              >
                Retour
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ============ Phase Conversion ============ */}
      {phase === 'progress' && jobId && (
        <ImportProgress
          jobId={jobId}
          onDone={handleDone}
          onError={handleProgressError}
        />
      )}

      {/* ============ Phase Rapport ============ */}
      {phase === 'results' && result && (
        <ImportResults
          result={result}
          errors={errors}
          onReset={handleReset}
        />
      )}
    </main>
  )
}

// --- Helpers ----------------------------------------------------------------------------

function statusLabel(s: 'done' | 'current' | 'todo'): string {
  if (s === 'done') return 'terminé'
  if (s === 'current') return 'en cours'
  return 'à venir'
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
