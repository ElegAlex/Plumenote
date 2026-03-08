import { useNavigate } from 'react-router-dom'
import { BookmarkFormInline } from './BookmarkForm'

export default function BookmarkNewPage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-xl mx-auto py-16 px-6">
      <h1
        className="text-2xl font-bold tracking-tight mb-8"
        style={{ fontFamily: "'Archivo Black', sans-serif" }}
      >
        Ajouter un lien externe
      </h1>
      <BookmarkFormInline onSaved={() => navigate(-1)} />
    </div>
  )
}
