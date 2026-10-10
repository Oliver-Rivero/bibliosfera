import { useEffect, useRef } from 'react'
import { Calendar, Tag, FileText, Clock, X, Pencil, Trash2 } from 'lucide-react'
import { Book } from '../types'

interface BookDetailModalProps {
  book: Book
  onClose: () => void
  onEdit: (book: Book) => void
  onDelete: (id: string) => void
}

export default function BookDetailModal({ book, onClose, onEdit, onDelete }: BookDetailModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const closeModal = () => {
    dialogRef.current?.close()
    onClose()
  }

  const formatter = new Intl.DateTimeFormat('es-ES', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })
  const dateStr = book.dateRead ? formatter.format(new Date(book.dateRead)) : ''

  const rating = book.rating || 0

  return (
    <dialog
      ref={dialogRef}
      onCancel={closeModal}
      className="border-none rounded-[24px] bg-[var(--color-surface)] text-[var(--color-ink)] w-[min(760px,100%-32px)] max-h-[90vh] overflow-y-auto p-0 m-auto backdrop:bg-[rgba(20,35,42,0.65)] backdrop:backdrop-blur-[3px] shadow-2xl"
    >
      <div className="relative p-6 sm:p-8 flex flex-col gap-6">
        
        {/* Close Button */}
        <button
          onClick={closeModal}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[var(--color-bg)] hover:bg-[var(--color-line)] flex items-center justify-center transition-colors text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Layout: 2 Columns on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6 sm:gap-8 items-start">
          
          {/* Left Column: Cover & Quick Actions */}
          <div className="flex flex-col items-center sm:items-start gap-4">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-[160px] sm:w-[190px] h-[230px] sm:h-[270px] object-cover rounded-[10px] shadow-lg border border-[var(--color-line)] bg-white"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div 
                className="w-[160px] sm:w-[190px] h-[230px] sm:h-[270px] rounded-[10px] bg-[var(--color-teal)] text-[var(--color-cream)] flex items-center justify-center font-bold text-[36px] font-['Bricolage_Grotesque'] shadow-md"
                style={{ boxShadow: 'inset 10px 0 0 rgba(0,0,0,0.2)' }}
              >
                {book.title.substring(0, 2)}
              </div>
            )}

            {/* Rating display with half-star visual */}
            <div className="flex flex-col items-center sm:items-start gap-1 w-full mt-1">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-[3px]">
                  {[1, 2, 3, 4, 5].map((starIdx) => {
                    const isFull = rating >= starIdx
                    const isHalf = !isFull && rating >= starIdx - 0.5
                    return (
                      <div key={starIdx} className="relative w-5 h-5">
                        <svg className="absolute inset-0 w-5 h-5 fill-[var(--color-star)] opacity-25" viewBox="0 0 24 24">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        {(isFull || isHalf) && (
                          <div className="absolute inset-0 overflow-hidden" style={{ width: isFull ? '100%' : '50%' }}>
                            <svg className="w-5 h-5 fill-[var(--color-star)]" viewBox="0 0 24 24">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <span className="text-[14px] font-bold text-[var(--color-ink)] ml-1">
                  {rating.toFixed(1)} / 5
                </span>
              </div>
              
              {dateStr && (
                <span className="text-[12px] text-[var(--color-muted)] mt-0.5">
                  Terminado el {dateStr}
                </span>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex gap-2 w-full mt-2">
              <button
                onClick={() => {
                  closeModal()
                  onEdit(book)
                }}
                className="flex-1 py-2 px-3 rounded-[10px] bg-[var(--color-bg)] hover:bg-[var(--color-line)] text-[13px] font-bold text-[var(--color-ink)] transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
              
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar definitivamente "${book.title}" de Mis lecturas?`)) {
                    closeModal()
                    onDelete(book.id)
                  }
                }}
                className="py-2 px-3 rounded-[10px] bg-red-50 hover:bg-red-100 text-red-700 text-[13px] font-bold transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5"
                title="Eliminar de mi listado"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>

          {/* Right Column: Book Details & Synopsis */}
          <div className="flex flex-col gap-5 pr-4">
            
            <div>
              <h2 className="text-[26px] sm:text-[30px] font-bold leading-[1.15] font-['Bricolage_Grotesque'] text-[var(--color-ink)]">
                {book.title}
              </h2>
              <div className="text-[17px] text-[var(--color-muted)] font-medium mt-1">
                {book.author}
              </div>

              {/* Metadata Badges */}
              <div className="flex flex-wrap items-center gap-2 mt-3 text-[13px]">
                {book.year && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] font-medium text-[var(--color-ink)]">
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-muted)]" /> {book.year}
                  </span>
                )}
                {book.genre && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] font-medium text-[var(--color-ink)]">
                    <Tag className="w-3.5 h-3.5 text-[var(--color-muted)]" /> {book.genre}
                  </span>
                )}
                {book.pages && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] font-medium text-[var(--color-ink)]">
                    <FileText className="w-3.5 h-3.5 text-[var(--color-muted)]" /> {book.pages} páginas
                  </span>
                )}
                {book.readingTime && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] font-medium text-[var(--color-ink)]">
                    <Clock className="w-3.5 h-3.5 text-[var(--color-muted)]" /> {book.readingTime}
                  </span>
                )}
                {book.isbn && (
                  <span className="px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] font-mono text-[12px] opacity-80">
                    ISBN: {book.isbn}
                  </span>
                )}
              </div>
            </div>

            {/* Synopsis */}
            {book.synopsis && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  Sinopsis
                </span>
                <p className="text-[15px] text-[var(--color-ink)] leading-relaxed bg-[var(--color-bg)]/40 p-4 rounded-[14px] border border-[var(--color-line)]/50 whitespace-pre-line">
                  {book.synopsis}
                </p>
              </div>
            )}

            {/* Personal Reader Notes */}
            {book.comment ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                  Tu valoración personal
                </span>
                <div className="text-[15px] p-4 rounded-[14px] bg-[var(--color-bg)] border border-[var(--color-line)] leading-relaxed italic text-[var(--color-ink)]">
                  "{book.comment}"
                </div>
              </div>
            ) : (
              <div className="text-[13px] text-[var(--color-muted)] italic">
                Sin notas ni comentarios personales registrados todavía.
              </div>
            )}

          </div>

        </div>

      </div>
    </dialog>
  )
}
