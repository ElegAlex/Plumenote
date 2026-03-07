import { Plugin } from '@tiptap/pm/state'
import { Extension } from '@tiptap/react'

const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export function uploadImage(
  file: File,
  documentId: string | null,
): Promise<{ filepath: string }> {
  if (!ACCEPTED.includes(file.type)) {
    return Promise.reject(new Error('Format non supporte. Utilisez PNG, JPG, GIF ou WebP.'))
  }
  if (file.size > MAX_SIZE) {
    return Promise.reject(new Error('Image trop volumineuse (max 10 Mo).'))
  }
  if (!documentId) {
    return Promise.reject(new Error('Sauvegardez le document avant d\'ajouter des images.'))
  }

  const formData = new FormData()
  formData.append('file', file)
  const token = localStorage.getItem('token')

  return fetch(`/api/documents/${documentId}/attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async (res) => {
    if (!res.ok) throw new Error('Echec upload image')
    return res.json()
  })
}

export const ImageDrop = Extension.create({
  name: 'imageDrop',

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        props: {
          handleDrop(view, event) {
            const files = event.dataTransfer?.files
            if (!files?.length) return false
            const images = Array.from(files).filter((f) => ACCEPTED.includes(f.type))
            if (!images.length) return false

            event.preventDefault()
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })

            images.forEach((file) => {
              const documentId = ((editor.storage as unknown as Record<string, unknown>).imageDrop as { documentId?: string | null })?.documentId
              if (!documentId) {
                alert('Sauvegardez le document avant d\'ajouter des images.')
                return
              }
              const placeholder = `[Uploading ${file.name}...]`
              if (coords) {
                editor.chain().focus().insertContentAt(coords.pos, placeholder).run()
              }
              uploadImage(file, documentId).then(
                (data) => {
                  const content = editor.getHTML()
                  editor.commands.setContent(content.replace(placeholder, ''))
                  editor.commands.setImage({ src: data.filepath })
                },
                () => {
                  const content = editor.getHTML()
                  editor.commands.setContent(content.replace(placeholder, ''))
                },
              )
            })
            return true
          },
        },
      }),
    ]
  },

  addStorage() {
    return { documentId: null as string | null }
  },
})
