import { useState, useEffect } from 'react'
import {
  X,
  Download,
  Upload,
  HardDrive,
  FileSpreadsheet,
  FileText,
  FileCode,
  FolderOutput,
  FolderInput,
  FolderCog,
  FolderOpen,
  RotateCcw,
  BookOpen,
  Library,
  CheckCircle2,
  Usb,
  RefreshCw,
  AlertCircle,
  Palette,
  Sparkles,
  FileDown,
  Loader2,
  ExternalLink,
  Wifi
} from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: string
  selectedLibraryIds?: string[]
  totalReadingsCount: number
  totalLibraryCount: number
  onReadingsUpdated?: () => void
  onLibraryUpdated?: () => void
  onUploadBook?: () => Promise<void>
  activeColorMode?: 'light' | 'dark'
  onToggleColorMode?: () => void
  onOpenTour?: () => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  selectedLibraryIds,
  totalReadingsCount,
  totalLibraryCount,
  onReadingsUpdated,
  onLibraryUpdated,
  activeColorMode = 'light',
  onToggleColorMode,
  onOpenTour
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<'export_import' | 'themes' | 'device'>('export_import')
  const [exportSubTab, setExportSubTab] = useState<'library' | 'readings'>('library')
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  // Library Storage Folder state
  const [storageInfo, setStorageInfo] = useState<{
    path: string
    defaultPath: string
    isCustom: boolean
  }>({
    path: '',
    defaultPath: '',
    isCustom: false
  })

  // Theme state
  const [selectedTheme, setSelectedTheme] = useState<string>(() => {
    const t = localStorage.getItem('bibliosfera_app_theme') || 'clasico'
    return t === 'elegante' ? 'clasico' : t === 'exlibris' ? 'pergamino' : t
  })

  // Kindle Web store domain state
  const [kindleDomain, setKindleDomain] = useState<string>(() => {
    return localStorage.getItem('bibliosfera_kindle_domain') || 'amazon.es'
  })

  // eReader state
  const [connectedDevice, setConnectedDevice] = useState<{
    connected: boolean
    name: string
    volumePath: string
    targetFolder: string
  } | null>(null)
  const [checkingDevice, setCheckingDevice] = useState(false)

  const loadStorageInfo = async () => {
    try {
      if (typeof window.api?.getLibraryStorageDir === 'function') {
        const info = await window.api.getLibraryStorageDir()
        if (info) {
          setStorageInfo({
            path: info.path,
            defaultPath: info.defaultPath,
            isCustom: info.isCustom
          })
          if (info.themeName) {
            setSelectedTheme(info.themeName)
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const checkDevice = async () => {
    setCheckingDevice(true)
    try {
      const dev = await window.api.getConnectedDevice()
      const customFolder = localStorage.getItem('bibliosfera_custom_device_folder')
      if (dev && dev.connected) {
        setConnectedDevice(dev)
      } else if (customFolder) {
        setConnectedDevice({
          connected: true,
          name: 'Carpeta eReader vinculada',
          volumePath: customFolder,
          targetFolder: customFolder
        })
      } else {
        setConnectedDevice(null)
      }
    } catch {
      setConnectedDevice(null)
    } finally {
      setCheckingDevice(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setStatusMsg(null)
      loadStorageInfo()
      checkDevice()
    }
  }, [isOpen])

  if (!isOpen) return null

  // --- Library Storage & Import/Export Handlers ---
  const handleSelectStorageDir = async () => {
    setBusyAction('storage-select')
    setStatusMsg(null)
    try {
      const res = await window.api.selectLibraryStorageDir()
      if (res.success && res.path) {
        setStorageInfo(prev => ({
          ...prev,
          path: res.path!,
          isCustom: Boolean(res.isCustom)
        }))
        setStatusMsg({ type: 'success', text: res.message })
      } else if (res.message && res.message !== 'Operación cancelada.') {
        setStatusMsg({ type: 'error', text: res.message })
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e?.message || 'Error al cambiar la carpeta de almacenamiento.' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleResetStorageDir = async () => {
    setBusyAction('storage-reset')
    setStatusMsg(null)
    try {
      const res = await window.api.resetLibraryStorageDir()
      if (res.success && res.path) {
        setStorageInfo(prev => ({
          ...prev,
          path: res.path!,
          isCustom: false
        }))
        setStatusMsg({ type: 'success', text: res.message })
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e?.message || 'Error al restaurar la carpeta.' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleOpenStorageDir = async () => {
    await window.api.openLibraryStorageDir()
  }

  const handleImportLibraryFolder = async () => {
    setBusyAction('import-lib-folder')
    setStatusMsg({
      type: 'info',
      text: 'Analizando archivos de la carpeta y extrayendo metadatos, páginas, portadas y sinopsis... Esto puede tardar unos segundos.'
    })
    try {
      const res = await window.api.importLibraryFolder()
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message })
        if (onLibraryUpdated) onLibraryUpdated()
      } else if (res.message && res.message !== 'Importación cancelada.') {
        setStatusMsg({ type: 'error', text: res.message })
      } else {
        setStatusMsg(null)
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e?.message || 'Error al importar carpeta de biblioteca.' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleExportLibrary = async (format: 'json' | 'csv' | 'html' | 'files') => {
    setBusyAction(`lib-${format}`)
    setStatusMsg(null)
    try {
      const res = await window.api.exportLibrary(format, selectedLibraryIds)
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message })
      } else if (res.message && res.message !== 'Exportación cancelada.') {
        setStatusMsg({ type: 'error', text: res.message })
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e?.message || 'Error al exportar biblioteca.' })
    } finally {
      setBusyAction(null)
    }
  }

  // --- Readings Export & Import Handlers ---
  const handleExportReadings = async (format: 'excel' | 'pdf' | 'json' | 'csv' | 'markdown' | 'html') => {
    setBusyAction(`readings-${format}`)
    setStatusMsg(null)
    try {
      const res = await window.api.exportReadings(format)
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message })
      } else if (res.message && res.message !== 'Exportación cancelada.') {
        setStatusMsg({ type: 'error', text: res.message })
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e?.message || 'Error inesperado al exportar.' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleImportReadings = async (formatFilter: 'excel' | 'csv' | 'md' | 'json' | 'all') => {
    setBusyAction(`import-readings-${formatFilter}`)
    setStatusMsg({
      type: 'info',
      text: 'Importando títulos y buscando portadas e información complementaria...'
    })
    try {
      const res = await window.api.importReadings(formatFilter)
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message })
        if (onReadingsUpdated) onReadingsUpdated()
      } else if (res.message && res.message !== 'Operación cancelada.') {
        setStatusMsg({ type: 'error', text: res.message })
      } else {
        setStatusMsg(null)
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e?.message || 'Error al importar lecturas.' })
    } finally {
      setBusyAction(null)
    }
  }

  // --- Theme Selection Handler ---
  const handleSelectTheme = async (themeKey: string) => {
    setSelectedTheme(themeKey)
    localStorage.setItem('bibliosfera_app_theme', themeKey)
    document.documentElement.setAttribute('data-theme', themeKey)
    try {
      if (typeof window.api?.setAppTheme === 'function') {
        await window.api.setAppTheme(themeKey)
      }
    } catch {
      // ignore
    }
    const labels: Record<string, string> = {
      clasico: 'Clásico',
      elegante: 'Clásico',
      cactusito: 'Cactusito',
      pergamino: 'Pergamino',
      exlibris: 'Pergamino'
    }
    setStatusMsg({
      type: 'success',
      text: `Tema «${labels[themeKey] || themeKey}» aplicado correctamente.`
    })
  }

  // --- eReader Manual Folder Handlers ---
  const handleSelectCustomDeviceFolder = async () => {
    setStatusMsg(null)
    try {
      const res = await window.api.selectCustomDeviceFolder()
      if (res.success && res.device && res.path) {
        localStorage.setItem('bibliosfera_custom_device_folder', res.path)
        setConnectedDevice(res.device)
        setStatusMsg({
          type: 'success',
          text: `Carpeta de eReader configurada en: ${res.path}`
        })
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e?.message || 'No se pudo seleccionar la carpeta.' })
    }
  }

  const handleClearCustomDeviceFolder = () => {
    localStorage.removeItem('bibliosfera_custom_device_folder')
    checkDevice()
    setStatusMsg({ type: 'success', text: 'Se ha restablecido la detección automática de dispositivos USB.' })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[820px] max-h-[90vh] bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[22px] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--color-line)] flex items-center justify-between bg-[var(--color-bg)]/50">
          <div>
            <h2 className="font-bold text-lg font-['Bricolage_Grotesque'] tracking-tight text-[var(--color-ink)]">
              Ajustes de Bibliosfera
            </h2>
            <p className="text-[12.5px] text-[var(--color-muted)]">
              Almacenamiento, importación/exportación de Biblioteca y Mis lecturas, temas visuales y eReader
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            title="Cerrar ajustes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Section Switcher Tabs */}
        <div className="px-6 pt-3 border-b border-[var(--color-line)] flex gap-2 bg-[var(--color-bg)]/25 overflow-x-auto">
          <button
            onClick={() => {
              setActiveSection('export_import')
              setStatusMsg(null)
            }}
            className={`px-4 py-2.5 text-[13px] font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSection === 'export_import'
                ? 'border-[var(--color-accent)] text-[var(--color-ink)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Exportar / Importar</span>
          </button>

          <button
            onClick={() => {
              setActiveSection('themes')
              setStatusMsg(null)
            }}
            className={`px-4 py-2.5 text-[13px] font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSection === 'themes'
                ? 'border-[var(--color-accent)] text-[var(--color-ink)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Temas</span>
          </button>

          <button
            onClick={() => {
              setActiveSection('device')
              setStatusMsg(null)
            }}
            className={`px-4 py-2.5 text-[13px] font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSection === 'device'
                ? 'border-[var(--color-accent)] text-[var(--color-ink)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Usb className="w-4 h-4" />
            <span>eReader / USB</span>
            {connectedDevice?.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 flex-1">
          {/* Status Banner */}
          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl border text-[13px] flex items-start gap-2.5 whitespace-pre-line ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : statusMsg.type === 'info'
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : statusMsg.type === 'info' ? (
                <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="flex-1">{statusMsg.text}</span>
            </div>
          )}

          {/* =========================================================
              TAB 1: EXPORTAR / IMPORTAR
             ========================================================= */}
          {activeSection === 'export_import' && (
            <div className="flex flex-col gap-5">
              {/* Sub-switcher between Biblioteca and Mis Lecturas */}
              <div className="flex items-center justify-between flex-wrap gap-3 bg-[var(--color-bg)]/60 p-1.5 rounded-2xl border border-[var(--color-line)]">
                <div className="flex items-center gap-1.5 flex-1">
                  <button
                    onClick={() => {
                      setExportSubTab('library')
                      setStatusMsg(null)
                    }}
                    className={`flex-1 py-2 px-4 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      exportSubTab === 'library'
                        ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-xs'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    <Library className="w-4 h-4" />
                    <span>Biblioteca digital</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        exportSubTab === 'library' ? 'bg-white/20' : 'bg-[var(--color-surface)]'
                      }`}
                    >
                      {totalLibraryCount}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setExportSubTab('readings')
                      setStatusMsg(null)
                    }}
                    className={`flex-1 py-2 px-4 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      exportSubTab === 'readings'
                        ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-xs'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Mis lecturas</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        exportSubTab === 'readings' ? 'bg-white/20' : 'bg-[var(--color-surface)]'
                      }`}
                    >
                      {totalReadingsCount}
                    </span>
                  </button>
                </div>
              </div>

              {/* ---------------------------------------------------------
                  SUB-TAB A: BIBLIOTECA DIGITAL
                 --------------------------------------------------------- */}
              {exportSubTab === 'library' && (
                <div className="flex flex-col gap-5">
                  {/* 1. Elegir carpeta de almacenamiento */}
                  <div className="p-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)]/35 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                          <FolderCog className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-[14.5px] text-[var(--color-ink)]">
                              Carpeta de almacenamiento de la Biblioteca
                            </h3>
                            <span
                              className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                                storageInfo.isCustom
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                                  : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-line)]'
                              }`}
                            >
                              {storageInfo.isCustom ? 'Personalizada' : 'Predeterminada'}
                            </span>
                          </div>
                          <p className="text-[12px] text-[var(--color-muted)]">
                            Ubicación física donde Bibliosfera guarda los archivos de tus libros electrónicos
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] flex items-center justify-between gap-2">
                      <code className="text-[12px] text-[var(--color-ink)] truncate flex-1 font-mono">
                        {storageInfo.path || 'Cargando ruta...'}
                      </code>
                      <button
                        onClick={handleOpenStorageDir}
                        className="text-[11.5px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                        title="Abrir carpeta en el Finder"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Abrir en Finder</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={handleSelectStorageDir}
                        disabled={busyAction !== null}
                        className="py-2 px-4 rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-95 font-bold text-[12.5px] flex items-center gap-2 transition-opacity cursor-pointer disabled:opacity-50"
                      >
                        <FolderCog className="w-4 h-4" />
                        <span>
                          {busyAction === 'storage-select'
                            ? 'Cambiando carpeta...'
                            : 'Elegir carpeta de almacenamiento'}
                        </span>
                      </button>

                      {storageInfo.isCustom && (
                        <button
                          onClick={handleResetStorageDir}
                          disabled={busyAction !== null}
                          className="py-2 px-3.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-ink)] font-semibold text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restaurar ubicación original</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. Exportar e Importar carpeta de Biblioteca */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Exportar carpeta de biblioteca */}
                    <div className="p-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)]/35 flex flex-col justify-between gap-3.5">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] shrink-0">
                          <FolderOutput className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[14px] text-[var(--color-ink)]">
                            Exportar carpeta de biblioteca
                          </h4>
                          <p className="text-[12px] text-[var(--color-muted)] mt-1 leading-relaxed">
                            Exporta todos los archivos de tu biblioteca ({totalLibraryCount} libros) con nombres limpios (<em>Título - Autor</em>) a cualquier carpeta o disco externo.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleExportLibrary('files')}
                        disabled={busyAction !== null}
                        className="w-full py-2.5 px-4 rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)] hover:text-[var(--color-on-accent)] text-[var(--color-ink)] font-bold text-[12.5px] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <FolderOutput className="w-4 h-4" />
                        <span>
                          {busyAction === 'lib-files'
                            ? 'Exportando biblioteca...'
                            : 'Exportar carpeta a donde desees'}
                        </span>
                      </button>
                    </div>

                    {/* Importar carpeta con archivos a modo de biblioteca */}
                    <div className="p-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)]/35 flex flex-col justify-between gap-3.5">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                          <FolderInput className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[14px] text-[var(--color-ink)]">
                            Importar carpeta como biblioteca
                          </h4>
                          <p className="text-[12px] text-[var(--color-muted)] mt-1 leading-relaxed">
                            Selecciona una carpeta con libros (EPUB, PDF, MOBI, AZW3...). Se analizarán automáticamente para extraer título, autor, páginas, portada y sinopsis.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleImportLibraryFolder}
                        disabled={busyAction !== null}
                        className="w-full py-2.5 px-4 rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-95 font-bold text-[12.5px] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {busyAction === 'import-lib-folder' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Analizando e importando carpeta...</span>
                          </>
                        ) : (
                          <>
                            <FolderInput className="w-4 h-4" />
                            <span>Seleccionar carpeta y analizar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 3. Exportar catálogo de la biblioteca (HTML / CSV / JSON) */}
                  <div className="p-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-[13px] text-[var(--color-ink)]">
                        Exportar catálogo de la Biblioteca
                      </h4>
                      <p className="text-[11.5px] text-[var(--color-muted)]">
                        Guarda un listado o catálogo visual interactivo de los libros de tu biblioteca
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleExportLibrary('html')}
                        disabled={busyAction !== null}
                        className="py-1.5 px-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] text-[12px] font-bold text-[var(--color-ink)] cursor-pointer transition-colors"
                      >
                        Catálogo Web (.html)
                      </button>
                      <button
                        onClick={() => handleExportLibrary('csv')}
                        disabled={busyAction !== null}
                        className="py-1.5 px-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] text-[12px] font-bold text-[var(--color-ink)] cursor-pointer transition-colors"
                      >
                        Listado CSV (.csv)
                      </button>
                      <button
                        onClick={() => handleExportLibrary('json')}
                        disabled={busyAction !== null}
                        className="py-1.5 px-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] text-[12px] font-bold text-[var(--color-ink)] cursor-pointer transition-colors"
                      >
                        JSON (.json)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------------
                  SUB-TAB B: MIS LECTURAS
                 --------------------------------------------------------- */}
              {exportSubTab === 'readings' && (
                <div className="flex flex-col gap-5">
                  {/* 1. Exportar Mis Lecturas (Excel, PDF, CSV, Markdown, JSON) */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="font-bold text-[14.5px] text-[var(--color-ink)] flex items-center gap-2">
                        <Download className="w-4 h-4 text-[var(--color-accent)]" />
                        <span>Exportar títulos de Mis lecturas ({totalReadingsCount} libros)</span>
                      </h3>
                      <p className="text-[12px] text-[var(--color-muted)]">
                        Descarga tu historial de lecturas con valoraciones, fechas, páginas, sinopsis y opiniones personales
                      </p>
                    </div>

                    {/* Featured Exports: Excel & PDF */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => handleExportReadings('excel')}
                        disabled={busyAction !== null}
                        className="p-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)]/40 hover:border-[var(--color-accent)] hover:bg-[var(--color-bg)] transition-all text-left flex items-start gap-3.5 cursor-pointer group"
                      >
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-[14px] text-[var(--color-ink)] flex items-center justify-between">
                            <span>Exportar en Excel (.xlsx)</span>
                            {busyAction === 'readings-excel' && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-accent)]" />
                            )}
                          </div>
                          <p className="text-[12px] text-[var(--color-muted)] mt-0.5 leading-snug">
                            Libro nativo de Microsoft Excel / Numbers con columnas formateadas y encabezados estilizados.
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => handleExportReadings('pdf')}
                        disabled={busyAction !== null}
                        className="p-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)]/40 hover:border-[var(--color-accent)] hover:bg-[var(--color-bg)] transition-all text-left flex items-start gap-3.5 cursor-pointer group"
                      >
                        <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                          <FileDown className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-[14px] text-[var(--color-ink)] flex items-center justify-between">
                            <span>Exportar en PDF (.pdf)</span>
                            {busyAction === 'readings-pdf' && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-accent)]" />
                            )}
                          </div>
                          <p className="text-[12px] text-[var(--color-muted)] mt-0.5 leading-snug">
                            Documento PDF maquetado con estadísticas globales, fichas de lectura, estrellas y notas.
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Additional Export Formats: CSV, Markdown, JSON */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        onClick={() => handleExportReadings('csv')}
                        disabled={busyAction !== null}
                        className="p-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/25 hover:border-[var(--color-accent)] transition-all text-left flex items-center gap-2.5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                        <div>
                          <div className="font-bold text-[12.5px] text-[var(--color-ink)]">CSV (.csv)</div>
                          <div className="text-[11px] text-[var(--color-muted)]">Tabla universal</div>
                        </div>
                      </button>

                      <button
                        onClick={() => handleExportReadings('markdown')}
                        disabled={busyAction !== null}
                        className="p-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/25 hover:border-[var(--color-accent)] transition-all text-left flex items-center gap-2.5 cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                        <div>
                          <div className="font-bold text-[12.5px] text-[var(--color-ink)]">Markdown (.md)</div>
                          <div className="text-[11px] text-[var(--color-muted)]">Obsidian / Notion</div>
                        </div>
                      </button>

                      <button
                        onClick={() => handleExportReadings('json')}
                        disabled={busyAction !== null}
                        className="p-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/25 hover:border-[var(--color-accent)] transition-all text-left flex items-center gap-2.5 cursor-pointer"
                      >
                        <FileCode className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                        <div>
                          <div className="font-bold text-[12.5px] text-[var(--color-ink)]">JSON (.json)</div>
                          <div className="text-[11px] text-[var(--color-muted)]">Copia completa</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* 2. Importar Mis Lecturas (Excel, CSV, Markdown, JSON) */}
                  <div className="p-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)]/35 flex flex-col gap-3.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="font-bold text-[14.5px] text-[var(--color-ink)] flex items-center gap-2">
                          <Upload className="w-4 h-4 text-[var(--color-accent)]" />
                          <span>Importar lecturas desde archivo</span>
                        </h3>
                        <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                          Importa títulos desde archivos <strong>Excel (.xlsx, .xls)</strong>, <strong>CSV (.csv)</strong>, <strong>Markdown (.md)</strong> o <strong>JSON</strong>. Bibliosfera completará automáticamente las portadas y datos que falten.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        onClick={() => handleImportReadings('excel')}
                        disabled={busyAction !== null}
                        className="p-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-bold text-[12.5px] text-[var(--color-ink)]">Importar Excel</span>
                        <span className="text-[10.5px] text-[var(--color-muted)]">.xlsx / .xls</span>
                      </button>

                      <button
                        onClick={() => handleImportReadings('csv')}
                        disabled={busyAction !== null}
                        className="p-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <FileSpreadsheet className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                        <span className="font-bold text-[12.5px] text-[var(--color-ink)]">Importar CSV</span>
                        <span className="text-[10.5px] text-[var(--color-muted)]">.csv</span>
                      </button>

                      <button
                        onClick={() => handleImportReadings('md')}
                        disabled={busyAction !== null}
                        className="p-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        <span className="font-bold text-[12.5px] text-[var(--color-ink)]">Importar Markdown</span>
                        <span className="text-[10.5px] text-[var(--color-muted)]">.md</span>
                      </button>

                      <button
                        onClick={() => handleImportReadings('json')}
                        disabled={busyAction !== null}
                        className="p-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <FileCode className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <span className="font-bold text-[12.5px] text-[var(--color-ink)]">Importar JSON</span>
                        <span className="text-[10.5px] text-[var(--color-muted)]">.json</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 2: TEMAS
             ========================================================= */}
          {activeSection === 'themes' && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="font-bold text-[15px] text-[var(--color-ink)] flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[var(--color-accent)]" />
                  <span>Aspecto y temas de la aplicación</span>
                </h3>
                <p className="text-[12.5px] text-[var(--color-muted)] mt-0.5">
                  Elige el estilo visual de Bibliosfera. Cada tema define la paleta cromática, el carácter tipográfico y el acabado de las tarjetas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Tema 1: Clásico */}
                <div
                  onClick={() => handleSelectTheme('clasico')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                    selectedTheme === 'clasico' || selectedTheme === 'elegante'
                      ? 'border-[var(--color-accent)] bg-[var(--color-bg)]/60 shadow-sm'
                      : 'border-[var(--color-line)] bg-[var(--color-bg)]/25 hover:border-[var(--color-accent)]/50'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Swatch preview */}
                    <div className="h-20 rounded-xl border border-[#d9c8bf] overflow-hidden flex flex-col justify-between p-2.5 bg-[#EEE0D9]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-[#EEE0D9] border border-black/20" title="#EEE0D9" />
                          <span className="w-4 h-4 rounded-full bg-[#285666] border border-white/20" title="#285666" />
                          <span className="w-4 h-4 rounded-full bg-[#663A24] border border-white/20" title="#663A24" />
                          <span className="w-4 h-4 rounded-full bg-[#C3DDE6] border border-black/15" title="#C3DDE6" />
                        </div>
                        {(selectedTheme === 'clasico' || selectedTheme === 'elegante') && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#285666] text-[#EEE0D9]">
                            Activo
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold font-['Bricolage_Grotesque'] text-[#2A1C14]">
                        Aa • Editorial Clásico
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-[14.5px] text-[var(--color-ink)]">Clásico</h4>
                        {(selectedTheme === 'clasico' || selectedTheme === 'elegante') && (
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)]" />
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--color-muted)] mt-1 leading-relaxed">
                        Estética editorial clásica y serena en tonos papel crema, azul petróleo y cuero, con modo claro y oscuro.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleSelectTheme('clasico')
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-[12px] font-bold transition-colors cursor-pointer ${
                      selectedTheme === 'clasico' || selectedTheme === 'elegante'
                        ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                        : 'border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[var(--color-ink)]'
                    }`}
                  >
                    {selectedTheme === 'clasico' || selectedTheme === 'elegante' ? 'Tema seleccionado' : 'Aplicar tema «Clásico»'}
                  </button>
                </div>

                {/* Tema 2: Cactusito (#FFF2F1, #A7EEC2, #FFAFF5, #481C58) */}
                <div
                  onClick={() => handleSelectTheme('cactusito')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                    selectedTheme === 'cactusito'
                      ? 'border-[var(--color-accent)] bg-[var(--color-bg)]/60 shadow-sm'
                      : 'border-[var(--color-line)] bg-[var(--color-bg)]/25 hover:border-[var(--color-accent)]/50'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Swatch preview */}
                    <div className="h-20 rounded-xl border border-[#F3C6EC] overflow-hidden flex flex-col justify-between p-2.5 bg-[#FFF2F1]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-[#FFF2F1] border border-[#481C58]/25" title="Fondo #FFF2F1" />
                          <span className="w-4 h-4 rounded-full bg-[#A7EEC2] border border-[#481C58]/20" title="#A7EEC2" />
                          <span className="w-4 h-4 rounded-full bg-[#FFAFF5] border border-[#481C58]/20" title="#FFAFF5" />
                          <span className="w-4 h-4 rounded-full bg-[#481C58] border border-white/20" title="#481C58" />
                        </div>
                        {selectedTheme === 'cactusito' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#481C58] text-[#A7EEC2]">
                            Activo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold font-['Bricolage_Grotesque'] text-[#481C58]">
                          Aa • Cactus & Flor
                        </span>
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-[#FFAFF5] text-[#481C58]">
                          #A7EEC2 • #FFAFF5
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-[14.5px] text-[var(--color-ink)]">Cactusito</h4>
                        {selectedTheme === 'cactusito' && (
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)]" />
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--color-muted)] mt-1 leading-relaxed">
                        Paleta fresca y botánica sobre fondo crema rosado (<code>#FFF2F1</code>) con verde menta (<code>#A7EEC2</code>), rosa flor (<code>#FFAFF5</code>) y ciruela profundo (<code>#481C58</code>).
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleSelectTheme('cactusito')
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-[12px] font-bold transition-colors cursor-pointer ${
                      selectedTheme === 'cactusito'
                        ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                        : 'border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[var(--color-ink)]'
                    }`}
                  >
                    {selectedTheme === 'cactusito' ? 'Tema seleccionado' : 'Aplicar tema «Cactusito»'}
                  </button>
                </div>

                {/* Tema 3: Pergamino (#F4F1EA, #1E3F32, #D5E2DA, #C88A36) */}
                <div
                  onClick={() => handleSelectTheme('pergamino')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                    selectedTheme === 'pergamino' || selectedTheme === 'exlibris'
                      ? 'border-[var(--color-accent)] bg-[var(--color-bg)]/60 shadow-sm'
                      : 'border-[var(--color-line)] bg-[var(--color-bg)]/25 hover:border-[var(--color-accent)]/50'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Swatch preview */}
                    <div className="h-20 rounded-xl border border-[#D4CFC3] overflow-hidden flex flex-col justify-between p-2.5 bg-[#F4F1EA]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-[#F4F1EA] border border-[#1E3F32]/25" title="Fondo #F4F1EA" />
                          <span className="w-4 h-4 rounded-full bg-[#1E3F32] border border-white/20" title="#1E3F32" />
                          <span className="w-4 h-4 rounded-full bg-[#D5E2DA] border border-[#1E3F32]/20" title="#D5E2DA" />
                          <span className="w-4 h-4 rounded-full bg-[#C88A36] border border-white/20" title="#C88A36" />
                        </div>
                        {(selectedTheme === 'pergamino' || selectedTheme === 'exlibris') && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E3F32] text-[#F4F1EA]">
                            Activo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold font-['Bricolage_Grotesque'] text-[#182921]">
                          Aa • Pergamino & Biblioteca
                        </span>
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-[#D5E2DA] text-[#1E3F32]">
                          #1E3F32 • #C88A36
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-[14.5px] text-[var(--color-ink)]">Pergamino</h4>
                        {(selectedTheme === 'pergamino' || selectedTheme === 'exlibris') && (
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)]" />
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--color-muted)] mt-1 leading-relaxed">
                        Inspirado en el papel pergamino y salas de lectura: lino cálido (<code>#F4F1EA</code>), verde biblioteca (<code>#1E3F32</code>), salvia suave (<code>#D5E2DA</code>) y latón antiguo (<code>#C88A36</code>).
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleSelectTheme('pergamino')
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-[12px] font-bold transition-colors cursor-pointer ${
                      selectedTheme === 'pergamino' || selectedTheme === 'exlibris'
                        ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                        : 'border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[var(--color-ink)]'
                    }`}
                  >
                    {selectedTheme === 'pergamino' || selectedTheme === 'exlibris' ? 'Tema seleccionado' : 'Aplicar tema «Pergamino»'}
                  </button>
                </div>
              </div>

              {onToggleColorMode && (
                <div className="p-3.5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)]/35 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[12.5px] text-[var(--color-muted)]">
                    Todos los temas son compatibles con <strong>modo Claro</strong> y <strong>modo Oscuro</strong>:
                  </span>
                  <button
                    onClick={onToggleColorMode}
                    className="py-1.5 px-3.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[12px] font-bold text-[var(--color-ink)] transition-colors cursor-pointer"
                  >
                    Modo actual: {activeColorMode === 'dark' ? 'Oscuro (Cambiar a Claro)' : 'Claro (Cambiar a Oscuro)'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 3: EREADER / USB
             ========================================================= */}
          {activeSection === 'device' && (
            <div className="flex flex-col gap-5">
              <div className="p-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)]/40 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl ${
                        connectedDevice?.connected
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
                      }`}
                    >
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[14px] text-[var(--color-ink)]">
                        {connectedDevice?.connected
                          ? `Conectado: ${connectedDevice.name}`
                          : 'Ningún eReader detectado automáticamente'}
                      </h4>
                      <p className="text-[12px] text-[var(--color-muted)]">
                        {connectedDevice?.connected
                          ? `Carpeta de destino: ${connectedDevice.targetFolder}`
                          : 'Conecta tu Kindle, Kobo, PocketBook, Tolino o memoria USB a tu Mac'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={checkDevice}
                    disabled={checkingDevice}
                    className="p-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[var(--color-ink)] cursor-pointer"
                    title="Volver a escanear puertos USB"
                  >
                    <RefreshCw className={`w-4 h-4 ${checkingDevice ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="font-bold text-[13.5px] text-[var(--color-ink)]">
                  Vincular carpeta de eReader o unidad USB manualmente
                </h4>
                <p className="text-[12.5px] text-[var(--color-muted)] leading-relaxed">
                  Si tu dispositivo de lectura usa un nombre personalizado o prefieres enviar tus libros a una carpeta sincronizada, puedes elegirla manualmente:
                </p>
                <div className="flex flex-wrap gap-2.5 mt-2">
                  <button
                    onClick={handleSelectCustomDeviceFolder}
                    className="py-2.5 px-4 rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold text-[12.5px] hover:opacity-95 transition-opacity cursor-pointer flex items-center gap-2"
                  >
                    <FolderOutput className="w-4 h-4" />
                    <span>Elegir carpeta de destino...</span>
                  </button>

                  {localStorage.getItem('bibliosfera_custom_device_folder') && (
                    <button
                      onClick={handleClearCustomDeviceFolder}
                      className="py-2.5 px-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)] font-semibold text-[12.5px] transition-colors cursor-pointer"
                    >
                      Restablecer detección automática
                    </button>
                  )}
                </div>
              </div>

              {/* Kindle Wireless / Send to Kindle Card */}
              <div className="p-4 rounded-2xl border border-[var(--color-line)] bg-amber-500/5 dark:bg-amber-950/15 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <Wifi className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[14px] text-[var(--color-ink)] flex items-center gap-2">
                        <span>Amazon Kindle • Transferencia inalámbrica</span>
                        <span className="text-[10.5px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          Sin cables USB
                        </span>
                      </h4>
                      <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                        Sube libros directamente a tu Kindle a través de la web oficial de Amazon (hasta 200 MB por libro en formato EPUB, PDF o MOBI).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-[12.5px] text-[var(--color-muted)] leading-relaxed bg-[var(--color-surface)]/60 border border-[var(--color-line)]/70 rounded-xl p-3">
                  <span className="font-semibold text-[var(--color-ink)]">¿Cómo funciona en Bibliosfera?</span> Al pulsar <strong>«Subir a Kindle (Web)»</strong> en cualquier libro o lote de libros, la aplicación abre automáticamente la web oficial de Amazon Send to Kindle y te selecciona el archivo en tu Finder / Explorador para que solo tengas que arrastrarlo a la página.
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2.5 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[var(--color-muted)] font-medium">Tienda de Amazon:</span>
                    <select
                      value={kindleDomain}
                      onChange={(e) => {
                        const val = e.target.value
                        setKindleDomain(val)
                        localStorage.setItem('bibliosfera_kindle_domain', val)
                        setStatusMsg({
                          type: 'success',
                          text: `Dominio de Kindle configurado en https://www.${val}/sendtokindle`
                        })
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] text-[12px] font-semibold text-[var(--color-ink)] cursor-pointer"
                    >
                      <option value="amazon.es">Amazon España (amazon.es)</option>
                      <option value="amazon.com">Amazon Internacional (amazon.com)</option>
                      <option value="amazon.com.mx">Amazon México (amazon.com.mx)</option>
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      if (typeof window.api?.openSendToKindleWeb === 'function') {
                        window.api.openSendToKindleWeb(kindleDomain)
                      }
                    }}
                    className="py-1.5 px-3.5 rounded-xl border border-amber-600/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-[12px] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Send to Kindle Web</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--color-line)] bg-[var(--color-bg)]/40 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-[var(--color-muted)]">
              Bibliosfera • v1.1 desarrollado por Óliver Rivero ©
            </span>
            {onOpenTour && (
              <button
                onClick={onOpenTour}
                className="text-[11.5px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ver tour de bienvenida</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-bg)] text-[12.5px] font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
