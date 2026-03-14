import { useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useImportFile, useImportBatch } from '@/lib/hooks'
import { api } from '@/lib/api'
import type { Domain, BatchImportResult } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import FolderImportTab from './FolderImportTab'

interface DocumentType {
  id: string
  name: string
  slug: string
}

const ACCEPTED_EXTENSIONS = '.doc,.docx,.pdf,.txt,.md'
const MAX_SIZE_MB = 50

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<'files' | 'folder'>('files')
  const [dragActive, setDragActive] = useState(false)
  const [domainId, setDomainId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const importFile = useImportFile()
  const importBatch = useImportBatch()

  const { data: domains } = useQuery({
    queryKey: ['domains'],
    queryFn: () => api.get<Domain[]>('/domains'),
  })

  const { data: docTypes } = useQuery({
    queryKey: ['document-types'],
    queryFn: () => api.get<DocumentType[]>('/document-types'),
  })

  const isUploading = importFile.isPending || importBatch.isPending
  const hasResult = importFile.isSuccess || importFile.isError || importBatch.isSuccess || importBatch.isError

  const reset = useCallback(() => {
    setSelectedFiles([])
    importFile.reset()
    importBatch.reset()
    if (inputRef.current) inputRef.current.value = ''
  }, [importFile, importBatch])

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase()
      return ACCEPTED_EXTENSIONS.split(',').includes(ext) && f.size <= MAX_SIZE_MB * 1024 * 1024
    })
    if (arr.length === 0) return
    setSelectedFiles(arr)
  }, [])

  const handleUpload = useCallback(() => {
    if (!domainId || selectedFiles.length === 0) return
    const opts = { domainId, typeId: typeId || undefined }

    if (selectedFiles.length === 1) {
      importFile.mutate({ file: selectedFiles[0], ...opts })
    } else {
      importBatch.mutate({ files: selectedFiles, ...opts })
    }
  }, [domainId, typeId, selectedFiles, importFile, importBatch])

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }, [handleFiles])

  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <h1
        className="text-2xl font-bold tracking-tight mb-2"
        style={{ fontFamily: "'Archivo Black', sans-serif", color: '#1C1C1C' }}
      >
        Importer des fichiers
      </h1>
      <p className="text-ink-45 text-sm mb-6">
        Importez vos documents existants dans PlumeNote. Formats acceptés : .doc, .docx, .pdf, .txt, .md
      </p>

      {/* Tab bar */}
      <div className="flex border-b border-ink-10 mb-8">
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'files'
              ? 'border-blue text-blue'
              : 'border-transparent text-ink-45 hover:text-ink'
          }`}
        >
          Fichiers
        </button>
        <button
          onClick={() => setActiveTab('folder')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'folder'
              ? 'border-blue text-blue'
              : 'border-transparent text-ink-45 hover:text-ink'
          }`}
        >
          Dossier
        </button>
      </div>

      {activeTab === 'folder' && <FolderImportTab />}

      {activeTab === 'files' && (<>

      {/* Domain selector */}
      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-ink-70 mb-1.5">
          Domaine *
        </label>
        <select
          value={domainId}
          onChange={e => setDomainId(e.target.value)}
          disabled={isUploading}
          className="w-full border border-ink-10 rounded px-3 py-2 text-sm bg-bg text-ink focus:outline-none focus:border-blue"
        >
          <option value="">Choisir un domaine...</option>
          {domains?.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Type selector (optional) */}
      <div className="mb-8">
        <label className="block text-xs font-semibold uppercase tracking-wider text-ink-70 mb-1.5">
          Type de document
        </label>
        <select
          value={typeId}
          onChange={e => setTypeId(e.target.value)}
          disabled={isUploading}
          className="w-full border border-ink-10 rounded px-3 py-2 text-sm bg-bg text-ink focus:outline-none focus:border-blue"
        >
          <option value="">Aucun (optionnel)</option>
          {docTypes?.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      {!hasResult && (
        <div
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => !isUploading && inputRef.current?.click()}
          className={
            dragActive
              ? 'border-2 border-dashed border-blue bg-blue/5 rounded-lg p-12 text-center'
              : 'border-2 border-dashed border-ink-10 rounded-lg p-12 text-center cursor-pointer hover:border-blue/50 transition'
          }
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            onChange={onFileChange}
            className="hidden"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-blue" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-ink-45">Import en cours...</p>
            </div>
          ) : selectedFiles.length > 0 ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-ink font-medium">
                {selectedFiles.length === 1
                  ? selectedFiles[0].name
                  : `${selectedFiles.length} fichiers selectionnes`}
              </p>
              <button
                onClick={e => {
                  e.stopPropagation()
                  handleUpload()
                }}
                disabled={!domainId}
                className="px-5 py-2 bg-blue text-white text-sm font-semibold rounded hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {!domainId ? 'Choisissez un domaine' : 'Lancer l\'import'}
              </button>
              <button
                onClick={e => {
                  e.stopPropagation()
                  reset()
                }}
                className="text-xs text-ink-45 hover:text-ink transition"
              >
                Annuler
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-ink-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5M7.5 12.75L12 8.25l4.5 4.5" />
              </svg>
              <p className="text-sm text-ink-70 font-medium">
                Glissez vos fichiers ici ou cliquez pour parcourir
              </p>
              <p className="text-xs text-ink-45">
                .doc, .docx, .pdf, .txt, .md — max 50 Mo
              </p>
            </div>
          )}
        </div>
      )}

      {/* Single file result */}
      {importFile.isSuccess && importFile.data && (
        <div className="border border-ink-10 rounded-lg p-8 text-center">
          <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ink mb-1">Import reussi</p>
          {importFile.data.document && (
            <Link
              to={`/documents/${importFile.data.document.slug}`}
              className="text-sm text-blue hover:underline"
            >
              {importFile.data.document.title}
            </Link>
          )}
          <div className="mt-6">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium text-ink-70 border border-ink-10 rounded hover:bg-ink-05 transition"
            >
              Importer un autre fichier
            </button>
          </div>
        </div>
      )}

      {/* Single file error */}
      {importFile.isError && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-8 text-center">
          <p className="text-sm font-semibold text-red-700 mb-1">Erreur d'import</p>
          <p className="text-xs text-red-600">{(importFile.error as Error).message}</p>
          <div className="mt-6">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium text-ink-70 border border-ink-10 rounded hover:bg-ink-05 transition"
            >
              Reessayer
            </button>
          </div>
        </div>
      )}

      {/* Batch result */}
      {importBatch.isSuccess && importBatch.data && (
        <div className="border border-ink-10 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-ink-05 border-b border-ink-10">
            <p className="text-sm font-semibold text-ink">
              {importBatch.data.success} / {importBatch.data.total} fichiers importes
            </p>
            {importBatch.data.failed > 0 && (
              <p className="text-xs text-red-600 mt-0.5">{importBatch.data.failed} erreur(s)</p>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-10 text-left">
                <th className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-ink-45">Fichier</th>
                <th className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-ink-45">Statut</th>
              </tr>
            </thead>
            <tbody>
              {importBatch.data.results.map((r: BatchImportResult, i: number) => (
                <tr key={i} className="border-b border-ink-10 last:border-0">
                  <td className="px-6 py-2.5 text-ink">{r.filename}</td>
                  <td className="px-6 py-2.5">
                    {r.status === 'ok' && r.document ? (
                      <Link to={`/documents/${r.document.slug}`} className="text-blue hover:underline">
                        {r.document.title}
                      </Link>
                    ) : (
                      <span className="text-red-600">{r.error || 'Erreur'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-ink-10 text-center">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium text-ink-70 border border-ink-10 rounded hover:bg-ink-05 transition"
            >
              Importer un autre fichier
            </button>
          </div>
        </div>
      )}

      {/* Batch error */}
      {importBatch.isError && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-8 text-center">
          <p className="text-sm font-semibold text-red-700 mb-1">Erreur d'import</p>
          <p className="text-xs text-red-600">{(importBatch.error as Error).message}</p>
          <div className="mt-6">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium text-ink-70 border border-ink-10 rounded hover:bg-ink-05 transition"
            >
              Reessayer
            </button>
          </div>
        </div>
      )}

      </>)}
    </div>
  )
}
