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
  Wifi,
  Users,
  UserPlus,
  Trash2,
  Edit2,
  Check
} from 'lucide-react'
import { UserProfile } from '../types'

const USER_AVATARS = ['📚', '☕', '🦊', '🦉', '✨', '🌿', '🚀', '🐱', '🖋️', '🎨', '🧭', '🎧', '🏰', '📖', '🧙', '👑']

const USER_COLORS = [
  { name: 'Petróleo', hex: '#285666' },
  { name: 'Ciruela', hex: '#481C58' },
  { name: 'Bosque', hex: '#1E3F32' },
  { name: 'Latón', hex: '#C88A36' },
  { name: 'Terracota', hex: '#C2410C' },
  { name: 'Océano', hex: '#0284C7' },
  { name: 'Lavanda', hex: '#7C3AED' },
  { name: 'Rosa flor', hex: '#DB2777' }
]

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'export_import' | 'export' | 'themes' | 'device' | 'users' | string
  selectedLibraryIds?: string[]
  totalReadingsCount: number
  totalLibraryCount: number
  currentUser?: UserProfile | null
  onSwitchUser?: (userId: string) => Promise<void>
  onUserListUpdated?: () => void
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
  initialTab,
  selectedLibraryIds,
  totalReadingsCount,
  totalLibraryCount,
  currentUser,
  onSwitchUser,
  onUserListUpdated,
  onReadingsUpdated,
  onLibraryUpdated,
  activeColorMode = 'light',
  onToggleColorMode,
  onOpenTour
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<'export_import' | 'themes' | 'device' | 'users'>(() => {
    if (initialTab === 'export') return 'export_import'
    if (initialTab === 'themes' || initialTab === 'device' || initialTab === 'users' || initialTab === 'export_import') return initialTab
    return 'export_import'
  })
  const [exportSubTab, setExportSubTab] = useState<'library' | 'readings'>('library')
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  // Users state
  const [users, setUsers] = useState<UserProfile[]>([])
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null)
  const [userForm, setUserForm] = useState<{
    name: string
    avatar: string
    color: string
    themeName: 'clasico' | 'cactusito' | 'pergamino'
    colorMode: 'light' | 'dark'
    viewMode: 'list' | 'shelf' | 'spines'
    bio: string
    copyBooksFromUserId?: string
  }>({
    name: '',
    avatar: '📚',
    color: '#285666',
    themeName: 'clasico',
    colorMode: 'light',
    viewMode: 'list',
    bio: '',
    copyBooksFromUserId: ''
  })

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

  const loadUsers = async () => {
    try {
      if (typeof window.api?.getUsers === 'function') {
        const u = await window.api.getUsers()
        if (Array.isArray(u)) {
          setUsers(u)
        }
      }
    } catch (e) {
      console.error('Error cargando usuarios:', e)
    }
  }

  const handleOpenAddUser = () => {
    setEditingUser(null)
    setUserForm({
      name: '',
      avatar: '📚',
      color: '#285666',
      themeName: 'clasico',
      colorMode: 'light',
      viewMode: 'list',
      bio: '',
      copyBooksFromUserId: ''
    })
    setShowUserModal(true)
  }

  const handleOpenEditUser = (u: UserProfile) => {
    setEditingUser(u)
    setUserForm({
      name: u.name,
      avatar: u.avatar || '📚',
      color: u.color || '#285666',
      themeName: (u.themeName as any) || 'clasico',
      colorMode: u.colorMode || 'light',
      viewMode: u.viewMode || 'list',
      bio: u.bio || '',
      copyBooksFromUserId: ''
    })
    setShowUserModal(true)
  }

  const handleSaveUser = async () => {
    if (!userForm.name.trim()) {
      setStatusMsg({ type: 'error', text: 'El nombre de usuario no puede estar vacío.' })
      return
    }
    setBusyAction('save-user')
    try {
      if (editingUser) {
        const res = await window.api.updateUser(editingUser.id, {
          name: userForm.name.trim(),
          avatar: userForm.avatar,
          color: userForm.color,
          themeName: userForm.themeName,
          colorMode: userForm.colorMode,
          viewMode: userForm.viewMode,
          bio: userForm.bio.trim()
        })
        if (res && res.users) {
          setUsers(res.users)
          if (currentUser?.id === editingUser.id && onSwitchUser) {
            await onSwitchUser(editingUser.id)
          }
        }
        setShowUserModal(false)
        setStatusMsg({ type: 'success', text: `Perfil de "${userForm.name}" actualizado con éxito.` })
      } else {
        const res = await window.api.addUser({
          name: userForm.name.trim(),
          avatar: userForm.avatar,
          color: userForm.color,
          themeName: userForm.themeName,
          colorMode: userForm.colorMode,
          viewMode: userForm.viewMode,
          bio: userForm.bio.trim()
        }, {
          copyBooksFromUserId: userForm.copyBooksFromUserId || undefined
        })
        if (res && res.users) {
          setUsers(res.users)
          if (res.user && onSwitchUser) {
            await onSwitchUser(res.user.id)
          }
        }
        setShowUserModal(false)
        setStatusMsg({ type: 'success', text: `Nuevo perfil "${userForm.name}" añadido a la biblioteca.` })
      }
      if (onUserListUpdated) onUserListUpdated()
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Error guardando usuario.' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleDeleteUser = async (u: UserProfile) => {
    if (users.length <= 1) {
      setStatusMsg({ type: 'error', text: 'No puedes eliminar el único perfil de usuario existente.' })
      setDeletingUser(null)
      return
    }
    setBusyAction('delete-user')
    try {
      const res = await window.api.deleteUser(u.id)
      if (res && res.success) {
        setUsers(res.users)
        if (res.newActiveUserId && onSwitchUser) {
          await onSwitchUser(res.newActiveUserId)
        }
        setStatusMsg({ type: 'success', text: `El perfil "${u.name}" ha sido eliminado.` })
      } else {
        setStatusMsg({ type: 'error', text: res?.message || 'No se pudo eliminar el usuario.' })
      }
      if (onUserListUpdated) onUserListUpdated()
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Error eliminando usuario.' })
    } finally {
      setBusyAction(null)
      setDeletingUser(null)
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveSection(initialTab === 'export' ? 'export_import' : (initialTab as any))
      }
      setStatusMsg(null)
      loadStorageInfo()
      checkDevice()
      loadUsers()
    }
  }, [isOpen, initialTab])

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
      if (currentUser?.id && typeof window.api?.updateUser === 'function') {
        await window.api.updateUser(currentUser.id, { themeName: themeKey })
        if (onUserListUpdated) onUserListUpdated()
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

          <button
            onClick={() => {
              setActiveSection('users')
              setStatusMsg(null)
            }}
            className={`px-4 py-2.5 text-[13px] font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSection === 'users'
                ? 'border-[var(--color-accent)] text-[var(--color-ink)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuarios</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[var(--color-chip)] text-[var(--color-ink)] font-bold">
              {users.length}
            </span>
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

          {/* =========================================================
              TAB 4: USUARIOS Y BIBLIOTECAS PERSONALIZADAS
             ========================================================= */}
          {activeSection === 'users' && (
            <div className="flex flex-col gap-6">
              {/* Header bar */}
              <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-[var(--color-line)]">
                <div>
                  <h3 className="font-bold text-[16px] text-[var(--color-ink)] flex items-center gap-2">
                    <Users className="w-5 h-5 text-[var(--color-accent)]" />
                    <span>Gestión de usuarios y bibliotecas</span>
                  </h3>
                  <p className="text-[12.5px] text-[var(--color-muted)] mt-1 max-w-xl leading-relaxed">
                    Añade perfiles para otros lectores del hogar o crea espacios temáticos separados. Cada usuario dispone de su propia colección de libros, historial de lecturas, valoraciones y configuración visual individual.
                  </p>
                </div>
                <button
                  onClick={handleOpenAddUser}
                  className="py-2.5 px-4 rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold text-[13px] flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shadow-xs shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Añadir nuevo usuario</span>
                </button>
              </div>

              {/* Users Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {users.map(u => {
                  const isActive = (currentUser?.id || 'default') === u.id
                  return (
                    <div
                      key={u.id}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 ${
                        isActive
                          ? 'border-[var(--color-accent)] bg-[var(--color-bg)]/60 shadow-sm'
                          : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className="w-13 h-13 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-2xs select-none"
                          style={{
                            backgroundColor: `${u.color || '#285666'}20`,
                            border: `2px solid ${u.color || '#285666'}`
                          }}
                        >
                          {u.avatar || '📚'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-[15.5px] text-[var(--color-ink)] truncate">{u.name}</h4>
                            {isActive && (
                              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                Activo
                              </span>
                            )}
                          </div>

                          {u.bio && (
                            <p className="text-[12px] text-[var(--color-muted)] mt-1 italic line-clamp-2">
                              «{u.bio}»
                            </p>
                          )}

                          {/* Preference badges */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)] capitalize font-medium">
                              🎨 Tema {u.themeName === 'cactusito' ? 'Cactusito' : u.themeName === 'pergamino' ? 'Pergamino' : 'Clásico'}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)] capitalize font-medium">
                              {u.colorMode === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)] font-medium">
                              📖 {u.viewMode === 'shelf' ? 'Estantería 3D' : u.viewMode === 'spines' ? 'Lomos' : 'Lista'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--color-line)]/60">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="py-1.5 px-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/50 hover:bg-[var(--color-bg)] text-[var(--color-ink)] text-[12px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="Editar perfil"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

                          {users.length > 1 && (
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 rounded-xl border border-red-500/25 bg-red-500/5 hover:bg-red-500/15 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {!isActive ? (
                          <button
                            onClick={async () => {
                              if (onSwitchUser) await onSwitchUser(u.id)
                            }}
                            className="py-1.5 px-3.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-[12px] font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <span>Activar perfil</span>
                          </button>
                        ) : (
                          <span className="text-[11.5px] font-bold text-[var(--color-muted)] px-2">
                            Biblioteca seleccionada
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal: Crear / Editar Usuario */}
        {showUserModal && (
          <div className="fixed inset-0 z-60 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl shadow-2xl max-w-lg w-full p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-line)]">
                <h3 className="font-bold text-[16.5px] text-[var(--color-ink)] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[var(--color-accent)]" />
                  <span>{editingUser ? 'Editar perfil de lector' : 'Añadir nuevo perfil a la biblioteca'}</span>
                </h3>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="p-1.5 rounded-full hover:bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Field: Nombre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-bold text-[var(--color-ink)]">
                  Nombre o apodo del lector <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej. Sofía, Carlos, Club de lectura..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/40 text-[13.5px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
                  autoFocus
                />
              </div>

              {/* Field: Avatar Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-[12.5px] font-bold text-[var(--color-ink)]">
                  Avatar del perfil
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {USER_AVATARS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setUserForm(p => ({ ...p, avatar: emoji }))}
                      className={`h-10 rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer ${
                        userForm.avatar === emoji
                          ? 'border-2 border-[var(--color-accent)] bg-[var(--color-bg)] shadow-xs scale-105'
                          : 'border border-[var(--color-line)] bg-[var(--color-bg)]/30 hover:bg-[var(--color-bg)]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11.5px] text-[var(--color-muted)]">O escribe un emoji personalizado:</span>
                  <input
                    type="text"
                    maxLength={4}
                    value={userForm.avatar}
                    onChange={e => setUserForm(p => ({ ...p, avatar: e.target.value }))}
                    className="w-12 text-center py-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)]/40 text-[14px]"
                  />
                </div>
              </div>

              {/* Field: Color Accent Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-[12.5px] font-bold text-[var(--color-ink)]">
                  Color identificativo
                </label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {USER_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setUserForm(p => ({ ...p, color: c.hex }))}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-xs relative"
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {userForm.color === c.hex && (
                        <Check className="w-4 h-4 text-white stroke-[3] drop-shadow-xs" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field: Preferred Theme */}
              <div className="flex flex-col gap-2">
                <label className="text-[12.5px] font-bold text-[var(--color-ink)]">
                  Tema visual inicial
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'clasico', name: 'Clásico', desc: 'Papel & Petróleo' },
                    { id: 'cactusito', name: 'Cactusito', desc: 'Menta & Ciruela' },
                    { id: 'pergamino', name: 'Pergamino', desc: 'Lino & Biblioteca' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setUserForm(p => ({ ...p, themeName: t.id as any }))}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        userForm.themeName === t.id
                          ? 'border-[var(--color-accent)] bg-[var(--color-bg)] shadow-xs font-bold'
                          : 'border-[var(--color-line)] bg-[var(--color-bg)]/20 hover:bg-[var(--color-bg)]/60'
                      }`}
                    >
                      <div className="text-[12.5px] font-bold text-[var(--color-ink)]">{t.name}</div>
                      <div className="text-[10.5px] text-[var(--color-muted)]">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Field: Color Mode & View Mode in a 2-column row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-[var(--color-ink)]">
                    Modo de color
                  </label>
                  <div className="flex rounded-xl border border-[var(--color-line)] p-1 bg-[var(--color-bg)]/30">
                    <button
                      type="button"
                      onClick={() => setUserForm(p => ({ ...p, colorMode: 'light' }))}
                      className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                        userForm.colorMode === 'light'
                          ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-xs'
                          : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                      }`}
                    >
                      ☀️ Claro
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserForm(p => ({ ...p, colorMode: 'dark' }))}
                      className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                        userForm.colorMode === 'dark'
                          ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-xs'
                          : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                      }`}
                    >
                      🌙 Oscuro
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-[var(--color-ink)]">
                    Vista predeterminada
                  </label>
                  <select
                    value={userForm.viewMode}
                    onChange={e => setUserForm(p => ({ ...p, viewMode: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/40 text-[12.5px] text-[var(--color-ink)] font-medium focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="list">Lista densa</option>
                    <option value="shelf">Estantería 3D</option>
                    <option value="spines">Lomos de libros</option>
                  </select>
                </div>
              </div>

              {/* Field: Bio / Meta de lectura */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-bold text-[var(--color-ink)]">
                  Lema o meta de lectura anual (opcional)
                </label>
                <input
                  type="text"
                  value={userForm.bio}
                  onChange={e => setUserForm(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Ej. Meta 2026: 25 libros leídos"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/40 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Field: Copiar biblioteca (solo al crear nuevo usuario) */}
              {!editingUser && users.length > 0 && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/25">
                  <label className="text-[12px] font-bold text-[var(--color-ink)]">
                    Inicialización de la biblioteca
                  </label>
                  <div className="flex flex-col gap-2 mt-1">
                    <label className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink)] cursor-pointer">
                      <input
                        type="radio"
                        name="copySource"
                        checked={!userForm.copyBooksFromUserId}
                        onChange={() => setUserForm(p => ({ ...p, copyBooksFromUserId: '' }))}
                        className="accent-[var(--color-accent)]"
                      />
                      <span>Comenzar con biblioteca limpia y vacía (0 libros)</span>
                    </label>

                    <label className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink)] cursor-pointer">
                      <input
                        type="radio"
                        name="copySource"
                        checked={Boolean(userForm.copyBooksFromUserId)}
                        onChange={() => setUserForm(p => ({ ...p, copyBooksFromUserId: users[0]?.id || '' }))}
                        className="accent-[var(--color-accent)]"
                      />
                      <span>Copiar catálogo de libros de otro usuario</span>
                    </label>

                    {Boolean(userForm.copyBooksFromUserId) && (
                      <select
                        value={userForm.copyBooksFromUserId}
                        onChange={e => setUserForm(p => ({ ...p, copyBooksFromUserId: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] text-[12px] text-[var(--color-ink)] font-semibold"
                      >
                        {users.map(srcU => (
                          <option key={srcU.id} value={srcU.id}>
                            {srcU.avatar} {srcU.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--color-line)]">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="py-2 px-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[13px] font-bold text-[var(--color-ink)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveUser}
                  disabled={busyAction !== null}
                  className="py-2 px-5 rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-[13px] font-bold hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {busyAction === 'save-user' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  )}
                  <span>{editingUser ? 'Guardar cambios' : 'Crear perfil'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Confirmación de Eliminación */}
        {deletingUser && (
          <div className="fixed inset-0 z-65 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface)] border border-red-500/30 rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h4 className="font-bold text-[16px] text-[var(--color-ink)]">
                  ¿Eliminar perfil de «{deletingUser.name}»?
                </h4>
                <p className="text-[12.5px] text-[var(--color-muted)] mt-1.5 leading-relaxed">
                  Esta acción eliminará de forma permanente el perfil y toda su biblioteca digital, valoraciones y notas asociadas.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--color-line)]">
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  className="py-2 px-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] text-[12.5px] font-bold text-[var(--color-ink)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteUser(deletingUser)}
                  disabled={busyAction !== null}
                  className="py-2 px-4 rounded-xl bg-red-600 text-white text-[12.5px] font-bold hover:bg-red-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {busyAction === 'delete-user' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Eliminar permanentemente</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--color-line)] bg-[var(--color-bg)]/40 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-[var(--color-muted)]">
              Bibliosfera • v1.1 • Desarrollada por Óliver Rivero © 2026
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
