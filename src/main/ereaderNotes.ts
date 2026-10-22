import fs from 'fs'
import { join, basename } from 'path'
import initSqlJs, { SqlJsStatic } from 'sql.js'
import { getWasmBinary } from './db'

export interface ParsedQuote {
  id: string
  text: string
  note?: string
  page?: string
  dateAdded?: string
  source: 'kindle' | 'kobo' | 'sony' | 'generic' | string
}

export interface BookWithQuotes {
  title: string
  author?: string
  quotesCount: number
  quotes: ParsedQuote[]
}

export interface EReaderScanResult {
  success: boolean
  deviceType: 'kindle' | 'kobo' | 'sony' | 'generic'
  deviceName: string
  filePath?: string
  booksFound: BookWithQuotes[]
  message?: string
}

let sqlInstance: SqlJsStatic | null = null

async function getSQL(): Promise<SqlJsStatic> {
  if (sqlInstance) return sqlInstance
  const wasmBinary = getWasmBinary()
  sqlInstance = await initSqlJs({ wasmBinary: new Uint8Array(wasmBinary).buffer as ArrayBuffer })
  return sqlInstance
}

/**
 * Normalizes title for loose comparison (removes accents, punctuation, parenthesis)
 */
export function normalizeTitleForMatch(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 1. KINDLE: Parses My Clippings.txt format
 */
export function parseKindleClippings(content: string): BookWithQuotes[] {
  const cleanContent = content.replace(/^\uFEFF/, '')
  const rawEntries = cleanContent.split(/={8,14}/)
  const booksMap = new Map<string, { title: string; author?: string; quotes: ParsedQuote[] }>()

  for (const entry of rawEntries) {
    const lines = entry.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) continue

    // Line 0: Title (Author)
    const titleLine = lines[0]
    let title = titleLine
    let author: string | undefined = undefined
    const authorMatch = titleLine.match(/^(.*?)\s*\(([^()]+)\)$/)
    if (authorMatch) {
      title = authorMatch[1].trim()
      author = authorMatch[2].trim()
    }

    // Line 1: Metadata line
    const metaLine = lines[1]
    let page: string | undefined = undefined
    const pageMatch = metaLine.match(/(?:página|page|seite|p\.)\s*(\d+)/i)
    if (pageMatch) {
      page = `Pág. ${pageMatch[1]}`
    } else {
      const locMatch = metaLine.match(/(?:posición|location|pos\.)\s*([\d-]+)/i)
      if (locMatch) {
        page = `Loc. ${locMatch[1]}`
      }
    }

    let dateAdded: string | undefined = undefined
    const dateMatch = metaLine.match(/(?:Añadido el|Added on|Ajouté le|Hinzugefügt am)\s+(.+)$/i)
    if (dateMatch) {
      dateAdded = dateMatch[1].trim()
    }

    const isNote = metaLine.toLowerCase().includes('nota') || metaLine.toLowerCase().includes('note')
    const textLines = lines.slice(2).join('\n').trim()
    if (!textLines) continue

    const normKey = normalizeTitleForMatch(title)
    if (!booksMap.has(normKey)) {
      booksMap.set(normKey, {
        title,
        author,
        quotes: []
      })
    }

    const bookEntry = booksMap.get(normKey)!
    // If it's a note at the same page/location as previous highlight, attach it
    if (isNote && bookEntry.quotes.length > 0 && page) {
      const last = bookEntry.quotes[bookEntry.quotes.length - 1]
      if (last.page === page && !last.note) {
        last.note = textLines
        continue
      }
    }

    bookEntry.quotes.push({
      id: `quote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: textLines,
      note: isNote ? textLines : undefined,
      page,
      dateAdded,
      source: 'kindle'
    })
  }

  return Array.from(booksMap.values()).map(b => ({
    ...b,
    quotesCount: b.quotes.length
  }))
}

/**
 * 2. KOBO: Parses KoboReader.sqlite Bookmark table
 */
export async function parseKoboDatabase(buffer: Buffer): Promise<BookWithQuotes[]> {
  const SQL = await getSQL()
  const db = new SQL.Database(buffer)
  const booksMap = new Map<string, { title: string; author?: string; quotes: ParsedQuote[] }>()

  try {
    const tableRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='Bookmark';")
    if (!tableRes || tableRes.length === 0 || tableRes[0].values.length === 0) {
      return []
    }

    // Build metadata lookup from content table if available
    const contentMap = new Map<string, { title: string; author?: string }>()
    try {
      const contentRes = db.exec("SELECT ContentID, BookTitle, Title, Attribution FROM content WHERE BookTitle IS NOT NULL OR Attribution IS NOT NULL;")
      if (contentRes.length > 0) {
        for (const row of contentRes[0].values) {
          const id = String(row[0] || '')
          const bookTitle = row[1] ? String(row[1]).trim() : ''
          const title = row[2] ? String(row[2]).trim() : ''
          const attribution = row[3] ? String(row[3]).trim() : ''
          const finalTitle = bookTitle || title
          if (id && finalTitle) {
            contentMap.set(id, { title: finalTitle, author: attribution || undefined })
          }
        }
      }
    } catch {}

    const stmt = db.prepare(`
      SELECT VolumeID, Text, Annotation, DateCreated, ChapterProgress
      FROM Bookmark
      WHERE (Text IS NOT NULL AND TRIM(Text) != '') OR (Annotation IS NOT NULL AND TRIM(Annotation) != '')
      ORDER BY DateCreated ASC
    `)

    while (stmt.step()) {
      const row = stmt.getAsObject() as any
      const volumeId = String(row.VolumeID || '')
      const text = row.Text ? String(row.Text).trim() : ''
      const annotation = row.Annotation ? String(row.Annotation).trim() : ''
      const dateCreated = row.DateCreated ? String(row.DateCreated) : undefined
      const progress = row.ChapterProgress !== undefined && row.ChapterProgress !== null ? Number(row.ChapterProgress) : null

      let title = ''
      let author: string | undefined = undefined

      if (contentMap.has(volumeId)) {
        const meta = contentMap.get(volumeId)!
        title = meta.title
        author = meta.author
      } else {
        try {
          const cleanPath = decodeURIComponent(volumeId).replace(/\\/g, '/')
          const fileBase = basename(cleanPath).replace(/\.[a-zA-Z0-9]+$/, '')
          title = fileBase || 'Libro Kobo'
        } catch {
          title = volumeId || 'Libro Kobo'
        }
      }

      if (!title) continue
      const normKey = normalizeTitleForMatch(title)
      if (!booksMap.has(normKey)) {
        booksMap.set(normKey, { title, author, quotes: [] })
      }

      const bookEntry = booksMap.get(normKey)!
      const quoteText = text || annotation
      const quoteNote = text && annotation ? annotation : undefined

      let pageStr: string | undefined = undefined
      if (progress !== null && !isNaN(progress) && progress > 0) {
        pageStr = `${Math.round(progress * 100)}%`
      }

      bookEntry.quotes.push({
        id: `kobo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        text: quoteText,
        note: quoteNote,
        page: pageStr,
        dateAdded: dateCreated,
        source: 'kobo'
      })
    }
    stmt.free()
  } catch (err) {
    console.error('Error parsing KoboReader.sqlite:', err)
  }

  return Array.from(booksMap.values()).map(b => ({
    ...b,
    quotesCount: b.quotes.length
  }))
}

