import { useState, useEffect, useRef } from 'react'
import {
  X,
  Smartphone,
  HardDrive,
  BookOpen,
  Check,
  Search,
  Upload,
  RefreshCw,
  AlertCircle,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react'
import { Book, BookQuote } from '../types'

interface ImportEReaderQuotesModalProps {
  targetBook: Book
  onClose: () => void
  onImportComplete: (updatedQuotes: BookQuote[]) => void
}

export default function ImportEReaderQuotesModal({
  targetBook,
  onClose,
  onImportComplete
}: ImportEReaderQuotesModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [loading, setLoading] = useState(true)
  const [deviceConnected, setDeviceConnected] = useState(false)
  const [deviceName, setDeviceName] = useState<string>('')
  const [deviceType, setDeviceType] = useState<string>('')
  const [notesFilePath, setNotesFilePath] = useState<string>('')
  const [booksOnDevice, setBooksOnDevice] = useState<
    { title: string; author?: string; quotesCount?: number; quotes: BookQuote[] }[]
  >([])

  const [selectedBookTitle, setSelectedBookTitle] = useState<string>('')
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set())
  const [avoidDuplicates, setAvoidDuplicates] = useState(true)
  const [filterQuery, setFilterQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    dialogRef.current?.showModal()
    scanDevice()
  }, [])

  const scanDevice = async () => {
    setLoading(true)
    setErrorMessage('')
    setStatusMessage('Buscando lector de libros conectado por USB...')

    try {
      const res = await window.api.scanEReaderNotes({ targetTitle: targetBook.title })
      setDeviceConnected(res.connected)
      if (res.deviceName) setDeviceName(res.deviceName)
      if (res.deviceType) setDeviceType(res.deviceType)
      if (res.notesFilePath) setNotesFilePath(res.notesFilePath)

      if (res.success && res.books && res.books.length > 0) {
        setBooksOnDevice(res.books)

        // Select matched book if found, or first book
        let chosenTitle = ''
        if (res.matchedBookTitle) {
          chosenTitle = res.matchedBookTitle
        } else {
          // Try to find if any title matches closely
          chosenTitle = res.books[0].title
        }

        setSelectedBookTitle(chosenTitle)
        const targetBookEntry = res.books.find((b) => b.title === chosenTitle)
        if (targetBookEntry && targetBookEntry.quotes) {
          setSelectedQuoteIds(new Set(targetBookEntry.quotes.map((q) => q.id)))
        }

        setStatusMessage(res.message || `Se han encontrado ${res.books.length} títulos con notas.`)
      } else {
        setBooksOnDevice([])
        if (!res.connected) {
          setStatusMessage('No se detectó ningún eReader conectado por USB.')
        } else {
          setStatusMessage(res.message || 'Dispositivo conectado, pero no se encontraron notas.')
        }
      }
    } catch (err: any) {
      setErrorMessage(`Error al explorar el eReader: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectFileManually = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const res = await window.api.selectAndParseNotesFile(targetBook.title)
      if (res.canceled) {
        setLoading(false)
        return
      }

      if (res.success && res.books && res.books.length > 0) {
        setDeviceConnected(true)
        setDeviceName(res.deviceName || 'Archivo de notas')
        if (res.deviceType) setDeviceType(res.deviceType)
        if (res.filePath) setNotesFilePath(res.filePath)
        setBooksOnDevice(res.books)

        let chosenTitle = ''
        if (res.matchedBookTitle) {
          chosenTitle = res.matchedBookTitle
        } else {
          chosenTitle = res.books[0].title
        }

        setSelectedBookTitle(chosenTitle)
        const targetBookEntry = res.books.find((b) => b.title === chosenTitle)
        if (targetBookEntry && targetBookEntry.quotes) {
          setSelectedQuoteIds(new Set(targetBookEntry.quotes.map((q) => q.id)))
        }

        setStatusMessage(
          res.message || `Archivo procesado: ${res.books.length} títulos encontrados.`
        )
      } else {
        setErrorMessage(res.message || 'No se pudieron extraer notas de ese archivo.')
      }
    } catch (err: any) {
      setErrorMessage(`Error al leer archivo: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Active book quotes on device
  const currentDeviceBook = booksOnDevice.find((b) => b.title === selectedBookTitle)
  const currentQuotes = currentDeviceBook?.quotes || []

  // Handle switching active book on device
  const handleSelectBook = (title: string) => {
    setSelectedBookTitle(title)
    const b = booksOnDevice.find((item) => item.title === title)
    if (b && b.quotes) {
      setSelectedQuoteIds(new Set(b.quotes.map((q) => q.id)))
    } else {
      setSelectedQuoteIds(new Set())
    }
  }

  // Toggle single quote
  const toggleQuote = (id: string) => {
    setSelectedQuoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Select/Deselect all
  const selectAll = () => {
    setSelectedQuoteIds(new Set(currentQuotes.map((q) => q.id)))
  }

  const deselectAll = () => {
    setSelectedQuoteIds(new Set())
  }

  const handleSaveImport = async () => {
    if (selectedQuoteIds.size === 0) {
      alert('Por favor selecciona al menos una cita para importar.')
      return
    }

    setIsSaving(true)
    try {
      const existingQuotes = targetBook.quotes || []
      const quotesToImport = currentQuotes.filter((q) => selectedQuoteIds.has(q.id))

      let finalQuotes: BookQuote[] = []
      if (avoidDuplicates) {
        // Filter out quotes whose text is already in existingQuotes
        const existingTexts = new Set(existingQuotes.map((q) => q.text.trim().toLowerCase()))
        const newUniques = quotesToImport.filter(
          (q) => !existingTexts.has(q.text.trim().toLowerCase())
        )
        finalQuotes = [...existingQuotes, ...newUniques]
      } else {
        finalQuotes = [...existingQuotes, ...quotesToImport]
      }

      const res = await window.api.saveBookQuotes(targetBook.id, finalQuotes)
      if (res.success) {
        onImportComplete(finalQuotes)
        dialogRef.current?.close()
        onClose()
      } else {
        alert('No se pudieron guardar las notas en la base de datos.')
      }
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const closeModal = () => {
    dialogRef.current?.close()
    onClose()
  }

  // Filtered books on device for selection dropdown / list
  const filteredBooksOnDevice = booksOnDevice.filter((b) => {
    if (!filterQuery.trim()) return true
    const q = filterQuery.toLowerCase()
    return (
      b.title.toLowerCase().includes(q) ||
      (b.author && b.author.toLowerCase().includes(q))
    )
  })

  // Format device badge
  const renderDeviceBadge = () => {
    const dLower = (deviceType || deviceName).toLowerCase()
    let label = deviceName || 'Lector USB'
    let bg = 'bg-blue-50 text-blue-800 border-blue-200'

    if (dLower.includes('kindle')) {
      label = deviceName || 'Amazon Kindle'
      bg = 'bg-amber-50 text-amber-800 border-amber-200'
    } else if (dLower.includes('kobo')) {
      label = deviceName || 'Kobo eReader'
      bg = 'bg-red-50 text-red-800 border-red-200'
    } else if (dLower.includes('sony') || dLower.includes('prs')) {
      label = deviceName || 'Sony Reader'
      bg = 'bg-indigo-50 text-indigo-800 border-indigo-200'
    } else if (dLower.includes('tolino')) {
      label = deviceName || 'Tolino'
      bg = 'bg-teal-50 text-teal-800 border-teal-200'
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12px] font-semibold ${bg}`}
      >
        <Smartphone className="w-3.5 h-3.5" />
        {label}
      </span>
    )
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={closeModal}
      className="border-none rounded-[24px] bg-[var(--color-surface)] text-[var(--color-ink)] w-[min(860px,100%-32px)] max-h-[90vh] overflow-y-auto p-0 m-auto backdrop:bg-[rgba(20,35,42,0.65)] backdrop:backdrop-blur-[3px] shadow-2xl"
    >
      <div className="relative p-6 sm:p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--color-line)] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-[20px] sm:text-[22px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)]">
                Importar citas desde eReader
              </h2>
              <p className="text-[13px] text-[var(--color-muted)] mt-0.5">
                Para el libro: <strong className="text-[var(--color-ink)]">{targetBook.title}</strong>{' '}
                {targetBook.author && <span>— {targetBook.author}</span>}
              </p>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="w-9 h-9 rounded-full bg-[var(--color-bg)] hover:bg-[var(--color-line)] flex items-center justify-center transition-colors text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-[14px] bg-[var(--color-bg)] border border-[var(--color-line)]">
          <div className="flex items-center gap-2.5">
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
            ) : deviceConnected ? (
              renderDeviceBadge()
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--color-line)] bg-neutral-100 text-[var(--color-muted)] text-[12px] font-medium">
                <HardDrive className="w-3.5 h-3.5" />
                Sin lector USB conectado
              </span>
            )}

            <div className="flex flex-col">
              <span className="text-[13px] text-[var(--color-muted)]">
                {statusMessage || (loading ? 'Escaneando...' : '')}
              </span>
              {notesFilePath && (
                <span className="text-[11px] text-[var(--color-muted)]/70 truncate max-w-[340px]" title={notesFilePath}>
                  {notesFilePath}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={scanDevice}
              disabled={loading}
              className="px-3 py-1.5 rounded-[10px] bg-[var(--color-surface)] hover:bg-[var(--color-line)] border border-[var(--color-line)] text-[12px] font-semibold text-[var(--color-ink)] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Volver a escanear USB"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Reintentar</span>
            </button>

            <button
              onClick={handleSelectFileManually}
              disabled={loading}
              className="px-3 py-1.5 rounded-[10px] bg-[var(--color-surface)] hover:bg-[var(--color-line)] border border-[var(--color-line)] text-[12px] font-semibold text-[var(--color-ink)] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Seleccionar archivo .txt, .sqlite, .db"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Elegir archivo</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-[12px] bg-red-50 border border-red-200 text-red-700 text-[13px]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* If no device and no books found */}
        {!loading && booksOnDevice.length === 0 && (
          <div className="py-10 px-6 text-center flex flex-col items-center justify-center gap-4 rounded-[18px] bg-[var(--color-bg)]/50 border border-dashed border-[var(--color-line)]">
            <div className="w-14 h-14 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center">
              <BookOpen className="w-7 h-7" />
            </div>
            <div className="max-w-[480px]">
              <h3 className="text-[17px] font-bold text-[var(--color-ink)]">
                Conecta tu eReader mediante USB
              </h3>
              <p className="text-[13px] text-[var(--color-muted)] mt-1.5 leading-relaxed">
                Bibliosfera es compatible con <strong>Kindle</strong> (My Clippings.txt),{' '}
                <strong>Kobo</strong> (KoboReader.sqlite) y <strong>Sony Reader</strong> (PRS
                books.db). Conecta el cable USB a tu ordenador, selecciona el modo de transferencia
                en la pantalla del eReader y pulsa «Reintentar».
              </p>
              <p className="text-[12px] text-[var(--color-muted)] mt-2">
                O si ya tienes el archivo de notas en tu ordenador, pulsa «Elegir archivo».
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={scanDevice}
                className="px-4 py-2 rounded-[10px] bg-[var(--color-accent)] text-white text-[13px] font-bold shadow-sm hover:opacity-95 transition cursor-pointer"
              >
                Volver a buscar eReader
              </button>
              <button
                onClick={handleSelectFileManually}
                className="px-4 py-2 rounded-[10px] bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] text-[13px] font-semibold hover:bg-[var(--color-line)] transition cursor-pointer"
              >
                Seleccionar archivo del eReader
              </button>
            </div>
          </div>
        )}

        {/* If books found on device */}
        {!loading && booksOnDevice.length > 0 && (
          <div className="flex flex-col gap-5">
            {/* Target Title Selector on Device */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  <span>Título seleccionado en el eReader ({booksOnDevice.length} encontrados):</span>
                </label>
                {booksOnDevice.length > 5 && (
                  <div className="relative w-[220px]">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--color-muted)]" />
                    <input
                      type="text"
                      placeholder="Filtrar títulos..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-[8px] bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                )}
              </div>

              {/* Selector / List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto p-1.5 rounded-[12px] bg-[var(--color-bg)]/60 border border-[var(--color-line)]">
                {filteredBooksOnDevice.map((b) => {
                  const isSelected = b.title === selectedBookTitle
                  return (
                    <button
                      key={b.title}
                      type="button"
                      onClick={() => handleSelectBook(b.title)}
                      className={`flex items-center justify-between text-left p-2.5 rounded-[10px] border transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--color-surface)] border-[var(--color-accent)] shadow-sm'
                          : 'bg-transparent border-transparent hover:bg-[var(--color-surface)]/80 text-[var(--color-ink)]'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span
                          className={`text-[13px] font-bold truncate ${
                            isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)]'
                          }`}
                        >
                          {b.title}
                        </span>
                        {b.author && (
                          <span className="text-[11px] text-[var(--color-muted)] truncate">
                            {b.author}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isSelected
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'bg-[var(--color-bg)] text-[var(--color-muted)]'
                        }`}
                      >
                        {b.quotesCount || b.quotes?.length || 0}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quotes Selection Section */}
            {currentDeviceBook ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-[var(--color-ink)]">
                      Citas disponibles ({currentQuotes.length})
                    </span>
                    <span className="text-[12px] text-[var(--color-muted)]">
                      • {selectedQuoteIds.size} seleccionadas para importar
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-[12px] font-semibold text-[var(--color-accent)] hover:underline cursor-pointer"
                    >
                      Seleccionar todas
                    </button>
                    <span className="text-[var(--color-muted)] text-[12px]">|</span>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="text-[12px] font-semibold text-[var(--color-muted)] hover:underline cursor-pointer"
                    >
                      Deseleccionar
                    </button>
                  </div>
                </div>

                {/* Duplicates checkbox */}
                <label className="flex items-center gap-2 text-[12px] text-[var(--color-muted)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={avoidDuplicates}
                    onChange={(e) => setAvoidDuplicates(e.target.checked)}
                    className="rounded border-[var(--color-line)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] cursor-pointer"
                  />
                  <span>
                    No duplicar citas que ya existan en este libro (compara el texto exacto)
                  </span>
                </label>

                {/* Quotes List Cards */}
                <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {currentQuotes.length === 0 ? (
                    <div className="p-8 text-center text-[13px] text-[var(--color-muted)] italic">
                      No hay citas ni notas para este título en el eReader.
                    </div>
                  ) : (
                    currentQuotes.map((q) => {
                      const isChecked = selectedQuoteIds.has(q.id)
                      return (
                        <div
                          key={q.id}
                          onClick={() => toggleQuote(q.id)}
                          className={`flex items-start gap-3 p-3.5 rounded-[14px] border transition cursor-pointer select-none ${
                            isChecked
                              ? 'bg-[var(--color-surface)] border-[var(--color-accent)]/60 shadow-xs'
                              : 'bg-[var(--color-bg)]/40 border-[var(--color-line)]/50 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0 text-[var(--color-accent)]">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 fill-[var(--color-accent)] text-white" />
                            ) : (
                              <Square className="w-4 h-4 text-[var(--color-muted)]" />
                            )}
                          </div>

                          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <p className="text-[13.5px] text-[var(--color-ink)] leading-relaxed italic font-serif">
                              «{q.text}»
                            </p>

                            {q.note && (
                              <div className="text-[12px] text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2.5 py-1.5 rounded-[8px] font-sans">
                                <strong>Nota personal:</strong> {q.note}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[var(--color-muted)]">
                              {q.page && (
                                <span className="bg-[var(--color-bg)] px-2 py-0.5 rounded-full border border-[var(--color-line)]">
                                  {q.page}
                                </span>
                              )}
                              {q.source && (
                                <span className="uppercase tracking-wider font-semibold opacity-75">
                                  {q.source}
                                </span>
                              )}
                              {q.dateAdded && <span>• {q.dateAdded}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-4 mt-2">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 rounded-[10px] text-[13px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-bg)] transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSaveImport}
            disabled={isSaving || selectedQuoteIds.size === 0}
            className="px-5 py-2.5 rounded-[12px] bg-[var(--color-accent)] text-white text-[13px] font-bold shadow-md hover:opacity-95 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>
              {isSaving
                ? 'Guardando...'
                : `Importar ${selectedQuoteIds.size} ${
                    selectedQuoteIds.size === 1 ? 'cita' : 'citas'
                  } al libro`}
            </span>
          </button>
        </div>
      </div>
    </dialog>
  )
}
