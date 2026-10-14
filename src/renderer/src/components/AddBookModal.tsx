import { useState, useEffect, useRef } from 'react'
import { X, Search, Loader2, Sparkles, Upload } from 'lucide-react'
import { Book } from '../types'

interface AddBookModalProps {
  onClose: () => void
  onAdd: (book: Book) => void | Promise<void>
  bookToEdit?: Book
}

export default function AddBookModal({ onClose, onAdd, bookToEdit }: AddBookModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [showForm, setShowForm] = useState(!!bookToEdit)
  const [bookData, setBookData] = useState<Partial<Book>>(bookToEdit || {
    rating: 4,
    dateRead: new Date().toISOString().substring(0, 10),
    title: '',
    author: '',
    coverUrl: '',
    genre: '',
    year: '',
    isbn: '',
    pages: '',
    readingTime: '',
    synopsis: '',
    comment: ''
  })

  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona un archivo de imagen válido (JPG, PNG o WEBP).')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 480
          const MAX_HEIGHT = 720
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width)
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height)
              height = MAX_HEIGHT
            }
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9)
            setBookData(prev => ({ ...prev, coverUrl: dataUrl }))
          } else {
            setBookData(prev => ({ ...prev, coverUrl: reader.result as string }))
          }
        }
        img.src = reader.result
      }
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    try {
      if (!dialogRef.current?.open) {
        dialogRef.current?.showModal()
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (bookToEdit) {
      setBookData(bookToEdit)
      setShowForm(true)
      // If book lacks synopsis or pages or year, auto-enrich in background!
      const lacksData = !bookToEdit.synopsis || !bookToEdit.pages || !bookToEdit.year || !bookToEdit.genre || !bookToEdit.coverUrl
      if (lacksData && bookToEdit.title) {
        setIsEnriching(true)
        const q = [bookToEdit.title, bookToEdit.author !== 'Autor desconocido' ? bookToEdit.author : ''].filter(Boolean).join(' ').trim()
        window.api.searchBook(q).then(data => {
          if (data) {
            setBookData(prev => ({
              ...prev,
              title: prev.title || data.title,
              author: (!prev.author || prev.author === 'Autor desconocido') && data.author ? data.author : prev.author,
              coverUrl: prev.coverUrl || data.coverUrl || '',
              genre: prev.genre || data.genre || '',
              year: prev.year || data.year || '',
              isbn: prev.isbn || data.isbn || '',
              pages: prev.pages || data.pages || '',
              synopsis: prev.synopsis || data.synopsis || ''
            }))
          }
        }).catch(() => {}).finally(() => {
          setIsEnriching(false)
        })
      }
    }
  }, [bookToEdit])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const data = await window.api.searchBook(searchQuery.trim())
      
      if (data) {
        setBookData(prev => ({
          ...prev,
          title: data.title || searchQuery,
          author: data.author || '',
          coverUrl: data.coverUrl || '',
          genre: data.genre || '',
          year: data.year || '',
          isbn: data.isbn || '',
          pages: data.pages || prev.pages || '',
          readingTime: prev.readingTime || '',
          synopsis: data.synopsis || '',
          rating: prev.rating || 4,
          dateRead: prev.dateRead || new Date().toISOString().substring(0, 10),
          comment: ''
        }))
      } else {
        setBookData(prev => ({ ...prev, title: searchQuery }))
      }
    } catch (error) {
      console.error("Error buscando libro:", error)
      setBookData(prev => ({ ...prev, title: searchQuery }))
    } finally {
      setIsSearching(false)
      setShowForm(true)
      setTimeout(() => titleInputRef.current?.focus(), 50)
    }
  }

  const handleEnrichOnline = async () => {
    const query = [bookData.title, bookData.author !== 'Autor desconocido' ? bookData.author : ''].filter(Boolean).join(' ').trim()
    if (!query) return
    setIsEnriching(true)
    try {
      const data = await window.api.searchBook(query)
      if (data) {
        setBookData(prev => ({
          ...prev,
          title: prev.title || data.title,
          author: (!prev.author || prev.author === 'Autor desconocido') && data.author ? data.author : prev.author,
          coverUrl: prev.coverUrl || data.coverUrl || '',
          genre: prev.genre || data.genre || '',
          year: prev.year || data.year || '',
          isbn: prev.isbn || data.isbn || '',
          pages: prev.pages || data.pages || '',
          synopsis: prev.synopsis || data.synopsis || ''
        }))
      }
    } catch (err) {
      console.error('Error enriqueciendo libro:', err)
    } finally {
      setIsEnriching(false)
    }
  }

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!bookData.title?.trim()) {
      titleInputRef.current?.focus()
      return
    }

    if (isSubmitting) return
    setIsSubmitting(true)

    const newBook: Book = {
      id: bookData.id || Date.now().toString(),
      title: bookData.title.trim(),
      author: bookData.author?.trim() || "Autor desconocido",
      rating: typeof bookData.rating === 'number' ? bookData.rating : (Number(bookData.rating) || 3),
      dateRead: bookData.dateRead || new Date().toISOString().substring(0, 10),
      synopsis: bookData.synopsis?.trim() || '',
      comment: bookData.comment?.trim() || '',
      coverUrl: bookData.coverUrl?.trim() || '',
      genre: bookData.genre?.trim() || '',
      year: bookData.year ? String(parseInt(String(bookData.year), 10) || bookData.year) : undefined,
      isbn: bookData.isbn?.trim() || '',
      pages: bookData.pages ? String(parseInt(String(bookData.pages), 10) || bookData.pages) : undefined,
      readingTime: bookData.readingTime?.trim() || '',
      libraryBookId: bookData.libraryBookId
    }

    try {
      await onAdd(newBook)
    } catch (err) {
      console.error('Error en onAdd:', err)
    } finally {
      setIsSubmitting(false)
      closeModal()
    }
  }

  const closeModal = () => {
    dialogRef.current?.close()
    onClose()
  }

  return (
    <dialog 
      ref={dialogRef}
      onCancel={closeModal}
      className="border-none rounded-[24px] bg-[var(--color-surface)] text-[var(--color-ink)] w-[min(860px,95vw)] max-h-[90vh] p-0 m-auto backdrop:bg-[rgba(20,35,42,0.65)] backdrop:backdrop-blur-[3px] shadow-2xl flex flex-col overflow-hidden"
    >
      {!showForm ? (
        /* STEP 1: Search screen */
        <div className="p-6 sm:p-8 flex flex-col gap-5">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-[26px] font-bold font-['Bricolage_Grotesque']">Buscar obra</h2>
              <p className="text-[14px] text-[var(--color-muted)] mt-1">
                Escribe el título para autocompletar portada, autor, año, género, ISBN y sinopsis.
              </p>
            </div>
            <button 
              type="button" 
              onClick={closeModal}
              className="w-8 h-8 rounded-full bg-[var(--color-bg)] hover:bg-[var(--color-line)] flex items-center justify-center transition-colors text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <input 
                autoFocus
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[14px] p-[14px_16px] text-[16px] w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-green)]" 
                placeholder="Ej. Cien años de soledad, El hobbit, 1984..."
              />
            </div>

            <div className="flex justify-between items-center mt-3">
              <button 
                type="button" 
                onClick={() => { setBookData(prev => ({ ...prev, title: searchQuery })); setShowForm(true); }} 
                className="text-[14px] text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline cursor-pointer"
              >
                Rellenar manualmente sin buscar
              </button>
              <div className="flex gap-2.5">
                <button type="button" onClick={closeModal} className="p-[10px_20px] rounded-[12px] border border-[var(--color-line)] font-medium text-[14px] cursor-pointer">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSearching} 
                  className="p-[10px_24px] rounded-[12px] bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold text-[14px] disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs hover:opacity-90"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--color-on-accent)]" />
                      <span>Buscando datos...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Buscar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* STEP 2: Balanced 2-Column Confirmation Form with Fixed Header & Footer */
        <div className="flex flex-col h-full max-h-[90vh]">
          
          {/* Header (Fixed) */}
          <div className="p-5 sm:p-6 pb-4 border-b border-[var(--color-line)] flex justify-between items-center bg-[var(--color-surface)] flex-shrink-0">
            <div>
              <h2 className="text-[22px] sm:text-[24px] font-bold font-['Bricolage_Grotesque']">
                {bookToEdit?.libraryBookId ? 'Pasar a Mis lecturas' : (bookToEdit ? 'Editar lectura' : 'Confirmar datos del libro')}
              </h2>
              <p className="text-[13px] text-[var(--color-muted)]">
                {bookToEdit?.libraryBookId
                  ? 'Revisa los datos del eBook antes de incorporarlo a tu diario de lecturas.'
                  : 'Revisa y ajusta los campos antes de guardar en Mis lecturas.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEnrichOnline}
                disabled={isEnriching}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)] hover:bg-[var(--color-line)] text-[12px] font-medium text-[var(--color-ink)] transition-colors cursor-pointer disabled:opacity-50"
                title="Buscar en internet para completar automáticamente portada, sinopsis, páginas, género y año"
              >
                {isEnriching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-accent)]" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                )}
                <span>{isEnriching ? 'Buscando...' : 'Completar con internet'}</span>
              </button>
              {!bookToEdit && (
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="text-[13px] text-[var(--color-accent)] hover:underline font-medium cursor-pointer"
                >
                  ← Nueva búsqueda
                </button>
              )}
            </div>
          </div>

          {/* Form Content (Scrollable if viewport is tiny, but wide enough to fit cleanly) */}
          <form id="book-form" onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 items-start">
              
              {/* Left Column: Cover, Title, Author & Publication Data */}
              <div className="flex flex-col gap-4">
                
                {/* Cover Preview & URL / File input */}
                <div className="flex gap-3.5 p-3.5 bg-[var(--color-bg)] rounded-[14px] border border-[var(--color-line)] items-center">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-22 rounded-[6px] overflow-hidden bg-[var(--color-line)] flex items-center justify-center text-[11px] text-[var(--color-muted)] text-center p-1 flex-shrink-0 cursor-pointer relative group border border-black/10 shadow-xs"
                    title="Haz clic para seleccionar o cambiar portada"
                  >
                    {bookData.coverUrl ? (
                      <>
                        <img 
                          src={bookData.coverUrl} 
                          alt="Portada" 
                          className="w-full h-full object-cover rounded-[5px]"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                          Cambiar
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 text-[var(--color-muted)] group-hover:text-[var(--color-ink)] transition-colors">
                        <Upload className="w-5 h-5" />
                        <span className="text-[9.5px] leading-tight">Subir foto</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-medium text-[var(--color-muted)]">
                        Portada del libro
                      </label>
                      {bookData.coverUrl && (
                        <button 
                          type="button" 
                          onClick={() => setBookData({...bookData, coverUrl: ''})}
                          className="text-[11px] text-red-600 hover:underline cursor-pointer"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>

                    {/* Hidden file input */}
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleCoverUpload}
                      className="hidden"
                    />

                    <div className="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-[8px] bg-[var(--color-surface)] border border-[var(--color-line)] hover:border-[var(--color-accent)] text-[12px] font-medium text-[var(--color-ink)] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        <span>Subir imagen (JPG, PNG)</span>
                      </button>
                    </div>

                    <input 
                      type="text" 
                      id="input-cover"
                      value={bookData.coverUrl?.startsWith('data:') ? 'Imagen local cargada' : (bookData.coverUrl || '')}
                      onChange={e => setBookData({...bookData, coverUrl: e.target.value})}
                      placeholder="O introduce una URL de imagen..."
                      className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[8px] p-[5px_8px] text-[11.5px] w-full truncate text-[var(--color-muted)]"
                    />
                  </div>
                </div>

                {/* Title */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="input-title" className="text-[13px] font-medium">Título *</label>
                  <input 
                    ref={titleInputRef}
                    type="text" 
                    id="input-title"
                    required
                    value={bookData.title || ''}
                    onChange={e => setBookData({...bookData, title: e.target.value})}
                    className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[10px] p-[8px_12px] text-[14px] w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-green)]" 
                    placeholder="Ej. El Señor de los Anillos"
                  />
                </div>
                
                {/* Author */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="input-author" className="text-[13px] font-medium">Autor</label>
                  <input 
                    type="text" 
                    id="input-author"
                    value={bookData.author || ''}
                    onChange={e => setBookData({...bookData, author: e.target.value})}
                    className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[10px] p-[8px_12px] text-[14px] w-full" 
                    placeholder="Ej. J.R.R. Tolkien"
                  />
                </div>

                {/* Year, Genre, ISBN in 3 compact columns */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="input-year" className="text-[12px] font-medium text-[var(--color-muted)]">Año</label>
                    <input 
                      type="text" 
                      id="input-year"
                      value={bookData.year || ''}
                      onChange={e => setBookData({...bookData, year: e.target.value})}
                      className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[8px] p-[7px_10px] text-[13px] w-full" 
                      placeholder="1954"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="input-genre" className="text-[12px] font-medium text-[var(--color-muted)]">Género</label>
                    <input 
                      type="text" 
                      id="input-genre"
                      value={bookData.genre || ''}
                      onChange={e => setBookData({...bookData, genre: e.target.value})}
                      className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[8px] p-[7px_10px] text-[13px] w-full" 
                      placeholder="Fantasía"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="input-isbn" className="text-[12px] font-medium text-[var(--color-muted)]">ISBN</label>
                    <input 
                      type="text" 
                      id="input-isbn"
                      value={bookData.isbn || ''}
                      onChange={e => setBookData({...bookData, isbn: e.target.value})}
                      className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[8px] p-[7px_10px] text-[13px] w-full font-mono text-[12px]" 
                      placeholder="ISBN"
                    />
                  </div>
                </div>

                {/* Pages & Reading Time row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="input-pages" className="text-[12px] font-medium text-[var(--color-muted)]">
                      N.º de páginas
                    </label>
                    <input 
                      type="text" 
                      id="input-pages"
                      value={bookData.pages || ''}
                      onChange={e => setBookData({...bookData, pages: e.target.value})}
                      className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[8px] p-[7px_10px] text-[13px] w-full" 
                      placeholder="Ej. 420"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="input-reading-time" className="text-[12px] font-medium text-[var(--color-muted)]">
                      Tiempo de lectura
                    </label>
                    <input 
                      type="text" 
                      id="input-reading-time"
                      value={bookData.readingTime || ''}
                      onChange={e => setBookData({...bookData, readingTime: e.target.value})}
                      className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[8px] p-[7px_10px] text-[13px] w-full" 
                      placeholder="Ej. 14 horas, 2 semanas..."
                    />
                  </div>
                </div>

              </div>

              {/* Right Column: Synopsis, Rating, Date & Personal Comment */}
              <div className="flex flex-col gap-4">
                
                {/* Synopsis: Large & Prominent */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="input-synopsis" className="text-[13px] font-medium text-[var(--color-ink)]">
                      Sinopsis de la obra
                    </label>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      {bookData.synopsis ? `${bookData.synopsis.length} caracteres` : 'Resumen argumental'}
                    </span>
                  </div>
                  <textarea 
                    id="input-synopsis"
                    rows={6}
                    value={bookData.synopsis || ''}
                    onChange={e => setBookData({...bookData, synopsis: e.target.value})}
                    className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[12px] p-[10px_14px] text-[14px] min-h-[135px] w-full resize-y text-[var(--color-ink)] leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-green)]" 
                    placeholder="Escribe o revisa la sinopsis y argumento de la obra..."
                  ></textarea>
                </div>

                {/* Rating & Date Read */}
                <div className="p-3 bg-[var(--color-bg)] rounded-[14px] border border-[var(--color-line)] flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-medium">Puntuación</span>
                    <div className="flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-line)] px-2 py-0.5 rounded-[8px]">
                      <span className="font-bold text-[14px] text-[var(--color-ink)] font-['Bricolage_Grotesque']">
                        {(bookData.rating || 0).toFixed(1)}
                      </span>
                      <span className="text-[11px] text-[var(--color-muted)] font-medium">/ 5</span>
                    </div>
                  </div>

                  {/* Half-Star Rating Interactive Stars */}
                  <div className="flex items-center gap-3">
                    <div className="flex gap-[4px] items-center" role="radiogroup">
                      {[1, 2, 3, 4, 5].map((starIdx) => {
                        const currentRating = bookData.rating || 0
                        const isFull = currentRating >= starIdx
                        const isHalf = !isFull && currentRating >= starIdx - 0.5
                        return (
                          <div 
                            key={starIdx} 
                            className="relative w-[30px] h-[30px] cursor-pointer select-none group"
                          >
                            <svg className="absolute inset-0 w-full h-full fill-[var(--color-line)]" viewBox="0 0 24 24">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                            {(isFull || isHalf) && (
                              <div className="absolute inset-0 overflow-hidden" style={{ width: isFull ? '100%' : '50%' }}>
                                <svg className="w-[30px] h-[30px] fill-[var(--color-star)]" viewBox="0 0 24 24">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                </svg>
                              </div>
                            )}

                            {/* Left half clickable (starIdx - 0.5) */}
                            <button
                              type="button"
                              onClick={() => setBookData({ ...bookData, rating: starIdx - 0.5 })}
                              className="absolute left-0 top-0 w-1/2 h-full z-10 cursor-pointer opacity-0"
                              title={`${starIdx - 0.5} estrellas`}
                            />

                            {/* Right half clickable (starIdx) */}
                            <button
                              type="button"
                              onClick={() => setBookData({ ...bookData, rating: starIdx })}
                              className="absolute right-0 top-0 w-1/2 h-full z-10 cursor-pointer opacity-0"
                              title={`${starIdx} estrellas`}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Date Read */}
                  <div className="flex flex-col gap-1 pt-2 border-t border-[var(--color-line)]/50">
                    <label htmlFor="input-date" className="text-[12px] font-medium text-[var(--color-muted)]">Fecha de lectura</label>
                    <input 
                      type="date" 
                      id="input-date"
                      value={bookData.dateRead || ''}
                      onChange={e => setBookData({...bookData, dateRead: e.target.value})}
                      className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[8px] p-[6px_10px] text-[13px] w-full" 
                    />
                  </div>
                </div>

                {/* Personal Comment */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="input-comment" className="text-[13px] font-medium">Tu comentario personal</label>
                  <textarea 
                    id="input-comment"
                    rows={3}
                    value={bookData.comment || ''}
                    onChange={e => setBookData({...bookData, comment: e.target.value})}
                    className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[10px] p-[8px_12px] text-[13px] w-full resize-y" 
                    placeholder="¿Qué te ha parecido la lectura? Tus reflexiones..."
                  ></textarea>
                </div>

              </div>

            </div>
          </form>

          {/* Fixed Footer with Action Buttons: ALWAYS 100% VISIBLE */}
          <div className="p-4 px-6 border-t border-[var(--color-line)] bg-[var(--color-surface)] flex justify-end gap-3 flex-shrink-0">
            <button 
              type="button" 
              onClick={closeModal} 
              className="p-[10px_20px] rounded-[12px] border border-[var(--color-line)] font-medium text-[14px] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="button" 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="p-[10px_24px] rounded-[12px] bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold text-[14px] hover:opacity-90 transition-opacity cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Aceptar'}
            </button>
          </div>

        </div>
      )}
    </dialog>
  )
}
