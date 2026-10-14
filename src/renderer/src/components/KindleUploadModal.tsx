import { useState, useMemo, useEffect } from 'react'
import { LibraryBook } from '../types'
import { 
  Wifi, 
  X, 
  Search, 
  CheckSquare, 
  Square, 
  Check, 
  Loader2, 
  ShieldCheck,
  FileText
} from 'lucide-react'

interface KindleUploadModalProps {
  isOpen: boolean
  onClose: () => void
  books: LibraryBook[]
  initialSelectedIds?: string[]
  onConfirmUpload: (bookIds: string[], domain: string) => Promise<void>
}

export default function KindleUploadModal({
  isOpen,
  onClose,
  books,
  initialSelectedIds = [],
  onConfirmUpload
}: KindleUploadModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds)
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [domain, setDomain] = useState<string>(() => {
    return localStorage.getItem('bibliosfera_kindle_domain') || 'amazon.es'
  })

  // Sync initial selections when opening modal
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedIds.length > 0) {
        setSelectedIds(initialSelectedIds)
      } else {
        // By default, if nothing is selected, start empty so user explicitly picks
        setSelectedIds([])
      }
      setSearchQuery('')
      setIsUploading(false)
    }
  }, [isOpen, initialSelectedIds])

  const filteredBooks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return books
    return books.filter(b => 
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.format || '').toLowerCase().includes(q)
    )
  }, [books, searchQuery])

  if (!isOpen) return null

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedIds.length === filteredBooks.length && filteredBooks.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredBooks.map(b => b.id))
    }
  }

  const handleSubmit = async () => {
    if (selectedIds.length === 0 || isUploading) return
    setIsUploading(true)
    try {
      await onConfirmUpload(selectedIds, domain)
      onClose()
    } catch {
      setIsUploading(false)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    return `${Math.round(bytes / 1024)} KB`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[24px] shadow-2xl w-full max-w-[620px] max-h-[90vh] overflow-hidden flex flex-col animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[var(--color-line)] flex items-center justify-between bg-[var(--color-bg)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-500/25 shrink-0">
              <Wifi className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[19px] sm:text-[20px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-tight">
                  Subir a Kindle (Inalámbrico)
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                  Sin cables
                </span>
              </div>
              <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
                Selecciona los libros que deseas enviar a tu lector a través de Send to Kindle
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isUploading}
            className="p-2 rounded-full hover:bg-[var(--color-line)]/50 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Store selector & Search & Quick Select */}
        <div className="p-4 bg-[var(--color-bg)]/20 border-b border-[var(--color-line)] flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar libro por título o autor..."
                className="w-full bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl pl-9 pr-3 py-1.5 text-[13px] text-[var(--color-ink)] focus:outline-[var(--color-accent)]"
              />
            </div>

            {/* Amazon Store Domain */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11.5px] text-[var(--color-muted)] font-medium">Tienda:</span>
              <select
                value={domain}
                onChange={(e) => {
                  const val = e.target.value
                  setDomain(val)
                  localStorage.setItem('bibliosfera_kindle_domain', val)
                }}
                className="px-2 py-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] text-[12px] font-semibold text-[var(--color-ink)] cursor-pointer"
              >
                <option value="amazon.es">Amazon España (.es)</option>
                <option value="amazon.com">Amazon USA / Int. (.com)</option>
                <option value="amazon.com.mx">Amazon México (.com.mx)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-[12px] text-[var(--color-muted)] px-1">
            <button
              onClick={handleSelectAll}
              className="text-[var(--color-accent)] hover:underline font-semibold cursor-pointer flex items-center gap-1.5"
            >
              {selectedIds.length === filteredBooks.length && filteredBooks.length > 0 ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Deseleccionar todos</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Seleccionar todos ({filteredBooks.length})</span>
                </>
              )}
            </button>

            <span className="font-medium">
              {selectedIds.length} de {books.length} seleccionados
            </span>
          </div>
        </div>

        {/* Scrollable Books List */}
        <div className="overflow-y-auto flex-1 divide-y divide-[var(--color-line)]/50 p-2 sm:p-3 max-h-[380px]">
          {filteredBooks.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-muted)] text-[13px]">
              No se encontraron libros que coincidan con la búsqueda.
            </div>
          ) : (
            filteredBooks.map((book) => {
              const isSelected = selectedIds.includes(book.id)
              const formatUpper = (book.format || 'EPUB').toUpperCase()
              return (
                <div
                  key={book.id}
                  onClick={() => toggleSelect(book.id)}
                  className={`p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-amber-500/10 dark:bg-amber-950/25 border border-amber-500/30' 
                      : 'hover:bg-[var(--color-bg)]/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition-all ${
                      isSelected 
                        ? 'bg-amber-600 border-amber-600 text-white' 
                        : 'border-[var(--color-line)] bg-[var(--color-surface)] text-transparent'
                    }`}>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>

                    {/* Book Cover or Badge */}
                    {book.coverUrl ? (
                      <img 
                        src={book.coverUrl} 
                        alt={book.title} 
                        className="w-9 h-12 object-cover rounded-md border border-[var(--color-line)] bg-[var(--color-bg)] shrink-0 shadow-2xs" 
                      />
                    ) : (
                      <div className="w-9 h-12 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)] flex items-center justify-center text-[10px] font-bold text-[var(--color-muted)] shrink-0 font-['Bricolage_Grotesque']">
                        {(book.title || 'LI').substring(0, 2).toUpperCase()}
                      </div>
                    )}

                    {/* Book Metadata */}
                    <div className="min-w-0">
                      <h4 className="font-bold text-[13.5px] text-[var(--color-ink)] truncate font-['Bricolage_Grotesque']">
                        {book.title}
                      </h4>
                      <p className="text-[12px] text-[var(--color-muted)] truncate">
                        {book.author && book.author !== 'Autor desconocido' ? book.author : 'Autor desconocido'}
                      </p>
                    </div>
                  </div>

                  {/* Format & Size Badge */}
                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <span className="font-mono text-[10.5px] text-[var(--color-muted)] hidden sm:inline">
                      {formatFileSize(book.fileSize)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-bold text-[10.5px] tracking-wider uppercase bg-[var(--color-line)]/60 text-[var(--color-ink)]">
                      {formatUpper}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Informative Security & Workflow Banner */}
        <div className="px-5 py-3 bg-amber-500/5 dark:bg-amber-950/20 border-t border-[var(--color-line)]/70 flex items-start gap-2.5 text-[12px] text-[var(--color-muted)] shrink-0">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>
            Se abrirá la ventana oficial de <strong>Send to Kindle</strong>. Si es la primera vez, inicia sesión en Amazon: Bibliosfera recordará tu cuenta y cargará tus libros automáticamente.
          </span>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[var(--color-line)] bg-[var(--color-bg)]/40 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="py-2 px-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[13px] font-semibold text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={handleSubmit}
            disabled={selectedIds.length === 0 || isUploading}
            className="py-2.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[13.5px] transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Abriendo Send to Kindle...</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                <span>
                  {selectedIds.length === 0
                    ? 'Selecciona al menos un libro'
                    : selectedIds.length === 1
                      ? 'Subir 1 libro a Kindle'
                      : `Subir ${selectedIds.length} libros a Kindle`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
