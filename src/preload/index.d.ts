import { ElectronAPI } from '@electron-toolkit/preload'
import { Book, LibraryBook } from '../renderer/src/types'

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
      openLibraryBook: (id: string) => Promise<boolean>;
      showLibraryBookInFolder: (id: string) => Promise<boolean>;
      sendToDevice: (id: string) => Promise<{ success: boolean; message: string }>;
      sendMultipleToDevice: (bookIds: string[], targetFolder?: string) => Promise<{ success: boolean; count: number; message: string }>;
      getConnectedDevice: () => Promise<{ connected: boolean; name: string; volumePath: string; targetFolder: string } | null>;
      shareByEmail: (id: string, options?: { toEmail?: string }) => Promise<{ success: boolean; message: string }>;
      enrichLibraryBook: (id: string, query?: string) => Promise<LibraryBook | null>;
      exportLibrary: (format: 'json' | 'csv' | 'html' | 'files', selectedIds?: string[]) => Promise<{ success: boolean; count?: number; path?: string; message: string }>;
      exportReadings: (format: 'json' | 'csv' | 'markdown' | 'html') => Promise<{ success: boolean; path?: string; message: string }>;
      importReadingsJson: () => Promise<{ success: boolean; count?: number; message: string }>;
      selectCustomDeviceFolder: () => Promise<{ success: boolean; path?: string; device?: { connected: boolean; name: string; volumePath: string; targetFolder: string }; message?: string }>;
    }
  }
}
