import fs from 'fs'
import { join } from 'path'
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'

export interface Book {
  id: string
  title: string
  author: string
  year?: number
  genre?: string
  pages?: number
  rating?: number
  readingTime?: string
  dateRead?: string
  comment?: string
  coverUrl?: string
  libraryBookId?: string
  [key: string]: any
}

export interface LibraryBook {
  id: string
  title: string
  author: string
  format: string
  fileName: string
  filePath: string
  fileSize: number
  pages?: number
  coverUrl?: string
  synopsis?: string
  dateAdded: string
  status?: 'pending' | 'reading' | 'read'
  [key: string]: any
}

let db: Database | null = null
let dbFilePath = ''
let isInitialized = false

/**
 * Locate and read sql-wasm.wasm binary buffer reliably across dev & production
 */
function getWasmBinary(): Buffer {
  const possiblePaths = [
    require.resolve('sql.js/dist/sql-wasm.wasm'),
    join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
    join(process.resourcesPath || '', 'sql-wasm.wasm'),
    join(__dirname, 'sql-wasm.wasm')
  ]
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p)
      }
    } catch {
      // continue
    }
  }
  // Fallback to require.resolve
  return fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))
}

/**
 * Initializes the SQLite database and executes migrations if needed
 */
export async function initDatabase(userDataPath: string): Promise<void> {
  if (isInitialized && db) return

  dbFilePath = join(userDataPath, 'bibliosfera.db')
  const wasmBinary = getWasmBinary()
  const SQL: SqlJsStatic = await initSqlJs({ wasmBinary: new Uint8Array(wasmBinary).buffer as ArrayBuffer })

  if (fs.existsSync(dbFilePath)) {
    try {
      const fileBuffer = fs.readFileSync(dbFilePath)
      db = new SQL.Database(fileBuffer)
      console.log(`[SQLite] Loaded existing database from ${dbFilePath}`)
    } catch (err) {
      console.error(`[SQLite] Failed to load existing database, creating fresh one:`, err)
      db = new SQL.Database()
    }
  } else {
    console.log(`[SQLite] Initializing new database at ${dbFilePath}`)
    db = new SQL.Database()
  }

  // Create tables and indexes
  db.run(`
    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      year INTEGER,
      genre TEXT,
      pages INTEGER,
      rating REAL,
      reading_time TEXT,
      date_read TEXT,
      comment TEXT,
      cover_url TEXT,
      library_book_id TEXT,
      synopsis TEXT,
      isbn TEXT,
      extra_json TEXT
    );

    CREATE TABLE IF NOT EXISTS library_books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      format TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      pages INTEGER,
      cover_url TEXT,
      synopsis TEXT,
      date_added TEXT,
      status TEXT DEFAULT 'pending',
      sort_order INTEGER,
      extra_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_readings_date_read ON readings(date_read);
    CREATE INDEX IF NOT EXISTS idx_readings_rating ON readings(rating);
    CREATE INDEX IF NOT EXISTS idx_readings_author ON readings(author);
    CREATE INDEX IF NOT EXISTS idx_library_status ON library_books(status);
    CREATE INDEX IF NOT EXISTS idx_library_format ON library_books(format);
    CREATE INDEX IF NOT EXISTS idx_library_author ON library_books(author);
  `)

  // Migration for existing tables: add synopsis and isbn if missing in readings
  try {
    db.run(`ALTER TABLE readings ADD COLUMN synopsis TEXT;`)
  } catch (e) {}

  try {
    db.run(`ALTER TABLE readings ADD COLUMN isbn TEXT;`)
  } catch (e) {}

  // Migration for existing tables: add sort_order column and index if missing
  try {
    db.run(`ALTER TABLE library_books ADD COLUMN sort_order INTEGER;`)
  } catch (e) {}

  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_library_sort_order ON library_books(sort_order);`)
  } catch (e) {}

  // Auto-migrate from legacy JSON files if SQLite tables are empty
  await autoMigrateFromLegacyJson(userDataPath)

  // Initial persist
  flushToDisk()
  isInitialized = true
}

/**
 * Flushes SQLite in-memory state directly to the bibliosfera.db file on disk
 */
export function flushToDisk(): void {
  if (!db || !dbFilePath) return
  try {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbFilePath, buffer)
  } catch (err) {
    console.error(`[SQLite] Error saving database to disk:`, err)
  }
}

/**
 * Automatic one-time migration: copies records from bibliosfera-books.json
 * and bibliosfera-library.json if the SQLite tables are currently empty.
 */
async function autoMigrateFromLegacyJson(userDataPath: string): Promise<void> {
  if (!db) return

  // 1. Check readings count
  const readingsCountRes = db.exec(`SELECT COUNT(*) as count FROM readings;`)
  const readingsCount = readingsCountRes[0]?.values[0]?.[0] as number || 0

  if (readingsCount === 0) {
    const jsonBooksPath = join(userDataPath, 'bibliosfera-books.json')
    const legacyPath = join(userDataPath, 'bibliograma-books.json')
    const targetPath = fs.existsSync(jsonBooksPath) ? jsonBooksPath : fs.existsSync(legacyPath) ? legacyPath : null

    if (targetPath) {
      try {
        const raw = fs.readFileSync(targetPath, 'utf-8')
        const books: Book[] = JSON.parse(raw)
        if (Array.isArray(books) && books.length > 0) {
          console.log(`[SQLite Migration] Migrating ${books.length} readings from ${targetPath}...`)
          setStoredBooks(books)
        }
      } catch (err) {
        console.error(`[SQLite Migration] Error reading legacy books JSON:`, err)
      }
    }
  }

  // 2. Check library_books count
  const libraryCountRes = db.exec(`SELECT COUNT(*) as count FROM library_books;`)
  const libraryCount = libraryCountRes[0]?.values[0]?.[0] as number || 0

  if (libraryCount === 0) {
    const jsonLibPath = join(userDataPath, 'bibliosfera-library.json')
    const legacyLibPath = join(userDataPath, 'bibliograma-library.json')
    const targetLibPath = fs.existsSync(jsonLibPath) ? jsonLibPath : fs.existsSync(legacyLibPath) ? legacyLibPath : null

    if (targetLibPath) {
      try {
        const raw = fs.readFileSync(targetLibPath, 'utf-8')
        const library: LibraryBook[] = JSON.parse(raw)
        if (Array.isArray(library) && library.length > 0) {
          console.log(`[SQLite Migration] Migrating ${library.length} library books from ${targetLibPath}...`)
          setStoredLibrary(library)
        }
      } catch (err) {
        console.error(`[SQLite Migration] Error reading legacy library JSON:`, err)
      }
    }
  }
}

// ============================================================================
// READINGS (Mis Lecturas) CRUD
// ============================================================================

export function getStoredBooks(): Book[] {
  if (!db) return []
  try {
    const stmt = db.prepare(`
      SELECT id, title, author, year, genre, pages, rating, reading_time, date_read, comment, cover_url, library_book_id, synopsis, isbn, extra_json
      FROM readings
      ORDER BY date_read DESC, id DESC
    `)
    const books: Book[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as any
      let extra: any = {}
      if (row.extra_json) {
        try { extra = JSON.parse(row.extra_json) } catch {}
      }
      books.push({
        id: row.id,
        title: row.title,
        author: row.author,
        year: row.year !== null && row.year !== undefined ? Number(row.year) : undefined,
        genre: row.genre || undefined,
        pages: row.pages !== null && row.pages !== undefined ? Number(row.pages) : undefined,
        rating: row.rating !== null && row.rating !== undefined ? Number(row.rating) : undefined,
        readingTime: row.reading_time || undefined,
        dateRead: row.date_read || undefined,
        comment: row.comment || undefined,
        coverUrl: row.cover_url || undefined,
        libraryBookId: row.library_book_id || undefined,
        synopsis: row.synopsis || undefined,
        isbn: row.isbn || undefined,
        ...extra
      })
    }
    stmt.free()
    return books
  } catch (err) {
    console.error(`[SQLite] Error in getStoredBooks:`, err)
    return []
  }
}

function toNullableNumber(val: any): number | null {
  if (val === undefined || val === null || val === '') return null
  const num = Number(val)
  return isNaN(num) ? null : num
}

export function setStoredBooks(books: Book[]): void {
  if (!db) return
  try {
    db.run(`BEGIN TRANSACTION;`)
    db.run(`DELETE FROM readings;`)
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO readings (id, title, author, year, genre, pages, rating, reading_time, date_read, comment, cover_url, library_book_id, synopsis, isbn, extra_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const b of books) {
      const knownKeys = new Set(['id', 'title', 'author', 'year', 'genre', 'pages', 'rating', 'readingTime', 'dateRead', 'comment', 'coverUrl', 'libraryBookId', 'synopsis', 'isbn'])
      const extra: Record<string, any> = {}
      for (const k of Object.keys(b)) {
        if (!knownKeys.has(k)) extra[k] = b[k]
      }
      stmt.run([
        b.id || `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        b.title || 'Sin título',
        b.author || 'Autor desconocido',
        toNullableNumber(b.year),
        b.genre || null,
        toNullableNumber(b.pages),
        toNullableNumber(b.rating),
        b.readingTime || null,
        b.dateRead || null,
        b.comment || null,
        b.coverUrl || null,
        b.libraryBookId || null,
        b.synopsis || null,
        b.isbn || null,
        Object.keys(extra).length > 0 ? JSON.stringify(extra) : null
      ])
    }
    stmt.free()
    db.run(`COMMIT;`)
    flushToDisk()
  } catch (err) {
    if (db) db.run(`ROLLBACK;`)
    console.error(`[SQLite] Error in setStoredBooks:`, err)
  }
}

