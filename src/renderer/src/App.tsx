import { useState, useEffect } from 'react'
import { Book, LibraryBook } from './types'
import { BookOpen, Library, FileText, Clock, Plus, Search, Star, Sun, Moon, Settings } from 'lucide-react'
import AddBookModal from './components/AddBookModal'
import BookDetailModal from './components/BookDetailModal'
import LibraryView from './components/LibraryView'
import SettingsModal from './components/SettingsModal'

const initialData: Book[] = [];

type PeriodMode = 'total' | 'year' | 'month' | 'custom'

export default function App() {
  const [activeTab, setActiveTab] = useState<'readings' | 'library'>('readings')
  const [books, setBooks] = useState<Book[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | '5' | '4'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingBook, setEditingBook] = useState<Book | undefined>(undefined)
  const [detailBook, setDetailBook] = useState<Book | undefined>(undefined)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [libraryCount, setLibraryCount] = useState(0)

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

  // Period filter state for reading stats
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
    window.api.getBooks().then(data => {
      if (data && data.length > 0) {
        setBooks(data)
      } else {
        setBooks(initialData)
      }
    })
    refreshLibraryCount()
  }, [])

  // Available years from books + current
  const availableYears = Array.from(
    new Set([
      '2026',
      '2025',
      '2024',
      ...books.map(b => b.dateRead ? b.dateRead.substring(0, 4) : '').filter(Boolean)
    ])
  ).sort().reverse()

  // Books filtered by the selected period (for stats)
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
    // If filter list by period is active
    if (filterListByPeriod && !periodBooks.some(pb => pb.id === b.id)) {
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

  // --- Statistics Calculation for Selected Period ---
  const periodCount = periodBooks.length

  // Average Rating
  let avgRating = '–'
  const ratedBooks = periodBooks.filter(b => (b.rating || 0) > 0)
  if (ratedBooks.length > 0) {
    const totalRating = ratedBooks.reduce((acc, b) => acc + (b.rating || 0), 0)
    avgRating = (totalRating / ratedBooks.length).toFixed(1)
  }

  // Reading Pace
  let paceText = ''
  if (periodCount > 0) {
    if (periodMode === 'month') {
      const daysPerBook = Math.max(1, Math.round(30 / periodCount))
      paceText = `~1 libro cada ${daysPerBook} ${daysPerBook === 1 ? 'día' : 'días'}`
    } else if (periodMode === 'year') {
      const currentYearStr = String(new Date().getFullYear())
      const isCurrentYear = selectedYear === currentYearStr
      const monthsElapsed = isCurrentYear ? Math.max(1, new Date().getMonth() + 1) : 12
      const pacePerMonth = (periodCount / monthsElapsed).toFixed(1)
      paceText = `Ritmo: ~${pacePerMonth} libros/mes`
    } else if (periodMode === 'custom') {
      if (customStart && customEnd) {
        const diffDays = Math.max(1, Math.round((new Date(customEnd).getTime() - new Date(customStart).getTime()) / (1000 * 60 * 60 * 24)))
        const pace = Math.round(diffDays / periodCount)
        paceText = `~1 libro cada ${pace} días`
      } else {
        paceText = `${periodCount} en este rango`
      }
    } else {
      // Total history pace
      if (periodCount >= 2) {
        const sortedDates = periodBooks
          .map(b => new Date(b.dateRead || 0).getTime())
          .filter(t => t > 0)
          .sort((a, b) => a - b)
        if (sortedDates.length >= 2) {
          const diffDays = Math.max(1, Math.round((sortedDates[sortedDates.length - 1] - sortedDates[0]) / (1000 * 60 * 60 * 24)))
          const pace = Math.max(1, Math.round(diffDays / periodCount))
          paceText = `Frecuencia media: 1 cada ~${pace} días`
        } else {
          paceText = `${periodCount} lecturas registradas`
        }
      } else {
        paceText = `${periodCount} ${periodCount === 1 ? 'lectura registrada' : 'lecturas'}`
      }
    }
  } else {
    paceText = 'Sin lecturas en este periodo'
  }

  // Top Author & Top Genre
  const authorsMap: Record<string, number> = {}
  const genresMap: Record<string, number> = {}
  periodBooks.forEach(b => {
    if (b.author && b.author !== 'Autor desconocido') {
      authorsMap[b.author] = (authorsMap[b.author] || 0) + 1
    }
    if (b.genre) {
      genresMap[b.genre] = (genresMap[b.genre] || 0) + 1
    }
  })
  const topAuthorEntry = Object.entries(authorsMap).sort((a, b) => b[1] - a[1])[0]
  const topGenreEntry = Object.entries(genresMap).sort((a, b) => b[1] - a[1])[0]

  // Satisfaction rate (4-5 stars)
  const highRatedCount = periodBooks.filter(b => (b.rating || 0) >= 4).length
  const highRatedPct = periodCount > 0 ? Math.round((highRatedCount / periodCount) * 100) : 0

  // Most recent book in the period
  const sortedPeriodBooks = [...periodBooks].sort((a, b) => new Date(b.dateRead || 0).getTime() - new Date(a.dateRead || 0).getTime())
  const lastBook = sortedPeriodBooks[0]

  const handleLibraryMarkAsRead = (libraryBook: LibraryBook) => {
    setEditingBook({
      id: Date.now().toString(),
      title: libraryBook.title,
      author: libraryBook.author !== 'Autor desconocido' ? libraryBook.author : '',
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

  const LogoSVG = () => (
    <svg viewBox="0 0 48 48" role="img" aria-label="Logo de Bibliosfera" className="w-10 h-10">
      <rect width="48" height="48" rx="13" fill="var(--color-teal)"/>
      <rect x="9" y="22" width="8" height="17" rx="1.5" fill="var(--color-sky)"/>
      <rect x="20" y="14" width="8" height="25" rx="1.5" fill="var(--color-cream)"/>
      <rect x="31" y="8" width="8" height="31" rx="1.5" fill="var(--color-green)" stroke="var(--color-sky)" strokeWidth="1.5"/>
      <path d="M11 27h4M22 19h4M33 13h4" stroke="var(--color-teal)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 42h34" stroke="var(--color-brown)" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )

  const formatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

  // Helper label for month display
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
    <div className="max-w-[1240px] mx-auto p-5 sm:p-7 flex flex-col gap-8 min-h-screen">
      
      {/* Header with Navigation Tabs */}
      <header className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-5 sm:gap-8">
          <div className="flex items-center gap-3">
            <LogoSVG />
            <h1 className="font-bold text-2xl lowercase font-['Bricolage_Grotesque'] tracking-tight">bibliosfera</h1>
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

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="py-[9px] px-3.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-bg)] font-medium text-[12.5px] flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            title="Ajustes y opciones de importación / exportación"
          >
            <Settings className="w-3.5 h-3.5 stroke-[2.2]" />
            <span className="hidden sm:inline">Ajustes</span>
          </button>

          {activeTab === 'readings' && (
            <button 
              onClick={() => { setEditingBook(undefined); setShowModal(true); }}
              className="bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold py-[9px] px-5 rounded-full flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shadow-xs text-[13px]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Añadir lectura</span>
            </button>
          )}
        </div>
      </header>

      {/* Readings Module */}
      {activeTab === 'readings' && (
        <>
          {/* Summary Grid with Period Selectors */}
          <section className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-3">
        
        {/* Main Card: Libros leídos & Filtro temporal */}
        <div className="bg-[var(--color-teal)] text-[var(--color-cream)] rounded-[18px] p-[18px_20px] flex flex-col justify-between col-span-1 sm:col-span-1 border border-transparent shadow-xs">
          <div>
            {/* Top row: Label & Period Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-[12px] font-bold text-[var(--color-sky)] uppercase tracking-wider">
                Libros leídos
              </span>
              
              <select 
                value={periodMode}
                onChange={e => setPeriodMode(e.target.value as PeriodMode)}
                className="bg-[rgba(195,221,230,0.18)] hover:bg-[rgba(195,221,230,0.28)] text-[var(--color-cream)] text-[12px] font-medium rounded-lg px-2.5 py-1 border border-[rgba(195,221,230,0.3)] outline-none cursor-pointer transition-colors"
              >
                <option value="total" className="text-black bg-white">Todo el historial</option>
                <option value="year" className="text-black bg-white">Un año concreto</option>
                <option value="month" className="text-black bg-white">Un mes concreto</option>
                <option value="custom" className="text-black bg-white">Rango personalizado</option>
              </select>
            </div>

            {/* Context Controls based on Period Selection */}
            {periodMode === 'year' && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-[var(--color-sky)]">Año:</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="bg-[rgba(195,221,230,0.2)] text-[var(--color-cream)] text-[11px] font-bold rounded px-2 py-0.5 border border-[rgba(195,221,230,0.3)] outline-none cursor-pointer"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr} className="text-black bg-white">{yr}</option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === 'month' && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-[var(--color-sky)]">Mes:</span>
                <input 
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-[rgba(195,221,230,0.2)] text-[var(--color-cream)] text-[11px] font-bold rounded px-2 py-0.5 border border-[rgba(195,221,230,0.3)] outline-none cursor-pointer"
                />
              </div>
            )}

            {periodMode === 'custom' && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[11px] text-[var(--color-sky)]">
                <input 
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="bg-[rgba(195,221,230,0.2)] text-[var(--color-cream)] text-[11px] rounded px-1.5 py-0.5 border border-[rgba(195,221,230,0.3)] outline-none"
                  placeholder="Desde"
                />
                <span>a</span>
                <input 
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="bg-[rgba(195,221,230,0.2)] text-[var(--color-cream)] text-[11px] rounded px-1.5 py-0.5 border border-[rgba(195,221,230,0.3)] outline-none"
                  placeholder="Hasta"
                />
              </div>
            )}

            {/* Big prominent number */}
            <div className="font-bold text-[36px] sm:text-[40px] leading-[1.1] tracking-[-0.03em] font-['Bricolage_Grotesque'] mt-1">
              {periodCount} {periodCount === 1 ? 'libro' : 'libros'}
            </div>
          </div>

          {/* Relevant calculated statistic in Teal Card */}
          <div className="mt-3 pt-2.5 border-t border-[rgba(195,221,230,0.2)] flex items-center justify-between text-[12px] text-[var(--color-sky)]">
            <span className="font-medium">{paceText}</span>
            {periodMode !== 'total' && (
              <span className="text-[11px] opacity-75">
                {periodMode === 'month' ? formatMonthLabel(selectedMonth) : periodMode === 'year' ? selectedYear : 'Filtro activo'}
              </span>
            )}
          </div>
        </div>
        
        {/* Card 2: Nota media en el periodo */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[18px] p-[18px_20px] flex flex-col justify-between shadow-xs">
          <div>
            <div className="text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2">Nota media</div>
            <div className="font-bold text-[36px] sm:text-[40px] leading-[1.1] tracking-[-0.03em] font-['Bricolage_Grotesque'] flex items-baseline gap-2">
              <span>{avgRating}</span>
              {avgRating !== '–' && <Star className="w-5 h-5 fill-current text-[var(--color-star)] self-center" />}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[var(--color-line)] text-[12px] text-[var(--color-muted)]">
            {periodCount > 0 ? (
              <span>{highRatedPct}% con valoración 4-5 estrellas</span>
            ) : (
              <span>Sin valoraciones</span>
            )}
          </div>
        </div>
        
        {/* Card 3: Datos clave calculados (Autor más leído o Último libro) */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[18px] p-[18px_20px] flex flex-col justify-between shadow-xs">
          <div>
            <div className="text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2">
              {topAuthorEntry ? 'Autor más leído' : 'Última lectura'}
            </div>
            
            {topAuthorEntry ? (
              <div>
                <div className="text-[19px] sm:text-[21px] font-bold leading-[1.2] font-['Bricolage_Grotesque'] line-clamp-2">
                  {topAuthorEntry[0]}
                </div>
                <div className="text-[12px] text-[var(--color-muted)] mt-1">
                  {topAuthorEntry[1]} {topAuthorEntry[1] === 1 ? 'obra leída' : 'obras leídas'}
                </div>
              </div>
            ) : lastBook ? (
              <div>
                <div className="text-[19px] sm:text-[21px] font-bold leading-[1.2] font-['Bricolage_Grotesque'] line-clamp-2">
                  {lastBook.title}
                </div>
                <div className="text-[12px] text-[var(--color-muted)] mt-1">
                  {lastBook.author}
                </div>
              </div>
            ) : (
              <div className="text-[20px] font-bold text-[var(--color-muted)] font-['Bricolage_Grotesque']">
                –
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-[var(--color-line)] text-[12px] text-[var(--color-muted)] truncate">
            {topGenreEntry ? (
              <span>Género habitual: <strong className="font-medium text-[var(--color-ink)]">{topGenreEntry[0]}</strong></span>
            ) : lastBook?.dateRead ? (
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

        {/* Optional sync toggle: Filter list by the selected period */}
        {periodMode !== 'total' && (
          <div className="flex items-center gap-2 self-start text-[12px] text-[var(--color-muted)] pl-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={filterListByPeriod}
                onChange={e => setFilterListByPeriod(e.target.checked)}
                className="accent-[var(--color-accent)] rounded cursor-pointer"
              />
              <span>Limitar lista inferior a este periodo ({periodCount} {periodCount === 1 ? 'libro' : 'libros'})</span>
            </label>
          </div>
        )}
      </section>

      {/* Book List */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[20px] font-bold font-['Bricolage_Grotesque']">
            Leídos ({filteredBooks.length})
          </h2>
        </div>
        
        {filteredBooks.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--color-line)] rounded-[18px] p-[40px_20px] text-center text-[var(--color-muted)] flex flex-col items-center gap-2">
            <p className="font-medium">
              No hay lecturas registradas {searchQuery || filterListByPeriod ? 'con estos filtros' : 'todavía'}.
            </p>
            <p className="text-[14px]">Haz clic en "+ Añadir lectura" arriba a la derecha para empezar a registrar en Mis lecturas.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filteredBooks.map((book, idx) => {
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
                      {book.isbn && <span className="text-[11px] opacity-75">• ISBN: {book.isbn}</span>}
                    </div>

                    {/* Synopsis */}
                    {book.synopsis && (
                      <p className="text-[13.5px] text-[var(--color-muted)] line-clamp-4 mt-1.5 leading-relaxed font-normal">
                        {book.synopsis}
                      </p>
                    )}

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
          onMarkAsRead={handleLibraryMarkAsRead}
          readBookIds={books.map(b => b.libraryBookId).filter(Boolean) as string[]}
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
            if (editingBook) {
              const updated = await window.api.updateBook(book)
              setBooks(updated)
            } else {
              const updated = await window.api.addBook(book)
              setBooks(updated)
              if (book.libraryBookId) {
                await window.api.updateLibraryBook(book.libraryBookId, { status: 'read' })
              }
            }
          }} 
        />
      )}

      {/* Settings Modal (Export / Import / eReader) */}
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
      />
    </div>
  )
}