/**
 * 3. SONY READER: Parses Sony Reader database (books.db) and notes
 */
export async function parseSonyReaderDatabase(buffer: Buffer): Promise<BookWithQuotes[]> {
  const SQL = await getSQL()
  const db = new SQL.Database(buffer)
  const booksMap = new Map<string, { title: string; author?: string; quotes: ParsedQuote[] }>()

  try {
    const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table';")
    const tableNames = new Set((tablesRes[0]?.values || []).map(v => String(v[0]).toLowerCase()))

    // Check for Sony PRS Android/Linux schema: 'annotation' and 'books'
    if (tableNames.has('annotation')) {
      let query = `
        SELECT a.marked_text, a.memo_text, a.added_date, a.page,
               COALESCE(b.title, 'Libro Sony') as title,
               b.author
        FROM annotation a
      `
      if (tableNames.has('books')) {
        query += ` LEFT JOIN books b ON a.content_id = b._id OR a.content_id = b.id `
      } else {
        query = ` SELECT marked_text, memo_text, added_date, page, 'Libro Sony' as title, '' as author FROM annotation `
      }
      query += ` WHERE (marked_text IS NOT NULL AND TRIM(marked_text) != '') OR (memo_text IS NOT NULL AND TRIM(memo_text) != '') `

      try {
        const stmt = db.prepare(query)
        while (stmt.step()) {
          const row = stmt.getAsObject() as any
          const text = row.marked_text ? String(row.marked_text).trim() : ''
          const memo = row.memo_text ? String(row.memo_text).trim() : ''
          const title = row.title ? String(row.title).trim() : 'Libro Sony'
          const author = row.author ? String(row.author).trim() : undefined
          const page = row.page ? `Pág. ${row.page}` : undefined
          const dateAdded = row.added_date ? String(row.added_date) : undefined

          const quoteText = text || memo
          const quoteNote = text && memo ? memo : undefined

          const normKey = normalizeTitleForMatch(title)
          if (!booksMap.has(normKey)) {
            booksMap.set(normKey, { title, author, quotes: [] })
          }

          booksMap.get(normKey)!.quotes.push({
            id: `sony_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            text: quoteText,
            note: quoteNote,
            page,
            dateAdded,
            source: 'sony'
          })
        }
        stmt.free()
      } catch (e) {
        console.error('Error querying Sony annotation table:', e)
      }
    }

    // Check for older Sony PRS schema: 'bookmark'
    if (tableNames.has('bookmark') && booksMap.size === 0) {
      let query = `
        SELECT b.marked_text, b.memo_text, b.date, b.page,
               COALESCE(k.title, 'Libro Sony') as title,
               k.author
        FROM bookmark b
      `
      if (tableNames.has('books')) {
        query += ` LEFT JOIN books k ON b.book_id = k._id OR b.content_id = k._id `
      } else {
        query = ` SELECT marked_text, memo_text, date, page, 'Libro Sony' as title, '' as author FROM bookmark `
      }
      query += ` WHERE (marked_text IS NOT NULL AND TRIM(marked_text) != '') OR (memo_text IS NOT NULL AND TRIM(memo_text) != '') `

      try {
        const stmt = db.prepare(query)
        while (stmt.step()) {
          const row = stmt.getAsObject() as any
          const text = row.marked_text ? String(row.marked_text).trim() : ''
          const memo = row.memo_text ? String(row.memo_text).trim() : ''
          const title = row.title ? String(row.title).trim() : 'Libro Sony'
          const author = row.author ? String(row.author).trim() : undefined
          const page = row.page ? `Pág. ${row.page}` : undefined
          const dateAdded = row.date ? String(row.date) : undefined

          const normKey = normalizeTitleForMatch(title)
          if (!booksMap.has(normKey)) {
            booksMap.set(normKey, { title, author, quotes: [] })
          }

          booksMap.get(normKey)!.quotes.push({
            id: `sony_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            text: text || memo,
            note: text && memo ? memo : undefined,
            page,
            dateAdded,
            source: 'sony'
          })
        }
        stmt.free()
      } catch (e) {
        console.error('Error querying Sony bookmark table:', e)
      }
    }
  } catch (err) {
    console.error('Error parsing Sony Reader database:', err)
  }

  return Array.from(booksMap.values()).map(b => ({
    ...b,
    quotesCount: b.quotes.length
  }))
}

