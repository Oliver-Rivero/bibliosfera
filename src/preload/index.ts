import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getBooks: () => ipcRenderer.invoke('get-books'),
  addBook: (book) => ipcRenderer.invoke('add-book', book),
  updateBook: (book) => ipcRenderer.invoke('update-book', book),
  deleteBook: (id) => ipcRenderer.invoke('delete-book', id),
  searchBook: (query) => ipcRenderer.invoke('search-book', query),
  
  // Library (Calibre-style) APIs
  getLibraryBooks: () => ipcRenderer.invoke('get-library-books'),
  uploadLibraryBook: () => ipcRenderer.invoke('upload-library-book'),
  updateLibraryBook: (bookOrId: any, updates?: any) => ipcRenderer.invoke('update-library-book', bookOrId, updates),
  deleteLibraryBook: (id: string) => ipcRenderer.invoke('delete-library-book', id),
  openLibraryBook: (id: string) => ipcRenderer.invoke('open-library-book', id),
  showLibraryBookInFolder: (id: string) => ipcRenderer.invoke('show-library-book-in-folder', id),
  sendToDevice: (id: string) => ipcRenderer.invoke('send-to-device', id),
  sendMultipleToDevice: (bookIds: string[], targetFolder?: string) => ipcRenderer.invoke('send-multiple-to-device', bookIds, targetFolder),
  getConnectedDevice: () => ipcRenderer.invoke('get-connected-device'),
  shareByEmail: (id: string, options?: { toEmail?: string }) => ipcRenderer.invoke('share-by-email', id, options),
  enrichLibraryBook: (id: string, query?: string) => ipcRenderer.invoke('enrich-library-book', id, query),
  exportLibrary: (format: 'json' | 'csv' | 'html' | 'files', selectedIds?: string[]) => ipcRenderer.invoke('export-library', format, selectedIds),
  exportReadings: (format: 'json' | 'csv' | 'markdown' | 'html') => ipcRenderer.invoke('export-readings', format),
  importReadingsJson: () => ipcRenderer.invoke('import-readings-json'),
  selectCustomDeviceFolder: () => ipcRenderer.invoke('select-custom-device-folder')
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
