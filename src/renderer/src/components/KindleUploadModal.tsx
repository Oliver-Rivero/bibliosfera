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
  ExternalLink,
  Folder,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RotateCcw
} from 'lucide-react'

interface KindleUploadModalProps {
  isOpen: boolean
  onClose: () => void
  books?: LibraryBook[]
  initialSelectedIds?: string[]
  onConfirmUpload: (bookIds: string[], domain: string) => Promise<boolean>
}

export default function KindleUploadModal({
  isOpen,
  onClose,
  books = [],
  initialSelectedIds = [],
  onConfirmUpload
}: KindleUploadModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds)
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [step, setStep] = useState<'select' | 'ready'>('select')
  const [domain, setDomain] = useState<string>(() => {
    return localStorage.getItem('bibliosfera_kindle_domain') || 'amazon.es'
  })

  // Sync initial selections when opening modal
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedIds.length > 0) {
        setSelectedIds(initialSelectedIds)
      } else {
        setSelectedIds([])
      }
      setSearchQuery('')
      setIsUploading(false)
      setStep('select')
    }
  }, [isOpen, initialSelectedIds])

  const filteredBooks = useMemo(() => {
    const list = books || []
    const q = searchQuery.toLowerCase().trim()
    if (!q) return list
    return list.filter(b => 
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.format || '').toLowerCase().includes(q)
    )
  }, [books, searchQuery])

  const selectedBooksList = useMemo(() => {
    return (books || []).filter(b => selectedIds.includes(b.id))
  }, [books, selectedIds])

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
      const ok = await onConfirmUpload(selectedIds, domain)
      if (ok) {
        setStep('ready')
      }
    } catch {
      // error handled by showToast in LibraryView
    } finally {
      setIsUploading(false)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    return `${Math.round(bytes / 1024)} KB`
  }

  const handleReopenFolder = async () => {
    if (typeof window.api?.openKindleStagingDir === 'function') {
      await window.api.openKindleStagingDir()
    }
  }

  const handleReopenWeb = async () => {
    if (typeof window.api?.openSendToKindleWeb === 'function') {
      await window.api.openSendToKindleWeb(domain)
    }
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
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 transition-colors ${
              step === 'ready'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25'
            }`}>
              {step === 'ready' ? (
                <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
              ) : (
                <Wifi className="w-6 h-6 stroke-[2.2]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[19px] sm:text-[20px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-tight">
                  {step === 'ready' ? '¡Libros listos para enviar!' : 'Subir a Kindle (Sin cables)'}
                </h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  step === 'ready'
                    ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                }`}>
                  {step === 'ready' ? 'Paso 2: Arrastrar' : 'Sin cables'}
                </span>
              </div>
              <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
                {step === 'ready' 
                  ? 'Navegador y carpeta listos. Solo arrastra los libros a la web de Amazon.'
                  : 'Selecciona los libros que deseas enviar a tu lector a través de Send to Kindle'}
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

        {/* STEP 1: SELECT BOOKS */}
        {step === 'select' && (
          <>
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
            <div className="px-5 py-3 bg-amber-500/10 dark:bg-amber-950/20 border-t border-[var(--color-line)]/70 flex items-start gap-2.5 text-[12px] text-[var(--color-muted)] shrink-0">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                Bibliosfera preparará tus libros con sus <strong>títulos y autores limpios</strong> (sin códigos numéricos), abrirá <strong>Send to Kindle</strong> en tu navegador habitual y te pondrá la carpeta al lado para arrastrar y soltar en un segundo.
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
                    <span>Preparando libros y abriendo navegador...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {selectedIds.length === 0
                        ? 'Selecciona al menos un libro'
                        : selectedIds.length === 1
                          ? 'Preparar 1 libro y abrir navegador'
                          : `Preparar ${selectedIds.length} libros y abrir navegador`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* STEP 2: READY & ASSISTANT (Navegador y carpeta abiertos) */}
        {step === 'ready' && (
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* Guide Instructions */}
            <div className="p-5 sm:p-6 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-line)] flex flex-col gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-[13px] flex items-center justify-center">
                    1
                  </div>
                  <h4 className="font-bold text-[13px] text-[var(--color-ink)]">Navegador abierto</h4>
                  <p className="text-[12px] text-[var(--color-muted)] leading-relaxed">
                    Tu navegador habitual está en la web oficial de Send to Kindle con tu cuenta activa.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-line)] flex flex-col gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[13px] flex items-center justify-center">
                    2
                  </div>
                  <h4 className="font-bold text-[13px] text-[var(--color-ink)]">Títulos limpios</h4>
                  <p className="text-[12px] text-[var(--color-muted)] leading-relaxed">
                    La carpeta contiene los libros renombrados con <em>Título - Autor</em> (sin códigos numéricos).
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-line)] flex flex-col gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-400 font-bold text-[13px] flex items-center justify-center">
                    3
                  </div>
                  <h4 className="font-bold text-[13px] text-[var(--color-ink)]">Arrastra y pulsa Enviar</h4>
                  <p className="text-[12px] text-[var(--color-muted)] leading-relaxed">
                    Arrastra los archivos de la carpeta al recuadro de Amazon y pulsa el botón amarillo "Enviar".
                  </p>
                </div>
              </div>

              {/* Action Buttons to reopen if minimized */}
              <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/25 flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
                <div className="flex items-center gap-2 text-[var(--color-ink)] font-medium">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>¿Se minimizó alguna ventana? Puedes volver a traerla al frente aquí:</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleReopenFolder}
                    className="py-1.5 px-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[12px] font-bold text-[var(--color-ink)] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Ver carpeta con libros</span>
                  </button>
                  <button
                    onClick={handleReopenWeb}
                    className="py-1.5 px-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[12px] font-bold text-[var(--color-ink)] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Ver web de Amazon</span>
                  </button>
                </div>
              </div>

              {/* List of prepared files */}
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider px-1">
                  Libros preparados ({selectedBooksList.length})
                </span>
                <div className="divide-y divide-[var(--color-line)]/50 border border-[var(--color-line)] rounded-xl overflow-hidden bg-[var(--color-surface)] max-h-[160px] overflow-y-auto">
                  {selectedBooksList.map(b => (
                    <div key={b.id} className="p-2.5 flex items-center justify-between gap-3 text-[12.5px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                        <span className="font-bold text-[var(--color-ink)] truncate font-['Bricolage_Grotesque']">
                          {b.title}
                        </span>
                        <span className="text-[var(--color-muted)] truncate hidden sm:inline">
                          — {b.author && b.author !== 'Autor desconocido' ? b.author : ''}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[var(--color-muted)] shrink-0">
                        {(b.format || 'EPUB').toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-[var(--color-line)] bg-[var(--color-bg)]/40 flex items-center justify-between gap-3 shrink-0 mt-auto">
              <button
                onClick={() => setStep('select')}
                className="py-2 px-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[13px] font-semibold text-[var(--color-ink)] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Volver a seleccionar</span>
              </button>

              <button
                onClick={onClose}
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[13.5px] transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>¡Listo, cerrar ventana!</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
