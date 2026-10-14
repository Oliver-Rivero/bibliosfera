import { ElectronAPI } from '@electron-toolkit/preload'
import { Book, LibraryBook, RecommendedBook } from '../renderer/src/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getBooks: () => Promise<Book[]>;
      addBook: (book: Book) => Promise<Book[]>;
      updateBook: (book: Book) => Promise<Book[]>;
      deleteBook: (id: string) => Promise<Book[]>;
      searchBook: (query: string) => Promise<any>;

      // Library APIs
      getLibraryBooks: () => Promise<LibraryBook[]>;
      uploadLibraryBook: () => Promise<LibraryBook | null>;
      updateLibraryBook: (bookOrId: string | LibraryBook, updates?: Partial<LibraryBook>) => Promise<LibraryBook[]>;
      deleteLibraryBook: (id: string) => Promise<LibraryBook[]>;
      deleteMultipleLibraryBooks: (ids: string[]) => Promise<LibraryBook[]>;
      openLibraryBook: (id: string) => Promise<boolean>;
      showLibraryBookInFolder: (id: string) => Promise<boolean>;
      sendToDevice: (id: string) => Promise<{ success: boolean; message: string }>;
      sendMultipleToDevice: (bookIds: string[], targetFolder?: string) => Promise<{ success: boolean; count: number; message: string }>;
      getConnectedDevice: () => Promise<{ connected: boolean; name: string; volumePath: string; targetFolder: string } | null>;
      sendToKindleWeb: (bookIds: string | string[], options?: { domain?: string }) => Promise<{ success: boolean; message: string }>;
      openSendToKindleWeb: (domain?: string) => Promise<{ success: boolean }>;
      shareByEmail: (id: string, options?: { toEmail?: string }) => Promise<{ success: boolean; message: string }>;
      enrichLibraryBook: (id: string, query?: string) => Promise<LibraryBook | null>;
      reorderLibraryBooks: (orderedIds: string[]) => Promise<LibraryBook[]>;
      exportLibrary: (format: 'json' | 'csv' | 'html' | 'files', selectedIds?: string[]) => Promise<{ success: boolean; count?: number; path?: string; message: string }>;
      exportReadings: (format: 'excel' | 'pdf' | 'json' | 'csv' | 'markdown' | 'html') => Promise<{ success: boolean; path?: string; message: string }>;
      importReadings: (formatFilter?: 'excel' | 'csv' | 'md' | 'json' | 'all') => Promise<{ success: boolean; count?: number; message: string }>;
      importReadingsJson: () => Promise<{ success: boolean; count?: number; message: string }>;
      importLibraryFolder: () => Promise<{ success: boolean; count?: number; totalScanned?: number; message: string }>;
      getLibraryStorageDir: () => Promise<{ path: string; defaultPath: string; isCustom: boolean; themeName?: string }>;
      selectLibraryStorageDir: () => Promise<{ success: boolean; path?: string; isCustom?: boolean; migratedCount?: number; message: string }>;
      resetLibraryStorageDir: () => Promise<{ success: boolean; path?: string; isCustom?: boolean; message: string }>;
      openLibraryStorageDir: () => Promise<{ success: boolean; path?: string }>;
      setAppTheme: (themeName: string) => Promise<{ success: boolean; themeName: string }>;
      selectCustomDeviceFolder: () => Promise<{ success: boolean; path?: string; device?: { connected: boolean; name: string; volumePath: string; targetFolder: string }; message?: string }>;
      getRecommendations: (seed?: number) => Promise<{ recommendations: RecommendedBook[]; basedOnCount: number }>;
    }
  }
}
