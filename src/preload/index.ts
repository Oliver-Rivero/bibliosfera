import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getBooks: (userId?: string) => ipcRenderer.invoke('get-books', userId),
  addBook: (book, userId?: string) => ipcRenderer.invoke('add-book', book, userId),
  updateBook: (book, userId?: string) => ipcRenderer.invoke('update-book', book, userId),
  deleteBook: (id: string, userId?: string) => ipcRenderer.invoke('delete-book', id, userId),
  searchBook: (query) => ipcRenderer.invoke('search-book', query),

  // Users APIs
  getUsers: () => ipcRenderer.invoke('get-users'),
  getActiveUser: () => ipcRenderer.invoke('get-active-user'),
  setActiveUser: (userId: string) => ipcRenderer.invoke('set-active-user', userId),
  addUser: (user: any, options?: { copyBooksFromUserId?: string }) => ipcRenderer.invoke('add-user', user, options),
  updateUser: (id: string, updates: any) => ipcRenderer.invoke('update-user', id, updates),
  deleteUser: (id: string) => ipcRenderer.invoke('delete-user', id),
  
  // Library (Calibre-style) APIs
  getLibraryBooks: (userId?: string) => ipcRenderer.invoke('get-library-books', userId),
  uploadLibraryBook: () => ipcRenderer.invoke('upload-library-book'),
  updateLibraryBook: (bookOrId: any, updates?: any) => ipcRenderer.invoke('update-library-book', bookOrId, updates),
  deleteLibraryBook: (id: string) => ipcRenderer.invoke('delete-library-book', id),
  deleteMultipleLibraryBooks: (ids: string[]) => ipcRenderer.invoke('delete-multiple-library-books', ids),
  openLibraryBook: (id: string) => ipcRenderer.invoke('open-library-book', id),
  showLibraryBookInFolder: (id: string) => ipcRenderer.invoke('show-library-book-in-folder', id),
  sendToDevice: (id: string) => ipcRenderer.invoke('send-to-device', id),
  sendMultipleToDevice: (bookIds: string[], targetFolder?: string) => ipcRenderer.invoke('send-multiple-to-device', bookIds, targetFolder),
  getConnectedDevice: () => ipcRenderer.invoke('get-connected-device'),
  sendToKindleWeb: (bookIds: string | string[], options?: { domain?: string }) => ipcRenderer.invoke('send-to-kindle-web', bookIds, options),
  openSendToKindleWeb: (domain?: string) => ipcRenderer.invoke('open-send-to-kindle-web', domain),
  openKindleStagingDir: () => ipcRenderer.invoke('open-kindle-staging-dir'),
  shareByEmail: (id: string, options?: { toEmail?: string }) => ipcRenderer.invoke('share-by-email', id, options),
  enrichLibraryBook: (id: string, query?: string) => ipcRenderer.invoke('enrich-library-book', id, query),
  reorderLibraryBooks: (orderedIds: string[]) => ipcRenderer.invoke('reorder-library-books', orderedIds),
  exportLibrary: (format: 'json' | 'csv' | 'html' | 'files', selectedIds?: string[]) => ipcRenderer.invoke('export-library', format, selectedIds),
  exportReadings: (format: 'excel' | 'pdf' | 'json' | 'csv' | 'markdown' | 'html') => ipcRenderer.invoke('export-readings', format),
  importReadings: (formatFilter?: 'excel' | 'csv' | 'md' | 'json' | 'all') => ipcRenderer.invoke('import-readings', formatFilter),
  importReadingsJson: () => ipcRenderer.invoke('import-readings-json'),
  importLibraryFolder: () => ipcRenderer.invoke('import-library-folder'),
  getLibraryStorageDir: () => ipcRenderer.invoke('get-library-storage-dir'),
  selectLibraryStorageDir: () => ipcRenderer.invoke('select-library-storage-dir'),
  resetLibraryStorageDir: () => ipcRenderer.invoke('reset-library-storage-dir'),
  openLibraryStorageDir: () => ipcRenderer.invoke('open-library-storage-dir'),
  setAppTheme: (themeName: string) => ipcRenderer.invoke('set-app-theme', themeName),
  selectCustomDeviceFolder: () => ipcRenderer.invoke('select-custom-device-folder'),
  getRecommendations: (seed?: number) => ipcRenderer.invoke('get-recommendations', seed),

  // eReader Notes & Quotes APIs
  scanEReaderNotes: (options?: { volumePath?: string; targetTitle?: string }) => ipcRenderer.invoke('scan-ereader-notes', options),
  selectAndParseNotesFile: (targetTitle?: string) => ipcRenderer.invoke('select-and-parse-notes-file', targetTitle),
  saveBookQuotes: (bookId: string, quotes: any[]) => ipcRenderer.invoke('save-book-quotes', bookId, quotes)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
