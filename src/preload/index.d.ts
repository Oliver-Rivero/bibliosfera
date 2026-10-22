import { ElectronAPI } from '@electron-toolkit/preload'
import { Book, BookQuote, LibraryBook, RecommendedBook, UserProfile } from '../renderer/src/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getBooks: (userId?: string) => Promise<Book[]>;
      addBook: (book: Book, userId?: string) => Promise<Book[]>;
      updateBook: (book: Book, userId?: string) => Promise<Book[]>;
      deleteBook: (id: string, userId?: string) => Promise<Book[]>;
      searchBook: (query: string) => Promise<any>;

      // Users APIs
      getUsers: () => Promise<UserProfile[]>;
      getActiveUser: () => Promise<{ activeUserId: string; activeUser: UserProfile }>;
      setActiveUser: (userId: string) => Promise<{ success: boolean; activeUser: UserProfile; books: Book[]; library: LibraryBook[] }>;
      addUser: (user: Partial<UserProfile>, options?: { copyBooksFromUserId?: string }) => Promise<{ success: boolean; user: UserProfile; users: UserProfile[] }>;
      updateUser: (id: string, updates: Partial<UserProfile>) => Promise<{ success: boolean; user?: UserProfile; users: UserProfile[] }>;
      deleteUser: (id: string) => Promise<{ success: boolean; users: UserProfile[]; newActiveUserId?: string; message?: string }>;

      // Library APIs
      getLibraryBooks: (userId?: string) => Promise<LibraryBook[]>;
      uploadLibraryBook: () => Promise<LibraryBook | null>;
      updateLibraryBook: (bookOrId: string | LibraryBook, updates?: Partial<LibraryBook>) => Promise<LibraryBook[]>;
      deleteLibraryBook: (id: string) => Promise<LibraryBook[]>;
      deleteMultipleLibraryBooks: (ids: string[]) => Promise<LibraryBook[]>;
      openLibraryBook: (id: string) => Promise<boolean>;
      showLibraryBookInFolder: (id: string) => Promise<boolean>;
      sendToDevice: (id: string) => Promise<{ success: boolean; message: string }>;
      sendMultipleToDevice: (bookIds: string[], targetFolder?: string) => Promise<{ success: boolean; count: number; message: string }>;
      getConnectedDevice: () => Promise<{ connected: boolean; name: string; volumePath: string; targetFolder: string } | null>;
      sendToKindleWeb: (bookIds: string | string[], options?: { domain?: string }) => Promise<{ success: boolean; message: string; count?: number; stagingDir?: string; cleanFiles?: { title: string; fileName: string; fileSize?: number }[] }>;
      openSendToKindleWeb: (domain?: string) => Promise<{ success: boolean }>;
      openKindleStagingDir: () => Promise<{ success: boolean }>;
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

      // eReader Notes & Quotes APIs
      scanEReaderNotes: (options?: { volumePath?: string; targetTitle?: string }) => Promise<{
        success: boolean;
        connected: boolean;
        deviceName?: string;
        deviceType?: string;
        notesFilePath?: string;
        totalBooksWithNotes?: number;
        books: { title: string; author?: string; quotesCount?: number; quotes: BookQuote[] }[];
        matchedQuotes?: BookQuote[];
        matchedBookTitle?: string;
        message?: string;
      }>;
      selectAndParseNotesFile: (targetTitle?: string) => Promise<{
        canceled: boolean;
        success?: boolean;
        filePath?: string;
        deviceType?: string;
        deviceName?: string;
        totalBooksWithNotes?: number;
        books?: { title: string; author?: string; quotesCount?: number; quotes: BookQuote[] }[];
        matchedQuotes?: BookQuote[];
        matchedBookTitle?: string;
        message?: string;
      }>;
      saveBookQuotes: (bookId: string, quotes: BookQuote[]) => Promise<{ success: boolean; books: Book[] }>;
    }
  }
}
