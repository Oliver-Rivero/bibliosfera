import { useState } from 'react'
import { 
  X, 
  Settings, 
  Download, 
  Upload, 
  HardDrive, 
  FileSpreadsheet, 
  FileText, 
  Globe, 
  FolderDown, 
  Database, 
  Check, 
  BookOpen, 
  Library,
  FolderOpen
} from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'export' | 'import' | 'devices'
  selectedLibraryIds?: string[]
  totalReadingsCount: number
  totalLibraryCount: number
  onUploadBook?: () => void
  onReadingsUpdated?: () => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  initialTab = 'export',
  selectedLibraryIds = [],
  totalReadingsCount,
  totalLibraryCount,
  onUploadBook,
  onReadingsUpdated
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'devices'>(initialTab)
  const [exportSection, setExportSection] = useState<'readings' | 'library'>('readings')
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null)
  const [customDevicePath, setCustomDevicePath] = useState<string | null>(null)

  if (!isOpen) return null

  const handleExportReadings = async (format: 'csv' | 'markdown' | 'html' | 'json') => {
    setIsProcessing(true)
    setFeedback(null)
    try {
      const res = await window.api.exportReadings(format)
      if (res.success) {
        setFeedback({ success: true, message: res.message })
      } else if (res.message !== 'Exportación cancelada.') {
        setFeedback({ success: false, message: res.message })
      }
    } catch (e: any) {
      setFeedback({ success: false, message: e.message || 'Error al exportar' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportLibrary = async (format: 'csv' | 'html' | 'json' | 'files') => {
    setIsProcessing(true)
    setFeedback(null)
    try {
      const ids = selectedLibraryIds.length > 0 ? selectedLibraryIds : undefined
      const res = await window.api.exportLibrary(format, ids)
      if (res.success) {
        setFeedback({ success: true, message: res.message })
      } else if (res.message !== 'Exportación cancelada.') {
        setFeedback({ success: false, message: res.message })
      }
    } catch (e: any) {
      setFeedback({ success: false, message: e.message || 'Error al exportar' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleImportReadings = async () => {
    setIsProcessing(true)
    setFeedback(null)
    try {
      const res = await window.api.importReadingsJson()
      if (res.success) {
        setFeedback({ success: true, message: res.message })
        if (onReadingsUpdated) onReadingsUpdated()
      } else if (res.message !== 'Operación cancelada.') {
        setFeedback({ success: false, message: res.message })
      }
    } catch (e: any) {
      setFeedback({ success: false, message: e.message || 'Error al importar lecturas' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSelectDeviceFolder = async () => {
    try {
      const res = await window.api.selectCustomDeviceFolder()
      if (res.success && res.path) {
        setCustomDevicePath(res.path)
        setFeedback({ 
          success: true, 
          message: `Carpeta seleccionada para eReader / USB:\n${res.path}` 
        })
      }
    } catch (e: any) {
      setFeedback({ success: false, message: e.message || 'Error al seleccionar carpeta' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[26px] shadow-2xl w-full max-w-[640px] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-[var(--color-line)] flex items-center justify-between bg-[var(--color-bg)]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center">
              <Settings className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-[20px] font-bold font-['Bricolage_Grotesque'] text-[var(--color-ink)] leading-tight">
                Ajustes y Datos
              </h3>
              <p className="text-[12.5px] text-[var(--color-muted)]">
                Exportación, importación y gestión de datos de Bibliosfera
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--color-line)]/50 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            title="Cerrar ajustes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Tab Navigation */}
        <div className="flex border-b border-[var(--color-line)] px-6 pt-2 bg-[var(--color-bg)]/15">
          <button
            onClick={() => { setActiveTab('export'); setFeedback(null); }}
            className={`pb-3 px-3.5 font-bold text-[13px] border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'export'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Download className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Exportar datos</span>
          </button>

          <button
            onClick={() => { setActiveTab('import'); setFeedback(null); }}
            className={`pb-3 px-3.5 font-bold text-[13px] border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'import'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Upload className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Importar datos</span>
          </button>

          <button
            onClick={() => { setActiveTab('devices'); setFeedback(null); }}
            className={`pb-3 px-3.5 font-bold text-[13px] border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'devices'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>eReader / USB</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[68vh]">

          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-4 rounded-[14px] text-[13px] leading-relaxed flex items-start gap-3 border ${
              feedback.success 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800' 
                : 'bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-100 border-red-200 dark:border-red-800'
            }`}>
              {feedback.success ? (
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">
                  !
                </div>
              )}
              <div className="flex-1 whitespace-pre-wrap break-all">
                {feedback.message}
              </div>
            </div>
          )}

          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="flex flex-col gap-4">
              {/* Sub-selector: Mis lecturas vs Biblioteca digital */}
              <div className="flex p-1 bg-[var(--color-bg)] border border-[var(--color-line)] rounded-full self-start gap-1">
                <button
                  onClick={() => { setExportSection('readings'); setFeedback(null); }}
                  className={`py-1 px-4 rounded-full text-[12.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    exportSection === 'readings'
                      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-xs'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Mis lecturas ({totalReadingsCount})</span>
                </button>

                <button
                  onClick={() => { setExportSection('library'); setFeedback(null); }}
                  className={`py-1 px-4 rounded-full text-[12.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    exportSection === 'library'
                      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-xs'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  <Library className="w-3.5 h-3.5" />
                  <span>Biblioteca ({totalLibraryCount})</span>
                </button>
              </div>

              {exportSection === 'readings' ? (
                /* EXPORT READINGS CARDS */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* CSV */}
                  <button
                    onClick={() => handleExportReadings('csv')}
                    disabled={isProcessing || totalReadingsCount === 0}
                    className="p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[14px] text-[var(--color-ink)]">Hoja de cálculo (CSV)</h4>
                        <span className="text-[11px] text-[var(--color-muted)]">Excel, Numbers, Sheets</span>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed">
                      Compatible con tablas dinámicas. Incluye puntuaciones, fechas, páginas y géneros.
                    </p>
                  </button>

                  {/* Markdown */}
                  <button
                    onClick={() => handleExportReadings('markdown')}
                    disabled={isProcessing || totalReadingsCount === 0}
                    className="p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[14px] text-[var(--color-ink)]">Notas Markdown (.md)</h4>
                        <span className="text-[11px] text-[var(--color-muted)]">Obsidian, Notion, Logseq</span>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed">
                      Fichas editoriales con citas, sinopsis y notas personales en formato legible.
                    </p>
                  </button>

                  {/* HTML */}
                  <button
                    onClick={() => handleExportReadings('html')}
                    disabled={isProcessing || totalReadingsCount === 0}
                    className="p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[14px] text-[var(--color-ink)]">Página Web / Imprimible</h4>
                        <span className="text-[11px] text-[var(--color-muted)]">Archivo .html con estilo</span>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed">
                      Diseño cuidado listo para imprimir en PDF o guardar como informe estético.
                    </p>
                  </button>

                  {/* JSON */}
                  <button
                    onClick={() => handleExportReadings('json')}
                    disabled={isProcessing || totalReadingsCount === 0}
                    className="p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[14px] text-[var(--color-ink)]">Copia de seguridad (JSON)</h4>
                        <span className="text-[11px] text-[var(--color-muted)]">Estructurado y portable</span>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed">
                      Copia íntegra de la base de datos de lecturas. Ideal para transferir de ordenador.
                    </p>
                  </button>
                </div>
              ) : (
                /* EXPORT LIBRARY CARDS */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Extract Raw Files */}
                  <button
                    onClick={() => handleExportLibrary('files')}
                    disabled={isProcessing || totalLibraryCount === 0}
                    className="p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 flex items-center justify-center shrink-0">
                        <FolderDown className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[14px] text-[var(--color-ink)]">Extraer archivos e-books</h4>
                        <span className="text-[11px] text-[var(--color-muted)]">Copia archivos a una carpeta</span>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed">
                      Extrae todos los ficheros EPUB y PDF con nombres normalizados («Título - Autor»).
                    </p>
                  </button>

                  {/* HTML Catalog */}
                  <button
                    onClick={() => handleExportLibrary('html')}
                    disabled={isProcessing || totalLibraryCount === 0}
                    className="p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[14px] text-[var(--color-ink)]">Catálogo Web HTML</h4>
                        <span className="text-[11px] text-[var(--color-muted)]">Galería visual de biblioteca</span>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed">
                      Documento interactivo con portadas, formatos, pesos y metadatos de tu biblioteca.
                    </p>
                  </button>

                  {/* CSV Catalog */}
                  <button
                    onClick={() => handleExportLibrary('csv')}
                    disabled={isProcessing || totalLibraryCount === 0}
                    className="p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[14px] text-[var(--color-ink)]">Inventario CSV</h4>
                        <span className="text-[11px] text-[var(--color-muted)]">Excel, Numbers, Sheets</span>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed">
                      Listado en formato tabla con títulos, autores, formatos, tamaños y rutas locales.
                    </p>
                  </button>

                  {/* JSON Backup */}
                  <button
                    onClick={() => handleExportLibrary('json')}
                    disabled={isProcessing || totalLibraryCount === 0}
                    className="p-4 rounded-[16px] border border-[var(--color-line)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]/40 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[14px] text-[var(--color-ink)]">Copia completa (JSON)</h4>
                        <span className="text-[11px] text-[var(--color-muted)]">Base de datos íntegra</span>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed">
                      Estructura JSON con todos los metadatos y portadas registradas en la biblioteca.
                    </p>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
                    <Upload className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[15px] text-[var(--color-ink)] font-['Bricolage_Grotesque']">
                      Añadir libros a la biblioteca
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)] mt-0.5 leading-relaxed">
                      Sube archivos EPUB, PDF o MOBI. Detectaremos las portadas, autores y sinopsis automáticamente.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose()
                    if (onUploadBook) onUploadBook()
                  }}
                  className="bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold py-2.5 px-5 rounded-full text-[12.5px] hover:opacity-90 transition-opacity cursor-pointer shadow-xs shrink-0 inline-flex items-center justify-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Elegir e-books</span>
                </button>
              </div>

              <div className="p-4 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Database className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[15px] text-[var(--color-ink)] font-['Bricolage_Grotesque']">
                      Restaurar copia de Mis lecturas (JSON)
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)] mt-0.5 leading-relaxed">
                      Carga un archivo de respaldo JSON generado previamente en Bibliosfera para añadir las lecturas a tu lista.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleImportReadings}
                  disabled={isProcessing}
                  className="py-2.5 px-5 rounded-full border border-[var(--color-line)] hover:bg-[var(--color-bg)] text-[var(--color-ink)] font-bold text-[12.5px] transition-colors cursor-pointer shadow-xs shrink-0 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Importar JSON</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DEVICES (eReader / USB) */}
          {activeTab === 'devices' && (
            <div className="flex flex-col gap-4">
              <div className="p-5 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-surface)] flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 flex items-center justify-center shrink-0">
                    <HardDrive className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[16px] text-[var(--color-ink)] font-['Bricolage_Grotesque']">
                      Detección automática de eReader / USB
                    </h4>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      Transfiere libros directamente por cable sin sincronizaciones complejas.
                    </p>
                  </div>
                </div>

                <p className="text-[12.5px] text-[var(--color-muted)] leading-relaxed pt-1">
                  Cuando conectas tu lector eReader o cualquier memoria USB a tu ordenador, Bibliosfera detecta el volumen montado y te permite arrastrar libros al dock para copiarlos de forma instantánea.
                </p>

                {customDevicePath && (
                  <div className="p-3 rounded-[12px] bg-[var(--color-bg)] border border-[var(--color-line)] text-[12px] font-mono text-[var(--color-ink)] break-all mt-1">
                    Carpeta configurada: {customDevicePath}
                  </div>
                )}

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    onClick={handleSelectDeviceFolder}
                    className="py-2.5 px-5 rounded-full border border-[var(--color-line)] hover:bg-[var(--color-bg)] text-[var(--color-ink)] font-bold text-[12.5px] transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Seleccionar carpeta de eReader manualmente</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer with App Info & Author */}
        <div className="p-4 px-6 border-t border-[var(--color-line)] bg-[var(--color-bg)]/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[12.5px] text-[var(--color-muted)] flex flex-wrap items-center gap-2">
            <span className="font-bold text-[var(--color-ink)] font-['Bricolage_Grotesque'] tracking-tight">Bibliosfera</span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] font-medium text-[11px] text-[var(--color-ink)]">v1.0</span>
            <span>•</span>
            <span>Desarrollada por <strong className="text-[var(--color-ink)] font-semibold">Óliver Rivero</strong></span>
          </div>

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
