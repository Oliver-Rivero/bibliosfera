import { useEffect, useRef, useState } from 'react'
import {
  Calendar,
  Tag,
  FileText,
  Clock,
  X,
  Pencil,
  Trash2,
  Quote,
  Smartphone,
  Plus,
  Copy,
  Check,
  FileDown
} from 'lucide-react'
import { Book, BookQuote } from '../types'
import ImportEReaderQuotesModal from './ImportEReaderQuotesModal'
import EditQuoteModal from './EditQuoteModal'

interface BookDetailModalProps {
  book: Book
  onClose: () => void
  onEdit: (book: Book) => void
  onDelete: (id: string) => void
  onUpdateBook?: (book: Book) => void
}

export default function BookDetailModal({
  book,
  onClose,
  onEdit,
  onDelete,
  onUpdateBook
}: BookDetailModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [currentBook, setCurrentBook] = useState<Book>(book)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showEditQuoteModal, setShowEditQuoteModal] = useState(false)
  const [quoteToEdit, setQuoteToEdit] = useState<BookQuote | undefined>(undefined)
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    setCurrentBook(book)
  }, [book])

  const closeModal = () => {
    dialogRef.current?.close()
    onClose()
  }

  const formatter = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const dateStr = currentBook.dateRead ? formatter.format(new Date(currentBook.dateRead)) : ''
  const rating = currentBook.rating || 0
  const quotes = currentBook.quotes || []

  // Handle single quote add/edit
  const handleSaveQuote = async (newOrUpdatedQuote: BookQuote) => {
    const existing = currentBook.quotes || []
    const index = existing.findIndex((q) => q.id === newOrUpdatedQuote.id)
    let nextQuotes: BookQuote[]
    if (index >= 0) {
      nextQuotes = [...existing]
      nextQuotes[index] = newOrUpdatedQuote
    } else {
      nextQuotes = [newOrUpdatedQuote, ...existing]
    }

    const updatedBook = { ...currentBook, quotes: nextQuotes }
    setCurrentBook(updatedBook)
    await window.api.saveBookQuotes(currentBook.id, nextQuotes)
    onUpdateBook?.(updatedBook)
  }

  // Handle single quote delete
  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('¿Eliminar esta cita del libro?')) return
    const existing = currentBook.quotes || []
    const nextQuotes = existing.filter((q) => q.id !== quoteId)
    const updatedBook = { ...currentBook, quotes: nextQuotes }
    setCurrentBook(updatedBook)
    await window.api.saveBookQuotes(currentBook.id, nextQuotes)
    onUpdateBook?.(updatedBook)
  }

  // Handle bulk quotes imported from eReader
  const handleImportComplete = (importedQuotes: BookQuote[]) => {
    const updatedBook = { ...currentBook, quotes: importedQuotes }
    setCurrentBook(updatedBook)
    onUpdateBook?.(updatedBook)
  }

  // Copy single quote to clipboard
  const handleCopyQuote = (q: BookQuote) => {
    let text = `«${q.text}»`
    if (q.page) text += ` — ${q.page}`
    text += ` (${currentBook.title}, ${currentBook.author || 'Autor'})`
    if (q.note) text += `\nNota: ${q.note}`
    navigator.clipboard.writeText(text)
    setCopiedQuoteId(q.id)
    setTimeout(() => setCopiedQuoteId(null), 2000)
  }

  // Export / copy all quotes formatted as Markdown (for Obsidian, Notion, blogs)
  const handleCopyAllMarkdown = () => {
    if (quotes.length === 0) return

    let md = `# Citas de "${currentBook.title}"\n`
    if (currentBook.author) md += `**Autor:** ${currentBook.author}\n`
    if (currentBook.year) md += `**Año:** ${currentBook.year}\n`
    md += `\n---\n\n`

    for (const q of quotes) {
      md += `> ${q.text.split('\n').join('\n> ')}\n>\n`
      const metaParts: string[] = []
      if (q.page) metaParts.push(`*${q.page}*`)
      if (q.source) metaParts.push(`*Fuente: ${q.source}*`)
      if (q.dateAdded) metaParts.push(`*${q.dateAdded}*`)
      if (metaParts.length > 0) {
        md += `> — ${metaParts.join(' • ')}\n`
      }
      if (q.note) {
        md += `\n> **Nota:** ${q.note}\n`
      }
      md += `\n`
    }

    navigator.clipboard.writeText(md)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  // Render source badge
  const renderSourceBadge = (source?: string) => {
    if (!source) return null
    const s = source.toLowerCase()
    let label = source
    let cls = 'bg-neutral-100 text-neutral-700 border-neutral-200'

    if (s.includes('kindle')) {
      label = 'Kindle'
      cls = 'bg-amber-50 text-amber-800 border-amber-200'
    } else if (s.includes('kobo')) {
      label = 'Kobo'
      cls = 'bg-red-50 text-red-800 border-red-200'
    } else if (s.includes('sony')) {
      label = 'Sony Reader'
      cls = 'bg-indigo-50 text-indigo-800 border-indigo-200'
    } else if (s === 'manual') {
      label = 'Manual'
      cls = 'bg-emerald-50 text-emerald-800 border-emerald-200'
    }

    return (
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${cls}`}
      >
        {label}
      </span>
    )
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        onCancel={closeModal}
        className="border-none rounded-[24px] bg-[var(--color-surface)] text-[var(--color-ink)] w-[min(860px,100%-32px)] max-h-[92vh] overflow-y-auto p-0 m-auto backdrop:bg-[rgba(20,35,42,0.65)] backdrop:backdrop-blur-[3px] shadow-2xl"
      >
        <div className="relative p-6 sm:p-8 flex flex-col gap-7">
          {/* Close Button */}
          <button
            onClick={closeModal}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[var(--color-bg)] hover:bg-[var(--color-line)] flex items-center justify-center transition-colors text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer z-10"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Top Section: Book Information (2 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-6 sm:gap-8 items-start">
            {/* Left Column: Cover & Quick Actions */}
            <div className="flex flex-col items-center sm:items-start gap-4">
              {currentBook.coverUrl ? (
                <img
                  src={currentBook.coverUrl}
                  alt={currentBook.title}
                  className="w-[160px] sm:w-[190px] h-[230px] sm:h-[270px] object-cover rounded-[10px] shadow-lg border border-[var(--color-line)] bg-white"
                  onError={(e) => {
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              ) : (
                <div
                  className="w-[160px] sm:w-[190px] h-[230px] sm:h-[270px] rounded-[10px] bg-[var(--color-teal)] text-[var(--color-cream)] flex items-center justify-center font-bold text-[36px] font-['Bricolage_Grotesque'] shadow-md"
                  style={{ boxShadow: 'inset 10px 0 0 rgba(0,0,0,0.2)' }}
                >
                  {currentBook.title.substring(0, 2)}
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
                          <svg
                            className="absolute inset-0 w-5 h-5 fill-[var(--color-star)] opacity-25"
                            viewBox="0 0 24 24"
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                          </svg>
                          {(isFull || isHalf) && (
                            <div
                              className="absolute inset-0 overflow-hidden"
                              style={{ width: isFull ? '100%' : '50%' }}
                            >
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
                    onEdit(currentBook)
                  }}
                  className="flex-1 py-2 px-3 rounded-[10px] bg-[var(--color-bg)] hover:bg-[var(--color-line)] text-[13px] font-bold text-[var(--color-ink)] transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>

                <button
                  onClick={() => {
                    if (
                      confirm(`¿Eliminar definitivamente "${currentBook.title}" de Mis lecturas?`)
                    ) {
                      closeModal()
                      onDelete(currentBook.id)
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
                  {currentBook.title}
                </h2>
                <div className="text-[17px] text-[var(--color-muted)] font-medium mt-1">
                  {currentBook.author}
                </div>

                {/* Metadata Badges */}
                <div className="flex flex-wrap items-center gap-2 mt-3 text-[13px]">
                  {currentBook.year && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] font-medium text-[var(--color-ink)]">
                      <Calendar className="w-3.5 h-3.5 text-[var(--color-muted)]" />{' '}
                      {currentBook.year}
                    </span>
                  )}
                  {currentBook.genre && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] font-medium text-[var(--color-ink)]">
                      <Tag className="w-3.5 h-3.5 text-[var(--color-muted)]" /> {currentBook.genre}
                    </span>
                  )}
                  {currentBook.pages && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] font-medium text-[var(--color-ink)]">
                      <FileText className="w-3.5 h-3.5 text-[var(--color-muted)]" />{' '}
                      {currentBook.pages} páginas
                    </span>
                  )}
                  {currentBook.readingTime && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] font-medium text-[var(--color-ink)]">
                      <Clock className="w-3.5 h-3.5 text-[var(--color-muted)]" />{' '}
                      {currentBook.readingTime}
                    </span>
                  )}
                  {currentBook.isbn && (
                    <span className="px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] font-mono text-[12px] opacity-80">
                      ISBN: {currentBook.isbn}
                    </span>
                  )}
                </div>
              </div>

              {/* Synopsis */}
              {currentBook.synopsis && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    Sinopsis
                  </span>
                  <p className="text-[14.5px] text-[var(--color-ink)] leading-relaxed bg-[var(--color-bg)]/40 p-4 rounded-[14px] border border-[var(--color-line)]/50 whitespace-pre-line max-h-[160px] overflow-y-auto">
                    {currentBook.synopsis}
                  </p>
                </div>
              )}

              {/* Personal Reader Notes */}
              {currentBook.comment ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                    Tu valoración personal
                  </span>
                  <div className="text-[14.5px] p-4 rounded-[14px] bg-[var(--color-bg)] border border-[var(--color-line)] leading-relaxed italic text-[var(--color-ink)]">
                    "{currentBook.comment}"
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Bottom Section: Quotes & Reading Notes */}
          <div className="border-t border-[var(--color-line)] pt-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center">
                  <Quote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] flex items-center gap-2">
                    <span>Citas y notas de lectura</span>
                    <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-muted)]">
                      {quotes.length} {quotes.length === 1 ? 'cita' : 'citas'}
                    </span>
                  </h3>
                </div>
              </div>

              {/* Section Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {quotes.length > 0 && (
                  <button
                    onClick={handleCopyAllMarkdown}
                    className="px-3 py-1.5 rounded-[10px] bg-[var(--color-bg)] hover:bg-[var(--color-line)] border border-[var(--color-line)] text-[12px] font-semibold text-[var(--color-ink)] transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Copiar todas las citas formateadas en Markdown"
                  >
                    {copiedAll ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedAll ? '¡Copiado en Markdown!' : 'Copiar en Markdown'}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setQuoteToEdit(undefined)
                    setShowEditQuoteModal(true)
                  }}
                  className="px-3 py-1.5 rounded-[10px] bg-[var(--color-bg)] hover:bg-[var(--color-line)] border border-[var(--color-line)] text-[12px] font-semibold text-[var(--color-ink)] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  <span>Añadir cita</span>
                </button>

                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-3.5 py-1.5 rounded-[10px] bg-[var(--color-accent)] text-white text-[12px] font-bold shadow-xs hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Importar de eReader</span>
                </button>
              </div>
            </div>

            {/* Quotes Cards or Empty State */}
            {quotes.length === 0 ? (
              <div className="py-8 px-6 text-center flex flex-col items-center justify-center gap-3 rounded-[16px] bg-[var(--color-bg)]/40 border border-dashed border-[var(--color-line)]">
                <div className="w-11 h-11 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center">
                  <Quote className="w-5 h-5" />
                </div>
                <div className="max-w-[420px]">
                  <h4 className="text-[15px] font-bold text-[var(--color-ink)]">
                    No hay citas registradas para este libro
                  </h4>
                  <p className="text-[13px] text-[var(--color-muted)] mt-1 leading-relaxed">
                    Guarda los pasajes más inspiradores manualmente o importa tus subrayados
                    directamente conectando tu Kindle, Kobo o Sony Reader por USB.
                  </p>
                </div>
                <div className="flex gap-2.5 mt-2">
                  <button
                    onClick={() => {
                      setQuoteToEdit(undefined)
                      setShowEditQuoteModal(true)
                    }}
                    className="px-3.5 py-1.5 rounded-[10px] bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] text-[12px] font-semibold hover:bg-[var(--color-line)] transition cursor-pointer"
                  >
                    + Añadir cita manual
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-3.5 py-1.5 rounded-[10px] bg-[var(--color-accent)] text-white text-[12px] font-bold shadow-xs hover:opacity-95 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Importar de eReader</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {quotes.map((q) => {
                  const isCopied = copiedQuoteId === q.id
                  return (
                    <div
                      key={q.id}
                      className="group relative p-4 rounded-[14px] bg-[var(--color-bg)]/40 hover:bg-[var(--color-bg)]/70 border border-[var(--color-line)]/70 transition-all flex flex-col gap-2.5"
                    >
                      {/* Quote Text */}
                      <div className="relative pl-6">
                        <span className="absolute left-0 -top-1.5 text-[28px] font-serif leading-none text-[var(--color-accent)]/40 select-none">
                          “
                        </span>
                        <p className="text-[14px] text-[var(--color-ink)] leading-relaxed italic font-serif">
                          {q.text}
                        </p>
                      </div>

                      {/* Reader's Personal Reflection / Note */}
                      {q.note && (
                        <div className="ml-6 text-[12.5px] text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-2 rounded-[10px] border border-[var(--color-accent)]/20 leading-snug">
                          <strong className="font-semibold">Nota:</strong> {q.note}
                        </div>
                      )}

                      {/* Card Footer: Metadata and Actions */}
                      <div className="ml-6 flex items-center justify-between pt-1 border-t border-[var(--color-line)]/40 text-[11px] text-[var(--color-muted)]">
                        <div className="flex flex-wrap items-center gap-2">
                          {q.page && (
                            <span className="bg-[var(--color-surface)] px-2 py-0.5 rounded-full border border-[var(--color-line)] font-medium text-[var(--color-ink)]">
                              {q.page}
                            </span>
                          )}
                          {renderSourceBadge(q.source)}
                          {q.dateAdded && <span>{q.dateAdded}</span>}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopyQuote(q)}
                            className="p-1.5 rounded-[6px] hover:bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition cursor-pointer"
                            title="Copiar cita"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setQuoteToEdit(q)
                              setShowEditQuoteModal(true)
                            }}
                            className="p-1.5 rounded-[6px] hover:bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition cursor-pointer"
                            title="Editar cita"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuote(q.id)}
                            className="p-1.5 rounded-[6px] hover:bg-red-50 text-[var(--color-muted)] hover:text-red-600 transition cursor-pointer"
                            title="Eliminar cita"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </dialog>

      {/* Submodal for Adding / Editing a Single Quote */}
      {showEditQuoteModal && (
        <EditQuoteModal
          quoteToEdit={quoteToEdit}
          onClose={() => {
            setShowEditQuoteModal(false)
            setQuoteToEdit(undefined)
          }}
          onSave={handleSaveQuote}
        />
      )}

      {/* Submodal for Importing Quotes from eReader */}
      {showImportModal && (
        <ImportEReaderQuotesModal
          targetBook={currentBook}
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}
    </>
  )
}