/**
 * 4. Scan a connected eReader volume for notes files
 */
export async function scanDeviceForNotes(deviceVolumePath: string): Promise<EReaderScanResult> {
  if (!fs.existsSync(deviceVolumePath)) {
    return {
      success: false,
      deviceType: 'generic',
      deviceName: 'Dispositivo no encontrado',
      booksFound: [],
      message: `La ruta del dispositivo no existe: ${deviceVolumePath}`
    }
  }

  // 1. Check KINDLE
  const kindlePaths = [
    join(deviceVolumePath, 'documents', 'My Clippings.txt'),
    join(deviceVolumePath, 'clippings', 'My Clippings.txt'),
    join(deviceVolumePath, 'My Clippings.txt'),
    join(deviceVolumePath, 'documents', 'my clippings.txt')
  ]
  for (const kp of kindlePaths) {
    if (fs.existsSync(kp)) {
      try {
        const raw = fs.readFileSync(kp, 'utf-8')
        const books = parseKindleClippings(raw)
        return {
          success: true,
          deviceType: 'kindle',
          deviceName: 'Amazon Kindle',
          filePath: kp,
          booksFound: books,
          message: `Se han encontrado ${books.length} libros con notas en Kindle (My Clippings.txt).`
        }
      } catch (e: any) {
        console.error('Error reading Kindle clippings:', e)
      }
    }
  }

  // 2. Check KOBO
  const koboPaths = [
    join(deviceVolumePath, '.kobo', 'KoboReader.sqlite'),
    join(deviceVolumePath, 'KoboReader.sqlite'),
    join(deviceVolumePath, '.kobo', 'kobo.sqlite')
  ]
  for (const kop of koboPaths) {
    if (fs.existsSync(kop)) {
      try {
        const buf = fs.readFileSync(kop)
        const books = await parseKoboDatabase(buf)
        return {
          success: true,
          deviceType: 'kobo',
          deviceName: 'Kobo eReader',
          filePath: kop,
          booksFound: books,
          message: `Se han encontrado ${books.length} libros con notas en Kobo (.kobo/KoboReader.sqlite).`
        }
      } catch (e: any) {
        console.error('Error reading Kobo database:', e)
      }
    }
  }

  // 3. Check SONY READER
  const sonyPaths = [
    join(deviceVolumePath, 'Sony_Reader', 'database', 'books.db'),
    join(deviceVolumePath, 'Sony Reader', 'database', 'books.db'),
    join(deviceVolumePath, 'database', 'books.db'),
    join(deviceVolumePath, 'books.db'),
    join(deviceVolumePath, 'Sony_Reader', 'books.db')
  ]
  for (const sp of sonyPaths) {
    if (fs.existsSync(sp)) {
      try {
        const buf = fs.readFileSync(sp)
        const books = await parseSonyReaderDatabase(buf)
        return {
          success: true,
          deviceType: 'sony',
          deviceName: 'Sony Reader',
          filePath: sp,
          booksFound: books,
          message: `Se han encontrado ${books.length} libros con notas en Sony Reader (${basename(sp)}).`
        }
      } catch (e: any) {
        console.error('Error reading Sony database:', e)
      }
    }
  }

  // 4. Check for generic / Tolino text notes
  const genericTextPaths = [
    join(deviceVolumePath, 'notes.txt'),
    join(deviceVolumePath, 'Notes.txt'),
    join(deviceVolumePath, 'notes')
  ]
  for (const gp of genericTextPaths) {
    if (fs.existsSync(gp) && fs.statSync(gp).isFile()) {
      try {
        const raw = fs.readFileSync(gp, 'utf-8')
        const books = parseKindleClippings(raw)
        if (books.length > 0) {
          return {
            success: true,
            deviceType: 'generic',
            deviceName: 'eReader / USB',
            filePath: gp,
            booksFound: books,
            message: `Se han encontrado notas en ${basename(gp)}.`
          }
        }
      } catch {}
    }
  }

  return {
    success: false,
    deviceType: 'generic',
    deviceName: 'eReader conectado',
    booksFound: [],
    message: 'No se encontraron archivos de notas compatibles (Kindle My Clippings.txt, KoboReader.sqlite, Sony books.db) en la unidad conectada.'
  }
}

