import { useState, useEffect, useRef } from 'react'
import { X, Quote, Check } from 'lucide-react'
import { BookQuote } from '../types'

interface EditQuoteModalProps {
  quoteToEdit?: BookQuote
  onClose: () => void
  onSave: (quote: BookQuote) => void
}

export default function EditQuoteModal({ quoteToEdit, onClose, onSave }: EditQuoteModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)

  const [text, setText] = useState(quoteToEdit?.text || '')
  const [page, setPage] = useState(quoteToEdit?.page || '')
  const [note, setNote] = useState(quoteToEdit?.note || '')

  useEffect(() => {
    dialogRef.current?.showModal()
    textInputRef.current?.focus()
  }, [])

  const closeModal = () => {
    dialogRef.current?.close()
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      alert('Por favor, escribe el texto de la cita.')
      return
    }

    const updatedQuote: BookQuote = {
      id: quoteToEdit?.id || `quote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: text.trim(),
      page: page.trim() || undefined,
      note: note.trim() || undefined,
      dateAdded: quoteToEdit?.dateAdded || new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
      source: quoteToEdit?.source || 'manual'
    }

    onSave(updatedQuote)
    closeModal()
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={closeModal}
      className="border-none rounded-[20px] bg-[var(--color-surface)] text-[var(--color-ink)] w-[min(560px,100%-32px)] max-h-[90vh] overflow-y-auto p-0 m-auto backdrop:bg-[rgba(20,35,42,0.65)] backdrop:backdrop-blur-[3px] shadow-2xl z-50"
    >
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center">
              <Quote className="w-4 h-4" />
            </div>
            <h3 className="text-[18px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)]">
              {quoteToEdit ? 'Editar cita' : 'Añadir cita o pasaje'}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="w-8 h-8 rounded-full bg-[var(--color-bg)] hover:bg-[var(--color-line)] flex items-center justify-center transition-colors text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Quote Text */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Texto de la cita *
            </label>
            <textarea
              ref={textInputRef}
              rows={4}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="«Escribe aquí las palabras del autor que deseas recordar...»"
              className="w-full p-3.5 text-[14px] leading-relaxed rounded-[12px] bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)] font-serif italic"
            />
          </div>

          {/* Page or Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Página o posición (opcional)
            </label>
            <input
              type="text"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="Ej. Pág. 142 o Posición 2341"
              className="w-full px-3.5 py-2 text-[13px] rounded-[10px] bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Personal Note */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Tu nota o reflexión personal (opcional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="¿Qué te transmitió este pasaje? ¿Alguna idea para profundizar?"
              className="w-full p-3 text-[13px] rounded-[10px] bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-line)]">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 text-[13px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-[10px] bg-[var(--color-accent)] text-white text-[13px] font-bold shadow-sm hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Guardar cita</span>
          </button>
        </div>
      </form>
    </dialog>
  )
}
