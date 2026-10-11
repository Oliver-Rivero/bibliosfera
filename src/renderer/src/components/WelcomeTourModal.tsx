import React, { useState } from 'react'
import {
  Library,
  BookOpen,
  Upload,
  Plus,
  Star,
  Tablet,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  BookmarkCheck
} from 'lucide-react'

interface WelcomeTourModalProps {
  isOpen: boolean
  onClose: () => void
  onNavigateTab?: (tab: 'readings' | 'library') => void
}

interface TourStep {
  title: string
  subtitle: string
  tag: string
  icon: React.ReactNode
  accentColor: string
  content: React.ReactNode
  tips?: string[]
}

export default function WelcomeTourModal({
  isOpen,
  onClose,
  onNavigateTab
}: WelcomeTourModalProps) {
  const [currentStep, setCurrentStep] = useState(0)

  if (!isOpen) return null

  const handleFinish = () => {
    localStorage.setItem('bibliosfera_welcome_tour_seen', 'true')
    onClose()
  }

  const steps: TourStep[] = [
    {
      title: '¡Bienvenido a Bibliosfera!',
      subtitle:
        'Tu biblioteca personal en la que además de guardar todos tus eBooks, podrás llevar un registro de tus lecturas y valorarlas.',
      tag: 'Bienvenida',
      icon: <Sparkles className="w-8 h-8 text-[var(--color-accent)]" />,
      accentColor: 'from-amber-500/20 to-orange-500/10',
      content: (
        <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          <p>
            Hemos diseñado Bibliosfera para que sea tu <strong>santuario de lectura digital</strong>: un espacio íntimo, elegante y 100% privado en tu ordenador, sin publicidad ni cuentas obligatorias.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)] shrink-0">
                <Library className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[13px] text-[var(--color-ink)] block">Biblioteca digital</span>
                <span className="text-[12px]">Tu biblioteca virtual donde guardar todos tus eBooks.</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)] shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[13px] text-[var(--color-ink)] block">Mis lecturas</span>
                <span className="text-[12px]">Diario personal con tus lecturas, reseñas, valoraciones y estadísticas.</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'El módulo «Biblioteca digital»',
      subtitle: 'Una estantería visual para tus libros electrónicos.',
      tag: 'Estantería',
      icon: <Library className="w-8 h-8 text-[var(--color-accent)]" />,
      accentColor: 'from-sky-500/20 to-teal-500/10',
      content: (
        <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          <p>
            En la pestaña <strong>Biblioteca digital</strong> tus libros se presentan con portadas en 3D con perspectiva real, vista de lomos proporcionales o lista tradicional.
          </p>
          <ul className="space-y-2 mt-1">
            <li className="flex items-start gap-2 text-[13px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Metadatos automáticos:</strong> Al importar un EPUB o PDF, Bibliosfera extrae automáticamente el título, autor, páginas, portada y sinopsis.</span>
            </li>
            <li className="flex items-start gap-2 text-[13px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Filtros rápidos:</strong> Puedes filtrar por formato (EPUB, PDF...) y por estado (por leer o ya leídos).</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      title: 'Cómo añadir libros a tu Biblioteca',
      subtitle: 'Coloca tus archivos en la estantería con un solo gesto.',
      tag: 'Añadir libros',
      icon: <Upload className="w-8 h-8 text-[var(--color-accent)]" />,
      accentColor: 'from-emerald-500/20 to-teal-500/10',
      content: (
        <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          <p>Tienes varias formas muy sencillas de añadir libros:</p>
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold text-[12px] flex items-center justify-center shrink-0">1</span>
              <div>
                <strong className="text-[13px] text-[var(--color-ink)] block">Botón «Añadir a biblioteca»</strong>
                <span className="text-[12px]">Arriba a la derecha. Pulsa para elegir uno o varios archivos de tu disco.</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold text-[12px] flex items-center justify-center shrink-0">2</span>
              <div>
                <strong className="text-[13px] text-[var(--color-ink)] block">Clic directo en el recuadro vacío</strong>
                <span className="text-[12px]">Si tu estantería está despejada, haz clic en el propio recuadro para abrir el selector de archivos al instante.</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold text-[12px] flex items-center justify-center shrink-0">3</span>
              <div>
                <strong className="text-[13px] text-[var(--color-ink)] block">Importar carpetas completas en Ajustes</strong>
                <span className="text-[12px]">En el icono de engranaje ⚙️ puedes importar carpetas enteras de golpe para analizar cientos de libros a la vez.</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Pasar de la Biblioteca a «Mis lecturas»',
      subtitle: 'Conecta tus libros leídos con tu registro personal.',
      tag: 'Flujo de lectura',
      icon: <BookmarkCheck className="w-8 h-8 text-[var(--color-accent)]" />,
      accentColor: 'from-purple-500/20 to-pink-500/10',
      content: (
        <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          <p>
            Cuando termines un libro de tu biblioteca digital, no necesitas volver a escribir su título ni buscar su portada:
          </p>
          <div className="p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[var(--color-ink)] font-bold text-[13px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Marcar como leído en un clic</span>
            </div>
            <p className="text-[12.5px]">
              Haz clic en el libro en la estantería y pulsa <strong>«Marcar como leído»</strong> (o el botón rápido con tick). Se abrirá la ficha en «Mis lecturas» con el título, autor, páginas y portada ya rellenados, para que solo tengas que ponerle tu nota con estrellas ⭐ y tu reseña u opinión.
            </p>
          </div>
        </div>
      )
    },
    {
      title: 'Cómo añadir a «Mis lecturas» directamente',
      subtitle: 'Registra cualquier libro, incluso los que leíste en papel o hace años.',
      tag: 'Mis lecturas',
      icon: <Star className="w-8 h-8 text-amber-500" />,
      accentColor: 'from-amber-500/20 to-yellow-500/10',
      content: (
        <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          <p>
            En la sección <strong>Mis lecturas</strong> puedes llevar el histórico de toda tu vida lectora:
          </p>
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-start gap-3">
              <Plus className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[13px] text-[var(--color-ink)] block">Botón «+ Añadir lectura»</strong>
                <span className="text-[12px]">Situado arriba a la derecha (o clic en el recuadro cuando está vacío). Introduce el título y la app buscará la portada y datos oficiales por ti.</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[13px] text-[var(--color-ink)] block">Estadísticas y Hábitos</strong>
                <span className="text-[12px]">Haz clic en la primera tarjeta de <strong>Libros leídos</strong> para abrir la gráfica interactiva y ver tus hábitos por años o meses.</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'eReader, Temas y Exportación',
      subtitle: 'Todo lo que necesitas para disfrutar de tus libros a tu gusto.',
      tag: 'Funciones Pro',
      icon: <Tablet className="w-8 h-8 text-[var(--color-accent)]" />,
      accentColor: 'from-teal-500/20 to-emerald-500/10',
      content: (
        <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-start gap-3">
              <Tablet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-[13px] text-[var(--color-ink)] block">Conexión con eReader (Kobo, Kindle, etc.)</strong>
                <span className="text-[12px]">Conecta tu dispositivo por USB y verás aparecer la barra verde: solo tienes que arrastrar y soltar cualquier libro para transferirlo a la memoria.</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[13px] text-[var(--color-ink)] block">Temas y Exportación en Ajustes ⚙️</strong>
                <span className="text-[12px]">Elige entre los temas <em>Elegante</em>, <em>Cactusito</em> o <em>Ex Libris</em>, y exporta tus lecturas a Excel o PDF cuando quieras.</span>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ]

  const step = steps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleFinish}
    >
      <div
        className="w-full max-w-[640px] bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[24px] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header with Progress & Close */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-[var(--color-line)]/60 bg-[var(--color-bg)]/40">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              {step.tag}
            </span>
            <span className="text-[12px] font-medium text-[var(--color-muted)]">
              Paso {currentStep + 1} de {steps.length}
            </span>
          </div>
          <button
            onClick={handleFinish}
            className="w-8 h-8 rounded-full hover:bg-[var(--color-line)]/50 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors flex items-center justify-center cursor-pointer"
            title="Cerrar tour"
            aria-label="Cerrar tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Banner & Content */}
        <div className="p-6 sm:p-7 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl bg-gradient-to-br ${step.accentColor} border border-[var(--color-line)] shrink-0 shadow-xs`}>
              {step.icon}
            </div>
            <div>
              <h2 className="text-[20px] sm:text-[22px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-tight">
                {step.title}
              </h2>
              <p className="text-[13px] text-[var(--color-muted)] mt-1 font-medium leading-snug">
                {step.subtitle}
              </p>
            </div>
          </div>

          <div className="py-2">
            {step.content}
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-6 py-4 border-t border-[var(--color-line)]/70 bg-[var(--color-bg)]/40 flex items-center justify-between gap-3">
          {/* Step Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStep
                    ? 'w-6 bg-[var(--color-accent)]'
                    : 'w-2 bg-[var(--color-line)] hover:bg-[var(--color-muted)]'
                }`}
                title={`Ir al paso ${idx + 1}`}
                aria-label={`Ir al paso ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="py-2 px-3.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[var(--color-ink)] font-semibold text-[12.5px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
            )}

            {isFirst && (
              <button
                onClick={handleFinish}
                className="py-2 px-3.5 rounded-full text-[var(--color-muted)] hover:text-[var(--color-ink)] font-medium text-[12.5px] transition-colors cursor-pointer"
              >
                Saltar tour
              </button>
            )}

            {!isLast ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="py-2 px-4.5 rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-95 font-bold text-[12.5px] flex items-center gap-1.5 transition-opacity cursor-pointer shadow-xs"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="py-2 px-5 rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-95 font-bold text-[13px] flex items-center gap-1.5 transition-opacity cursor-pointer shadow-xs"
              >
                <span>¡Empezar a leer!</span>
                <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