/**
 * 5. Parse a user-selected file directly (Kindle txt, Kobo/Sony sqlite, JSON)
 */
export async function parseNotesFile(filePath: string): Promise<EReaderScanResult> {
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      deviceType: 'generic',
      deviceName: 'Archivo',
      booksFound: [],
      message: 'El archivo seleccionado no existe.'
    }
  }

  const ext = (filePath.split('.').pop() || '').toLowerCase()
  const fileName = basename(filePath).toLowerCase()

  // 1. Text format (Kindle My Clippings or notes)
  if (ext === 'txt' || ext === 'text') {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const books = parseKindleClippings(raw)
      return {
        success: true,
        deviceType: fileName.includes('clipping') ? 'kindle' : 'generic',
        deviceName: fileName.includes('clipping') ? 'Kindle Clippings' : 'Archivo de notas',
        filePath,
        booksFound: books,
        message: `Se han encontrado ${books.length} libros con notas en ${basename(filePath)}.`
      }
    } catch (e: any) {
      return {
        success: false,
        deviceType: 'generic',
        deviceName: 'Archivo de texto',
        booksFound: [],
        message: `Error al leer archivo de texto: ${e.message}`
      }
    }
  }

  // 2. SQLite format (Kobo or Sony)
  if (ext === 'sqlite' || ext === 'db' || ext === 'sqlite3') {
    try {
      const buf = fs.readFileSync(filePath)
      // Try Kobo first
      const koboBooks = await parseKoboDatabase(buf)
      if (koboBooks.length > 0) {
        return {
          success: true,
          deviceType: 'kobo',
          deviceName: 'Base de datos Kobo',
          filePath,
          booksFound: koboBooks,
          message: `Se han encontrado ${koboBooks.length} libros con notas en ${basename(filePath)}.`
        }
      }

      // Try Sony next
      const sonyBooks = await parseSonyReaderDatabase(buf)
      if (sonyBooks.length > 0) {
        return {
          success: true,
          deviceType: 'sony',
          deviceName: 'Base de datos Sony Reader',
          filePath,
          booksFound: sonyBooks,
          message: `Se han encontrado ${sonyBooks.length} libros con notas en ${basename(filePath)}.`
        }
      }

      return {
        success: false,
        deviceType: 'generic',
        deviceName: basename(filePath),
        booksFound: [],
        message: 'No se encontraron registros de subrayados o notas en las tablas de esta base de datos SQLite.'
      }
    } catch (e: any) {
      return {
        success: false,
        deviceType: 'generic',
        deviceName: 'Base de datos',
        booksFound: [],
        message: `Error al leer base de datos: ${e.message}`
      }
    }
  }

  // 3. JSON format
  if (ext === 'json') {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      const books: BookWithQuotes[] = []
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.title && Array.isArray(item.quotes)) {
            books.push({
              title: item.title,
              author: item.author,
              quotesCount: item.quotes.length,
              quotes: item.quotes
            })
          }
        }
      }
      return {
        success: true,
        deviceType: 'generic',
        deviceName: 'Archivo JSON',
        filePath,
        booksFound: books,
        message: `Se han importado ${books.length} títulos desde el archivo JSON.`
      }
    } catch (e: any) {
      return {
        success: false,
        deviceType: 'generic',
        deviceName: 'JSON',
        booksFound: [],
        message: `Error al leer archivo JSON: ${e.message}`
      }
    }
  }

  return {
    success: false,
    deviceType: 'generic',
    deviceName: basename(filePath),
    booksFound: [],
    message: 'Formato no soportado. Por favor, selecciona un archivo My Clippings.txt, KoboReader.sqlite, books.db o .json.'
  }
}

