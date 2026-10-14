import { useState, useEffect, useRef } from 'react'
import { LibraryBook } from '../types'
import { 
  Library, 
  BookOpen, 
  List,
  Bookmark,
  Search, 
  Upload, 
  HardDrive, 
  BookMarked, 
  Clock, 
  CheckCircle2, 
  Check, 
  Smartphone, 
  Mail, 
  Pencil, 
  Folder, 
  Trash2, 
  X, 
  FileText, 
  Calendar, 
  Tag, 
  RotateCw,
  Sparkles,
  Download,
  Tablet,
  CheckSquare,
  Square,
  Zap,
  ArrowUpDown,
  Wifi,
  ExternalLink
} from 'lucide-react'
import SettingsModal from './SettingsModal'
import KindleUploadModal from './KindleUploadModal'

import { SpinePalette, SPINE_PALETTES, extractCoverPalette } from '../utils/palette'

interface LibraryViewProps {
  onMarkAsRead: (libraryBook: LibraryBook) => void
  readBookIds: string[]
  onBooksCountChange?: (count: number) => void
}

export default function LibraryView({ onMarkAsRead, readBookIds, onBooksCountChange }: LibraryViewProps) {
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'read'>('all')
  const [formatFilter, setFormatFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'shelf' | 'spines' | 'list'>('shelf')
  const [coverPalettes, setCoverPalettes] = useState<Record<string, SpinePalette>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [editingBook, setEditingBook] = useState<LibraryBook | null>(null)
  const [inspectingBook, setInspectingBook] = useState<LibraryBook | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const libraryCoverInputRef = useRef<HTMLInputElement>(null)

  const handleLibraryCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingBook) return
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida (JPG o PNG).')
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
            setEditingBook(prev => prev ? ({ ...prev, coverUrl: dataUrl }) : null)
          } else {
            setEditingBook(prev => prev ? ({ ...prev, coverUrl: reader.result as string }) : null)
          }
        }
        img.src = reader.result
      }
    }
    reader.readAsDataURL(file)
  }

  // eReader & Multi-select & Export state
  const [connectedDevice, setConnectedDevice] = useState<{
    connected: boolean
    name: string
    volumePath: string
    targetFolder: string
  } | null>(null)
  const [isDragOverDevice, setIsDragOverDevice] = useState(false)
  const [draggedBookId, setDraggedBookId] = useState<string | null>(null)
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'custom' | 'title-asc' | 'title-desc' | 'author-asc'>('custom')
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isKindleModalOpen, setIsKindleModalOpen] = useState(false)
  const [kindleInitialBookIds, setKindleInitialBookIds] = useState<string[]>([])
  const [hoveredSpine, setHoveredSpine] = useState<{
    book: LibraryBook
    pagesCount: number
    palette: SpinePalette
    isRead: boolean
    formatUpper: string
    x: number
    y: number
    showBelow: boolean
  } | null>(null)

  useEffect(() => {
    loadLibrary()
    checkConnectedDevice()
    const interval = setInterval(checkConnectedDevice, 2500)
    return () => clearInterval(interval)
  }, [])

  const checkConnectedDevice = async () => {
    try {
      const dev = await window.api.getConnectedDevice()
      setConnectedDevice(dev)
    } catch (e) {}
  }

  const loadLibrary = async () => {
    const list = await window.api.getLibraryBooks()
    setBooks(list)
    if (onBooksCountChange) onBooksCountChange(list.length)
  }

  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 5000)
  }

  const handleUpload = async () => {
    setIsUploading(true)
    showToast('Importando e-book y buscando portada y autor en internet...')
    try {
      const newBook = await window.api.uploadLibraryBook()
      if (newBook) {
        await loadLibrary()
        showToast(`"${newBook.title}" añadido con éxito a tu estantería.`)
      }
    } catch (e: any) {
      console.error(e)
    } finally {
      setIsUploading(false)
    }
  }

  const handleOpen = async (book: LibraryBook) => {
    const ok = await window.api.openLibraryBook(book.id)
    if (!ok) {
      showToast('No se pudo abrir el archivo. Comprueba que el archivo existe en tu equipo.')
    }
  }

  const handleShowInFolder = async (book: LibraryBook) => {
    await window.api.showLibraryBookInFolder(book.id)
  }

  const handleSendToDevice = async (book: LibraryBook) => {
    const dev = connectedDevice || (await window.api.getConnectedDevice())
    if (!dev || !dev.connected) {
      showToast('No hay eReader USB conectado. Si tienes un Kindle, puedes usar "Subir a Kindle (Web)" sin cables.')
      return
    }
    showToast(`Transfiriendo "${book.title}" a ${dev.name}...`)
    const res = await window.api.sendToDevice(book.id)
    showToast(res.message)
  }

  const openKindleModal = (ids?: string[]) => {
    if (ids && ids.length > 0) {
      setKindleInitialBookIds(ids)
    } else if (selectedBookIds.length > 0) {
      setKindleInitialBookIds(selectedBookIds)
    } else {
      setKindleInitialBookIds([])
    }
    setIsKindleModalOpen(true)
  }

  const handleConfirmKindleUpload = async (bookIds: string[], domain: string) => {
    const label = bookIds.length === 1 ? '1 libro' : `${bookIds.length} libros`
    showToast(`Abriendo ventana Send to Kindle (${domain}) para ${label}...`)
    try {
      const res = await window.api.sendToKindleWeb(bookIds, { domain })
      showToast(res.message)
      if (res.success) {
        setSelectedBookIds([])
        setIsSelectMode(false)
      }
    } catch (e: any) {
      showToast(`Error al abrir Send to Kindle: ${e?.message || 'Error desconocido'}`)
    }
  }

  const handleSendToKindleWeb = (book: LibraryBook) => {
    openKindleModal([book.id])
  }

  const handleShareByEmail = async (book: LibraryBook) => {
    showToast(`Preparando envío de "${book.title}" por correo...`)
    const res = await window.api.shareByEmail(book.id)
    showToast(res.message)
  }

  const toggleSelectBook = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedBookIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedBookIds.length === filtered.length) {
      setSelectedBookIds([])
    } else {
      setSelectedBookIds(filtered.map(b => b.id))
    }
  }

  const handleTransferSelectionToDevice = async () => {
    if (selectedBookIds.length === 0) return
    const dev = connectedDevice || (await window.api.getConnectedDevice())
    if (!dev || !dev.connected) {
      showToast('No hay ningún eReader conectado. Conecta un eReader para realizar la transferencia.')
      return
    }
    showToast(`Transfiriendo ${selectedBookIds.length} libros a ${dev.name}...`)
    const res = await window.api.sendMultipleToDevice(selectedBookIds, dev.targetFolder)
    showToast(res.message)
    if (res.success) {
      setSelectedBookIds([])
      setIsSelectMode(false)
    }
  }

  const handleTransferSelectionToKindleWeb = () => {
    openKindleModal(selectedBookIds)
  }

  const handleDeleteSelection = async () => {
    if (selectedBookIds.length === 0) return
    const count = selectedBookIds.length
    const confirmMsg = count === 1
      ? '¿Eliminar definitivamente el título seleccionado de tu biblioteca y borrar su archivo del disco?'
      : `¿Eliminar definitivamente los ${count} títulos seleccionados de tu biblioteca y borrar sus archivos del disco?`
    if (confirm(confirmMsg)) {
      const updated = await window.api.deleteMultipleLibraryBooks(selectedBookIds)
      setBooks(updated)
      if (inspectingBook && selectedBookIds.includes(inspectingBook.id)) {
        setInspectingBook(null)
      }
      setSelectedBookIds([])
      setIsSelectMode(false)
      showToast(
        count === 1
          ? 'Libro eliminado de la biblioteca.'
          : `Se han eliminado ${count} títulos seleccionados de la biblioteca.`
      )
    }
  }

  const handleMarkSelectionAsRead = async () => {
    if (selectedBookIds.length === 0) return
    for (const id of selectedBookIds) {
      const b = books.find(item => item.id === id)
      if (b) {
        await window.api.updateLibraryBook(b.id, { status: 'read' })
        onMarkAsRead(b)
      }
    }
    await loadLibrary()
    showToast(`Se han marcado ${selectedBookIds.length} libros como leídos y trasladado a Mis lecturas.`)
    setSelectedBookIds([])
    setIsSelectMode(false)
  }

  const handleDropOnDevice = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverDevice(false)
    const droppedId = e.dataTransfer.getData('text/plain')
    if (!droppedId) return

    const idsToTransfer = (selectedBookIds.includes(droppedId) && selectedBookIds.length > 1)
      ? selectedBookIds
      : [droppedId]

    const book = books.find(b => b.id === droppedId)
    const label = idsToTransfer.length > 1 ? `${idsToTransfer.length} libros` : `"${book?.title || 'libro'}"`
    showToast(`Transfiriendo ${label} a ${connectedDevice?.name || 'tu eReader'}...`)

    const res = await window.api.sendMultipleToDevice(idsToTransfer)
    showToast(res.message)
    if (res.success && idsToTransfer.length > 1) {
      setSelectedBookIds([])
      setIsSelectMode(false)
    }
  }

  const handleBookDropReorder = async (targetBookId: string) => {
    setDragOverTargetId(null)
    if (!draggedBookId || draggedBookId === targetBookId) return

    const currentList = [...books]
    const fromIdx = currentList.findIndex(b => b.id === draggedBookId)
    const toIdx = currentList.findIndex(b => b.id === targetBookId)
    if (fromIdx === -1 || toIdx === -1) return

    const [moved] = currentList.splice(fromIdx, 1)
    currentList.splice(toIdx, 0, moved)

    setBooks(currentList)
    setSortBy('custom')

    try {
      const reorderedIds = currentList.map(b => b.id)
      await window.api.reorderLibraryBooks(reorderedIds)
      showToast('Orden personalizado guardado.')
    } catch (e) {
      console.error('Error reordering books:', e)
    }
  }

  const handleEnrich = async (book: LibraryBook) => {
    setEnrichingId(book.id)
    showToast(`Buscando portada y datos para "${book.title}"...`)
    try {
      const updated = await window.api.enrichLibraryBook(book.id)
      if (updated) {
        await loadLibrary()
        if (inspectingBook?.id === book.id) setInspectingBook(updated)
        showToast(`Portada y datos actualizados para "${updated.title}".`)
      } else {
        showToast('No se encontraron nuevos datos en internet.')
      }
    } catch (e) {
      showToast('Error al buscar datos en internet.')
    } finally {
      setEnrichingId(null)
    }
  }

  const handleDelete = async (book: LibraryBook) => {
    if (confirm(`¿Eliminar definitivamente "${book.title}" de tu biblioteca y borrar su archivo del disco?`)) {
      const updated = await window.api.deleteLibraryBook(book.id)
      setBooks(updated)
      if (onBooksCountChange) onBooksCountChange(updated.length)
      if (inspectingBook?.id === book.id) setInspectingBook(null)
      showToast(`Libro retirado de la biblioteca.`)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBook) return
    const updatedList = await window.api.updateLibraryBook(editingBook)
    setBooks(updatedList)
    if (inspectingBook?.id === editingBook.id) setInspectingBook(editingBook)
    setEditingBook(null)
    showToast('Cambios guardados con éxito.')
  }

  const handleSearchForEdit = async () => {
    if (!editingBook) return
    const query = `${editingBook.title} ${editingBook.author !== 'Autor desconocido' ? editingBook.author : ''}`.trim()
    if (!query) return
    showToast(`Buscando "${query}"...`)
    const result = await window.api.searchBook(query)
    if (result) {
      setEditingBook({
        ...editingBook,
        title: result.title || editingBook.title,
        author: result.author || editingBook.author,
        coverUrl: result.coverUrl || editingBook.coverUrl,
        pages: result.pages || editingBook.pages,
        year: result.year || editingBook.year,
        genre: result.genre || editingBook.genre,
        synopsis: result.synopsis || editingBook.synopsis
      })
      showToast('Datos autocompletados desde internet.')
    }
  }

  const handleOpenEdit = async (book: LibraryBook) => {
    const lacksInfo = !book.synopsis || !book.pages || !book.genre || !book.year || !book.coverUrl || !book.author || book.author === 'Autor desconocido'
    if (lacksInfo && book.title) {
      showToast('Completando información desde internet...')
      try {
        const query = `${book.title} ${book.author && book.author !== 'Autor desconocido' ? book.author : ''}`.trim()
        const result = await window.api.searchBook(query)
        if (result) {
          const enrichedBook: LibraryBook = {
            ...book,
            title: book.title || result.title,
            author: (!book.author || book.author === 'Autor desconocido') && result.author ? result.author : book.author,
            coverUrl: book.coverUrl || result.coverUrl || '',
            pages: book.pages || result.pages || undefined,
            year: book.year || result.year || undefined,
            genre: book.genre || result.genre || '',
            synopsis: book.synopsis || result.synopsis || ''
          }
          setEditingBook(enrichedBook)
          window.api.updateLibraryBook(enrichedBook).then(updated => {
            setBooks(updated)
            if (inspectingBook?.id === book.id) setInspectingBook(enrichedBook)
          }).catch(() => {})
          showToast('Datos completados desde internet.')
          return
        }
      } catch (err) {
        console.error('Error auto-enriching on open edit:', err)
      }
    }
    setEditingBook(book)
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 KB'
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }
    return Math.round(bytes / 1024) + ' KB'
  }

  const totalBytes = books.reduce((acc, b) => acc + (b.fileSize || 0), 0)
  const pendingCount = books.filter(b => b.status !== 'read' && !readBookIds.includes(b.id)).length
  const readCount = books.filter(b => b.status === 'read' || readBookIds.includes(b.id)).length

  // Filtering
  const filtered = books.filter(b => {
    const titleMatch = b.title.toLowerCase().includes(searchQuery.toLowerCase())
    const authorMatch = b.author?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSearch = titleMatch || authorMatch

    const isMarkedRead = b.status === 'read' || readBookIds.includes(b.id)
    const matchesStatus = statusFilter === 'all' ? true :
                          statusFilter === 'read' ? isMarkedRead :
                          statusFilter === 'pending' ? !isMarkedRead : true

    const matchesFormat = formatFilter === 'all' ? true : b.format.toLowerCase() === formatFilter.toLowerCase()

    return matchesSearch && matchesStatus && matchesFormat
  }).sort((a, b) => {
    if (sortBy === 'title-asc') {
      return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' })
    }
    if (sortBy === 'title-desc') {
      return (b.title || '').localeCompare(a.title || '', 'es', { sensitivity: 'base' })
    }
    if (sortBy === 'author-asc') {
      const aAuth = (a.author && a.author !== 'Autor desconocido') ? a.author : 'ZZZ'
      const bAuth = (b.author && b.author !== 'Autor desconocido') ? b.author : 'ZZZ'
      return aAuth.localeCompare(bAuth, 'es', { sensitivity: 'base' })
    }
    return 0 // 'custom': keeps the books state order (which is persisted by sort_order / reorderLibraryBooks)
  })

  // Partition for shelf display into shelves of 6 books
  const chunkIntoShelves = (arr: LibraryBook[], size: number) => {
    const shelves: LibraryBook[][] = []
    for (let i = 0; i < arr.length; i += size) {
      shelves.push(arr.slice(i, i + size))
    }
    return shelves
  }

  const shelfRows = chunkIntoShelves(filtered, 6)
  const spineRows = chunkIntoShelves(filtered, 16)

  // Extract cover colors dynamically when spines view is active
  useEffect(() => {
    if (viewMode !== 'spines') return
    let isMounted = true

    filtered.forEach((book, idx) => {
      if (book.coverUrl && !coverPalettes[book.id]) {
        extractCoverPalette(book.coverUrl, idx).then((pal) => {
          if (isMounted) {
            setCoverPalettes(prev => ({ ...prev, [book.id]: pal }))
          }
        })
      }
    })

    return () => { isMounted = false }
  }, [filtered, viewMode])

  // Realistic dynamic page calculation when pages is not in metadata
  const getEstimatedPages = (book: LibraryBook, idx: number): number => {
    if (book.pages) {
      const p = parseInt(book.pages)
      if (!isNaN(p) && p > 0) return p
    }
    if (book.fileSize && book.fileSize > 0) {
      const kb = book.fileSize / 1024
      if (book.format?.toLowerCase() === 'pdf') {
        return Math.min(950, Math.max(75, Math.round(kb / 18)))
      } else {
        const base = Math.round(180 + Math.sqrt(kb) * 12)
        const hash = (book.id || book.title || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), idx * 13)
        const variance = (hash % 160) - 80
        return Math.min(920, Math.max(90, base + variance))
      }
    }
    const hash = (book.id || book.title || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), idx * 23)
    const samples = [184, 320, 480, 240, 620, 156, 390, 510, 275, 430, 710, 195, 340, 560]
    return samples[hash % samples.length]
  }

  // Calculate organic spine width according to pages (34px to 80px)
  const getSpineWidth = (pages: number): number => {
    if (pages <= 130) return 34
    if (pages <= 220) return 40
    if (pages <= 330) return 48
    if (pages <= 460) return 56
    if (pages <= 600) return 66
    if (pages <= 760) return 74
    return 80
  }

  // Realistic natural physical height variation (220px to 260px)
  const getSpineHeight = (book: LibraryBook, idx: number): number => {
    const hash = (book.id || book.title || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), idx * 19)
    const heights = [220, 242, 256, 228, 248, 234, 260, 224, 244, 252]
    return heights[hash % heights.length]
  }

  // Dynamic font size for titles along the spine
  const getTitleFontSize = (title: string, spineWidth: number): string => {
    const len = (title || '').length
    if (len < 16) return spineWidth < 42 ? '12px' : '13.5px'
    if (len < 26) return spineWidth < 42 ? '11px' : '12.5px'
    if (len < 38) return spineWidth < 42 ? '10px' : '11.5px'
    return '9.5px'
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--color-ink)] text-[var(--color-cream)] p-4 rounded-[14px] shadow-2xl border border-[var(--color-line)]/30 max-w-[420px] text-[13px] leading-snug flex items-center justify-between gap-3 animate-fade-in">
          <span>{notification}</span>
          <button 
            onClick={() => setNotification(null)}
            className="text-[var(--color-cream)]/70 hover:text-white p-1 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner & Library Summary */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[22px] p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Library className="w-6 h-6 text-[var(--color-accent)] stroke-[2.2]" />
              <h2 className="text-[26px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)]">
                Tu Biblioteca Digital
              </h2>
            </div>
            <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--color-chip)] text-[var(--color-ink)] border border-[var(--color-line)]">
              {books.length} {books.length === 1 ? 'libro' : 'libros'}
            </span>
          </div>

          {/* Quick Stats Pill Bar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-4 text-[12.5px] font-medium text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)]">
              <BookMarked className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span><strong>{books.length}</strong> volúmenes</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)]">
              <HardDrive className="w-3.5 h-3.5 text-[var(--color-muted)]" />
              <span><strong>{formatFileSize(totalBytes)}</strong> en disco</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-amber-800 dark:text-amber-300">
              <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span><strong>{pendingCount}</strong> por leer</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span><strong>{readCount}</strong> leídos</span>
            </span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="shrink-0 flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              const nextMode = !isSelectMode
              setIsSelectMode(nextMode)
              if (!nextMode) setSelectedBookIds([])
            }}
            className={`py-[11px] px-4 rounded-full border font-bold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
              isSelectMode 
                ? 'bg-[var(--color-ink)] text-[var(--color-cream)] border-transparent' 
                : 'border-[var(--color-line)] bg-[var(--color-bg)] hover:bg-[var(--color-line)]/50 text-[var(--color-ink)]'
            }`}
            title="Seleccionar múltiples libros para transferir, borrar o exportar en lote"
          >
            {isSelectMode ? (
              <CheckSquare className="w-3.5 h-3.5 stroke-[2.2] text-[var(--color-sky)]" />
            ) : (
              <Square className="w-3.5 h-3.5 stroke-[2.2]" />
            )}
            <span>{isSelectMode ? 'Cancelar selección' : 'Seleccionar'}</span>
          </button>

          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold py-[11px] px-5 sm:px-6 rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shadow-xs disabled:opacity-50 text-[13px]"
          >
            {isUploading ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 stroke-[2.4]" />
            )}
            <span>{isUploading ? 'Añadiendo libro...' : 'Añadir a biblioteca'}</span>
          </button>
        </div>
      </div>

      {/* =============================================================
         eReader DOCK & DRAG-AND-DROP TRANSFER ZONE
      ============================================================= */}
      {connectedDevice ? (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragOverDevice(true) }}
          onDragLeave={() => setIsDragOverDevice(false)}
          onDrop={handleDropOnDevice}
          className={`rounded-[22px] p-4 sm:p-5 transition-all border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm select-none ${
            isDragOverDevice
              ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)] scale-[1.01] shadow-xl ring-4 ring-[var(--color-accent)]/20'
              : 'bg-emerald-500/10 dark:bg-emerald-950/25 border-emerald-500/40'
          }`}
        >
          {/* Left: Device status */}
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-[14px] bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                <Tablet className="w-6 h-6 stroke-[2]" />
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[var(--color-surface)] animate-pulse"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                  eReader detectado
                </span>
                <span className="font-bold text-[17px] text-[var(--color-ink)] font-['Bricolage_Grotesque']">
                  {connectedDevice.name}
                </span>
              </div>
              <p className="text-[12px] text-[var(--color-muted)] truncate max-w-[42ch] mt-0.5">
                Memoria principal: <span className="font-mono text-[11px] opacity-85">{connectedDevice.targetFolder}</span>
              </p>
            </div>
          </div>

          {/* Middle: Interactive Drag & Drop Landing Target */}
          <div className={`flex-1 max-w-[460px] py-2.5 px-4 rounded-[14px] text-center transition-all ${
            isDragOverDevice 
              ? 'bg-[var(--color-accent)] text-white font-bold text-[13.5px] scale-105 shadow-md' 
              : 'border border-dashed border-emerald-600/40 bg-white/40 dark:bg-black/20 text-[12.5px] text-emerald-900 dark:text-emerald-300'
          }`}>
            {isDragOverDevice ? (
              <span className="flex items-center gap-2 justify-center">
                <Download className="w-4 h-4 animate-bounce" />
                <span>¡Suelta aquí para transferir a {connectedDevice.name}!</span>
              </span>
            ) : (
              <span className="flex items-center gap-2 justify-center">
                <Tablet className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>Arrastra cualquier libro aquí para pasarlo a la memoria</span>
              </span>
            )}
          </div>

          {/* Right: Batch Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {selectedBookIds.length > 0 ? (
              <button
                onClick={handleTransferSelectionToDevice}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-4 rounded-full text-[12.5px] flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Transferir {selectedBookIds.length} sel.</span>
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (filtered.length === 0) return
                  showToast(`Transfiriendo ${filtered.length} libros a ${connectedDevice.name}...`)
                  const res = await window.api.sendMultipleToDevice(filtered.map(b => b.id), connectedDevice.targetFolder)
                  showToast(res.message)
                }}
                className="border border-emerald-600/40 hover:bg-emerald-600/10 text-emerald-900 dark:text-emerald-300 font-bold py-2 px-4 rounded-full text-[12px] transition-colors cursor-pointer"
                title="Copiar todos los libros filtrados al eReader"
              >
                Pasar todos ({filtered.length})
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Subtle eReader Helper Bar when not yet connected */
        <div className="rounded-[18px] px-5 py-3 bg-[var(--color-surface)] border border-[var(--color-line)] flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[var(--color-muted)] shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Tablet className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
            <span>Conecta tu eReader por USB para transferir libros arrastrando y soltando.</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => openKindleModal()}
              className="text-amber-700 dark:text-amber-400 hover:underline font-semibold cursor-pointer text-[12px] flex items-center gap-1.5"
              title="Seleccionar y subir libros a Kindle sin cables"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>¿Tienes Kindle? Enviar sin cables</span>
            </button>
            <span className="text-[var(--color-line)] hidden sm:inline">•</span>
            <button
              onClick={async () => {
                const dev = await window.api.getConnectedDevice()
                if (dev && dev.connected) {
                  setConnectedDevice(dev)
                  showToast(`Dispositivo detectado: ${dev.name}`)
                } else {
                  const res = await window.api.selectCustomDeviceFolder()
                  if (res.success && res.device) {
                    setConnectedDevice(res.device)
                    showToast(`Carpeta de eReader vinculada: ${res.path}`)
                  }
                }
              }}
              className="text-[var(--color-accent)] hover:underline font-semibold cursor-pointer text-[12px]"
            >
              Detectar o vincular carpeta manualmente
            </button>
          </div>
        </div>
      )}

      {/* Control Bar: Search, Filters & View Switcher */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between flex-wrap bg-[var(--color-surface)]/60 border border-[var(--color-line)]/80 rounded-2xl p-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-line)] rounded-full pl-9 pr-4 py-2 placeholder:text-[var(--color-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-green)] text-[13.5px]" 
            placeholder="Buscar por título o autor en la estantería..."
          />
        </div>

        {/* Filters and View Switcher */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Status chips */}
          <div className="flex gap-1 p-0.5 bg-[var(--color-bg)] border border-[var(--color-line)] rounded-full">
            <button 
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-full text-[12.5px] font-medium transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-[var(--color-chip)] font-bold text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}
            >
              Todos ({books.length})
            </button>
            <button 
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-full text-[12.5px] font-medium transition-all cursor-pointer ${statusFilter === 'pending' ? 'bg-[var(--color-chip)] font-bold text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}
            >
              Por leer
            </button>
            <button 
              onClick={() => setStatusFilter('read')}
              className={`px-3 py-1 rounded-full text-[12.5px] font-medium transition-all cursor-pointer ${statusFilter === 'read' ? 'bg-[var(--color-chip)] font-bold text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}
            >
              Leídos
            </button>
          </div>

          {/* Format selector */}
          <select
            value={formatFilter}
            onChange={e => setFormatFilter(e.target.value)}
            className="bg-[var(--color-bg)] border border-[var(--color-line)] rounded-full px-3 py-1.5 text-[12.5px] font-medium outline-none cursor-pointer text-[var(--color-ink)]"
          >
            <option value="all">Formato</option>
            <option value="epub">EPUB</option>
            <option value="pdf">PDF</option>
            <option value="mobi">MOBI</option>
            <option value="azw3">AZW3</option>
          </select>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-line)] rounded-full px-2.5 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-[12.5px] font-medium outline-none cursor-pointer text-[var(--color-ink)] pr-1"
            >
              <option value="custom">Orden manual</option>
              <option value="title-asc">Título (A-Z)</option>
              <option value="title-desc">Título (Z-A)</option>
              <option value="author-asc">Autor (A-Z)</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-1 p-0.5 bg-[var(--color-bg)] border border-[var(--color-line)] rounded-full ml-auto sm:ml-2">
            <button
              onClick={() => setViewMode('shelf')}
              className={`px-3 py-1 rounded-full text-[12.5px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${viewMode === 'shelf' ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold shadow-xs' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
              title="Vista de estantería suspendida con portadas"
            >
              <BookOpen className="w-3.5 h-3.5 stroke-[2]" />
              <span>Estantería</span>
            </button>
            <button
              onClick={() => setViewMode('spines')}
              className={`px-3 py-1 rounded-full text-[12.5px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${viewMode === 'spines' ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold shadow-xs' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
              title="Vista experimental de lomos de libros ordenados por tamaño de páginas"
            >
              <Bookmark className="w-3.5 h-3.5 stroke-[2]" />
              <span>Lomos</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-full text-[12.5px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold shadow-xs' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
              title="Vista en formato lista con miniaturas y detalles"
            >
              <List className="w-3.5 h-3.5 stroke-[2]" />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div
          onClick={() => {
            if (books.length === 0 && !isUploading) {
              handleUpload()
            }
          }}
          role={books.length === 0 ? 'button' : undefined}
          tabIndex={books.length === 0 ? 0 : undefined}
          onKeyDown={e => {
            if (books.length === 0 && !isUploading && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              handleUpload()
            }
          }}
          className={`border-2 border-dashed border-[var(--color-line)] rounded-[22px] p-12 text-center text-[var(--color-muted)] flex flex-col items-center gap-3 bg-[var(--color-surface)]/40 my-6 transition-all ${
            books.length === 0
              ? 'cursor-pointer hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)]/75 group'
              : ''
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-[var(--color-bg)] group-hover:bg-[var(--color-accent)] group-hover:text-[var(--color-on-accent)] group-hover:border-[var(--color-accent)] flex items-center justify-center text-[var(--color-muted)] border border-[var(--color-line)] transition-colors">
            <Library className="w-6 h-6 stroke-[1.8]" />
          </div>
          <p className="font-bold text-[20px] text-[var(--color-ink)] font-['Bricolage_Grotesque']">
            {books.length === 0 ? 'Tu estantería está despejada' : 'No hay libros con estos filtros'}
          </p>
          <p className="text-[14px] max-w-[48ch] leading-relaxed">
            {books.length === 0 
              ? 'Haz clic en este recuadro o pulsa en "Añadir a biblioteca" para colocar tus primeros libros en la estantería. Detectaremos las portadas y los autores automáticamente.'
              : 'Prueba a cambiar el texto de búsqueda o el filtro de formato.'}
          </p>
          {books.length === 0 && (
            <button
              onClick={e => {
                e.stopPropagation()
                handleUpload()
              }}
              className="mt-3 bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold py-2.5 px-6 rounded-full text-[13.5px] hover:opacity-90 cursor-pointer shadow-xs inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4 stroke-[2]" />
              <span>Elegir archivo (EPUB, PDF...)</span>
            </button>
          )}
        </div>
      ) : viewMode === 'shelf' ? (
        
        /* -------------------------------------------------------------
           MINIMALIST FLOATING BOOKSHELF (Estantería suspendida minimalista)
        ------------------------------------------------------------- */
        <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[24px] p-6 sm:p-10 shadow-xs flex flex-col gap-12 my-2 overflow-x-auto">
          {shelfRows.map((row, shelfIdx) => (
            <div key={shelfIdx} className="relative flex flex-col min-w-[960px]">
              
              {/* Quiet shelf indicator if multiple shelves */}
              {shelfRows.length > 1 && (
                <div className="flex items-center gap-2 mb-6 select-none">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-muted)] font-mono">
                    0{shelfIdx + 1}
                  </span>
                  <div className="h-px flex-1 bg-[var(--color-line)]/60"></div>
                </div>
              )}

              {/* Row of Books standing flush on the floating rail (exactly 6 books per line) */}
              <div className="flex items-end justify-between w-full px-4 sm:px-6 relative z-10 flex-nowrap">
                {row.map((book, bIdx) => {
                  const isRead = book.status === 'read' || readBookIds.includes(book.id)
                  const formatUpper = (book.format || 'EPUB').toUpperCase()
                  const isSelected = selectedBookIds.includes(book.id)

                  const coverColorIdx = (shelfIdx * 6 + bIdx) % 4
                  const coverBg = coverColorIdx === 0 ? 'var(--color-brown)' : coverColorIdx === 1 ? 'var(--color-teal)' : coverColorIdx === 2 ? 'var(--color-green)' : 'var(--color-sky)'
                  const coverFg = coverColorIdx === 3 ? 'var(--color-teal)' : 'var(--color-cream)'
                  const coverLetters = (book.title || 'LI').substring(0, 2).toUpperCase()

                  return (
                    <div 
                      key={book.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', book.id)
                        setDraggedBookId(book.id)
                      }}
                      onDragEnd={() => {
                        setDraggedBookId(null)
                        setDragOverTargetId(null)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (draggedBookId && draggedBookId !== book.id) {
                          setDragOverTargetId(book.id)
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverTargetId === book.id) {
                          setDragOverTargetId(null)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        handleBookDropReorder(book.id)
                      }}
                      onClick={(e) => {
                        if (isSelectMode) {
                          toggleSelectBook(book.id, e)
                        } else {
                          setInspectingBook(book)
                        }
                      }}
                      className={`group relative flex flex-col items-center cursor-pointer select-none transition-all duration-300 ease-out hover:-translate-y-3 shrink-0 ${
                        draggedBookId === book.id ? 'opacity-40 scale-95' : ''
                      } ${dragOverTargetId === book.id ? 'ring-2 ring-[var(--color-accent)] ring-offset-4 rounded-xl scale-105' : ''}`}
                      style={{ width: '130px', flexShrink: 0 }}
                    >
                      {/* Top Badges */}
                      <div className="absolute -top-3 right-1.5 z-30">
                        <span className="px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider bg-[var(--color-ink)] text-[var(--color-cream)] shadow-xs">
                          {formatUpper}
                        </span>
                      </div>

                      {isRead && (
                        <div className="absolute -top-3 left-1.5 z-30">
                          <span className="px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-bold bg-emerald-700 text-white shadow-xs inline-flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Leído</span>
                          </span>
                        </div>
                      )}

                      {/* Multi-Select Checkbox overlay */}
                      {(isSelectMode || isSelected) && (
                        <button
                          onClick={(e) => toggleSelectBook(book.id, e)}
                          className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-35 w-6 h-6 rounded-md shadow-md flex items-center justify-center border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                              : 'bg-white/95 dark:bg-black/90 border-black/20 text-black/50 hover:border-[var(--color-accent)]'
                          }`}
                          title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                        >
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-xs border border-black/40"></div>
                          )}
                        </button>
                      )}

                      {/* Book Volume Container */}
                      <div 
                        className={`relative rounded-[4px] overflow-hidden shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.18)] transition-all bg-stone-100 dark:bg-stone-800 border border-black/10 dark:border-white/10 ${
                          isSelected ? 'ring-3 ring-[var(--color-accent)] shadow-xl' : ''
                        }`}
                        style={{ width: '138px', height: '198px' }}
                      >
                        {/* Book Cover Image or Typographic Fallback */}
                        {book.coverUrl ? (
                          <img 
                            src={book.coverUrl} 
                            alt={book.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) {
                                const fallback = document.createElement('div');
                                fallback.className = "w-full h-full flex flex-col justify-between p-3.5 text-center";
                                fallback.style.backgroundColor = coverBg;
                                fallback.style.color = coverFg;
                                fallback.innerHTML = `
                                  <span class="text-[10px] font-bold uppercase tracking-wider opacity-70 truncate">${book.author || 'Libro'}</span>
                                  <span class="text-[32px] font-bold font-['Bricolage_Grotesque'] leading-none">${coverLetters}</span>
                                  <span class="text-[12px] font-bold line-clamp-2 leading-tight">${book.title}</span>
                                `;
                                parent.prepend(fallback);
                              }
                            }}
                          />
                        ) : (
                          <div 
                            className="w-full h-full flex flex-col justify-between p-3.5 text-center"
                            style={{ backgroundColor: coverBg, color: coverFg }}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 truncate">
                              {book.author && book.author !== 'Autor desconocido' ? book.author : 'Lectura'}
                            </span>
                            <span className="text-[32px] font-bold font-['Bricolage_Grotesque'] leading-none">
                              {coverLetters}
                            </span>
                            <span className="text-[12px] font-bold line-clamp-2 leading-tight">
                              {book.title}
                            </span>
                          </div>
                        )}

                        {/* Subtle inner spine depth shadow on the left */}
                        <div className="absolute inset-y-0 left-0 w-[10px] bg-gradient-to-r from-black/25 to-transparent pointer-events-none"></div>
                        <div className="absolute inset-y-0 right-0 w-[2px] bg-gradient-to-l from-black/15 to-transparent pointer-events-none"></div>
                      </div>

                      {/* Contact shadow */}
                      <div className="w-[124px] h-[5px] mx-auto bg-black/20 dark:bg-black/50 blur-[2px] rounded-full mt-[-2px] group-hover:opacity-40 group-hover:scale-75 transition-all pointer-events-none"></div>

                    </div>
                  )
                })}
                {Array.from({ length: 6 - row.length }).map((_, i) => (
                  <div key={`empty-lib-slot-${i}`} style={{ width: '138px', flexShrink: 0 }} />
                ))}
              </div>

              {/* Ultra-Minimalist Floating Shelf Rail */}
              <div className="relative w-full mt-0">
                <div className="h-[3px] w-full bg-[var(--color-line)] dark:bg-white/15 rounded-full"></div>
                <div className="h-[6px] w-full bg-gradient-to-b from-black/[0.04] to-transparent pointer-events-none"></div>
              </div>

              {/* Minimalist Typographic Labels beneath shelf */}
              <div className="flex items-start justify-between w-full px-4 sm:px-6 pt-2.5 pb-2 flex-nowrap">
                {row.map((book) => (
                  <div
                    key={book.id}
                    onClick={(e) => {
                      if (isSelectMode) {
                        toggleSelectBook(book.id, e)
                      } else {
                        setInspectingBook(book)
                      }
                    }}
                    className="cursor-pointer group/label text-center px-0.5 shrink-0"
                    style={{ width: '138px', flexShrink: 0 }}
                  >
                    <p className="text-[12.5px] font-semibold text-[var(--color-ink)] line-clamp-1 leading-snug group-hover/label:text-[var(--color-accent)] transition-colors">
                      {book.title}
                    </p>
                    <p className="text-[11px] text-[var(--color-muted)] truncate mt-0.5">
                      {book.author && book.author !== 'Autor desconocido' ? book.author : 'Autor desconocido'}
                    </p>
                  </div>
                ))}
                {Array.from({ length: 6 - row.length }).map((_, i) => (
                  <div key={`empty-lib-lbl-${i}`} style={{ width: '138px', flexShrink: 0 }} />
                ))}
              </div>

            </div>
          ))}
        </div>

      ) : viewMode === 'spines' ? (

        /* -------------------------------------------------------------
           CREATIVE BOOK SPINES VIEW (Vista experimental de lomos de libros)
        ------------------------------------------------------------- */
        <>
        <div
          onScroll={() => setHoveredSpine(null)}
          className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[24px] p-6 sm:p-10 shadow-xs flex flex-col gap-14 my-2 overflow-x-auto"
        >
          {spineRows.map((row, shelfIdx) => (
            <div key={shelfIdx} className="relative flex flex-col min-w-[760px]">
              
              {/* Quiet shelf indicator if multiple shelves */}
              {spineRows.length > 1 && (
                <div className="flex items-center gap-2 mb-8 select-none">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-muted)] font-mono">
                    Estante 0{shelfIdx + 1}
                  </span>
                  <div className="h-px flex-1 bg-[var(--color-line)]/60"></div>
                  <span className="text-[11px] text-[var(--color-muted)] font-mono">
                    {row.length} {row.length === 1 ? 'volumen' : 'volúmenes'}
                  </span>
                </div>
              )}

              {/* Row of Book Spines standing side-by-side on the shelf */}
              <div className="flex items-end justify-start gap-1.5 sm:gap-2 px-6 sm:px-8 relative z-10 pt-8 pb-0">
                {row.map((book, bIdx) => {
                  const isRead = book.status === 'read' || readBookIds.includes(book.id)
                  const isSelected = selectedBookIds.includes(book.id)
                  const formatUpper = (book.format || 'EPUB').toUpperCase()

                  // Dimension calculations: organic pages estimation & natural height variation
                  const pagesCount = getEstimatedPages(book, shelfIdx * 16 + bIdx)
                  const spineWidth = getSpineWidth(pagesCount)
                  const spineHeight = getSpineHeight(book, shelfIdx * 16 + bIdx)

                  // Cover-extracted palette (matching the book's cover image) with high-contrast guarantee
                  const palette = coverPalettes[book.id] || SPINE_PALETTES[(shelfIdx * 7 + bIdx) % SPINE_PALETTES.length]

                  return (
                    <div
                      key={book.id}
                      draggable={true}
                      onDragStart={(e) => {
                        setHoveredSpine(null)
                        e.dataTransfer.setData('text/plain', book.id)
                        setDraggedBookId(book.id)
                      }}
                      onDragEnd={() => setDraggedBookId(null)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const clampedX = Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2))
                        const showBelow = rect.top < 170
                        const yPos = showBelow ? rect.bottom + 12 : rect.top - 18
                        setHoveredSpine({
                          book,
                          pagesCount,
                          palette,
                          isRead,
                          formatUpper,
                          x: clampedX,
                          y: yPos,
                          showBelow
                        })
                      }}
                      onMouseLeave={() => setHoveredSpine(null)}
                      onClick={(e) => {
                        setHoveredSpine(null)
                        if (isSelectMode) {
                          toggleSelectBook(book.id, e)
                        } else {
                          setInspectingBook(book)
                        }
                      }}
                      className={`group relative flex flex-col items-center cursor-pointer select-none transition-all duration-200 ease-out hover:-translate-y-4 hover:z-30 ${
                        draggedBookId === book.id ? 'opacity-40 scale-95' : ''
                      }`}
                    >
                      {/* Selection checkbox indicator pill */}
                      {(isSelectMode || isSelected) && (
                        <div className={`absolute -top-6 left-1/2 -translate-x-1/2 z-20 w-5 h-5 rounded-md flex items-center justify-center border shadow-xs ${
                          isSelected ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white' : 'bg-white border-black/20 text-transparent'
                        }`}>
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}

                      {/* Physical Book Spine */}
                      <div 
                        className={`relative rounded-t-[4px] rounded-b-[2px] flex flex-col justify-between overflow-hidden shadow-md group-hover:shadow-2xl transition-all border ${
                          isSelected ? 'ring-2 ring-[var(--color-accent)] ring-offset-2' : ''
                        }`}
                        style={{
                          width: `${spineWidth}px`,
                          height: `${spineHeight}px`,
                          backgroundColor: palette.bg,
                          color: palette.text,
                          borderColor: palette.isLight ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.28)',
                          boxShadow: palette.isLight
                            ? 'inset 3px 0 3px rgba(0,0,0,0.12), inset -2px 0 2px rgba(255,255,255,0.6), 2px 4px 10px rgba(0,0,0,0.12)'
                            : 'inset 3px 0 3px rgba(0,0,0,0.25), inset -2px 0 2px rgba(255,255,255,0.08), 2px 4px 10px rgba(0,0,0,0.22)'
                        }}
                      >
                        {/* Top Spine Headband & Rib (Cabezada superior) */}
                        <div className="w-full flex flex-col items-center pt-1.5 px-0.5 pointer-events-none">
                          <div className={`w-full h-[3px] rounded-t-xs ${palette.isLight ? 'bg-black/15' : 'bg-black/25'}`}></div>
                          <div className={`w-full h-px mt-1 ${palette.isLight ? 'bg-black/8' : 'bg-white/10'}`}></div>
                          {isRead && (
                            <div className="mt-1 flex items-center justify-center">
                              <span 
                                className="w-2.5 h-2.5 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-xs"
                                title="Libro leído"
                              >
                                <Check className="w-1.5 h-1.5 stroke-[3.5]" />
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Upper embossed rib / nervio */}
                        <div className={`w-full h-[2px] pointer-events-none ${palette.isLight ? 'bg-black/12 shadow-[0_1px_0_rgba(255,255,255,0.4)]' : 'bg-black/20 shadow-[0_1px_0_rgba(255,255,255,0.08)]'}`}></div>

                        {/* Spine Typography: Title in Bold and Author in Small (Lectura vertical nítida sin cortes) */}
                        <div 
                          className="flex-1 flex items-center justify-center overflow-hidden py-2 px-1 pointer-events-none select-none"
                          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                        >
                          {spineWidth >= 52 ? (
                            // Wide Spines (52px+): 2 distinct, unbroken parallel lines
                            <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                              <span 
                                className="font-bold tracking-tight font-['Bricolage_Grotesque'] whitespace-nowrap truncate max-h-[155px]"
                                style={{ fontSize: getTitleFontSize(book.title, spineWidth), lineHeight: '1.2' }}
                              >
                                {book.title}
                              </span>
                              {book.author && book.author !== 'Autor desconocido' && (
                                <span 
                                  className="opacity-80 font-normal font-['DM_Sans'] whitespace-nowrap truncate max-h-[105px] text-[10.5px]"
                                >
                                  {book.author}
                                </span>
                              )}
                            </div>
                          ) : (
                            // Standard and Slender Spines (<52px): Single continuous line, never broken or cramped
                            <div className="whitespace-nowrap flex items-center gap-2 overflow-hidden text-ellipsis max-h-[160px]">
                              <span 
                                className="font-bold tracking-tight font-['Bricolage_Grotesque'] whitespace-nowrap"
                                style={{ fontSize: getTitleFontSize(book.title, spineWidth) }}
                              >
                                {book.title}
                              </span>
                              {book.author && book.author !== 'Autor desconocido' && (
                                <>
                                  <span className="opacity-40 text-[9px] select-none">•</span>
                                  <span 
                                    className="opacity-80 font-normal font-['DM_Sans'] whitespace-nowrap text-[10.5px]"
                                  >
                                    {book.author}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Lower embossed rib / nervio */}
                        <div className={`w-full h-[2px] pointer-events-none ${palette.isLight ? 'bg-black/12 shadow-[0_1px_0_rgba(255,255,255,0.4)]' : 'bg-black/20 shadow-[0_1px_0_rgba(255,255,255,0.08)]'}`}></div>

                        {/* Bottom Spine Tailband & Footnote (Páginas y formato) */}
                        <div className="w-full pb-1.5 pt-1 px-1 flex flex-col items-center justify-center gap-0.5 pointer-events-none select-none">
                          <span 
                            className="text-[9px] font-mono tracking-wider uppercase font-semibold"
                            style={{ 
                              color: palette.accent,
                              fontSize: spineWidth < 42 ? '8px' : '9px' 
                            }}
                          >
                            {pagesCount}p
                          </span>
                          <div className={`w-full h-[3px] rounded-b-xs ${palette.isLight ? 'bg-black/18' : 'bg-black/30'}`}></div>
                        </div>

                        {/* Subtle vertical spine sheen reflection overlay */}
                        <div 
                          className="absolute inset-0 pointer-events-none opacity-50"
                          style={{
                            background: palette.isLight
                              ? 'linear-gradient(90deg, rgba(0,0,0,0.08) 0%, rgba(255,255,255,0.3) 30%, rgba(255,255,255,0.1) 50%, rgba(0,0,0,0.12) 100%)'
                              : 'linear-gradient(90deg, rgba(0,0,0,0.18) 0%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.22) 100%)'
                          }}
                        />
                      </div>

                      {/* Contact shadow on the floating shelf */}
                      <div 
                        className="h-[4px] bg-black/25 dark:bg-black/60 blur-[1.5px] rounded-full mt-[-2px] group-hover:opacity-40 group-hover:scale-75 transition-all pointer-events-none"
                        style={{ width: `${spineWidth * 0.9}px` }}
                      />

                    </div>
                  )
                })}
              </div>

              {/* Minimalist Floating Shelf Rail */}
              <div className="relative w-full mt-0">
                <div className="h-[4px] w-full bg-[var(--color-line)] dark:bg-white/15 rounded-full shadow-xs"></div>
                <div className="h-[8px] w-full bg-gradient-to-b from-black/[0.05] to-transparent pointer-events-none"></div>
              </div>

            </div>
          ))}
        </div>

        {/* Fixed Hover Tooltip Card (Rendered outside overflow-x-auto so it is never clipped) */}
        {hoveredSpine && (
          <div
            className="fixed z-50 pointer-events-none min-w-[225px] max-w-[275px] bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[14px] p-3.5 shadow-2xl text-left transition-opacity duration-150"
            style={{
              left: `${hoveredSpine.x}px`,
              top: `${hoveredSpine.y}px`,
              transform: hoveredSpine.showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
            }}
          >
            <div className="flex gap-3 items-start">
              {hoveredSpine.book.coverUrl ? (
                <img
                  src={hoveredSpine.book.coverUrl}
                  alt={hoveredSpine.book.title}
                  className="w-[42px] h-[60px] object-cover rounded-[4px] border border-[var(--color-line)] shrink-0 bg-white shadow-xs"
                />
              ) : (
                <div
                  className="w-[42px] h-[60px] rounded-[4px] flex items-center justify-center font-bold text-[14px] shrink-0 font-['Bricolage_Grotesque'] shadow-xs"
                  style={{ backgroundColor: hoveredSpine.palette.bg, color: hoveredSpine.palette.text }}
                >
                  {(hoveredSpine.book.title || 'LI').substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[13.5px] text-[var(--color-ink)] line-clamp-2 leading-snug font-['Bricolage_Grotesque']">
                  {hoveredSpine.book.title}
                </p>
                <p className="text-[11.5px] text-[var(--color-muted)] truncate mt-0.5">
                  {hoveredSpine.book.author && hoveredSpine.book.author !== 'Autor desconocido'
                    ? hoveredSpine.book.author
                    : 'Autor desconocido'}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 text-[10.5px] text-[var(--color-muted)]">
                  <span className="font-bold uppercase text-[var(--color-accent)]">{hoveredSpine.formatUpper}</span>
                  {hoveredSpine.pagesCount && <span>• {hoveredSpine.pagesCount} págs.</span>}
                  {hoveredSpine.isRead && <span className="text-emerald-600 font-bold">• Leído</span>}
                </div>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-[var(--color-line)]/50 text-[10.5px] text-[var(--color-muted)] text-center font-medium">
              Haz clic para inspeccionar / Abrir
            </div>
          </div>
        )}
        </>

      ) : (

        /* -------------------------------------------------------------
           MINIMALIST EDITORIAL LIST VIEW (Formato lista con miniatura, título bold y autor)
        ------------------------------------------------------------- */
        <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[22px] overflow-hidden shadow-xs divide-y divide-[var(--color-line)]/50 my-2">
          {filtered.map((book, idx) => {
            const isRead = book.status === 'read' || readBookIds.includes(book.id)
            const formatUpper = (book.format || 'EPUB').toUpperCase()
            const formatColor = formatUpper === 'EPUB' ? 'bg-[#285666] text-[#EEE0D9]' :
                                formatUpper === 'PDF' ? 'bg-[#663A24] text-[#EEE0D9]' :
                                formatUpper === 'MOBI' ? 'bg-[#3C6655] text-[#EEE0D9]' :
                                'bg-[#C3DDE6] text-[#285666]'

            const coverIdx = idx % 4
            const coverBg = coverIdx === 0 ? 'var(--color-brown)' : coverIdx === 1 ? 'var(--color-teal)' : coverIdx === 2 ? 'var(--color-green)' : 'var(--color-sky)'
            const coverFg = coverIdx === 3 ? 'var(--color-teal)' : 'var(--color-cream)'
            const coverLetters = (book.title || 'LI').substring(0, 2).toUpperCase()

            const isSelected = selectedBookIds.includes(book.id)

            return (
              <div 
                key={book.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', book.id)
                  setDraggedBookId(book.id)
                }}
                onDragEnd={() => {
                  setDraggedBookId(null)
                  setDragOverTargetId(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (draggedBookId && draggedBookId !== book.id) {
                    setDragOverTargetId(book.id)
                  }
                }}
                onDragLeave={() => {
                  if (dragOverTargetId === book.id) {
                    setDragOverTargetId(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleBookDropReorder(book.id)
                }}
                onClick={(e) => {
                  if (isSelectMode) {
                    toggleSelectBook(book.id, e)
                  } else {
                    setInspectingBook(book)
                  }
                }}
                className={`group flex items-center justify-between gap-3 sm:gap-4 p-3 sm:p-3.5 hover:bg-[var(--color-bg)]/50 transition-colors cursor-pointer select-none ${
                  isSelected 
                    ? 'bg-[var(--color-accent)]/8' 
                    : ''
                } ${draggedBookId === book.id ? 'opacity-40 scale-[0.99]' : ''} ${dragOverTargetId === book.id ? 'border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/10 rounded-xl' : ''}`}
              >
                {/* Left Section: Checkbox + Miniature Cover + Title & Author */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* Select Checkbox */}
                  {(isSelectMode || isSelected) ? (
                    <button
                      onClick={(e) => toggleSelectBook(book.id, e)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-xs'
                          : 'bg-[var(--color-surface)] border-[var(--color-line)] text-black/40 hover:border-[var(--color-accent)]'
                      }`}
                      title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                    >
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-xs border border-[var(--color-line)]"></div>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => toggleSelectBook(book.id, e)}
                      className="w-6 h-6 rounded-md flex items-center justify-center border border-transparent opacity-0 group-hover:opacity-100 hover:border-[var(--color-line)] text-black/30 transition-all cursor-pointer shrink-0"
                      title="Seleccionar libro"
                    >
                      <div className="w-2.5 h-2.5 rounded-xs border border-[var(--color-muted)]"></div>
                    </button>
                  )}

                  {/* Miniature Cover */}
                  <div className="shrink-0 relative">
                    {book.coverUrl ? (
                      <img 
                        src={book.coverUrl} 
                        alt={book.title}
                        className="w-[44px] h-[64px] sm:w-[48px] sm:h-[68px] object-cover rounded-[3px_6px_6px_3px] shadow-xs border border-[var(--color-line)] bg-white group-hover:scale-[1.03] transition-transform"
                      />
                    ) : (
                      <div 
                        className="w-[44px] h-[64px] sm:w-[48px] sm:h-[68px] rounded-[3px_6px_6px_3px] flex items-center justify-center font-bold text-[14px] sm:text-[16px] font-['Bricolage_Grotesque'] group-hover:scale-[1.03] transition-transform shadow-xs"
                        style={{ backgroundColor: coverBg, color: coverFg, boxShadow: 'inset 4px 0 0 rgba(0,0,0,0.18)' }}
                      >
                        {coverLetters}
                      </div>
                    )}
                  </div>

                  {/* Title bold and Author smaller */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="font-bold text-[15px] sm:text-[16px] text-[var(--color-ink)] leading-snug group-hover:text-[var(--color-accent)] transition-colors truncate font-['Bricolage_Grotesque']">
                      {book.title}
                    </p>
                    <p className="text-[12.5px] text-[var(--color-muted)] font-normal truncate mt-0.5">
                      {book.author && book.author !== 'Autor desconocido' ? book.author : (
                        <span className="italic opacity-70">Autor desconocido</span>
                      )}
                    </p>

                    {/* Compact metadata info pills */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)] mt-1">
                      <span className={`px-2 py-0.2 rounded-[5px] font-bold text-[10px] tracking-wider ${formatColor}`}>
                        {formatUpper}
                      </span>
                      <span className="font-mono text-[10.5px]">
                        {formatFileSize(book.fileSize)}
                      </span>
                      {book.pages && (
                        <span>• {book.pages} págs.</span>
                      )}
                      {book.year && (
                        <span>• {book.year}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Section: Status badge & Streamlined actions */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  {/* Status Indicator */}
                  {isRead ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-[11px] font-bold">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span className="hidden sm:inline">Leído</span>
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onMarkAsRead(book)
                      }}
                      className="px-2.5 py-1 rounded-full bg-amber-100/70 hover:bg-emerald-100 dark:bg-amber-950/70 dark:hover:bg-emerald-950 text-amber-800 hover:text-emerald-800 dark:text-amber-200 dark:hover:text-emerald-200 text-[11px] font-medium transition-colors cursor-pointer"
                      title="Marcar como leído y pasar a Mis lecturas"
                    >
                      Por leer
                    </button>
                  )}

                  {/* Quick Action Icons */}
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpen(book)
                      }}
                      className="p-2 rounded-full hover:bg-[var(--color-line)]/50 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                      title="Abrir y leer"
                    >
                      <BookOpen className="w-4 h-4 stroke-[2]" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSendToDevice(book)
                      }}
                      className="p-2 rounded-full hover:bg-[var(--color-line)]/50 text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
                      title={connectedDevice ? `Transferir a ${connectedDevice.name}` : "Enviar a eReader / USB"}
                    >
                      <Smartphone className="w-4 h-4 stroke-[2]" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSendToKindleWeb(book)
                      }}
                      className="p-2 rounded-full hover:bg-amber-500/15 text-[var(--color-muted)] hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer hidden sm:inline-flex"
                      title="Subir a Kindle vía Send to Kindle Web (sin cables)"
                    >
                      <Wifi className="w-4 h-4 stroke-[2]" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleShareByEmail(book)
                      }}
                      className="p-2 rounded-full hover:bg-[var(--color-line)]/50 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer hidden sm:inline-flex"
                      title="Enviar por correo electrónico"
                    >
                      <Mail className="w-4 h-4 stroke-[2]" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEnrich(book)
                      }}
                      disabled={enrichingId === book.id}
                      className="p-2 rounded-full hover:bg-[var(--color-line)]/50 text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer hidden sm:inline-flex"
                      title="Buscar metadatos y portada en Internet"
                    >
                      {enrichingId === book.id ? (
                        <RotateCw className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
                      ) : (
                        <Sparkles className="w-4 h-4 stroke-[2]" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(book)
                      }}
                      className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600/70 hover:text-red-700 transition-colors cursor-pointer"
                      title="Eliminar de la biblioteca"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2]" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* -------------------------------------------------------------
          BOOK INSPECTOR MODAL
      ------------------------------------------------------------- */}
      {inspectingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[24px] max-w-[620px] w-full p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col gap-6">
            
            {/* Header: Format chip, size, close button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-[6px] text-[12px] font-bold uppercase bg-[var(--color-accent)] text-[var(--color-on-accent)]">
                  {inspectingBook.format.toUpperCase()}
                </span>
                <span className="text-[12px] text-[var(--color-muted)] font-mono">
                  {formatFileSize(inspectingBook.fileSize)}
                </span>
                {inspectingBook.status === 'read' || readBookIds.includes(inspectingBook.id) ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Registrado como Leído</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>En lista de pendientes</span>
                  </span>
                )}
              </div>

              <button 
                onClick={() => setInspectingBook(null)}
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)] p-1.5 rounded-full hover:bg-[var(--color-bg)] cursor-pointer transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Book Body: 3D Cover + Title & Details */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="shrink-0 mx-auto sm:mx-0">
                <div className="w-[130px] h-[188px] rounded-[3px_9px_9px_3px] overflow-hidden shadow-xl border border-black/10 relative">
                  {inspectingBook.coverUrl ? (
                    <img src={inspectingBook.coverUrl} alt={inspectingBook.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[var(--color-teal)] text-[var(--color-cream)] flex flex-col justify-between p-3 text-center">
                      <span className="text-[10px] uppercase font-bold opacity-75">{inspectingBook.author}</span>
                      <span className="text-[32px] font-bold font-['Bricolage_Grotesque']">LI</span>
                      <span className="text-[12px] font-bold line-clamp-2">{inspectingBook.title}</span>
                    </div>
                  )}
                  <div className="absolute inset-y-0 left-0 w-[14px] bg-gradient-to-r from-black/35 to-transparent pointer-events-none"></div>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <h3 className="text-[24px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-snug">
                  {inspectingBook.title}
                </h3>
                <h4 className="text-[16px] font-medium text-[var(--color-muted)] mt-1">
                  {inspectingBook.author}
                </h4>

                <div className="flex flex-wrap gap-2 text-[12.5px] text-[var(--color-muted)] mt-3">
                  {inspectingBook.pages && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)] font-medium">
                      <FileText className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                      <span>{inspectingBook.pages} páginas</span>
                    </span>
                  )}
                  {inspectingBook.year && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)]">
                      <Calendar className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                      <span>Año {inspectingBook.year}</span>
                    </span>
                  )}
                  {inspectingBook.genre && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)]">
                      <Tag className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                      <span>{inspectingBook.genre}</span>
                    </span>
                  )}
                </div>

                {inspectingBook.synopsis && (
                  <div className="mt-4 pt-3 border-t border-[var(--color-line)]/70">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)] block mb-1">
                      Sinopsis
                    </span>
                    <p className="text-[13px] text-[var(--color-muted)] leading-relaxed max-h-[120px] overflow-y-auto">
                      {inspectingBook.synopsis}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col gap-2.5 pt-4 border-t border-[var(--color-line)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => handleOpen(inspectingBook)}
                  className="py-3 px-4 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-line)] font-bold text-[14px] text-[var(--color-ink)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 stroke-[2]" />
                  <span>Abrir para leer</span>
                </button>

                <button
                  onClick={() => handleSendToDevice(inspectingBook)}
                  className="py-3 px-4 rounded-xl bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-on-accent)] font-bold text-[14px] transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Smartphone className="w-4 h-4 stroke-[2]" />
                  <span>Enviar a eReader / USB</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => handleSendToKindleWeb(inspectingBook)}
                  className="py-2.5 px-4 rounded-xl border border-amber-600/35 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[13px] font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  title="Subir a Kindle mediante Send to Kindle Web (sin cables)"
                >
                  <Wifi className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Subir a Kindle (Web)</span>
                </button>

                <button
                  onClick={() => handleShareByEmail(inspectingBook)}
                  className="py-2.5 px-4 rounded-xl border border-[var(--color-line)] hover:bg-[var(--color-bg)] text-[13px] font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Compartir por correo</span>
                </button>
              </div>

              <button
                onClick={() => {
                  const b = inspectingBook
                  setInspectingBook(null)
                  onMarkAsRead(b)
                }}
                className="py-2.5 px-4 rounded-xl border border-emerald-600/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[13px] font-bold text-emerald-800 dark:text-emerald-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer w-full"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Pasar a Mis lecturas</span>
              </button>

              <div className="flex items-center justify-between text-[12px] text-[var(--color-muted)] pt-2 px-1">
                <div className="flex gap-4">
                  <button
                    onClick={() => handleEnrich(inspectingBook)}
                    disabled={enrichingId === inspectingBook.id}
                    className="hover:underline hover:text-[var(--color-ink)] cursor-pointer inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>Buscar datos online</span>
                  </button>
                  <button
                    onClick={() => {
                      handleOpenEdit(inspectingBook)
                    }}
                    className="hover:underline hover:text-[var(--color-ink)] cursor-pointer inline-flex items-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar datos</span>
                  </button>
                  <button
                    onClick={() => handleShowInFolder(inspectingBook)}
                    className="hover:underline hover:text-[var(--color-ink)] cursor-pointer inline-flex items-center gap-1"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Mostrar en Finder</span>
                  </button>
                </div>

                <button
                  onClick={() => handleDelete(inspectingBook)}
                  className="text-red-700/80 hover:text-red-700 hover:underline cursor-pointer font-medium inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar archivo</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MANUAL EDIT MODAL
      ------------------------------------------------------------- */}
      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[22px] max-w-[540px] w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-line)] mb-5">
              <h3 className="text-[20px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)]">
                Editar libro digital
              </h3>
              <button 
                onClick={() => setEditingBook(null)}
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)] p-1.5 rounded-full hover:bg-[var(--color-bg)] cursor-pointer transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div className="flex gap-4 items-center p-3 rounded-[14px] bg-[var(--color-bg)] border border-[var(--color-line)]">
                {editingBook.coverUrl ? (
                  <img src={editingBook.coverUrl} alt="Portada" className="w-14 h-20 object-cover rounded shadow-sm border border-[var(--color-line)]" />
                ) : (
                  <div className="w-14 h-20 rounded bg-[var(--color-surface)] border border-[var(--color-line)] flex items-center justify-center text-xs text-[var(--color-muted)]">
                    Sin foto
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[var(--color-ink)] mb-1">
                    Portada y datos automáticos
                  </p>
                  <button
                    type="button"
                    onClick={handleSearchForEdit}
                    className="py-1.5 px-3 rounded-full bg-[var(--color-chip)] hover:opacity-90 text-[12px] font-bold text-[var(--color-ink)] cursor-pointer flex items-center gap-1.5 transition-opacity"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Buscar portada y datos en internet</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                  Título
                </label>
                <input 
                  type="text" 
                  value={editingBook.title}
                  onChange={e => setEditingBook({ ...editingBook, title: e.target.value })}
                  required
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[12px] p-2.5 text-[14px] focus:outline-[var(--color-green)]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                  Autor
                </label>
                <input 
                  type="text" 
                  value={editingBook.author}
                  onChange={e => setEditingBook({ ...editingBook, author: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[12px] p-2.5 text-[14px] focus:outline-[var(--color-green)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                    Foto de portada
                  </label>
                  {editingBook.coverUrl && (
                    <button
                      type="button"
                      onClick={() => setEditingBook({ ...editingBook, coverUrl: '' })}
                      className="text-[11px] text-red-600 hover:underline cursor-pointer"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>

                <input
                  ref={libraryCoverInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handleLibraryCoverUpload}
                  className="hidden"
                />

                <div className="flex gap-2 items-center mb-1.5">
                  <button
                    type="button"
                    onClick={() => libraryCoverInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-[8px] bg-[var(--color-bg)] border border-[var(--color-line)] hover:border-[var(--color-accent)] text-[12px] font-medium text-[var(--color-ink)] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>Subir imagen (JPG, PNG)</span>
                  </button>
                </div>

                <input 
                  type="text" 
                  value={editingBook.coverUrl?.startsWith('data:') ? 'Imagen local cargada' : (editingBook.coverUrl || '')}
                  onChange={e => setEditingBook({ ...editingBook, coverUrl: e.target.value })}
                  placeholder="O escribe una URL (https://...)"
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[12px] p-2.5 text-[13px] focus:outline-[var(--color-green)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Páginas
                  </label>
                  <input 
                    type="text" 
                    value={editingBook.pages || ''}
                    onChange={e => setEditingBook({ ...editingBook, pages: e.target.value })}
                    placeholder="Ej. 240"
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[12px] p-2.5 text-[14px] focus:outline-[var(--color-green)]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Año
                  </label>
                  <input 
                    type="text" 
                    value={editingBook.year || ''}
                    onChange={e => setEditingBook({ ...editingBook, year: e.target.value })}
                    placeholder="Ej. 1970"
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[12px] p-2.5 text-[14px] focus:outline-[var(--color-green)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                  Sinopsis
                </label>
                <textarea 
                  value={editingBook.synopsis || ''}
                  onChange={e => setEditingBook({ ...editingBook, synopsis: e.target.value })}
                  rows={3}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-line)] rounded-[12px] p-2.5 text-[14px] focus:outline-[var(--color-green)]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--color-line)] mt-2">
                <button
                  type="button"
                  onClick={() => setEditingBook(null)}
                  className="py-2.5 px-4 rounded-full border border-[var(--color-line)] text-[13px] font-medium hover:bg-[var(--color-bg)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold text-[13px] hover:opacity-90 cursor-pointer shadow-xs"
                >
                  Aceptar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* =============================================================
         FLOATING MULTI-SELECTION BAR (When books are selected)
      ============================================================= */}
      {selectedBookIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--color-ink)] text-[var(--color-cream)] px-5 py-3 rounded-full shadow-2xl border border-white/10 flex flex-wrap items-center justify-center gap-3 text-[13px] animate-fade-in backdrop-blur-md">
          <span className="font-bold flex items-center gap-1.5 pr-2 border-r border-white/20">
            <CheckSquare className="w-4 h-4 text-[var(--color-sky)]" />
            <span>{selectedBookIds.length} {selectedBookIds.length === 1 ? 'seleccionado' : 'seleccionados'}</span>
          </span>

          {/* Select all toggle */}
          <button
            onClick={handleSelectAll}
            className="text-[12px] text-white/80 hover:text-white underline cursor-pointer pr-1"
            title="Seleccionar o deseleccionar todos los libros mostrados"
          >
            {selectedBookIds.length === filtered.length ? 'Desmarcar todos' : 'Todos'}
          </button>

          {/* Transfer button */}
          <button
            onClick={handleTransferSelectionToDevice}
            className="font-bold hover:text-[var(--color-sky)] transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-white/10"
            title={connectedDevice ? `Transferir libros seleccionados a ${connectedDevice.name}` : 'Conecta un eReader para transferir los libros seleccionados'}
          >
            <Tablet className="w-4 h-4" />
            <span>Pasar a {connectedDevice ? connectedDevice.name : 'eReader'}</span>
          </button>

          {/* Transfer to Kindle Web button */}
          <button
            onClick={handleTransferSelectionToKindleWeb}
            className="font-bold text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-white/10"
            title="Subir libros seleccionados a tu Kindle mediante Send to Kindle Web (sin cables)"
          >
            <Wifi className="w-4 h-4 text-amber-400" />
            <span>Subir a Kindle (Web)</span>
          </button>

          {/* Mark as read button */}
          <button
            onClick={handleMarkSelectionAsRead}
            className="font-bold hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-white/10"
            title="Marcar libros seleccionados como leídos y trasladar a Mis lecturas"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Marcar leídos</span>
          </button>

          {/* Export selection */}
          <button
            onClick={() => setIsExportOpen(true)}
            className="font-bold hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-white/10"
            title="Exportar libros seleccionados en HTML, CSV, JSON o archivos"
          >
            <Download className="w-4 h-4" />
            <span>Exportar</span>
          </button>

          {/* Delete selection */}
          <button
            onClick={handleDeleteSelection}
            className="font-bold text-red-300 hover:text-red-200 transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-red-500/20"
            title="Borrar todos los títulos seleccionados de la biblioteca"
          >
            <Trash2 className="w-4 h-4" />
            <span>Borrar</span>
          </button>

          {/* Clear selection */}
          <button
            onClick={() => { setSelectedBookIds([]); setIsSelectMode(false); }}
            className="text-white/60 hover:text-white transition-colors cursor-pointer text-[12px] pl-2 border-l border-white/20"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Settings / Export Modal */}
      <SettingsModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        initialTab="export"
        selectedLibraryIds={selectedBookIds}
        totalReadingsCount={readBookIds.length}
        totalLibraryCount={books.length}
        onUploadBook={handleUpload}
      />

      {/* Kindle Wireless Selection Modal */}
      <KindleUploadModal
        isOpen={isKindleModalOpen}
        onClose={() => setIsKindleModalOpen(false)}
        books={books}
        initialSelectedIds={kindleInitialBookIds}
        onConfirmUpload={handleConfirmKindleUpload}
      />

    </div>
  )
}
