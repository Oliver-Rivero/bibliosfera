import { useState, useEffect } from 'react'
import { Book, LibraryBook, RecommendedBook } from './types'
import { 
  BookOpen, 
  Library, 
  FileText, 
  Clock, 
  Plus, 
  Search, 
  Star, 
  Sun, 
  Moon, 
  Settings, 
  Lightbulb, 
  BarChart3,
  List,
  Bookmark,
  ArrowUpDown
} from 'lucide-react'
import AddBookModal from './components/AddBookModal'
import BookDetailModal from './components/BookDetailModal'
import LibraryView from './components/LibraryView'
import SettingsModal from './components/SettingsModal'
import ReadingStatsModal, { PeriodMode } from './components/ReadingStatsModal'
import RecommendationsModal from './components/RecommendationsModal'
import WelcomeTourModal from './components/WelcomeTourModal'
import logoLight from './assets/logo-light.png'
import logoDark from './assets/logo-dark.png'
import { SpinePalette, SPINE_PALETTES, extractCoverPalette } from './utils/palette'

const initialData: Book[] = [];

export default function App() {
  const [activeTab, setActiveTab] = useState<'readings' | 'library'>('readings')
  const [books, setBooks] = useState<Book[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | '5' | '4'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [readingsViewMode, setReadingsViewMode] = useState<'list' | 'shelf' | 'spines'>('list')
  const [readingsSortBy, setReadingsSortBy] = useState<'date-desc' | 'date-asc' | 'author-asc' | 'title-asc'>('date-desc')
  const [coverPalettes, setCoverPalettes] = useState<Record<string, SpinePalette>>({})
  const [editingBook, setEditingBook] = useState<Book | undefined>(undefined)
  const [detailBook, setDetailBook] = useState<Book | undefined>(undefined)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false)
  const [showWelcomeTour, setShowWelcomeTour] = useState(() => {
    return !localStorage.getItem('bibliosfera_welcome_tour_seen')
  })
  const [libraryCount, setLibraryCount] = useState(0)
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0)

  // Light / Dark mode state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('bibliosfera_theme') || localStorage.getItem('bibliograma_theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
    }
    localStorage.setItem('bibliosfera_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Period filter state for reading stats modal
  const [periodMode, setPeriodMode] = useState<PeriodMode>('total')
  const [selectedYear, setSelectedYear] = useState<string>('2026')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [filterListByPeriod, setFilterListByPeriod] = useState<boolean>(false)

  const refreshLibraryCount = async () => {
    try {
      const libBooks = await window.api.getLibraryBooks()
      if (libBooks) setLibraryCount(libBooks.length)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const rawTheme = localStorage.getItem('bibliosfera_app_theme') || 'clasico'
    const savedAppTheme = rawTheme === 'elegante' ? 'clasico' : rawTheme === 'exlibris' ? 'pergamino' : rawTheme
    document.documentElement.setAttribute('data-theme', savedAppTheme)
    localStorage.setItem('bibliosfera_app_theme', savedAppTheme)

    if (typeof window.api?.getLibraryStorageDir === 'function') {
      window.api.getLibraryStorageDir().then(info => {
        if (info?.themeName) {
          const norm = info.themeName === 'elegante' ? 'clasico' : info.themeName === 'exlibris' ? 'pergamino' : info.themeName
          document.documentElement.setAttribute('data-theme', norm)
          localStorage.setItem('bibliosfera_app_theme', norm)
        }
      }).catch(() => {})
    }

    window.api.getBooks().then(data => {
      if (data && data.length > 0) {
        setBooks(data)
      } else {
        setBooks(initialData)
      }
    })
    refreshLibraryCount()
  }, [])

  useEffect(() => {
    if (readingsViewMode !== 'spines') return
    let isMounted = true
    books.forEach((book, idx) => {
      const key = book.id || book.coverUrl
      if (key && book.coverUrl && !coverPalettes[key]) {
        extractCoverPalette(book.coverUrl, idx).then((pal) => {
          if (isMounted) {
            setCoverPalettes(prev => ({ ...prev, [key]: pal }))
          }
        })
      }
    })
    return () => { isMounted = false }
  }, [books, readingsViewMode])

  // Books filtered by the selected period (when period filter is used in stats modal)
  const periodBooks = books.filter(b => {
    if (periodMode === 'total') return true
    if (!b.dateRead) return false
    const d = b.dateRead.substring(0, 10)
    if (periodMode === 'year') {
      return d.startsWith(selectedYear)
    }
    if (periodMode === 'month') {
      return d.startsWith(selectedMonth)
    }
    if (periodMode === 'custom') {
      if (customStart && d < customStart) return false
      if (customEnd && d > customEnd) return false
      return true
    }
    return true
  })

  // List filtering (combines search, rating chips, and optional period filter)
  const filteredBooks = books.filter(b => {
    if (filterListByPeriod && periodMode !== 'total' && !periodBooks.some(pb => pb.id === b.id)) {
      return false
    }

    const titleMatch = b.title.toLowerCase().includes(searchQuery.toLowerCase())
    const authorMatch = b.author?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSearch = titleMatch || authorMatch
    const matchesFilter = filterMode === 'all' ? true : 
                          filterMode === '5' ? (b.rating || 0) === 5 : 
                          filterMode === '4' ? (b.rating || 0) >= 4 : true
    return matchesSearch && matchesFilter
  })

  // Sort filtered books according to readingsSortBy
  const sortedFilteredBooks = [...filteredBooks].sort((a, b) => {
    if (readingsSortBy === 'date-desc') {
      return (b.dateRead || '').localeCompare(a.dateRead || '')
    }
    if (readingsSortBy === 'date-asc') {
      return (a.dateRead || '').localeCompare(b.dateRead || '')
    }
    if (readingsSortBy === 'title-asc') {
      return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' })
    }
    if (readingsSortBy === 'author-asc') {
      const aAuth = (a.author && a.author !== 'Autor desconocido') ? a.author : 'ZZZ'
      const bAuth = (b.author && b.author !== 'Autor desconocido') ? b.author : 'ZZZ'
      return aAuth.localeCompare(bAuth, 'es', { sensitivity: 'base' })
    }
    return 0
  })

  // Chunk helpers for shelf (6 books per line) and spines (16 per line)
  const chunkReadingsIntoShelves = (arr: Book[], size: number) => {
    const shelves: Book[][] = []
    for (let i = 0; i < arr.length; i += size) {
      shelves.push(arr.slice(i, i + size))
    }
    return shelves
  }

  const readingsShelfRows = chunkReadingsIntoShelves(sortedFilteredBooks, 6)
  const readingsSpineRows = chunkReadingsIntoShelves(sortedFilteredBooks, 16)

  // --- Overall Statistics for Compact Top Cards ---
  const totalReadCount = books.length

  // Average Rating (Valoración media)
  let avgRating = '–'
  const ratedBooks = books.filter(b => (b.rating || 0) > 0)
  if (ratedBooks.length > 0) {
    const totalRating = ratedBooks.reduce((acc, b) => acc + (b.rating || 0), 0)
    avgRating = (totalRating / ratedBooks.length).toFixed(1)
  }

  // Satisfaction rate (4-5 stars)
  const highRatedBooks = books.filter(b => (b.rating || 0) >= 4)
  const highRatedCount = highRatedBooks.length
  const highRatedPct = totalReadCount > 0 ? Math.round((highRatedCount / totalReadCount) * 100) : 0

  // Most recent book read (Última lectura)
  const sortedBooksByDate = [...books].sort((a, b) => new Date(b.dateRead || 0).getTime() - new Date(a.dateRead || 0).getTime())
  const lastBook = sortedBooksByDate[0]

  const handleLibraryMarkAsRead = (libraryBook: LibraryBook) => {
    const author = (libraryBook.author && libraryBook.author !== 'Autor desconocido') ? libraryBook.author : ''
    setEditingBook({
      id: Date.now().toString(),
      title: libraryBook.title || '',
      author,
      coverUrl: libraryBook.coverUrl || '',
      pages: libraryBook.pages || '',
      year: libraryBook.year || '',
      genre: libraryBook.genre || '',
      synopsis: libraryBook.synopsis || '',
      libraryBookId: libraryBook.id,
      rating: 4,
      dateRead: new Date().toISOString().substring(0, 10),
      comment: ''
    })
    setShowModal(true)
  }

  const handleAddRecommendedBook = (rec: RecommendedBook) => {
    setEditingBook({
      id: Date.now().toString(),
      title: rec.title,
      author: rec.author,
      coverUrl: rec.coverUrl || '',
      pages: rec.pages || '',
      year: rec.year || '',
      genre: rec.genre || '',
      synopsis: rec.synopsis || '',
      rating: 5,
      dateRead: new Date().toISOString().substring(0, 10),
      comment: ''
    })
    setShowModal(true)
  }

  const LogoSVG = () => (
    <img
      src={theme === 'dark' ? logoDark : logoLight}
      alt="Bibliosfera"
      className={`h-10 sm:h-11 w-auto object-contain select-none transition-all duration-200 ${
        theme === 'dark'
          ? 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]'
          : 'drop-shadow-[0_1px_3px_rgba(36,47,54,0.1)]'
      }`}
      draggable={false}
    />
  )

  const formatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

  const formatMonthLabel = (isoMonth: string) => {
    try {
      const [year, month] = isoMonth.split('-')
      const d = new Date(parseInt(year), parseInt(month) - 1, 1)
      return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    } catch {
      return isoMonth
    }
  }

  return (
    <div className="max-w-[1240px] mx-auto p-5 sm:p-7 flex flex-col gap-6 min-h-screen">
      
      {/* Header with Navigation Tabs */}
      <header className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-5 sm:gap-8">
          <div className="flex items-center">
            <LogoSVG />
            <h1 className="sr-only">Bibliosfera</h1>
          </div>

          {/* Module Switcher */}
          <nav className="flex items-center gap-1.5 p-1 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-full shadow-xs">
            <button
              onClick={() => setActiveTab('readings')}
              className={`py-1.5 px-4 rounded-full text-[13px] font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'readings' ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-xs' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
            >
              <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Mis lecturas</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${activeTab === 'readings' ? 'bg-white/20' : 'bg-[var(--color-bg)]'}`}>
                {books.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`py-1.5 px-4 rounded-full text-[13px] font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'library' ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-xs' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
            >
              <Library className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Biblioteca digital</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${activeTab === 'library' ? 'bg-white/20' : 'bg-[var(--color-bg)]'}`}>
                {libraryCount}
              </span>
            </button>
          </nav>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="py-[9px] px-3.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-bg)] font-medium text-[12.5px] flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 stroke-[2.2] text-amber-300" />
                <span className="hidden sm:inline">Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 stroke-[2.2] text-[var(--color-teal)]" />
                <span className="hidden sm:inline">Oscuro</span>
              </>
            )}
          </button>

          {/* Recommendations Button (next to Claro/Oscuro in Mis lecturas) */}
          {activeTab === 'readings' && (
            <button
              onClick={() => setShowRecommendationsModal(true)}
              className="py-[9px] px-3.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-bg)] font-medium text-[12.5px] flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              title="Buscar en internet recomendaciones basadas en tus lecturas de 4 y 5 estrellas"
            >
              <Lightbulb className="w-3.5 h-3.5 stroke-[2.2] text-[var(--color-accent)]" />
              <span>Recomendaciones</span>
            </button>
          )}

          {activeTab === 'readings' && (
            <button 
              onClick={() => { setEditingBook(undefined); setShowModal(true); }}
              className="bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold py-[9px] px-5 rounded-full flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shadow-xs text-[13px]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Añadir lectura</span>
            </button>
          )}

          {/* Settings Button (A la derecha, sólo icono) */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="w-[38px] h-[38px] rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer shadow-xs flex items-center justify-center shrink-0"
            title="Ajustes"
            aria-label="Ajustes"
          >
            <Settings className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </header>

      {/* Readings Module */}
      {activeTab === 'readings' && (
        <>
          {/* Compact 3-Card Summary Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Card 1: Libros leídos (Clickable -> Opens Stats & Habit Modal) */}
            <div
              onClick={() => setShowStatsModal(true)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowStatsModal(true) }}
              className="bg-[var(--color-teal)] text-[var(--color-cream)] rounded-[16px] p-3.5 sm:p-4 flex flex-col justify-between border border-white/15 shadow-xs hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer group"
              title="Haz clic para abrir filtros por fecha, estadísticas y gráfica de hábito de lectura"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[var(--color-sky)] uppercase tracking-wider">
                  Libros leídos
                </span>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold bg-white/15 group-hover:bg-white/25 text-[var(--color-cream)] px-2 py-0.5 rounded-full transition-colors">
                  <BarChart3 className="w-3 h-3" />
                  <span>Hábitos ↗</span>
                </span>
              </div>

              <div className="font-bold text-[26px] sm:text-[30px] leading-[1.1] tracking-[-0.03em] font-['Bricolage_Grotesque'] my-1.5">
                {totalReadCount} {totalReadCount === 1 ? 'libro' : 'libros'}
              </div>

              <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11.5px] text-[var(--color-sky)] truncate">
                <span className="truncate">
                  {periodMode !== 'total'
                    ? `Periodo: ${periodMode === 'year' ? selectedYear : periodMode === 'month' ? formatMonthLabel(selectedMonth) : 'Personalizado'} (${periodBooks.length})`
                    : 'Ver estadísticas por fecha'}
                </span>
              </div>
            </div>

            {/* Card 2: Valoración media */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[16px] p-3.5 sm:p-4 flex flex-col justify-between shadow-xs">
              <div className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                Valoración media
              </div>
              <div className="font-bold text-[26px] sm:text-[30px] leading-[1.1] tracking-[-0.03em] font-['Bricolage_Grotesque'] flex items-baseline gap-1.5 my-1.5">
                <span>{avgRating}</span>
                {avgRating !== '–' && <Star className="w-4 h-4 fill-current text-[var(--color-star)] self-center" />}
              </div>
              <div className="pt-2 border-t border-[var(--color-line)] text-[11.5px] text-[var(--color-muted)] truncate">
                {totalReadCount > 0 ? (
                  <span>{highRatedPct}% con 4 o 5 estrellas</span>
                ) : (
                  <span>Sin valoraciones</span>
                )}
              </div>
            </div>

            {/* Card 3: Última lectura */}
            <div
              onClick={() => { if (lastBook) setDetailBook(lastBook) }}
              className={`bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[16px] p-3.5 sm:p-4 flex flex-col justify-between shadow-xs ${lastBook ? 'cursor-pointer hover:border-[var(--color-accent)] transition-colors' : ''}`}
            >
              <div className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                Última lectura
              </div>

              {lastBook ? (
                <div className="my-1">
                  <div className="text-[15.5px] sm:text-[16.5px] font-bold leading-[1.2] font-['Bricolage_Grotesque'] line-clamp-1 text-[var(--color-ink)]">
                    {lastBook.title}
                  </div>
                  <div className="text-[11.5px] text-[var(--color-muted)] truncate mt-0.5">
                    {lastBook.author}
                  </div>
                </div>
              ) : (
                <div className="text-[22px] font-bold text-[var(--color-muted)] font-['Bricolage_Grotesque'] my-1.5">
                  –
                </div>
              )}

              <div className="pt-2 border-t border-[var(--color-line)] text-[11.5px] text-[var(--color-muted)] truncate">
                {lastBook?.dateRead ? (
                  <span>Terminado el {formatter.format(new Date(lastBook.dateRead))}</span>
                ) : (
                  <span>Registra lecturas para ver datos</span>
                )}
              </div>
            </div>

          </section>

      {/* Tools & Filter Options */}
      <section className="flex flex-col gap-2.5">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-line)] rounded-full pl-10.5 pr-5 py-2.5 placeholder:text-[var(--color-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-green)] text-[14px]" 
              placeholder="Buscar por título o autor..."
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button 
              aria-pressed={filterMode === 'all'} 
              onClick={() => setFilterMode('all')}
              className={`px-4 py-2 rounded-full border border-[var(--color-line)] text-[14px] cursor-pointer transition-all ${filterMode === 'all' ? 'bg-[var(--color-chip)] border-[var(--color-chip)] font-bold' : ''}`}
            >Todos</button>
            <button 
              aria-pressed={filterMode === '5'} 
              onClick={() => setFilterMode('5')}
              className={`px-4 py-2 rounded-full border border-[var(--color-line)] text-[14px] cursor-pointer transition-all ${filterMode === '5' ? 'bg-[var(--color-chip)] border-[var(--color-chip)] font-bold' : ''}`}
            >5 estrellas</button>
            <button 
              aria-pressed={filterMode === '4'} 
              onClick={() => setFilterMode('4')}
              className={`px-4 py-2 rounded-full border border-[var(--color-line)] text-[14px] cursor-pointer transition-all ${filterMode === '4' ? 'bg-[var(--color-chip)] border-[var(--color-chip)] font-bold' : ''}`}
            >4 o más</button>
          </div>
        </div>

        {/* Sorting and View Mode Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-[var(--color-line)]/50 mt-1">
          {/* Sort Selector: Fecha de lectura (recientes/antiguas), Autor, Título */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Ordenar:</span>
            </span>
            <select
              value={readingsSortBy}
              onChange={e => setReadingsSortBy(e.target.value as any)}
              className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--color-ink)] cursor-pointer focus:outline-[var(--color-green)] shadow-xs"
            >
              <option value="date-desc">Fecha de lectura (más recientes)</option>
              <option value="date-asc">Fecha de lectura (más antiguas)</option>
              <option value="author-asc">Autor (A-Z)</option>
              <option value="title-asc">Título (A-Z)</option>
            </select>
          </div>

          {/* View Mode Toggle: Lista (predeterminada) | Estantería | Lomos */}
          <div className="flex gap-1 p-0.5 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-full shadow-xs">
            <button
              onClick={() => setReadingsViewMode('list')}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                readingsViewMode === 'list'
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold shadow-xs'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
              title="Vista en lista detallada con reseñas y notas (Predeterminada)"
            >
              <List className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Lista</span>
            </button>
            <button
              onClick={() => setReadingsViewMode('shelf')}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                readingsViewMode === 'shelf'
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold shadow-xs'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
              title="Vista de estantería suspendida con portadas"
            >
              <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Estantería</span>
            </button>
            <button
              onClick={() => setReadingsViewMode('spines')}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                readingsViewMode === 'spines'
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold shadow-xs'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
              title="Vista de lomos de libros en la estantería"
            >
              <Bookmark className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Lomos</span>
            </button>
          </div>
        </div>

        {/* Optional sync toggle: Filter list by the selected period */}
        {periodMode !== 'total' && filterListByPeriod && (
          <div className="flex items-center gap-2 self-start text-[12px] text-[var(--color-muted)] pl-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={filterListByPeriod}
                onChange={e => setFilterListByPeriod(e.target.checked)}
                className="accent-[var(--color-accent)] rounded cursor-pointer"
              />
              <span>Lista filtrada por el periodo seleccionado ({periodBooks.length} {periodBooks.length === 1 ? 'libro' : 'libros'})</span>
            </label>
          </div>
        )}
      </section>

      {/* Book Readings Presentation: List (default), Shelf, or Spines */}
      <section>
        {sortedFilteredBooks.length === 0 ? (
          <div
            onClick={() => {
              if (books.length === 0) {
                setEditingBook(undefined)
                setShowModal(true)
              }
            }}
            role={books.length === 0 ? 'button' : undefined}
            tabIndex={books.length === 0 ? 0 : undefined}
            onKeyDown={e => {
              if (books.length === 0 && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                setEditingBook(undefined)
                setShowModal(true)
              }
            }}
            className={`border-2 border-dashed border-[var(--color-line)] rounded-[18px] p-[40px_20px] text-center text-[var(--color-muted)] flex flex-col items-center gap-2 transition-all ${
              books.length === 0
                ? 'cursor-pointer hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)]/65 group'
                : ''
            }`}
          >
            {books.length === 0 && (
              <div className="w-11 h-11 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] group-hover:border-[var(--color-accent)] group-hover:bg-[var(--color-accent)] group-hover:text-[var(--color-on-accent)] flex items-center justify-center text-[var(--color-muted)] transition-colors mb-1">
                <Plus className="w-5 h-5 stroke-[2.2]" />
              </div>
            )}
            <p className="font-medium text-[var(--color-ink)]">
              No hay lecturas registradas {searchQuery || filterListByPeriod ? 'con estos filtros' : 'todavía'}.
            </p>
            <p className="text-[14px]">
              {books.length === 0
                ? 'Haz clic en este recuadro o en "+ Añadir lectura" arriba a la derecha para empezar a registrar en Mis lecturas.'
                : 'Prueba a cambiar el texto de búsqueda o el filtro de periodo.'}
            </p>
          </div>
        ) : readingsViewMode === 'shelf' ? (
          /* -------------------------------------------------------------
             SHELF VIEW FOR MIS LECTURAS (6 libros por estantería)
          ------------------------------------------------------------- */
          <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[24px] p-6 sm:p-10 shadow-xs flex flex-col gap-12 my-2 overflow-x-auto">
            {readingsShelfRows.map((row, shelfIdx) => (
              <div key={shelfIdx} className="relative flex flex-col min-w-[960px]">
                {readingsShelfRows.length > 1 && (
                  <div className="flex items-center gap-2 mb-6 select-none">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-muted)] font-mono">
                      0{shelfIdx + 1}
                    </span>
                    <div className="h-px flex-1 bg-[var(--color-line)]/60"></div>
                  </div>
                )}

                {/* 6 books per shelf line standing flush on rail, justified edge-to-edge */}
                <div className="flex items-end justify-between w-full px-4 sm:px-6 relative z-10 flex-nowrap">
                  {row.map((book, bIdx) => {
                    const coverColorIdx = (shelfIdx * 6 + bIdx) % 4
                    const coverBg = coverColorIdx === 0 ? 'var(--color-brown)' : coverColorIdx === 1 ? 'var(--color-teal)' : coverColorIdx === 2 ? 'var(--color-green)' : 'var(--color-sky)'
                    const coverFg = coverColorIdx === 3 ? 'var(--color-teal)' : 'var(--color-cream)'
                    const coverLetters = (book.title || 'LI').substring(0, 2).toUpperCase()
                    const rating = book.rating || 0

                    return (
                      <div
                        key={book.id || bIdx}
                        onClick={() => setDetailBook(book)}
                        className="group relative flex flex-col items-center cursor-pointer select-none transition-all duration-300 ease-out hover:-translate-y-3 shrink-0"
                        style={{ width: '138px', flexShrink: 0 }}
                      >
                        {/* Rating Badge */}
                        {rating > 0 && (
                          <div className="absolute -top-3 right-1.5 z-30">
                            <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-[var(--color-star)] text-[var(--color-on-accent)] shadow-xs inline-flex items-center gap-0.5">
                              ★ {rating.toFixed(1)}
                            </span>
                          </div>
                        )}

                        {/* Cover Volume */}
                        <div 
                          className="relative rounded-[4px] overflow-hidden shadow-[0_8px_18px_rgba(0,0,0,0.12)] group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.18)] transition-all bg-stone-100 dark:bg-stone-800 border border-black/10 dark:border-white/10 flex items-center justify-center"
                          style={{ width: '138px', height: '198px' }}
                        >
                          {book.coverUrl ? (
                            <img
                              src={book.coverUrl}
                              alt={book.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
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
                                {book.author || 'Lectura'}
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
                  {/* Empty slots up to 6 so justify-between distributes all 6 positions edge-to-edge */}
                  {Array.from({ length: 6 - row.length }).map((_, i) => (
                    <div key={`empty-readings-slot-${i}`} style={{ width: '138px', flexShrink: 0 }} />
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
                      onClick={() => setDetailBook(book)}
                      className="cursor-pointer group/label text-center px-0.5 shrink-0"
                      style={{ width: '138px', flexShrink: 0 }}
                    >
                      <p className="text-[12.5px] font-semibold text-[var(--color-ink)] line-clamp-1 leading-snug group-hover/label:text-[var(--color-accent)] transition-colors">
                        {book.title}
                      </p>
                      <p className="text-[11px] text-[var(--color-muted)] truncate mt-0.5">
                        {book.author}
                      </p>
                    </div>
                  ))}
                  {Array.from({ length: 6 - row.length }).map((_, i) => (
                    <div key={`empty-readings-lbl-${i}`} style={{ width: '138px', flexShrink: 0 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : readingsViewMode === 'spines' ? (
          /* -------------------------------------------------------------
             SPINES VIEW FOR MIS LECTURAS (Lomos respetando colores de portada)
          ------------------------------------------------------------- */
          <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[24px] p-6 sm:p-10 shadow-xs flex flex-col gap-14 my-2 overflow-x-auto">
            {readingsSpineRows.map((row, shelfIdx) => (
              <div key={shelfIdx} className="relative flex flex-col min-w-[760px]">
                {readingsSpineRows.length > 1 && (
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
                {/* Spines row */}
                <div className="flex items-end justify-start gap-1.5 sm:gap-2 px-6 sm:px-8 relative z-10 pt-4 pb-0">
                  {row.map((book, bIdx) => {
                    const pages = typeof book.pages === 'number' ? book.pages : (parseInt(String(book.pages || '260'), 10) || 260)
                    const spineWidth = Math.max(34, Math.min(60, Math.round(30 + (pages / 600) * 26)))
                    const spineHeight = Math.max(195, Math.min(240, 210 + ((book.title.length * 3) % 25)))
                    
                    const paletteKey = book.id || book.coverUrl || ''
                    const palette: SpinePalette = (paletteKey && coverPalettes[paletteKey]) || SPINE_PALETTES[(shelfIdx * 7 + bIdx) % SPINE_PALETTES.length]
                    const rating = book.rating || 0

                    return (
                      <div
                        key={book.id || bIdx}
                        onClick={() => setDetailBook(book)}
                        className="group relative flex flex-col items-center cursor-pointer select-none transition-all duration-200 ease-out hover:-translate-y-4 hover:z-30 shrink-0"
                      >
                        {/* Physical Spine with colors from the actual book cover */}
                        <div
                          className="relative rounded-t-[4px] rounded-b-[2px] flex flex-col justify-between overflow-hidden shadow-md group-hover:shadow-2xl transition-all border"
                          style={{
                            width: `${spineWidth}px`,
                            height: `${spineHeight}px`,
                            backgroundColor: palette.bg,
                            color: palette.text,
                            borderColor: palette.isLight ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.35)',
                            boxShadow: 'inset 3px 0 4px rgba(0,0,0,0.22), inset -2px 0 3px rgba(255,255,255,0.12), 2px 4px 10px rgba(0,0,0,0.18)'
                          }}
                        >
                          {/* Top cabezada */}
                          <div className="w-full flex flex-col items-center pt-1.5 px-0.5 pointer-events-none">
                            <div className="w-full h-[3px] rounded-t-xs bg-black/25"></div>
                          </div>

                          {/* Spine Title (Vertical) */}
                          <div className="flex-1 flex items-center justify-center py-2 px-0.5 overflow-hidden">
                            <span
                              className="font-bold text-[12px] tracking-wide truncate font-['Bricolage_Grotesque'] select-none max-h-[145px]"
                              style={{
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                transform: 'rotate(180deg)'
                              }}
                            >
                              {book.title}
                            </span>
                          </div>

                          {/* Bottom metadata */}
                          <div className="w-full pb-2 px-0.5 flex flex-col items-center gap-0.5">
                            {rating > 0 && (
                              <span className="text-[9.5px] font-bold" style={{ color: palette.text, opacity: 0.9 }}>
                                ★ {rating.toFixed(1)}
                              </span>
                            )}
                            <div className="w-3/4 h-[2px] bg-black/20 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Shelf rail */}
                <div className="relative h-3 w-full -mt-0.5 rounded-sm bg-[var(--color-bg)] shadow-[0_6px_12px_rgba(0,0,0,0.06)] border border-[var(--color-line)]/80">
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--color-line)]/50"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* -------------------------------------------------------------
             DEFAULT LIST VIEW (Vista en lista con reseñas, sinopsis y valoraciones)
          ------------------------------------------------------------- */
          <ul className="flex flex-col gap-3">
            {sortedFilteredBooks.map((book, idx) => {
              const coverIdx = idx % 4
              const coverBg = coverIdx === 0 ? 'var(--color-brown)' : coverIdx === 1 ? 'var(--color-teal)' : coverIdx === 2 ? 'var(--color-green)' : 'var(--color-sky)'
              const coverFg = coverIdx === 3 ? 'var(--color-teal)' : 'var(--color-cream)'
              const coverLetters = book.title.substring(0, 2)
              const dateStr = book.dateRead ? formatter.format(new Date(book.dateRead)) : ''

              const bookRating = book.rating || 0

              return (
                <li 
                  key={book.id || idx} 
                  onClick={() => setDetailBook(book)}
                  className="grid grid-cols-[56px_1fr] sm:grid-cols-[68px_1fr_auto] gap-3.5 sm:gap-5 bg-[var(--color-surface)] border border-[var(--color-line)] hover:border-[var(--color-accent)] rounded-[18px] p-3.5 sm:p-4 items-start shadow-xs hover:shadow-md transition-all cursor-pointer group"
                >
                  
                  {/* Real cover image or fallback letter spine */}
                  {book.coverUrl ? (
                    <img 
                      src={book.coverUrl} 
                      alt={book.title}
                      className="w-[56px] h-[82px] sm:w-[68px] sm:h-[98px] object-cover rounded-[4px_8px_8px_4px] shadow-sm border border-[var(--color-line)] bg-white group-hover:scale-[1.02] transition-transform"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const parent = (e.target as HTMLElement).parentElement;
                        if (parent) {
                          const fallback = document.createElement('div');
                          fallback.className = "w-[56px] h-[82px] sm:w-[68px] sm:h-[98px] rounded-[4px_8px_8px_4px] flex items-center justify-center font-bold text-[18px] sm:text-[22px] font-['Bricolage_Grotesque']";
                          fallback.style.backgroundColor = coverBg;
                          fallback.style.color = coverFg;
                          fallback.style.boxShadow = 'inset 6px 0 0 rgba(0,0,0,0.18)';
                          fallback.textContent = coverLetters;
                          parent.prepend(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div 
                      className="w-[56px] h-[82px] sm:w-[68px] sm:h-[98px] rounded-[4px_8px_8px_4px] flex items-center justify-center font-bold text-[18px] sm:text-[22px] font-['Bricolage_Grotesque'] group-hover:scale-[1.02] transition-transform"
                      style={{ backgroundColor: coverBg, color: coverFg, boxShadow: 'inset 6px 0 0 rgba(0,0,0,0.18)' }}
                    >
                      {coverLetters}
                    </div>
                  )}
                  
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[18px] font-bold leading-[1.2] mb-0.5 font-['Bricolage_Grotesque'] group-hover:text-[var(--color-accent)] transition-colors">
                        {book.title}
                      </h3>
                      <span className="text-[11px] text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                        ↗ Ver detalle
                      </span>
                    </div>
                    
                    {/* Author & metadata */}
                    <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-[var(--color-muted)] mb-1">
                      <span className="font-medium text-[var(--color-ink)]">{book.author}</span>
                      {book.year && <span>• {book.year}</span>}
                      {book.genre && <span>• {book.genre}</span>}
                      {book.pages && (
                        <span className="inline-flex items-center gap-1">
                          • <FileText className="w-3 h-3 text-[var(--color-muted)]" /> {book.pages} págs.
                        </span>
                      )}
                      {book.readingTime && (
                        <span className="inline-flex items-center gap-1">
                          • <Clock className="w-3 h-3 text-[var(--color-muted)]" /> {book.readingTime}
                        </span>
                      )}
                    </div>

                    {/* Personal Comment */}
                    {book.comment && (
                      <div className="mt-2 text-[14px] p-2 sm:p-2.5 rounded-[10px] bg-[var(--color-bg)] border border-[var(--color-line)] max-w-[56ch]">
                        <span className="font-medium text-[12px] text-[var(--color-muted)] block mb-0.5">Opinión:</span>
                        "{book.comment}"
                      </div>
                    )}
                  </div>
                  
                  {/* Rating, Date and Actions */}
                  <div className="col-start-2 sm:col-start-auto flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 sm:gap-1.5 mt-2 sm:mt-0">
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-[2px]">
                        {[1, 2, 3, 4, 5].map((starIdx) => {
                          const isFull = bookRating >= starIdx
                          const isHalf = !isFull && bookRating >= starIdx - 0.5
                          return (
                            <div key={starIdx} className="relative w-4 h-4">
                              <svg className="absolute inset-0 w-4 h-4 fill-[var(--color-star)] opacity-25" viewBox="0 0 24 24">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                              </svg>
                              {(isFull || isHalf) && (
                                <div className="absolute inset-0 overflow-hidden" style={{ width: isFull ? '100%' : '50%' }}>
                                  <svg className="w-4 h-4 fill-[var(--color-star)]" viewBox="0 0 24 24">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                  </svg>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <span className="text-[12px] font-bold text-[var(--color-muted)]">
                        {bookRating.toFixed(1)}
                      </span>
                    </div>
                    
                    {dateStr && <span className="text-[13px] text-[var(--color-muted)]">Terminado el {dateStr}</span>}
                    
                    <div className="flex gap-3 mt-1 sm:mt-3" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => { setEditingBook(book); setShowModal(true); }}
                        className="text-[13px] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors font-medium cursor-pointer"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm(`¿Eliminar "${book.title}" de tus lecturas?`)) {
                            const updated = await window.api.deleteBook(book.id)
                            setBooks(updated)
                          }
                        }}
                        className="text-[13px] text-red-700/80 hover:text-red-700 transition-colors font-medium cursor-pointer"
                        title="Eliminar lectura"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )}

      {/* Digital Library Module */}
      {activeTab === 'library' && (
        <LibraryView 
          key={libraryRefreshKey}
          onMarkAsRead={handleLibraryMarkAsRead}
          readBookIds={books.map(b => b.libraryBookId).filter(Boolean) as string[]}
          onBooksCountChange={setLibraryCount}
        />
      )}

      {/* Floating Book Detail Modal */}
      {detailBook && (
        <BookDetailModal
          book={detailBook}
          onClose={() => setDetailBook(undefined)}
          onEdit={(b) => {
            setDetailBook(undefined)
            setEditingBook(b)
            setShowModal(true)
          }}
          onDelete={async (id) => {
            const updated = await window.api.deleteBook(id)
            setBooks(updated)
            setDetailBook(undefined)
          }}
        />
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <AddBookModal 
          bookToEdit={editingBook}
          onClose={() => { setShowModal(false); setEditingBook(undefined); }}
          onAdd={async (book) => {
            try {
              const isExistingReading = Boolean(editingBook && books.some(b => b.id === editingBook.id))
              if (isExistingReading) {
                const updated = await window.api.updateBook(book)
                setBooks(updated || [])
              } else {
                const updated = await window.api.addBook(book)
                setBooks(updated || [])
                if (book.libraryBookId) {
                  await window.api.updateLibraryBook(book.libraryBookId, { status: 'read' })
                  setLibraryRefreshKey(prev => prev + 1)
                  refreshLibraryCount()
                }
                setActiveTab('readings')
              }
            } catch (err) {
              console.error('Error guardando libro en Mis lecturas:', err)
            } finally {
              setShowModal(false)
              setEditingBook(undefined)
            }
          }} 
        />
      )}

      {/* Settings Modal (Export / Import / Temas / eReader) */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false)
          refreshLibraryCount()
        }}
        totalReadingsCount={books.length}
        totalLibraryCount={libraryCount}
        onReadingsUpdated={async () => {
          const data = await window.api.getBooks()
          setBooks(data || [])
        }}
        onLibraryUpdated={() => {
          refreshLibraryCount()
          setLibraryRefreshKey(prev => prev + 1)
        }}
        activeColorMode={theme}
        onToggleColorMode={toggleTheme}
        onOpenTour={() => {
          setShowSettingsModal(false)
          setShowWelcomeTour(true)
        }}
      />

      {/* Reading Stats & Habit Modal */}
      {showStatsModal && (
        <ReadingStatsModal
          books={books}
          periodMode={periodMode}
          setPeriodMode={setPeriodMode}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
          filterListByPeriod={filterListByPeriod}
          setFilterListByPeriod={setFilterListByPeriod}
          onClose={() => setShowStatsModal(false)}
          onSelectBook={b => setDetailBook(b)}
        />
      )}

      {/* Recommendations Modal (based on 4-5 star readings) */}
      {showRecommendationsModal && (
        <RecommendationsModal
          favoriteBooks={highRatedBooks}
          onClose={() => setShowRecommendationsModal(false)}
          onAddRecommendedToReadings={handleAddRecommendedBook}
        />
      )}

      {/* Welcome & Onboarding Tour Modal */}
      <WelcomeTourModal
        isOpen={showWelcomeTour}
        onClose={() => setShowWelcomeTour(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />
    </div>
  )
}