/**
 * 6. Finds matching quotes for a target book title
 */
export function findMatchingQuotesForTitle(booksFound: BookWithQuotes[], targetTitle: string): { matchedBook: BookWithQuotes | null; confidence: number } {
  if (!booksFound || booksFound.length === 0 || !targetTitle) {
    return { matchedBook: null, confidence: 0 }
  }

  const targetNorm = normalizeTitleForMatch(targetTitle)
  const targetTokens = new Set(targetNorm.split(' ').filter(w => w.length > 2))

  let bestMatch: BookWithQuotes | null = null
  let bestScore = 0

  for (const b of booksFound) {
    const bookNorm = normalizeTitleForMatch(b.title)

    // Exact normalized match
    if (bookNorm === targetNorm) {
      return { matchedBook: b, confidence: 100 }
    }

    // Substring match
    if (bookNorm.includes(targetNorm) || targetNorm.includes(bookNorm)) {
      const score = 85
      if (score > bestScore) {
        bestScore = score
        bestMatch = b
      }
      continue
    }

    // Token overlap
    const bookTokens = bookNorm.split(' ').filter(w => w.length > 2)
    let overlap = 0
    for (const t of bookTokens) {
      if (targetTokens.has(t)) overlap++
    }
    const score = targetTokens.size > 0 ? (overlap / Math.max(targetTokens.size, bookTokens.length)) * 80 : 0
    if (score > bestScore) {
      bestScore = score
      bestMatch = b
    }
  }

  if (bestScore >= 40) {
    return { matchedBook: bestMatch, confidence: Math.round(bestScore) }
  }

  return { matchedBook: null, confidence: 0 }
}
