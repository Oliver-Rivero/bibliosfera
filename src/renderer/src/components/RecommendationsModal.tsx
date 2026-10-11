import { useState, useEffect } from 'react'
import { Book, RecommendedBook } from '../types'
import { X, Lightbulb, RotateCw, Star, FileText, Calendar, Tag, Plus } from 'lucide-react'

interface RecommendationsModalProps {
  favoriteBooks: Book[]
  onClose: () => void
  onAddRecommendedToReadings?: (rec: RecommendedBook) => void
}

export default function RecommendationsModal({
  favoriteBooks,
  onClose,
  onAddRecommendedToReadings
}: RecommendationsModalProps) {
  const [recommendations, setRecommendations] = useState<RecommendedBook[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [seed, setSeed] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchRecommendations = async (nextSeed: number) => {
    if (favoriteBooks.length === 0) return
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const res = await window.api.getRecommendations(nextSeed)
      if (res && res.recommendations) {
        setRecommendations(res.recommendations)
      } else {
        setRecommendations([])
      }
    } catch (e) {
      setErrorMsg('No se pudo conectar para buscar recomendaciones. Verifica tu conexión a internet.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRecommendations(0)
  }, [])

  const handleRefresh = () => {
    const next = seed + 1
    setSeed(next)
    fetchRecommendations(next)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[24px] max-w-[840px] w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col gap-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[14px] bg-[var(--color-teal)] text-[var(--color-cream)] flex items-center justify-center shrink-0 shadow-xs">
              <Lightbulb className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-[22px] sm:text-[24px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-tight">
                Recomendaciones para ti
              </h2>
              <p className="text-[13px] text-[var(--color-muted)]">
                Descubrimientos literarios buscados en internet a partir de tus lecturas de 4 y 5 estrellas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {favoriteBooks.length > 0 && (
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="py-2 px-3.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)] hover:bg-[var(--color-line)]/60 text-[var(--color-ink)] text-[12.5px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Buscar nuevos títulos recomendados"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Nuevas sugerencias</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[var(--color-bg)] hover:bg-[var(--color-line)] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Favorite Books Reference Pill Bar */}
        {favoriteBooks.length > 0 && (
          <div className="bg-[var(--color-bg)]/60 border border-[var(--color-line)] rounded-[16px] p-3 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-bold text-[var(--color-muted)] uppercase tracking-wider text-[10.5px] mr-1">
              Inspirado en tus favoritos ({favoriteBooks.length}):
            </span>
            {favoriteBooks.slice(0, 5).map(fav => (
              <span
                key={fav.id}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] font-medium"
              >
                <span className="truncate max-w-[160px]">{fav.title}</span>
                <span className="text-[var(--color-star)] font-bold text-[11px] flex items-center">
                  {fav.rating}★
                </span>
              </span>
            ))}
            {favoriteBooks.length > 5 && (
              <span className="text-[11px] text-[var(--color-muted)]">
                +{favoriteBooks.length - 5} más
              </span>
            )}
          </div>
        )}

        {/* Content Body */}
        {favoriteBooks.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--color-line)] rounded-[20px] p-10 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-star)] border border-[var(--color-line)]">
              <Star className="w-6 h-6 fill-current" />
            </div>
            <h3 className="text-[18px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)]">
              Aún no tienes lecturas con 4 o 5 estrellas
            </h3>
            <p className="text-[13.5px] text-[var(--color-muted)] max-w-[46ch] leading-relaxed">
              Puntúa tus libros favoritos con 4 o 5 estrellas en «Mis lecturas» para que podamos buscar en internet obras afines a tus autores y géneros predilectos.
            </p>
          </div>
        ) : isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <RotateCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
            <p className="font-bold text-[16px] font-['Bricolage_Grotesque'] text-[var(--color-ink)]">
              Analizando tus lecturas favoritas y buscando títulos en internet...
            </p>
            <p className="text-[13px] text-[var(--color-muted)]">
              Explorando obras de tus autores mejor valorados y géneros afines
            </p>
          </div>
        ) : errorMsg ? (
          <div className="border border-red-300 bg-red-50/50 rounded-[18px] p-6 text-center text-red-800 text-[13.5px]">
            {errorMsg}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--color-line)] rounded-[20px] p-10 text-center flex flex-col items-center gap-2">
            <p className="font-bold text-[16px] text-[var(--color-ink)]">
              No se encontraron sugerencias en este intento
            </p>
            <p className="text-[13px] text-[var(--color-muted)]">
              Pulsa en «Nuevas sugerencias» arriba a la derecha para ampliar la búsqueda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec, idx) => {
              const coverIdx = idx % 4
              const coverBg =
                coverIdx === 0
                  ? 'var(--color-brown)'
                  : coverIdx === 1
                  ? 'var(--color-teal)'
                  : coverIdx === 2
                  ? 'var(--color-green)'
                  : 'var(--color-sky)'
              const coverFg = coverIdx === 3 ? 'var(--color-teal)' : 'var(--color-cream)'
              const coverLetters = (rec.title || 'LI').substring(0, 2).toUpperCase()

              return (
                <div
                  key={rec.id}
                  className="bg-[var(--color-bg)]/45 border border-[var(--color-line)] hover:border-[var(--color-accent)] rounded-[18px] p-4 flex gap-4 transition-all shadow-2xs"
                >
                  {/* Cover */}
                  <div className="shrink-0">
                    {rec.coverUrl ? (
                      <img
                        src={rec.coverUrl}
                        alt={rec.title}
                        className="w-[68px] h-[100px] object-cover rounded-[4px_8px_8px_4px] shadow-sm border border-[var(--color-line)] bg-white"
                        onError={e => {
                          ;(e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div
                        className="w-[68px] h-[100px] rounded-[4px_8px_8px_4px] flex items-center justify-center font-bold text-[20px] font-['Bricolage_Grotesque'] shadow-sm"
                        style={{
                          backgroundColor: coverBg,
                          color: coverFg,
                          boxShadow: 'inset 5px 0 0 rgba(0,0,0,0.18)'
                        }}
                      >
                        {coverLetters}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[var(--color-accent)] bg-[var(--color-chip)]/60 px-2 py-0.5 rounded-full mb-1.5 max-w-full truncate">
                        <Lightbulb className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{rec.reason}</span>
                      </span>

                      <h3 className="text-[16px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-snug line-clamp-2">
                        {rec.title}
                      </h3>
                      <p className="text-[13px] font-medium text-[var(--color-muted)] truncate mt-0.5">
                        {rec.author}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)] mt-1.5">
                        {rec.year && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {rec.year}
                          </span>
                        )}
                        {rec.pages && (
                          <span className="inline-flex items-center gap-1">
                            • <FileText className="w-3 h-3" /> {rec.pages} págs.
                          </span>
                        )}
                        {rec.genre && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                            • <Tag className="w-3 h-3" /> {rec.genre}
                          </span>
                        )}
                      </div>

                      {rec.synopsis && (
                        <p className="text-[12px] text-[var(--color-muted)] line-clamp-3 mt-2 leading-relaxed">
                          {rec.synopsis}
                        </p>
                      )}
                    </div>

                    {onAddRecommendedToReadings && (
                      <div className="mt-3 pt-2 border-t border-[var(--color-line)]/50 flex justify-end">
                        <button
                          onClick={() => {
                            onClose()
                            onAddRecommendedToReadings(rec)
                          }}
                          className="text-[11.5px] font-bold text-[var(--color-accent)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Registrar en Mis lecturas</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
