import { useState } from 'react'
import { 
  X, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Globe, 
  FolderDown, 
  Database, 
  Check, 
  BookOpen, 
  Library,
  ArrowRight
} from 'lucide-react'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  initialType?: 'readings' | 'library'
  selectedLibraryIds?: string[]
  totalReadingsCount: number
  totalLibraryCount: number
}

export default function ExportModal({
  isOpen,
  onClose,
  initialType = 'readings',
  selectedLibraryIds = [],
  totalReadingsCount,
  totalLibraryCount
}: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<'readings' | 'library'>(initialType)
  const [isExporting, setIsExporting] = useState(false)
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null)

  if (!isOpen) return null

  const handleExportReadings = async (format: 'csv' | 'markdown' | 'html' | 'json') => {
    setIsExporting(true)
    setFeedback(null)
    try {
      const res = await window.api.exportReadings(format)
      if (res.success) {
        setFeedback({ success: true, message: res.message })
      } else {
        if (res.message !== 'Exportación cancelada.') {
          setFeedback({ success: false, message: res.message })
        }
      }
    } catch (e: any) {
      setFeedback({ success: false, message: e.message || 'Error al exportar' })
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportLibrary = async (format: 'csv' | 'html' | 'json' | 'files') => {
    setIsExporting(true)
    setFeedback(null)
    try {
      const ids = selectedLibraryIds.length > 0 ? selectedLibraryIds : undefined
      const res = await window.api.exportLibrary(format, ids)
      if (res.success) {
        setFeedback({ success: true, message: res.message })
      } else {
        if (res.message !== 'Exportación cancelada.') {
          setFeedback({ success: false, message: res.message })
        }
      }
    } catch (e: any) {
      setFeedback({ success: false, message: e.message || 'Error al exportar' })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[24px] shadow-2xl w-full max-w-[620px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-[var(--color-line)] flex items-center justify-between bg-[var(--color-bg)]/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center">
              <Download className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-[20px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-tight">
                Exportar datos
              </h3>
              <p className="text-[12.5px] text-[var(--color-muted)]">
                Guarda tus lecturas y libros en múltiples formatos abiertos
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--color-line)]/50 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[var(--color-line)] px-6 pt-3 bg-[var(--color-bg)]/20">
          <button
            onClick={() => { setActiveTab('readings'); setFeedback(null); }}
            className={`pb-3 px-4 font-bold text-[13.5px] border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'readings'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <BookOpen className="w-4 h-4 stroke-[2]" />
            <span>Mis lecturas ({totalReadingsCount})</span>
          </button>

          <button
            onClick={() => { setActiveTab('library'); setFeedback(null); }}
            className={`pb-3 px-4 font-bold text-[13.5px] border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'library'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Library className="w-4 h-4 stroke-[2]" />
            <span>Biblioteca digital ({selectedLibraryIds.length > 0 ? `${selectedLibraryIds.length} seleccionados` : totalLibraryCount})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">

          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-4 rounded-[14px] text-[13px] leading-relaxed flex items-start gap-3 border ${
              feedback.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
            }`}>
              <div className="shrink-0 mt-0.5">
                {feedback.success ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-4 h-4 stroke-[3]" />}
              </div>
              <div className="whitespace-pre-line flex-1 font-medium">
                {feedback.message}
              </div>
            </div>
          )}

          {activeTab === 'readings' ? (
            /* ================= READINGS EXPORTS ================= */
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[var(--color-muted)] mb-1">
                Elige el formato en el que deseas exportar tu historial de libros leídos:
              </p>

              {/* CSV / Excel */}
              <button
                disabled={isExporting || totalReadingsCount === 0}
                onClick={() => handleExportReadings('csv')}
                className="group p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] transition-all flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[10px] bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[14.5px] text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                      Hoja de cálculo (CSV / Excel / Numbers)
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      Títulos, autores, valoraciones en estrellas, fechas, minutos leídos y comentarios.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              {/* Markdown */}
              <button
                disabled={isExporting || totalReadingsCount === 0}
                onClick={() => handleExportReadings('markdown')}
                className="group p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] transition-all flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[10px] bg-sky-600/10 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[14.5px] text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                      Documento Markdown (.md)
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      Formato editorial con fichas formateadas, citas y notas. Ideal para Obsidian o Notion.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              {/* HTML / Printable */}
              <button
                disabled={isExporting || totalReadingsCount === 0}
                onClick={() => handleExportReadings('html')}
                className="group p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] transition-all flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[10px] bg-amber-600/10 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[14.5px] text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                      Página Web e Imprimible (HTML / PDF)
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      Diseño cuidado con estadísticas globales. Ábrelo en tu navegador o imprímelo a PDF con Cmd+P.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              {/* JSON Backup */}
              <button
                disabled={isExporting || totalReadingsCount === 0}
                onClick={() => handleExportReadings('json')}
                className="group p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] transition-all flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[10px] bg-purple-600/10 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[14.5px] text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                      Copia de seguridad completa (JSON)
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      Archivo de datos sin pérdidas para respaldos o transferencias entre ordenadores.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            </div>
          ) : (
            /* ================= LIBRARY EXPORTS ================= */
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[var(--color-muted)] mb-1">
                {selectedLibraryIds.length > 0 
                  ? `Se exportarán los ${selectedLibraryIds.length} libros que tienes seleccionados actualmente:`
                  : `Exporta el catálogo o los archivos de tus ${totalLibraryCount} libros en tu biblioteca digital:`}
              </p>

              {/* Physical Files Export */}
              <button
                disabled={isExporting || totalLibraryCount === 0}
                onClick={() => handleExportLibrary('files')}
                className="group p-4 rounded-[16px] border-2 border-[var(--color-accent)]/30 hover:border-[var(--color-accent)] bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10 transition-all flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[10px] bg-[var(--color-accent)] text-[var(--color-on-accent)] flex items-center justify-center shrink-0">
                    <FolderDown className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[14.5px] text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                      Exportar archivos de e-books (.epub, .pdf)
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      Copia todos los archivos limpios a una carpeta o memoria USB que tú elijas.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-accent)] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              {/* Web HTML Catalog */}
              <button
                disabled={isExporting || totalLibraryCount === 0}
                onClick={() => handleExportLibrary('html')}
                className="group p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] transition-all flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[10px] bg-amber-600/10 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[14.5px] text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                      Catálogo Web interactivo (HTML)
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      Galería visual autónoma con buscador en vivo de libros y autores.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              {/* CSV */}
              <button
                disabled={isExporting || totalLibraryCount === 0}
                onClick={() => handleExportLibrary('csv')}
                className="group p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] transition-all flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[10px] bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[14.5px] text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                      Inventario en hoja de cálculo (CSV)
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      Listado con títulos, formatos, tamaños en KB, páginas y fecha de adición.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              {/* JSON */}
              <button
                disabled={isExporting || totalLibraryCount === 0}
                onClick={() => handleExportLibrary('json')}
                className="group p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] transition-all flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[10px] bg-purple-600/10 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[14.5px] text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                      Copia de seguridad de biblioteca (JSON)
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      Registro completo de metadatos de biblioteca para respaldos.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-[var(--color-line)] bg-[var(--color-bg)]/30 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full font-bold text-[13px] border border-[var(--color-line)] hover:bg-[var(--color-line)]/40 text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