export function addStoredBook(book: Book): Book[] {
  if (!db) return []
  const books = getStoredBooks()
  const exists = books.some(b => b.id === book.id)
  if (exists) {
    return updateStoredBook(book)
  }
  const knownKeys = new Set(['id', 'title', 'author', 'year', 'genre', 'pages', 'rating', 'readingTime', 'dateRead', 'comment', 'coverUrl', 'libraryBookId', 'synopsis', 'isbn'])
  const extra: Record<string, any> = {}
  for (const k of Object.keys(book)) {
    if (!knownKeys.has(k)) extra[k] = book[k]
  }

  try {
    db.run(
      `INSERT OR REPLACE INTO readings (id, title, author, year, genre, pages, rating, reading_time, date_read, comment, cover_url, library_book_id, synopsis, isbn, extra_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book.id,
        book.title || 'Sin título',
        book.author || 'Autor desconocido',
        toNullableNumber(book.year),
        book.genre || null,
        toNullableNumber(book.pages),
        toNullableNumber(book.rating),
        book.readingTime || null,
        book.dateRead || null,
        book.comment || null,
        book.coverUrl || null,
        book.libraryBookId || null,
        book.synopsis || null,
        book.isbn || null,
        Object.keys(extra).length > 0 ? JSON.stringify(extra) : null
      ]
    )
    flushToDisk()
    return getStoredBooks()
  } catch (err) {
    console.error(`[SQLite] Error in addStoredBook:`, err)
    return books
  }
}

export function updateStoredBook(book: Book): Book[] {
  if (!db) return []
  const books = getStoredBooks()
  const exists = books.some(b => b.id === book.id)
  if (!exists) {
    return addStoredBook(book)
  }
  const knownKeys = new Set(['id', 'title', 'author', 'year', 'genre', 'pages', 'rating', 'readingTime', 'dateRead', 'comment', 'coverUrl', 'libraryBookId', 'synopsis', 'isbn'])
  const extra: Record<string, any> = {}
  for (const k of Object.keys(book)) {
    if (!knownKeys.has(k)) extra[k] = book[k]
  }

  try {
    db.run(
      `UPDATE readings SET
        title = ?, author = ?, year = ?, genre = ?, pages = ?, rating = ?,
        reading_time = ?, date_read = ?, comment = ?, cover_url = ?, library_book_id = ?, synopsis = ?, isbn = ?, extra_json = ?
       WHERE id = ?`,
      [
        book.title || 'Sin título',
        book.author || 'Autor desconocido',
        toNullableNumber(book.year),
        book.genre || null,
        toNullableNumber(book.pages),
        toNullableNumber(book.rating),
        book.readingTime || null,
        book.dateRead || null,
        book.comment || null,
        book.coverUrl || null,
        book.libraryBookId || null,
        book.synopsis || null,
        book.isbn || null,
        Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
        book.id
      ]
    )
    flushToDisk()
    return getStoredBooks()
  } catch (err) {
    console.error(`[SQLite] Error in updateStoredBook:`, err)
    return getStoredBooks()
  }
}

export function deleteStoredBook(id: string): Book[] {
  if (!db) return []
  try {
    db.run(`DELETE FROM readings WHERE id = ?`, [id])
    flushToDisk()
    return getStoredBooks()
  } catch (err) {
    console.error(`[SQLite] Error in deleteStoredBook:`, err)
    return getStoredBooks()
  }
}

// ============================================================================
// LIBRARY (Biblioteca Digital) CRUD
// ============================================================================

export function getStoredLibrary(): LibraryBook[] {
  if (!db) return []
  try {
    const stmt = db.prepare(`
      SELECT id, title, author, format, file_name, file_path, file_size, pages, cover_url, synopsis, date_added, status, sort_order, extra_json
      FROM library_books
      ORDER BY CASE WHEN sort_order IS NOT NULL THEN sort_order ELSE 999999999 END ASC, date_added DESC, id DESC
    `)
    const library: LibraryBook[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as any
      let extra: any = {}
      if (row.extra_json) {
        try { extra = JSON.parse(row.extra_json) } catch {}
      }
      library.push({
        id: row.id,
        title: row.title,
        author: row.author,
        format: row.format,
        fileName: row.file_name,
        filePath: row.file_path,
        fileSize: Number(row.file_size || 0),
        pages: row.pages !== null ? Number(row.pages) : undefined,
        coverUrl: row.cover_url || undefined,
        synopsis: row.synopsis || undefined,
        dateAdded: row.date_added || new Date().toISOString(),
        status: row.status || 'pending',
        sortOrder: row.sort_order !== null ? Number(row.sort_order) : undefined,
        ...extra
      })
    }
    stmt.free()
    return library
  } catch (err) {
    console.error(`[SQLite] Error in getStoredLibrary:`, err)
    return []
  }
}

export function setStoredLibrary(books: LibraryBook[]): void {
  if (!db) return
  try {
    db.run(`BEGIN TRANSACTION;`)
    db.run(`DELETE FROM library_books;`)
    const stmt = db.prepare(`
      INSERT INTO library_books (id, title, author, format, file_name, file_path, file_size, pages, cover_url, synopsis, date_added, status, sort_order, extra_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (let i = 0; i < books.length; i++) {
      const b = books[i]
      const knownKeys = new Set(['id', 'title', 'author', 'format', 'fileName', 'filePath', 'fileSize', 'pages', 'coverUrl', 'synopsis', 'dateAdded', 'status', 'sortOrder'])
      const extra: Record<string, any> = {}
      for (const k of Object.keys(b)) {
        if (!knownKeys.has(k)) extra[k] = b[k]
      }
      stmt.run([
        b.id || `lib_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        b.title || 'Sin título',
        b.author || 'Autor desconocido',
        b.format || 'epub',
        b.fileName || '',
        b.filePath || '',
        b.fileSize || 0,
        b.pages !== undefined ? b.pages : null,
        b.coverUrl || null,
        b.synopsis || null,
        b.dateAdded || new Date().toISOString(),
        b.status || 'pending',
        b.sortOrder !== undefined ? b.sortOrder : i,
        Object.keys(extra).length > 0 ? JSON.stringify(extra) : null
      ])
    }
    stmt.free()
    db.run(`COMMIT;`)
    flushToDisk()
  } catch (err) {
    if (db) db.run(`ROLLBACK;`)
    console.error(`[SQLite] Error in setStoredLibrary:`, err)
  }
}

export function addStoredLibraryBook(book: LibraryBook): LibraryBook {
  if (!db) return book
  const knownKeys = new Set(['id', 'title', 'author', 'format', 'fileName', 'filePath', 'fileSize', 'pages', 'coverUrl', 'synopsis', 'dateAdded', 'status'])
  const extra: Record<string, any> = {}
  for (const k of Object.keys(book)) {
    if (!knownKeys.has(k)) extra[k] = book[k]
  }

  try {
    db.run(
      `INSERT OR REPLACE INTO library_books (id, title, author, format, file_name, file_path, file_size, pages, cover_url, synopsis, date_added, status, extra_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book.id,
        book.title || 'Sin título',
        book.author || 'Autor desconocido',
        book.format || 'epub',
        book.fileName || '',
        book.filePath || '',
        book.fileSize || 0,
        book.pages !== undefined ? book.pages : null,
        book.coverUrl || null,
        book.synopsis || null,
        book.dateAdded || new Date().toISOString(),
        book.status || 'pending',
        Object.keys(extra).length > 0 ? JSON.stringify(extra) : null
      ]
    )
    flushToDisk()
    return book
  } catch (err) {
    console.error(`[SQLite] Error in addStoredLibraryBook:`, err)
    return book
  }
}

export function updateStoredLibraryBook(id: string, updates: Partial<LibraryBook>): LibraryBook[] {
  if (!db) return []
  const library = getStoredLibrary()
  const target = library.find(b => b.id === id)
  if (!target) return library

  const merged = { ...target, ...updates }
  addStoredLibraryBook(merged)
  return getStoredLibrary()
}

export function deleteStoredLibraryBook(id: string): LibraryBook[] {
  if (!db) return []
  try {
    db.run(`DELETE FROM library_books WHERE id = ?`, [id])
    flushToDisk()
    return getStoredLibrary()
  } catch (err) {
    console.error(`[SQLite] Error in deleteStoredLibraryBook:`, err)
    return getStoredLibrary()
  }
}
