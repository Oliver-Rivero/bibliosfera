import { useState, useMemo } from 'react'
import { Book } from '../types'
import {
  X,
  BarChart3,
  BookOpen,
  FileText,
  Star,
  Calendar,
  TrendingUp,
  Award,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react'

export type PeriodMode = 'total' | 'year' | 'month' | 'custom'

interface ReadingStatsModalProps {
  books: Book[]
  periodMode: PeriodMode
  setPeriodMode: (m: PeriodMode) => void
  selectedYear: string
  setSelectedYear: (y: string) => void
  selectedMonth: string
  setSelectedMonth: (m: string) => void
  customStart: string
  setCustomStart: (s: string) => void
  customEnd: string
  setCustomEnd: (e: string) => void
  filterListByPeriod: boolean
  setFilterListByPeriod: (v: boolean) => void
  onClose: () => void
  onSelectBook?: (book: Book) => void
}

interface ChartBucket {
  label: string
  fullLabel: string
  booksCount: number
  pagesCount: number
  books: Book[]
}

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTH_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function ReadingStatsModal({
  books,
  periodMode,
  setPeriodMode,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  filterListByPeriod,
  setFilterListByPeriod,
  onClose,
  onSelectBook
}: ReadingStatsModalProps) {
  const [chartMetric, setChartMetric] = useState<'books' | 'pages'>('books')
  const [hoveredBucketIdx, setHoveredBucketIdx] = useState<number | null>(null)

  const currentYearStr = String(new Date().getFullYear())

  const availableYears = useMemo(() => {
    return Array.from(
      new Set([
        currentYearStr,
        '2025',
        '2024',
        ...books.map(b => (b.dateRead ? b.dateRead.substring(0, 4) : '')).filter(Boolean)
      ])
    )
      .sort()
      .reverse()
  }, [books, currentYearStr])

  // Filter books for the selected period
  const periodBooks = useMemo(() => {
    return books.filter(b => {
      if (periodMode === 'total') return true
      if (!b.dateRead) return false
      const d = b.dateRead.substring(0, 10)
      if (periodMode === 'year') return d.startsWith(selectedYear)
      if (periodMode === 'month') return d.startsWith(selectedMonth)
      if (periodMode === 'custom') {
        if (customStart && d < customStart) return false
        if (customEnd && d > customEnd) return false
        return true
      }
      return true
    })
  }, [books, periodMode, selectedYear, selectedMonth, customStart, customEnd])

  // KPIs
  const periodCount = periodBooks.length
  const totalPages = periodBooks.reduce((acc, b) => acc + (parseInt(b.pages || '0') || 0), 0)
  const avgPages = periodCount > 0 ? Math.round(totalPages / periodCount) : 0

  const ratedBooks = periodBooks.filter(b => (b.rating || 0) > 0)
  const avgRating =
    ratedBooks.length > 0
      ? (ratedBooks.reduce((acc, b) => acc + (b.rating || 0), 0) / ratedBooks.length).toFixed(1)
      : '–'

  const highRatedCount = periodBooks.filter(b => (b.rating || 0) >= 4).length
  const highRatedPct = periodCount > 0 ? Math.round((highRatedCount / periodCount) * 100) : 0

  // Top author & genre
  const { topAuthor, topGenre } = useMemo(() => {
    const aMap: Record<string, number> = {}
    const gMap: Record<string, number> = {}
    periodBooks.forEach(b => {
      if (b.author && b.author !== 'Autor desconocido') {
        aMap[b.author] = (aMap[b.author] || 0) + 1
      }
      if (b.genre) {
        const mainGenre = b.genre.split(',')[0].trim()
        if (mainGenre) gMap[mainGenre] = (gMap[mainGenre] || 0) + 1
      }
    })
    const topA = Object.entries(aMap).sort((a, b) => b[1] - a[1])[0]
    const topG = Object.entries(gMap).sort((a, b) => b[1] - a[1])[0]
    return { topAuthor: topA, topGenre: topG }
  }, [periodBooks])

  // Pace calculation
  const paceLabel = useMemo(() => {
    if (periodCount === 0) return 'Sin lecturas en este periodo'
    if (periodMode === 'month') {
      const daysPerBook = Math.max(1, Math.round(30 / periodCount))
      return `~1 libro cada ${daysPerBook} ${daysPerBook === 1 ? 'día' : 'días'}`
    }
    if (periodMode === 'year') {
      const isCurrent = selectedYear === currentYearStr
      const monthsElapsed = isCurrent ? Math.max(1, new Date().getMonth() + 1) : 12
      return `~${(periodCount / monthsElapsed).toFixed(1)} libros al mes`
    }
    if (periodMode === 'custom' && customStart && customEnd) {
      const diffDays = Math.max(
        1,
        Math.round((new Date(customEnd).getTime() - new Date(customStart).getTime()) / (1000 * 60 * 60 * 24))
      )
      const pace = Math.max(1, Math.round(diffDays / periodCount))
      return `1 libro cada ~${pace} días`
    }
    if (periodCount >= 2) {
      const dates = periodBooks
        .map(b => new Date(b.dateRead || 0).getTime())
        .filter(t => t > 0)
        .sort((a, b) => a - b)
      if (dates.length >= 2) {
        const diffDays = Math.max(1, Math.round((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)))
        const pace = Math.max(1, Math.round(diffDays / periodCount))
        return `1 libro cada ~${pace} días`
      }
    }
    return `${periodCount} ${periodCount === 1 ? 'lectura registrada' : 'lecturas registradas'}`
  }, [periodCount, periodMode, selectedYear, currentYearStr, customStart, customEnd, periodBooks])

  // Build Chart Buckets depending on periodMode
  const chartBuckets: ChartBucket[] = useMemo(() => {
    if (periodMode === 'year') {
      return MONTH_SHORT.map((shortName, mIdx) => {
        const prefix = `${selectedYear}-${String(mIdx + 1).padStart(2, '0')}`
        const matched = periodBooks.filter(b => b.dateRead?.startsWith(prefix))
        const pgs = matched.reduce((acc, b) => acc + (parseInt(b.pages || '0') || 0), 0)
        return {
          label: shortName,
          fullLabel: `${MONTH_FULL[mIdx]} ${selectedYear}`,
          booksCount: matched.length,
          pagesCount: pgs,
          books: matched
        }
      })
    }

    if (periodMode === 'month') {
      const [yStr, mStr] = selectedMonth.split('-')
      const yearNum = parseInt(yStr) || new Date().getFullYear()
      const monthNum = parseInt(mStr) || 1
      const daysInMonth = new Date(yearNum, monthNum, 0).getDate()

      const ranges = [
        { label: 'Sem 1', full: 'Días 1 al 7', start: 1, end: 7 },
        { label: 'Sem 2', full: 'Días 8 al 14', start: 8, end: 14 },
        { label: 'Sem 3', full: 'Días 15 al 21', start: 15, end: 21 },
        { label: 'Sem 4', full: 'Días 22 al 28', start: 22, end: 28 }
      ]
      if (daysInMonth > 28) {
        ranges.push({
          label: 'Sem 5',
          full: `Días 29 al ${daysInMonth}`,
          start: 29,
          end: daysInMonth
        })
      }

      return ranges.map(r => {
        const matched = periodBooks.filter(b => {
          if (!b.dateRead) return false
          const day = parseInt(b.dateRead.substring(8, 10))
          return day >= r.start && day <= r.end
        })
        const pgs = matched.reduce((acc, b) => acc + (parseInt(b.pages || '0') || 0), 0)
        return {
          label: r.label,
          fullLabel: r.full,
          booksCount: matched.length,
          pagesCount: pgs,
          books: matched
        }
      })
    }

    // For 'total' or 'custom':
    // Check if books span multiple years or if we should show last 12 months / months in range
    const datedBooks = periodBooks.filter(b => b.dateRead && b.dateRead.length >= 7)
    if (datedBooks.length === 0) {
      // Show current year 12 months empty state
      return MONTH_SHORT.map((shortName, mIdx) => ({
        label: shortName,
        fullLabel: `${MONTH_FULL[mIdx]} ${currentYearStr}`,
        booksCount: 0,
        pagesCount: 0,
        books: []
      }))
    }

    const monthsSet = new Set(datedBooks.map(b => b.dateRead!.substring(0, 7)))
    const sortedMonths = Array.from(monthsSet).sort()
    const firstYM = sortedMonths[0]
    const lastYM = sortedMonths[sortedMonths.length - 1]

    const [y1, m1] = firstYM.split('-').map(Number)
    const [y2, m2] = lastYM.split('-').map(Number)
    const totalMonthsSpan = (y2 - y1) * 12 + (m2 - m1) + 1

    if (totalMonthsSpan <= 14) {
      // Build continuous month buckets covering at least 6 months
      const buckets: ChartBucket[] = []
      const endYear = y2
      const endMonth = m2
      const span = Math.max(6, totalMonthsSpan)
      for (let i = span - 1; i >= 0; i--) {
        const d = new Date(endYear, endMonth - 1 - i, 1)
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const matched = periodBooks.filter(b => b.dateRead?.startsWith(ym))
        const pgs = matched.reduce((acc, b) => acc + (parseInt(b.pages || '0') || 0), 0)
        buckets.push({
          label: `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
          fullLabel: `${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`,
          booksCount: matched.length,
          pagesCount: pgs,
          books: matched
        })
      }
      return buckets
    } else {
      // Group by Year if spanning more than 14 months
      const years = Array.from(new Set(datedBooks.map(b => b.dateRead!.substring(0, 4)))).sort()
      return years.map(yr => {
        const matched = periodBooks.filter(b => b.dateRead?.startsWith(yr))
        const pgs = matched.reduce((acc, b) => acc + (parseInt(b.pages || '0') || 0), 0)
        return {
          label: yr,
          fullLabel: `Año ${yr}`,
          booksCount: matched.length,
          pagesCount: pgs,
          books: matched
        }
      })
    }
  }, [periodMode, selectedYear, selectedMonth, periodBooks, currentYearStr])

  const maxBucketValue = useMemo(() => {
    const vals = chartBuckets.map(b => (chartMetric === 'books' ? b.booksCount : b.pagesCount))
    return Math.max(1, ...vals)
  }, [chartBuckets, chartMetric])

  // Rating breakdown (5, 4, 3, <=2)
  const ratingBreakdown = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, low: 0 }
    periodBooks.forEach(b => {
      const r = Math.round(b.rating || 0)
      if (r >= 5) counts[5]++
      else if (r === 4) counts[4]++
      else if (r === 3) counts[3]++
      else if (r > 0) counts.low++
    })
    return [
      { label: '5 estrellas', stars: 5, count: counts[5] },
      { label: '4 estrellas', stars: 4, count: counts[4] },
      { label: '3 estrellas', stars: 3, count: counts[3] },
      { label: '1-2 estrellas', stars: 2, count: counts.low }
    ]
  }, [periodBooks])

  const shiftMonth = (delta: number) => {
    try {
      const [y, m] = selectedMonth.split('-').map(Number)
      const d = new Date(y, m - 1 + delta, 1)
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    } catch {}
  }

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[24px] max-w-[820px] w-full p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col gap-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[14px] bg-[var(--color-teal)] text-[var(--color-cream)] flex items-center justify-center shrink-0 shadow-xs">
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-[22px] sm:text-[24px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-tight">
                Estadísticas y Hábito de Lectura
              </h2>
              <p className="text-[13px] text-[var(--color-muted)]">
                Explora tus lecturas por año, mes o periodo personalizado
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--color-bg)] hover:bg-[var(--color-line)] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer shrink-0"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Period Filter Selector Bar */}
        <div className="bg-[var(--color-bg)]/80 border border-[var(--color-line)] rounded-[18px] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'total', label: 'Todo el historial' },
                { id: 'year', label: 'Por año' },
                { id: 'month', label: 'Por mes' },
                { id: 'custom', label: 'Periodo personalizado' }
              ] as { id: PeriodMode; label: string }[]
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setPeriodMode(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-bold transition-all cursor-pointer ${
                  periodMode === tab.id
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-xs'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Contextual Controls */}
          <div className="flex items-center gap-2">
            {periodMode === 'year' && (
              <div className="flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-full px-3 py-1">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span className="text-[12px] text-[var(--color-muted)]">Año:</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="bg-transparent text-[var(--color-ink)] text-[13px] font-bold outline-none cursor-pointer pr-1"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr} className="text-black bg-white">
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === 'month' && (
              <div className="flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-full px-2 py-1">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="p-1 rounded-full hover:bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
                  title="Mes anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-[var(--color-ink)] text-[12.5px] font-bold outline-none cursor-pointer px-1"
                />
                <button
                  onClick={() => shiftMonth(1)}
                  className="p-1 rounded-full hover:bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
                  title="Mes siguiente"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {periodMode === 'custom' && (
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="bg-[var(--color-surface)] text-[var(--color-ink)] text-[12px] font-medium rounded-full px-3 py-1 border border-[var(--color-line)] outline-none"
                />
                <span className="text-[var(--color-muted)]">a</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="bg-[var(--color-surface)] text-[var(--color-ink)] text-[12px] font-medium rounded-full px-3 py-1 border border-[var(--color-line)] outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* 4 Summary KPI Mini-Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[var(--color-teal)] text-[var(--color-cream)] rounded-[16px] p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-sky)] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Libros leídos</span>
            </span>
            <div className="text-[28px] font-bold font-['Bricolage_Grotesque'] leading-tight my-1">
              {periodCount}
            </div>
            <span className="text-[11px] text-[var(--color-sky)] truncate">{paceLabel}</span>
          </div>

          <div className="bg-[var(--color-bg)]/70 border border-[var(--color-line)] rounded-[16px] p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>Páginas leídas</span>
            </span>
            <div className="text-[28px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-tight my-1">
              {totalPages.toLocaleString('es-ES')}
            </div>
            <span className="text-[11px] text-[var(--color-muted)] truncate">
              {avgPages > 0 ? `Media: ${avgPages} págs./libro` : 'Sin páginas registradas'}
            </span>
          </div>

          <div className="bg-[var(--color-bg)]/70 border border-[var(--color-line)] rounded-[16px] p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-[var(--color-star)]" />
              <span>Valoración media</span>
            </span>
            <div className="text-[28px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-tight my-1 flex items-center gap-1.5">
              <span>{avgRating}</span>
              {avgRating !== '–' && <Star className="w-4 h-4 fill-current text-[var(--color-star)]" />}
            </div>
            <span className="text-[11px] text-[var(--color-muted)] truncate">
              {periodCount > 0 ? `${highRatedPct}% con 4 o 5 estrellas` : 'Sin valoraciones'}
            </span>
          </div>

          <div className="bg-[var(--color-bg)]/70 border border-[var(--color-line)] rounded-[16px] p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[var(--color-green)]" />
              <span>Autor / Género</span>
            </span>
            <div className="text-[15px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-snug my-1 line-clamp-1">
              {topAuthor ? topAuthor[0] : '–'}
            </div>
            <span className="text-[11px] text-[var(--color-muted)] truncate">
              {topGenre ? `Género: ${topGenre[0]}` : topAuthor ? `${topAuthor[1]} obras` : 'Sin datos suficientes'}
            </span>
          </div>
        </div>

        {/* Attractive Reading Habit Chart */}
        <div className="bg-[var(--color-bg)]/50 border border-[var(--color-line)] rounded-[20px] p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[16px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
                <span>
                  Hábito de lectura{' '}
                  {periodMode === 'year'
                    ? `en ${selectedYear}`
                    : periodMode === 'month'
                    ? `en ${formatMonthLabel(selectedMonth)}`
                    : periodMode === 'custom'
                    ? 'en el periodo seleccionado'
                    : 'histórico'}
                </span>
              </h3>
              <p className="text-[12px] text-[var(--color-muted)]">
                Pasa el cursor sobre las barras para ver los títulos leídos en cada tramo
              </p>
            </div>

            {/* Metric Switcher: Libros vs Páginas */}
            <div className="flex items-center gap-1 p-0.5 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-full text-[12px]">
              <button
                onClick={() => setChartMetric('books')}
                className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                  chartMetric === 'books'
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                Libros
              </button>
              <button
                onClick={() => setChartMetric('pages')}
                className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                  chartMetric === 'pages'
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                Páginas
              </button>
            </div>
          </div>

          {/* Interactive Bar Chart Canvas */}
          <div className="relative pt-6 pb-2 px-2">
            {/* Horizontal grid lines */}
            <div className="absolute inset-x-2 top-6 bottom-8 flex flex-col justify-between pointer-events-none">
              <div className="border-b border-dashed border-[var(--color-line)]/70 w-full" />
              <div className="border-b border-dashed border-[var(--color-line)]/50 w-full" />
              <div className="border-b border-dashed border-[var(--color-line)]/50 w-full" />
              <div className="border-b border-[var(--color-line)] w-full" />
            </div>

            <div className="relative z-10 grid items-end gap-2 sm:gap-3 h-[190px]" style={{ gridTemplateColumns: `repeat(${chartBuckets.length}, minmax(0, 1fr))` }}>
              {chartBuckets.map((bucket, idx) => {
                const val = chartMetric === 'books' ? bucket.booksCount : bucket.pagesCount
                const heightPct = val > 0 ? Math.max(12, Math.round((val / maxBucketValue) * 100)) : 4
                const isHovered = hoveredBucketIdx === idx
                const isPeak = val > 0 && val === maxBucketValue

                return (
                  <div
                    key={bucket.label + idx}
                    onMouseEnter={() => setHoveredBucketIdx(idx)}
                    onMouseLeave={() => setHoveredBucketIdx(null)}
                    className="relative h-full flex flex-col items-center justify-end group cursor-pointer select-none"
                  >
                    {/* Value label above bar */}
                    <span
                      className={`text-[11px] font-bold mb-1.5 transition-all ${
                        val > 0
                          ? isHovered || isPeak
                            ? 'text-[var(--color-accent)] scale-110'
                            : 'text-[var(--color-ink)]'
                          : 'text-[var(--color-muted)]/40 text-[10px]'
                      }`}
                    >
                      {val > 0 ? (chartMetric === 'pages' && val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val) : '0'}
                    </span>

                    {/* Bar */}
                    <div className="w-full max-w-[42px] h-[135px] flex items-end justify-center">
                      <div
                        className={`w-full rounded-t-[8px] rounded-b-[3px] transition-all duration-300 ${
                          val === 0
                            ? 'bg-[var(--color-line)]/50'
                            : isPeak
                            ? 'bg-gradient-to-t from-[var(--color-teal)] to-[var(--color-green)] shadow-sm'
                            : 'bg-[var(--color-teal)]/85 group-hover:bg-[var(--color-teal)]'
                        } ${isHovered ? 'ring-2 ring-[var(--color-accent)]/40 scale-x-105' : ''}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>

                    {/* X-axis label */}
                    <span
                      className={`mt-2 text-[11px] font-medium truncate max-w-full ${
                        isHovered ? 'font-bold text-[var(--color-ink)]' : 'text-[var(--color-muted)]'
                      }`}
                    >
                      {bucket.label}
                    </span>

                    {/* Hover Popover with titles */}
                    {isHovered && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 min-w-[190px] max-w-[240px] bg-[var(--color-ink)] text-[var(--color-cream)] p-3 rounded-[12px] shadow-xl text-left pointer-events-none animate-fade-in">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-sky)] mb-1">
                          {bucket.fullLabel}
                        </p>
                        <p className="text-[12.5px] font-bold mb-1">
                          {bucket.booksCount} {bucket.booksCount === 1 ? 'libro leído' : 'libros leídos'}
                          {bucket.pagesCount > 0 ? ` • ${bucket.pagesCount} págs.` : ''}
                        </p>
                        {bucket.books.length > 0 && (
                          <ul className="text-[11px] text-[var(--color-cream)]/85 space-y-0.5 border-t border-white/15 pt-1.5 mt-1">
                            {bucket.books.slice(0, 4).map(b => (
                              <li key={b.id} className="truncate">
                                • {b.title}
                              </li>
                            ))}
                            {bucket.books.length > 4 && (
                              <li className="text-[10px] opacity-75">+{bucket.books.length - 4} más...</li>
                            )}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Bottom Row: Rating Distribution & Period Books Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Rating Distribution */}
          <div className="bg-[var(--color-bg)]/40 border border-[var(--color-line)] rounded-[18px] p-4 flex flex-col justify-between gap-3">
            <h4 className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Distribución de valoraciones
            </h4>
            <div className="flex flex-col gap-2.5 my-auto">
              {ratingBreakdown.map(row => {
                const pct = periodCount > 0 ? Math.round((row.count / periodCount) * 100) : 0
                return (
                  <div key={row.label} className="flex items-center gap-2.5 text-[12.5px]">
                    <span className="w-[88px] text-[var(--color-ink)] font-medium shrink-0 flex items-center gap-1">
                      <span>{row.label}</span>
                    </span>
                    <div className="flex-1 h-2.5 bg-[var(--color-line)]/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-star)] rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-[11.5px] font-mono text-[var(--color-muted)]">
                      {row.count} ({pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Books in this period */}
          <div className="bg-[var(--color-bg)]/40 border border-[var(--color-line)] rounded-[18px] p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Títulos en este periodo ({periodCount})
              </h4>
            </div>

            {periodBooks.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-muted)] my-auto py-4 text-center">
                No hay lecturas registradas en las fechas seleccionadas.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[125px] overflow-y-auto pr-1">
                {periodBooks.slice(0, 8).map(b => (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (onSelectBook) {
                        onClose()
                        onSelectBook(b)
                      }
                    }}
                    className="flex items-center justify-between gap-2 py-1 px-2 rounded-lg hover:bg-[var(--color-surface)] text-[12.5px] cursor-pointer transition-colors"
                  >
                    <div className="truncate">
                      <span className="font-bold text-[var(--color-ink)]">{b.title}</span>
                      {b.author && <span className="text-[var(--color-muted)]"> — {b.author}</span>}
                    </div>
                    {b.rating ? (
                      <span className="text-[11px] font-bold text-[var(--color-star)] shrink-0">
                        {b.rating}★
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Sync filter checkbox & Close button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--color-line)]">
          <label className="flex items-center gap-2 text-[13px] text-[var(--color-ink)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterListByPeriod && periodMode !== 'total'}
              disabled={periodMode === 'total'}
              onChange={e => setFilterListByPeriod(e.target.checked)}
              className="accent-[var(--color-accent)] w-4 h-4 rounded cursor-pointer disabled:opacity-40"
            />
            <span className={periodMode === 'total' ? 'text-[var(--color-muted)]' : 'font-medium'}>
              <Filter className="w-3.5 h-3.5 inline mr-1 text-[var(--color-accent)]" />
              Aplicar este filtro de periodo al listado principal de «Mis lecturas»
            </span>
          </label>

          <button
            onClick={onClose}
            className="py-2 px-5 rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold text-[13px] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
