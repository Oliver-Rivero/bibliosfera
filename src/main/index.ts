import { app, shell, BrowserWindow, ipcMain, screen, dialog } from 'electron'
import { join, dirname, posix } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import {
  initDatabase,
  getStoredBooks as sqliteGetBooks,
  setStoredBooks as sqliteSetBooks,
  getStoredLibrary as sqliteGetLibrary,
  setStoredLibrary as sqliteSetLibrary,
  flushToDisk
} from './db'

function getBooksFile() {
  const newPath = join(app.getPath('userData'), 'bibliosfera-books.json')
  const legacyPath = join(app.getPath('userData'), 'bibliograma-books.json')
  if (!fs.existsSync(newPath) && fs.existsSync(legacyPath)) {
    try {
      fs.copyFileSync(legacyPath, newPath)
    } catch {
      return legacyPath
    }
  }
  return newPath
}

function getConfigFile() {
  return join(app.getPath('userData'), 'bibliosfera-config.json')
}

function getAppConfig(): { libraryStorageDir?: string; themeName?: string } {
  try {
    const file = getConfigFile()
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch (e) {}
  return {}
}

function setAppConfig(updates: { libraryStorageDir?: string; themeName?: string }) {
  try {
    const current = getAppConfig()
    const next = { ...current, ...updates }
    fs.writeFileSync(getConfigFile(), JSON.stringify(next, null, 2), 'utf-8')
    return next
  } catch (e) {
    console.error('Error saving app config:', e)
    return getAppConfig()
  }
}

function getDefaultLibraryFilesDir() {
  return join(app.getPath('userData'), 'library_files')
}

function getLibraryFilesDir() {
  const cfg = getAppConfig()
  if (cfg.libraryStorageDir && cfg.libraryStorageDir.trim()) {
    try {
      if (!fs.existsSync(cfg.libraryStorageDir)) {
        fs.mkdirSync(cfg.libraryStorageDir, { recursive: true })
      }
      return cfg.libraryStorageDir
    } catch (e) {
      console.error('Custom libraryStorageDir inaccessible, falling back to default:', e)
    }
  }
  const dir = getDefaultLibraryFilesDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function detectPagesFromFile(filePath: string, format?: string): string {
  try {
    const cp = require('child_process')
    const ext = (format || filePath.split('.').pop() || '').toLowerCase()

    if (ext === 'pdf') {
      // 1. Try native macOS Spotlight metadata (mdls)
      if (process.platform === 'darwin') {
        try {
          const out = cp.execFileSync('/usr/bin/mdls', ['-name', 'kMDItemNumberOfPages', '-raw', filePath], { encoding: 'utf-8', timeout: 3000 }).trim()
          if (out && out !== '(null)' && !isNaN(parseInt(out)) && parseInt(out) > 0) {
            return String(parseInt(out))
          }
        } catch (e) {}
      }

      // 2. Scan PDF buffer for /Count N in page tree
      try {
        const buf = fs.readFileSync(filePath)
        const text = buf.toString('binary')
        const countMatches = text.match(/\/Count\s+(\d+)/g)
        if (countMatches && countMatches.length > 0) {
          const counts = countMatches.map(m => {
            const num = m.match(/\d+/)
            return num ? parseInt(num[0]) : 0
          }).filter(n => n > 0)
          if (counts.length > 0) {
            return String(Math.max(...counts))
          }
        }

        // 3. Count /Type /Page
        const pageMatches = text.match(/\/Type\s*\/Page(?=[\s\/><\[])/g)
        if (pageMatches && pageMatches.length > 0) {
          return String(pageMatches.length)
        }
      } catch (pe) {}
    } else if (ext === 'epub') {
      // 1. Check OPF metadata
      try {
        const containerXml = cp.execFileSync('/usr/bin/unzip', ['-p', filePath, 'META-INF/container.xml'], { encoding: 'utf-8', maxBuffer: 1024 * 1024 })
        const match = containerXml.match(/full-path=["\x27]([^"\x27]+)["\x27]/i)
        if (match) {
          const opfXml = cp.execFileSync('/usr/bin/unzip', ['-p', filePath, match[1]], { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 })
          const pageMetaMatch = opfXml.match(/<(?:meta|dc:format)[^>]*?(?:page|numberOfPages|page_count)[^>]*?>\s*(\d+)\s*</i)
            || opfXml.match(/<meta[^>]+content=["\x27](\d+)["\x27][^>]+name=["\x27](?:calibre:page_count|numberOfPages|pages)["\x27]/i)
            || opfXml.match(/<meta[^>]+name=["\x27](?:calibre:page_count|numberOfPages|pages)["\x27][^>]+content=["\x27](\d+)["\x27]/i)
          if (pageMetaMatch && parseInt(pageMetaMatch[1]) > 5) {
            return String(parseInt(pageMetaMatch[1]))
          }
        }
      } catch (e) {}

      // 2. Estimate from uncompressed text volume (publishing standard: ~1,600 chars / ~270 words per printed book page)
      try {
        const listOutput = cp.execFileSync('/usr/bin/unzip', ['-l', filePath], { encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 })
        const lines = listOutput.split('\n')
        let totalTextBytes = 0
        for (const line of lines) {
          const m = line.trim().match(/^(\d+)\s+[\d-]+\s+[\d:]+\s+(.+)$/)
          if (m) {
            const size = parseInt(m[1])
            const filename = m[2].toLowerCase()
            if ((filename.endsWith('.xhtml') || filename.endsWith('.html') || filename.endsWith('.htm')) &&
                !filename.includes('toc') && !filename.includes('nav') && !filename.includes('cover')) {
              totalTextBytes += size
            }
          }
        }
        if (totalTextBytes > 1000) {
          const estimated = Math.max(1, Math.round((totalTextBytes * 0.68) / 1600))
          return String(estimated)
        }
      } catch (ee) {}
    }
  } catch (err) {
    console.error('Error detecting pages from file:', err)
  }
  return ''
}

function getStoredBooks(): any[] {
  try {
    const sqliteBooks = sqliteGetBooks()
    if (Array.isArray(sqliteBooks) && sqliteBooks.length > 0) {
      return sqliteBooks
    }
    // Fallback to JSON if SQLite was just created and not yet populated
    const file = getBooksFile()
    if (fs.existsSync(file)) {
      const books = JSON.parse(fs.readFileSync(file, 'utf-8'))
      if (Array.isArray(books) && books.length > 0) {
        sqliteSetBooks(books)
        return books
      }
    }
    return sqliteBooks || []
  } catch (e) {
    console.error('Error in getStoredBooks:', e)
    return []
  }
}

function setStoredBooks(books: any[]) {
  try {
    sqliteSetBooks(books)
    // Keep JSON file synced as an automatic backup
    try {
      fs.writeFileSync(getBooksFile(), JSON.stringify(books, null, 2))
    } catch {}
  } catch (e) {
    console.error('Error saving books:', e)
  }
}

function getLibraryFile() {
  const newPath = join(app.getPath('userData'), 'bibliosfera-library.json')
  const legacyPath = join(app.getPath('userData'), 'bibliograma-library.json')
  if (!fs.existsSync(newPath) && fs.existsSync(legacyPath)) {
    try {
      fs.copyFileSync(legacyPath, newPath)
    } catch {
      return legacyPath
    }
  }
  return newPath
}

function getStoredLibrary(): any[] {
  try {
    const sqliteLib = sqliteGetLibrary()
    if (Array.isArray(sqliteLib) && sqliteLib.length > 0) {
      return sqliteLib
    }
    // Fallback to JSON if SQLite was just created
    const file = getLibraryFile()
    if (fs.existsSync(file)) {
      const library = JSON.parse(fs.readFileSync(file, 'utf-8'))
      if (Array.isArray(library) && library.length > 0) {
        sqliteSetLibrary(library)
        return library
      }
    }
    return sqliteLib || []
  } catch (e) {
    console.error('Error in getStoredLibrary:', e)
    return []
  }
}

function setStoredLibrary(books: any[]) {
  try {
    sqliteSetLibrary(books)
    // Keep JSON file synced as an automatic backup
    try {
      fs.writeFileSync(getLibraryFile(), JSON.stringify(books, null, 2))
    } catch {}
  } catch (e) {
    console.error('Error saving library:', e)
  }
}

function getCoversDir() {
  const dir = join(app.getPath('userData'), 'covers')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

async function downloadAndSaveCover(bookId: string, remoteUrl?: string): Promise<string> {
  if (!remoteUrl || (!remoteUrl.startsWith('http://') && !remoteUrl.startsWith('https://'))) {
    return remoteUrl || ''
  }
  try {
    const { net } = require('electron')
    const response = await net.fetch(remoteUrl)
    if (!response.ok) return remoteUrl
    const buffer = Buffer.from(await response.arrayBuffer())
    
    // Save physical file to userData/covers/<id>.jpg
    const filePath = join(getCoversDir(), `${bookId}.jpg`)
    fs.writeFileSync(filePath, buffer)
    
    // Return self-contained base64 data URI for offline resilience and fast loading
    const mime = remoteUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch (e) {
    console.error('Error guardando portada local:', e)
    return remoteUrl
  }
}

function createSplashScreen(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 480,
    height: 290,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    show: false,
    hasShadow: true,
    webPreferences: {
      sandbox: false
    }
  })

  let logoBase64 = ''
  try {
    const candidates = [
      join(__dirname, '../../logo.png'),
      join(app.getAppPath(), 'logo.png'),
      join(__dirname, '../../src/renderer/src/assets/logo-light.png'),
      join(app.getAppPath(), 'src/renderer/src/assets/logo-light.png')
    ]
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(c).toString('base64')}`
        break
      }
    }
  } catch {}

  const splashHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: transparent;
          font-family: -apple-system, BlinkMacSystemFont, "DM Sans", "Segoe UI", Roboto, sans-serif;
          user-select: none;
          -webkit-app-region: drag;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
        }
        .card {
          width: 100%;
          height: 100%;
          background: #EEE0D9;
          border: 1.5px solid #d9c8bf;
          border-radius: 26px;
          box-shadow: 0 20px 45px rgba(42, 28, 20, 0.28);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 34px 28px 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .logo-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        .logo {
          max-width: 320px;
          max-height: 84px;
          object-fit: contain;
          filter: drop-shadow(0 2px 4px rgba(42, 28, 20, 0.08));
        }
        .progress-bar-container {
          width: 160px;
          height: 3px;
          background: rgba(40, 86, 102, 0.15);
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .progress-bar {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #285666, #C3DDE6, #285666);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite ease-in-out;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .version-text {
          font-size: 11.5px;
          font-weight: 500;
          color: #6d5a50;
          letter-spacing: 0.02em;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo-wrap">
          ${logoBase64 ? `<img class="logo" src="${logoBase64}" alt="Bibliosfera" />` : '<h1 style="font-size:32px;font-weight:bold;color:#285666;">Bibliosfera</h1>'}
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div class="progress-bar-container">
            <div class="progress-bar"></div>
          </div>
          <p class="version-text">v1.1. Desarrollada por Óliver Rivero © 2026</p>
        </div>
      </div>
    </body>
    </html>
  `

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)

  splash.once('ready-to-show', () => {
    splash.show()
  })

  return splash
}

function createWindow(): void {
  // 1. Show splash screen immediately
  const splash = createSplashScreen()
  const splashStartTime = Date.now()

  // Compute generous window size for large and high-res screens
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const defaultWidth = Math.min(1720, Math.max(1520, Math.round(screenWidth * 0.86)))
  const defaultHeight = Math.min(1150, Math.max(960, Math.round(screenHeight * 0.88)))

  const mainWindow = new BrowserWindow({
    title: 'Bibliosfera',
    width: defaultWidth,
    height: defaultHeight,
    minWidth: 1050,
    minHeight: 700,
    center: true,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  let mainWindowShown = false
  const showMainWindow = () => {
    if (mainWindowShown || mainWindow.isDestroyed()) return
    mainWindowShown = true

    const elapsed = Date.now() - splashStartTime
    const minSplashDuration = 1800 // Smooth natural display of 1.8s
    const remainingTime = Math.max(0, minSplashDuration - elapsed)

    setTimeout(() => {
      if (!splash.isDestroyed()) {
        splash.close()
      }
      if (!mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
      }
    }, remainingTime)
  }

  mainWindow.once('ready-to-show', () => {
    showMainWindow()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.oliver.bibliosfera')

  try {
    await initDatabase(app.getPath('userData'))
  } catch (err) {
    console.error('[SQLite] Error initializing database, falling back to JSON store:', err)
  }

  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(icon)
    } catch (e) {}
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC Store handlers
  ipcMain.handle('get-books', () => {
    return getStoredBooks()
  })

  ipcMain.handle('add-book', async (_, book) => {
    const books = getStoredBooks()
    if (book.coverUrl && (book.coverUrl.startsWith('http://') || book.coverUrl.startsWith('https://'))) {
      book.coverUrl = await downloadAndSaveCover(book.id, book.coverUrl)
    }
    // Enrich missing fields from library book if available (instant local lookup)
    if (book.libraryBookId) {
      const library = getStoredLibrary()
      const libBook = library.find((lb: any) => lb.id === book.libraryBookId)
      if (libBook) {
        if (!book.pages && libBook.pages) book.pages = libBook.pages
        if (!book.synopsis && libBook.synopsis) book.synopsis = libBook.synopsis
        if (!book.genre && libBook.genre) book.genre = libBook.genre
        if (!book.year && libBook.year) book.year = libBook.year
        if (!book.coverUrl && libBook.coverUrl) book.coverUrl = libBook.coverUrl
      }
    }
    const existingIndex = books.findIndex(b => b.id === book.id)
    if (existingIndex >= 0) {
      books[existingIndex] = book
    } else {
      books.push(book)
    }
    setStoredBooks(books)
    return books
  })

  ipcMain.handle('update-book', async (_, updatedBook) => {
    const books = getStoredBooks()
    const index = books.findIndex(b => b.id === updatedBook.id)
    if (updatedBook.coverUrl && (updatedBook.coverUrl.startsWith('http://') || updatedBook.coverUrl.startsWith('https://'))) {
      updatedBook.coverUrl = await downloadAndSaveCover(updatedBook.id, updatedBook.coverUrl)
    }
    if (index !== -1) {
      books[index] = updatedBook
    } else {
      books.push(updatedBook)
    }
    setStoredBooks(books)
    return books
  })

  // -------------------------------------------------------------
  // Book Metadata Search & Enrichment Helper
  // -------------------------------------------------------------
  async function searchBookOnline(query: string): Promise<{
    title: string
    author: string
    coverUrl: string
    genre: string
    year: string
    isbn: string
    synopsis: string
    pages: string
  }> {
    const { net } = require('electron')
    const result = {
      title: query,
      author: '',
      coverUrl: '',
      genre: '',
      year: '',
      isbn: '',
      synopsis: '',
      pages: ''
    }

    const customHeaders = {
      'User-Agent': 'Bibliosfera/1.0 (https://github.com/Oliver-Rivero/bibliosfera; contact@bibliosfera.app)'
    }

    const cleanText = (text: string) => {
      if (!text) return ''
      return text
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const normalize = (str: string) =>
      (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim()

    const normalizedQuery = normalize(query)
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2)

    try {
      // 1. PRIMARY SOURCE: Google Books API (Gold standard for authentic book synopsis and metadata)
      try {
        const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&printType=books`
        const gbRes = await net.fetch(gbUrl, { headers: customHeaders })
        if (gbRes.ok) {
          const gbData = await gbRes.json()
          if (Array.isArray(gbData.items) && gbData.items.length > 0) {
            // Find best matching item based on title similarity
            const bestItem = gbData.items.find((item: any) => {
              const itemTitle = normalize(item.volumeInfo?.title || '')
              return queryWords.some(w => itemTitle.includes(w))
            }) || gbData.items[0]

            const vi = bestItem.volumeInfo || {}
            if (vi.title) result.title = vi.title
            if (vi.authors && vi.authors.length > 0) result.author = vi.authors.join(', ')
            if (vi.publishedDate) result.year = vi.publishedDate.substring(0, 4)
            if (vi.pageCount) result.pages = String(vi.pageCount)
            if (vi.categories && vi.categories.length > 0) result.genre = vi.categories.slice(0, 2).join(', ')

            // Real authentic synopsis from Google Books!
            if (vi.description && vi.description.length > 20) {
              result.synopsis = cleanText(vi.description)
            }

            // ISBN
            if (Array.isArray(vi.industryIdentifiers)) {
              const isbn13 = vi.industryIdentifiers.find((id: any) => id.type === 'ISBN_13')
              const isbn10 = vi.industryIdentifiers.find((id: any) => id.type === 'ISBN_10')
              result.isbn = isbn13?.identifier || isbn10?.identifier || ''
            }

            // High-res cover thumbnail
            if (vi.imageLinks?.thumbnail || vi.imageLinks?.smallThumbnail) {
              let thumb = vi.imageLinks.thumbnail || vi.imageLinks.smallThumbnail
              thumb = thumb.replace('http://', 'https://')
              result.coverUrl = thumb
            }
          }
        }
      } catch (gbErr) {
        console.error('Google Books error:', gbErr)
      }

      // 2. SECONDARY SOURCE: OpenLibrary API (fills missing pages, cover or synopsis)
      try {
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`
        const olRes = await net.fetch(url, { headers: customHeaders })
        if (olRes.ok) {
          const olData = await olRes.json()
          const doc = olData.docs?.find((d: any) => {
            const docTitle = normalize(d.title || '')
            return queryWords.some(w => docTitle.includes(w))
          }) || olData.docs?.[0]

          if (doc) {
            if (!result.author && doc.author_name) result.author = doc.author_name.join(', ')
            if (!result.year && doc.first_publish_year) result.year = String(doc.first_publish_year)
            if (!result.isbn && doc.isbn?.length > 0) result.isbn = doc.isbn[0]
            if (!result.genre && doc.subject?.length > 0) result.genre = doc.subject.slice(0, 2).join(', ')
            if (!result.coverUrl && doc.cover_i) {
              result.coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
            }
            if (!result.pages) {
              if (doc.number_of_pages_median) result.pages = String(doc.number_of_pages_median)
              else if (doc.number_of_pages) result.pages = String(doc.number_of_pages)
            }

            // Only fetch OpenLibrary work description if synopsis is still missing
            if (!result.synopsis && doc.key) {
              try {
                const workRes = await net.fetch(`https://openlibrary.org${doc.key}.json`, { headers: customHeaders })
                if (workRes.ok) {
                  const workData = await workRes.json()
                  if (workData.description) {
                    const desc = typeof workData.description === 'string'
                      ? workData.description
                      : workData.description.value || ''
                    if (desc && desc.length > 25) {
                      result.synopsis = cleanText(desc)
                    }
                  }
                }
              } catch (we) {}
            }
          }
        }
      } catch (e) {
        console.error('OpenLibrary error:', e)
      }

      // 3. WIKIPEDIA (STRICT LITERARY FALLBACK ONLY)
      // Note: Only query Wikipedia if synopsis is STILL missing, and strictly require the article to be about a book/novel!
      if (!result.synopsis) {
        try {
          const wikiSearchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent('"' + query + '" libro OR novela')}&format=json&utf8=`
          const wikiSearchRes = await net.fetch(wikiSearchUrl, { headers: customHeaders })
          if (wikiSearchRes.ok) {
            const wsData = await wikiSearchRes.json()
            const hits = wsData.query?.search || []
            // Look for a hit that specifically mentions being a literary work or book
            const bookHit = hits.find((h: any) => {
              const snippet = (h.snippet || '').toLowerCase()
              return snippet.includes('novela') || snippet.includes('libro') || snippet.includes('obra') || snippet.includes('escrita por') || snippet.includes('publicada')
            })

            if (bookHit) {
              const sumUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bookHit.title)}`
              const sumRes = await net.fetch(sumUrl, { headers: customHeaders })
              if (sumRes.ok) {
                const sumData = await sumRes.json()
                const desc = (sumData.description || '').toLowerCase()
                // Verify again that this page summary is actually a book or novel
                if (desc.includes('novela') || desc.includes('libro') || desc.includes('obra') || desc.includes('ensayo') || desc.includes('cuento') || desc.includes('relato')) {
                  if (sumData.extract && sumData.extract.length > 30) {
                    result.synopsis = cleanText(sumData.extract)
                  }
                  if (!result.coverUrl && sumData.thumbnail?.source) {
                    result.coverUrl = sumData.thumbnail.source
                  }
                }
              }
            }
          }
        } catch (we) {}
      }
    } catch (e) {
      console.error('Search error:', e)
    }

    return result
  }

  function parseFilenameMetadata(rawFileName: string) {
    let clean = rawFileName.replace(/\.[^/.]+$/, '').trim()
    clean = clean.replace(/\[[^\]]+\]/g, ' ')
    clean = clean.replace(/\((?:spanish edition|edición en español|epub|pdf|mobi|azw3)[^)]*\)/gi, ' ')
    clean = clean.replace(/[_-]+/g, ' ')
    clean = clean.replace(/\s+/g, ' ').trim()

    let possibleTitle = clean
    let possibleAuthor = ''

    if (clean.includes(' - ')) {
      const parts = clean.split(' - ')
      possibleTitle = parts[0].trim()
      possibleAuthor = parts[1].trim()
    } else if (clean.includes(' — ')) {
      const parts = clean.split(' — ')
      possibleTitle = parts[0].trim()
      possibleAuthor = parts[1].trim()
    }
    return { clean, possibleTitle, possibleAuthor }
  }

  function extractEpubMetadata(epubPath: string): { title?: string; author?: string; pages?: string; coverBuffer?: Buffer; coverMime?: string } | null {
    try {
      const cp = require('child_process')
      const containerXml = cp.execFileSync('/usr/bin/unzip', ['-p', epubPath, 'META-INF/container.xml'], { encoding: 'utf-8', maxBuffer: 1024 * 1024 })
      const match = containerXml.match(/full-path=["\x27]([^"\x27]+)["\x27]/i)
      if (!match) return null
      const opfPath = match[1]
      const opfDir = dirname(opfPath)

      const opfXml = cp.execFileSync('/usr/bin/unzip', ['-p', epubPath, opfPath], { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 })
      
      const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)
      const title = titleMatch ? titleMatch[1].trim() : undefined

      const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i)
      const author = authorMatch ? authorMatch[1].trim() : undefined

      let pages: string | undefined
      const pageMetaMatch = opfXml.match(/<(?:meta|dc:format)[^>]*?(?:page|numberOfPages|page_count)[^>]*?>\s*(\d+)\s*</i)
        || opfXml.match(/<meta[^>]+content=["\x27](\d+)["\x27][^>]+name=["\x27](?:calibre:page_count|numberOfPages|pages)["\x27]/i)
        || opfXml.match(/<meta[^>]+name=["\x27](?:calibre:page_count|numberOfPages|pages)["\x27][^>]+content=["\x27](\d+)["\x27]/i)
      if (pageMetaMatch && parseInt(pageMetaMatch[1]) > 5) {
        pages = String(parseInt(pageMetaMatch[1]))
      }

      let coverHref: string | null = null
      const metaCoverMatch = opfXml.match(/<meta[^>]+name=["\x27]cover["\x27][^>]+content=["\x27]([^"\x27]+)["\x27]/i) 
        || opfXml.match(/<meta[^>]+content=["\x27]([^"\x27]+)["\x27][^>]+name=["\x27]cover["\x27]/i)
      
      if (metaCoverMatch) {
        const coverId = metaCoverMatch[1]
        const itemMatch = opfXml.match(new RegExp(`<item[^>]+id=["\x27]${coverId}["\x27][^>]+href=["\x27]([^"\x27]+)["\x27]`, 'i'))
          || opfXml.match(new RegExp(`<item[^>]+href=["\x27]([^"\x27]+)["\x27][^>]+id=["\x27]${coverId}["\x27]`, 'i'))
        if (itemMatch) coverHref = itemMatch[1]
      }
      if (!coverHref) {
        const propMatch = opfXml.match(/<item[^>]+properties=["\x27][^"\x27]*cover-image[^"\x27]*["\x27][^>]+href=["\x27]([^"\x27]+)["\x27]/i)
          || opfXml.match(/<item[^>]+href=["\x27]([^"\x27]+)["\x27][^>]+properties=["\x27][^"\x27]*cover-image/i)
        if (propMatch) coverHref = propMatch[1]
      }

      let coverBuffer: Buffer | null = null
      let coverMime = 'image/jpeg'
      if (coverHref) {
        const fullCoverPath = opfDir === '.' ? coverHref : posix.join(opfDir, coverHref)
        try {
          coverBuffer = cp.execFileSync('/usr/bin/unzip', ['-p', epubPath, fullCoverPath], { maxBuffer: 10 * 1024 * 1024 })
          if (coverHref.toLowerCase().endsWith('.png')) coverMime = 'image/png'
        } catch (ce) {}
      }

      return { title, author, pages, coverBuffer: coverBuffer || undefined, coverMime }
    } catch (err) {
      return null
    }
  }

  ipcMain.handle('search-book', async (_, query) => {
    return searchBookOnline(query)
  })

  ipcMain.handle('delete-book', (_, id) => {
    const books = getStoredBooks()
    const filtered = books.filter(b => b.id !== id)
    setStoredBooks(filtered)
    try {
      const coverFile = join(getCoversDir(), `${id}.jpg`)
      if (fs.existsSync(coverFile)) {
        fs.unlinkSync(coverFile)
      }
    } catch (e) {
      console.error('Error borrando archivo de portada:', e)
    }
    return filtered
  })

  // -------------------------------------------------------------
  // Digital Library (Calibre-style) IPC Handlers
  // -------------------------------------------------------------
  ipcMain.handle('get-library-books', async () => {
    const library = getStoredLibrary()
    return Array.isArray(library) ? library : []
  })

  async function importAndAnalyzeBookFile(sourcePath: string, existingLibrary: any[]): Promise<any | null> {
    try {
      const ext = (sourcePath.split('.').pop() || 'epub').toLowerCase()
      const rawFileName = sourcePath.split(/[/\\]/).pop() || 'libro'
      const { clean, possibleTitle, possibleAuthor } = parseFilenameMetadata(rawFileName)

      // Avoid importing exact duplicate file if already in library
      const normClean = clean.toLowerCase().trim()
      const alreadyExists = existingLibrary.some(b => {
        const bNorm = (b.title || '').toLowerCase().trim()
        return b.format === ext && bNorm && (bNorm === normClean || bNorm === (possibleTitle || '').toLowerCase().trim())
      })
      if (alreadyExists) {
        return null
      }

      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      const targetFileName = `${id}.${ext}`
      const targetPath = join(getLibraryFilesDir(), targetFileName)

      // Copy physical file to library folder (unless sourcePath is already targetPath)
      if (sourcePath !== targetPath) {
        fs.copyFileSync(sourcePath, targetPath)
      }
      const stats = fs.statSync(targetPath)

      // 1. Try EPUB internal metadata
      const epubMeta = ext === 'epub' ? extractEpubMetadata(targetPath) : null

      // 2. Local page detection from file (works for both PDF and EPUB)
      let pages = detectPagesFromFile(targetPath, ext) || epubMeta?.pages || ''

      let title = epubMeta?.title || possibleTitle || clean
      let author = epubMeta?.author || possibleAuthor || 'Autor desconocido'
      let coverUrl = ''
      let year = ''
      let genre = ''
      let synopsis = ''

      // If EPUB has embedded cover, save it
      if (epubMeta?.coverBuffer) {
        try {
          const coverPath = join(getCoversDir(), `lib_${id}.jpg`)
          fs.writeFileSync(coverPath, epubMeta.coverBuffer)
          coverUrl = `data:${epubMeta.coverMime || 'image/jpeg'};base64,${epubMeta.coverBuffer.toString('base64')}`
        } catch (e) {
          console.error('Error saving epub cover buffer:', e)
        }
      }

      // 3. Search online using OpenLibrary / Wikipedia to get missing metadata (author, cover, synopsis, genre, year, pages)
      const searchQueries = [
        epubMeta?.title && epubMeta?.author ? `${epubMeta.title} ${epubMeta.author}` : null,
        epubMeta?.title || null,
        clean,
        possibleTitle && possibleAuthor ? `${possibleTitle} ${possibleAuthor}` : null,
        possibleTitle || null
      ].filter((q): q is string => Boolean(q && q.trim().length > 1))

      for (const queryToTry of searchQueries) {
        if (title && author && author !== 'Autor desconocido' && coverUrl && synopsis && genre && year && pages) {
          break
        }
        try {
          const online = await searchBookOnline(queryToTry)
          if (online) {
            if ((!title || title === clean) && online.title && online.title.length > 1) {
              title = online.title
            }
            if ((!author || author === 'Autor desconocido') && online.author) {
              author = online.author
            }
            if (!pages && online.pages) pages = online.pages
            if (!year && online.year) year = online.year
            if (!genre && online.genre) genre = online.genre
            if (!synopsis && online.synopsis) synopsis = online.synopsis

            if (!coverUrl && online.coverUrl) {
              coverUrl = await downloadAndSaveCover(`lib_${id}`, online.coverUrl)
            }
          }
        } catch (se) {
          console.error('Error auto-searching book metadata for query:', queryToTry, se)
        }
      }

      return {
        id,
        title,
        author: author || 'Autor desconocido',
        format: ext,
        fileName: targetFileName,
        fileSize: stats.size,
        dateAdded: new Date().toISOString(),
        status: 'pending',
        coverUrl,
        pages,
        year,
        genre,
        synopsis
      }
    } catch (err) {
      console.error('Error importing book file:', sourcePath, err)
      return null
    }
  }

  ipcMain.handle('upload-library-book', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Añadir libro electrónico a tu Biblioteca',
      buttonLabel: 'Importar a mi biblioteca',
      properties: ['openFile'],
      filters: [
        { name: 'Libros electrónicos', extensions: ['epub', 'pdf', 'mobi', 'azw3', 'txt', 'cbz', 'cbr'] }
      ]
    })

    if (res.canceled || res.filePaths.length === 0) return null

    const library = getStoredLibrary()
    const newBook = await importAndAnalyzeBookFile(res.filePaths[0], [])
    if (!newBook) return null

    library.unshift(newBook)
    setStoredLibrary(library)
    return newBook
  })

  // Import an entire folder of e-book files as a library, analyzing each file for metadata
  ipcMain.handle('import-library-folder', async () => {
    const dirRes = await dialog.showOpenDialog({
      title: 'Seleccionar carpeta con archivos de libros para importar y analizar',
      buttonLabel: 'Importar y analizar carpeta',
      properties: ['openDirectory']
    })

    if (dirRes.canceled || dirRes.filePaths.length === 0) {
      return { success: false, count: 0, message: 'Importación cancelada.' }
    }

    const rootFolder = dirRes.filePaths[0]
    const validExts = new Set(['epub', 'pdf', 'mobi', 'azw3', 'txt', 'cbz', 'cbr'])
    const foundFiles: string[] = []

    const scanFolderRecursive = (dir: string, depth = 0) => {
      if (depth > 3) return
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name.startsWith('._')) continue
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            scanFolderRecursive(fullPath, depth + 1)
          } else if (entry.isFile()) {
            const ext = (entry.name.split('.').pop() || '').toLowerCase()
            if (validExts.has(ext)) {
              foundFiles.push(fullPath)
            }
          }
        }
      } catch (e) {}
    }

    scanFolderRecursive(rootFolder)

    if (foundFiles.length === 0) {
      return {
        success: false,
        count: 0,
        message: 'No se encontraron archivos compatibles (.epub, .pdf, .mobi, .azw3, .txt, .cbz, .cbr) en la carpeta seleccionada.'
      }
    }

    const library = getStoredLibrary()
    let importedCount = 0
    let skippedCount = 0

    for (const filePath of foundFiles) {
      const analyzed = await importAndAnalyzeBookFile(filePath, library)
      if (analyzed) {
        library.unshift(analyzed)
        importedCount++
      } else {
        skippedCount++
      }
    }

    if (importedCount > 0) {
      setStoredLibrary(library)
    }

    const skippedMsg = skippedCount > 0 ? ` (${skippedCount} omitidos por estar ya en la biblioteca)` : ''
    return {
      success: true,
      count: importedCount,
      totalScanned: foundFiles.length,
      message: `¡Análisis completado! Se han importado y catalogado ${importedCount} de ${foundFiles.length} libros encontrados${skippedMsg}.`
    }
  })

  // Library Storage Folder Management
  ipcMain.handle('get-library-storage-dir', () => {
    const cfg = getAppConfig()
    const currentPath = getLibraryFilesDir()
    const defaultPath = getDefaultLibraryFilesDir()
    const rawTheme = cfg.themeName || 'clasico'
    const normalizedTheme = rawTheme === 'elegante' ? 'clasico' : rawTheme === 'exlibris' ? 'pergamino' : rawTheme
    return {
      path: currentPath,
      defaultPath,
      isCustom: Boolean(cfg.libraryStorageDir && cfg.libraryStorageDir !== defaultPath),
      themeName: normalizedTheme
    }
  })

  ipcMain.handle('select-library-storage-dir', async () => {
    const oldDir = getLibraryFilesDir()
    const dirRes = await dialog.showOpenDialog({
      title: 'Elegir carpeta de almacenamiento para la Biblioteca digital',
      buttonLabel: 'Usar como carpeta de Biblioteca',
      defaultPath: oldDir,
      properties: ['openDirectory', 'createDirectory']
    })

    if (dirRes.canceled || dirRes.filePaths.length === 0) {
      return { success: false, message: 'Operación cancelada.' }
    }

    const newDir = dirRes.filePaths[0]
    if (newDir === oldDir) {
      return {
        success: true,
        path: newDir,
        isCustom: newDir !== getDefaultLibraryFilesDir(),
        message: 'La carpeta seleccionada ya es la carpeta de almacenamiento actual.'
      }
    }

    try {
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true })
      }
      // Migrate existing library files to the new storage folder
      const library = getStoredLibrary()
      let migrated = 0
      for (const book of library) {
        if (!book.fileName) continue
        const src = join(oldDir, book.fileName)
        const dest = join(newDir, book.fileName)
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
          try {
            fs.copyFileSync(src, dest)
            migrated++
          } catch (e) {}
        }
      }

      setAppConfig({ libraryStorageDir: newDir })
      return {
        success: true,
        path: newDir,
        isCustom: newDir !== getDefaultLibraryFilesDir(),
        migratedCount: migrated,
        message: `¡Carpeta de almacenamiento actualizada!\nUbicación: ${newDir}${migrated > 0 ? `\n(${migrated} archivos trasladados a la nueva carpeta)` : ''}`
      }
    } catch (e: any) {
      return { success: false, message: `No se pudo cambiar la carpeta de almacenamiento: ${e.message}` }
    }
  })

  ipcMain.handle('reset-library-storage-dir', async () => {
    const oldDir = getLibraryFilesDir()
    const defaultDir = getDefaultLibraryFilesDir()
    if (oldDir !== defaultDir) {
      try {
        if (!fs.existsSync(defaultDir)) {
          fs.mkdirSync(defaultDir, { recursive: true })
        }
        const library = getStoredLibrary()
        for (const book of library) {
          if (!book.fileName) continue
          const src = join(oldDir, book.fileName)
          const dest = join(defaultDir, book.fileName)
          if (fs.existsSync(src) && !fs.existsSync(dest)) {
            try {
              fs.copyFileSync(src, dest)
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
    setAppConfig({ libraryStorageDir: '' })
    return {
      success: true,
      path: defaultDir,
      isCustom: false,
      message: `Se ha restaurado la carpeta de almacenamiento predeterminada:\n${defaultDir}`
    }
  })

  ipcMain.handle('open-library-storage-dir', () => {
    const dir = getLibraryFilesDir()
    shell.openPath(dir)
    return { success: true, path: dir }
  })

  ipcMain.handle('set-app-theme', (_, themeName: string) => {
    setAppConfig({ themeName })
    return { success: true, themeName }
  })

  ipcMain.handle('enrich-library-book', async (_, id, customQuery) => {
    const library = getStoredLibrary()
    const book = library.find(b => b.id === id)
    if (!book) return null

    const query = customQuery || `${book.title} ${book.author !== 'Autor desconocido' ? book.author : ''}`.trim()
    const online = await searchBookOnline(query)
    if (online) {
      if (online.title && online.title.length > 1) book.title = online.title
      if (online.author) book.author = online.author
      if (online.coverUrl) {
        book.coverUrl = await downloadAndSaveCover(`lib_${book.id}`, online.coverUrl)
      }
      if (online.pages) {
        book.pages = online.pages
      } else if (!book.pages && book.fileName) {
        const filePath = join(getLibraryFilesDir(), book.fileName)
        if (fs.existsSync(filePath)) {
          const detected = detectPagesFromFile(filePath, book.format)
          if (detected) book.pages = detected
        }
      }
      if (online.year) book.year = online.year
      if (online.genre) book.genre = online.genre
      if (online.synopsis) book.synopsis = online.synopsis
      setStoredLibrary(library)
    }
    return book
  })

  ipcMain.handle('update-library-book', (_, bookOrId, updates) => {
    const library = getStoredLibrary()
    let id: string
    let patch: any
    if (typeof bookOrId === 'string') {
      id = bookOrId
      patch = updates || {}
    } else {
      id = bookOrId.id
      patch = bookOrId
    }
    const idx = library.findIndex(b => b.id === id)
    if (idx !== -1) {
      library[idx] = { ...library[idx], ...patch }
      setStoredLibrary(library)
    }
    return library
  })

  ipcMain.handle('reorder-library-books', (_, orderedIds: string[]) => {
    const library = getStoredLibrary()
    const map = new Map(library.map(b => [b.id, b]))
    const newOrder: any[] = []
    orderedIds.forEach((id, idx) => {
      const b = map.get(id)
      if (b) {
        b.sortOrder = idx
        newOrder.push(b)
        map.delete(id)
      }
    })
    // Append any books that weren't in orderedIds at the end
    map.forEach(b => {
      b.sortOrder = newOrder.length
      newOrder.push(b)
    })
    setStoredLibrary(newOrder)
    return newOrder
  })

  ipcMain.handle('delete-library-book', (_, id) => {
    const library = getStoredLibrary()
    const book = library.find(b => b.id === id)
    if (book && book.fileName) {
      try {
        const filePath = join(getLibraryFilesDir(), book.fileName)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (e) {
        console.error('Error eliminando archivo físico de biblioteca:', e)
      }
    }
    try {
      const coverPath = join(getCoversDir(), `lib_${id}.jpg`)
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath)
      }
    } catch (e) {}
    const filtered = library.filter(b => b.id !== id)
    setStoredLibrary(filtered)
    return filtered
  })

  ipcMain.handle('delete-multiple-library-books', (_, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return getStoredLibrary()
    const idSet = new Set(ids)
    const library = getStoredLibrary()
    for (const book of library) {
      if (idSet.has(book.id)) {
        if (book.fileName) {
          try {
            const filePath = join(getLibraryFilesDir(), book.fileName)
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
            }
          } catch (e) {
            console.error('Error eliminando archivo físico de biblioteca:', e)
          }
        }
        try {
          const coverPath = join(getCoversDir(), `lib_${book.id}.jpg`)
          if (fs.existsSync(coverPath)) {
            fs.unlinkSync(coverPath)
          }
        } catch (e) {}
      }
    }
    const filtered = library.filter(b => !idSet.has(b.id))
    setStoredLibrary(filtered)
    return filtered
  })

  ipcMain.handle('open-library-book', async (_, id) => {
    const library = getStoredLibrary()
    const book = library.find(b => b.id === id)
    if (!book || !book.fileName) return false
    const filePath = join(getLibraryFilesDir(), book.fileName)
    if (!fs.existsSync(filePath)) return false
    await shell.openPath(filePath)
    return true
  })

  ipcMain.handle('show-library-book-in-folder', async (_, id) => {
    const library = getStoredLibrary()
    const book = library.find(b => b.id === id)
    if (!book || !book.fileName) return false
    const filePath = join(getLibraryFilesDir(), book.fileName)
    if (!fs.existsSync(filePath)) return false
    shell.showItemInFolder(filePath)
    return true
  })

  // -------------------------------------------------------------
  // eReader Device Detection & Transfer Handlers
  // -------------------------------------------------------------
  interface ConnectedDevice {
    connected: boolean
    name: string
    volumePath: string
    targetFolder: string
  }

  function getConnectedEReader(): ConnectedDevice | null {
    if (process.platform === 'darwin') {
      try {
        const volumes = fs.readdirSync('/Volumes')
        for (const vol of volumes) {
          if (vol === 'Macintosh HD' || vol === 'Data' || vol.startsWith('.')) continue
          const fullVol = join('/Volumes', vol)
          const lower = vol.toLowerCase()

          const isKindle = lower.includes('kindle')
          const isKobo = lower.includes('kobo')
          const isTolino = lower.includes('tolino')
          const isPocketBook = lower.includes('pocketbook') || lower.startsWith('pb')
          const isGenericReader = lower.includes('reader') || lower.includes('ereader') || lower.includes('ebook')

          const kindleDocs = join(fullVol, 'documents')
          const genericBooks = join(fullVol, 'books')
          const genericEbooks = join(fullVol, 'ebooks')
          const genericMyFiles = join(fullVol, 'my files', 'books')

          if (isKindle) {
            return {
              connected: true,
              name: 'eReader / USB',
              volumePath: fullVol,
              targetFolder: fs.existsSync(kindleDocs) ? kindleDocs : fullVol
            }
          }
          if (isKobo || fs.existsSync(join(fullVol, '.kobo'))) {
            return {
              connected: true,
              name: 'eReader / USB',
              volumePath: fullVol,
              targetFolder: fs.existsSync(genericBooks) ? genericBooks : fullVol
            }
          }
          if (isTolino) {
            return {
              connected: true,
              name: 'Tolino eReader',
              volumePath: fullVol,
              targetFolder: fs.existsSync(join(fullVol, 'Books')) ? join(fullVol, 'Books') : fullVol
            }
          }
          if (isPocketBook) {
            return {
              connected: true,
              name: 'PocketBook',
              volumePath: fullVol,
              targetFolder: fs.existsSync(genericBooks) ? genericBooks : fullVol
            }
          }
          if (isGenericReader || fs.existsSync(kindleDocs) || fs.existsSync(genericBooks) || fs.existsSync(genericEbooks) || fs.existsSync(genericMyFiles)) {
            const target = fs.existsSync(kindleDocs) ? kindleDocs :
                           fs.existsSync(genericBooks) ? genericBooks :
                           fs.existsSync(genericEbooks) ? genericEbooks :
                           fs.existsSync(genericMyFiles) ? genericMyFiles : fullVol
            return {
              connected: true,
              name: vol,
              volumePath: fullVol,
              targetFolder: target
            }
          }
        }
      } catch (e) {
        console.error('Error scanning /Volumes:', e)
      }
    } else if (process.platform === 'win32') {
      try {
        const letters = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
        for (const l of letters) {
          const root = `${l}:\\`
          try {
            if (!fs.existsSync(root)) continue
            const kindleDocs = join(root, 'documents')
            const koboFolder = join(root, '.kobo')
            const genericBooks = join(root, 'books')
            const genericEbooks = join(root, 'ebooks')
            const genericMyFiles = join(root, 'my files', 'books')

            if (fs.existsSync(kindleDocs)) {
              return {
                connected: true,
                name: `Kindle (${l}:)`,
                volumePath: root,
                targetFolder: kindleDocs
              }
            }
            if (fs.existsSync(koboFolder)) {
              return {
                connected: true,
                name: `Kobo (${l}:)`,
                volumePath: root,
                targetFolder: fs.existsSync(genericBooks) ? genericBooks : root
              }
            }
            if (fs.existsSync(genericBooks) || fs.existsSync(genericEbooks) || fs.existsSync(genericMyFiles)) {
              const target = fs.existsSync(genericBooks) ? genericBooks :
                             fs.existsSync(genericEbooks) ? genericEbooks :
                             fs.existsSync(genericMyFiles) ? genericMyFiles : root
              return {
                connected: true,
                name: `eReader / USB (${l}:)`,
                volumePath: root,
                targetFolder: target
              }
            }
          } catch {}
        }
      } catch (e) {
        console.error('Error scanning Windows drives:', e)
      }
    }
    return null
  }

  ipcMain.handle('get-connected-device', () => {
    return getConnectedEReader()
  })

  ipcMain.handle('send-to-device', async (_, id) => {
    const library = getStoredLibrary()
    const book = library.find(b => b.id === id)
    if (!book || !book.fileName) {
      return { success: false, message: 'Libro no encontrado en el registro' }
    }
    const sourcePath = join(getLibraryFilesDir(), book.fileName)
    if (!fs.existsSync(sourcePath)) {
      return { success: false, message: 'El archivo físico no existe en el disco' }
    }

    const detected = getConnectedEReader()
    const targetDir = detected ? detected.targetFolder : ''

    if (!targetDir) {
      return {
        success: false,
        message: 'No hay ningún eReader conectado. Conecta un eReader a tu equipo para realizar la transferencia.'
      }
    }

    try {
      const sanitizedTitle = (book.title || 'libro').replace(/[/\\?%*:|"<>]/g, '')
      const destFile = join(targetDir, `${sanitizedTitle}.${book.format}`)
      fs.copyFileSync(sourcePath, destFile)
      const deviceName = detected ? detected.name : 'tu dispositivo'
      return { 
        success: true, 
        message: `¡Copiado con éxito a ${deviceName}!\nDestino: ${destFile}` 
      }
    } catch (err: any) {
      return { success: false, message: `Error al copiar al dispositivo: ${err.message}` }
    }
  })

  ipcMain.handle('send-multiple-to-device', async (_, bookIds: string[], customTargetFolder?: string) => {
    if (!bookIds || bookIds.length === 0) {
      return { success: false, count: 0, message: 'No hay libros seleccionados para transferir.' }
    }
    const library = getStoredLibrary()
    const detected = getConnectedEReader()
    const targetDir = customTargetFolder || (detected ? detected.targetFolder : '')

    if (!targetDir) {
      return {
        success: false,
        count: 0,
        message: 'No hay ningún eReader conectado. Conecta un eReader a tu equipo para realizar la transferencia.'
      }
    }

    let copiedCount = 0
    const errors: string[] = []

    for (const id of bookIds) {
      const book = library.find(b => b.id === id)
      if (!book || !book.fileName) continue
      const source = join(getLibraryFilesDir(), book.fileName)
      if (!fs.existsSync(source)) {
        errors.push(`"${book.title}": archivo no encontrado`)
        continue
      }
      try {
        const sanitized = (book.title || 'libro').replace(/[/\\?%*:|"<>]/g, '')
        const dest = join(targetDir, `${sanitized}.${book.format}`)
        fs.copyFileSync(source, dest)
        copiedCount++
      } catch (e: any) {
        errors.push(`"${book.title}": ${e.message}`)
      }
    }

    if (copiedCount === 0 && errors.length > 0) {
      return { success: false, count: 0, message: `Error al transferir: ${errors.join(', ')}` }
    }

    const deviceLabel = detected ? detected.name : 'tu dispositivo'
    return {
      success: true,
      count: copiedCount,
      message: `¡${copiedCount} ${copiedCount === 1 ? 'libro transferido' : 'libros transferidos'} con éxito a ${deviceLabel}!`
    }
  })

  // -------------------------------------------------------------
  // Direct Email Sending with Attachment
  // -------------------------------------------------------------
  ipcMain.handle('share-by-email', async (_, id, options?: { toEmail?: string }) => {
    const library = getStoredLibrary()
    const book = library.find(b => b.id === id)
    if (!book || !book.fileName) {
      return { success: false, message: 'Libro no encontrado' }
    }
    const filePath = join(getLibraryFilesDir(), book.fileName)
    if (!fs.existsSync(filePath)) {
      return { success: false, message: 'El archivo físico del libro no existe en el disco' }
    }

    const recipient = options?.toEmail ? options.toEmail.trim() : ''
    const subject = `Libro: ${book.title}`
    const body = `Hola,\n\nTe comparto el libro "${book.title}" de ${book.author || 'Autor desconocido'} (${book.format.toUpperCase()}).\n\nEnviado desde Bibliosfera.`

    let attachedWithMailApp = false

    // On macOS: use osascript to open Apple Mail with attachment directly attached
    if (process.platform === 'darwin') {
      try {
        const { execSync } = require('child_process')
        
        // Also copy physical file to macOS clipboard so Cmd+V in Gmail/Outlook pastes it as an attachment
        try {
          execSync(`osascript -e 'set the clipboard to POSIX file "${filePath.replace(/"/g, '\\"')}"'`)
        } catch (e) {}

        const recipientLine = recipient 
          ? `make new recipient at end of to recipients with properties {address:"${recipient.replace(/"/g, '\\"')}"}` 
          : ''
        
        const script = `
          tell application "Mail"
            set newMsg to make new outgoing message with properties {subject:"${subject.replace(/"/g, '\\"')}", content:"${body.replace(/"/g, '\\"')}\\n\\n", visible:true}
            tell newMsg
              ${recipientLine}
              make new attachment with properties {file name:(POSIX file "${filePath.replace(/"/g, '\\"')}") as alias} at after the last paragraph
            end tell
            activate
          end tell
        `
        execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`)
        attachedWithMailApp = true
      } catch (osascriptErr: any) {
        console.warn('Could not attach via Apple Mail osascript:', osascriptErr?.message)
      }
    }

    if (!attachedWithMailApp) {
      shell.showItemInFolder(filePath)
      const fmName = process.platform === 'win32' ? 'el Explorador de archivos' : 'el Finder'
      const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + `\n\n(Puedes arrastrar el archivo resaltado en ${fmName} para adjuntarlo).`)}`
      shell.openExternal(mailto)
      return {
        success: true,
        message: `Se ha abierto tu cliente de correo. El archivo del libro se ha seleccionado en ${fmName} para que puedas adjuntarlo fácilmente.`
      }
    }

    return {
      success: true,
      message: `¡Borrador de correo abierto con "${book.title}.${book.format}" adjunto directamente!\n(También se ha copiado al portapapeles).`
    }
  })

  // -------------------------------------------------------------
  // Send to Kindle Web (Dedicated window with persistent session & auto-upload)
  // -------------------------------------------------------------
  let kindleUploadWin: BrowserWindow | null = null

  ipcMain.handle('send-to-kindle-web', async (_, bookIds: string | string[], options?: { domain?: string }) => {
    const ids = Array.isArray(bookIds) ? bookIds : [bookIds]
    if (ids.length === 0) {
      return { success: false, message: 'No se ha seleccionado ningún libro.' }
    }

    const library = getStoredLibrary()
    const targetBooks = library.filter(b => ids.includes(b.id) && b.fileName)
    if (targetBooks.length === 0) {
      return { success: false, message: 'No se encontraron los libros seleccionados en el registro.' }
    }

    const filesDir = getLibraryFilesDir()
    const existingFiles: { title: string; path: string; format: string }[] = []

    for (const b of targetBooks) {
      const p = join(filesDir, b.fileName)
      if (fs.existsSync(p)) {
        existingFiles.push({ title: b.title, path: p, format: b.format })
      }
    }

    if (existingFiles.length === 0) {
      return { success: false, message: 'Los archivos físicos de los libros no existen en el disco.' }
    }

    const domain = options?.domain || 'amazon.es'
    const kindleUrl = `https://www.${domain}/sendtokindle`
    const filePaths = existingFiles.map(f => f.path)

    // Highlight file in Finder / Explorer and copy to clipboard as seamless companion
    const fmName = process.platform === 'win32' ? 'el Explorador de archivos' : 'el Finder'
    if (existingFiles.length === 1) {
      shell.showItemInFolder(existingFiles[0].path)
      if (process.platform === 'darwin') {
        try {
          const { execSync } = require('child_process')
          execSync(`osascript -e 'set the clipboard to POSIX file "${existingFiles[0].path.replace(/"/g, '\\"')}"'`)
        } catch {}
      }
    }

    try {
      if (kindleUploadWin && !kindleUploadWin.isDestroyed()) {
        kindleUploadWin.focus()
      } else {
        kindleUploadWin = new BrowserWindow({
          width: 1060,
          height: 820,
          minWidth: 780,
          minHeight: 600,
          title: 'Subir a Kindle — Send to Kindle (Bibliosfera)',
          autoHideMenuBar: true,
          webPreferences: {
            partition: 'persist:amazon_kindle',
            nodeIntegration: false,
            contextIsolation: true
          }
        })

        kindleUploadWin.on('closed', () => {
          kindleUploadWin = null
        })
      }

      const bookTitles = existingFiles.map(f => f.title).join(', ')
      const shortTitles = bookTitles.length > 45 ? `${existingFiles.length} libros seleccionados` : `"${bookTitles}"`

      const injectBanner = async (win: BrowserWindow, msg: string, bgColor: string = '#285666') => {
        try {
          await win.webContents.executeJavaScript(`
            (() => {
              let banner = document.getElementById('bibliosfera-kindle-bar');
              if (!banner) {
                banner = document.createElement('div');
                banner.id = 'bibliosfera-kindle-bar';
                banner.style.position = 'fixed';
                banner.style.top = '0';
                banner.style.left = '0';
                banner.style.right = '0';
                banner.style.zIndex = '9999999';
                banner.style.color = '#FFFFFF';
                banner.style.padding = '10px 16px';
                banner.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                banner.style.fontSize = '13px';
                banner.style.fontWeight = '600';
                banner.style.textAlign = 'center';
                banner.style.boxShadow = '0 3px 12px rgba(0,0,0,0.25)';
                banner.style.transition = 'all 0.3s ease';
                banner.style.display = 'flex';
                banner.style.alignItems = 'center';
                banner.style.justifyContent = 'center';
                banner.style.gap = '8px';
                document.body.prepend(banner);
                document.body.style.paddingTop = '42px';
              }
              banner.style.backgroundColor = ${JSON.stringify(bgColor)};
              banner.innerHTML = ${JSON.stringify(msg)};
            })()
          `)
        } catch {}
      }

      const tryAutoUpload = async (win: BrowserWindow) => {
        const url = win.webContents.getURL()
        if (url.includes('/signin') || url.includes('/ap/signin')) {
          await injectBanner(
            win,
            '🔐 Por favor, inicia sesión con tu cuenta de Amazon Kindle. Bibliosfera recordará tu cuenta y cargará tus libros automáticamente.',
            '#8C5828'
          )
          return false
        }

        if (!url.includes('/sendtokindle')) return false

        await injectBanner(win, `📚 Bibliosfera: Preparando ${shortTitles} en Send to Kindle...`, '#285666')

        // Poll for input[type="file"] and inject via Chrome DevTools Protocol
        for (let attempt = 0; attempt < 15; attempt++) {
          if (win.isDestroyed()) return false
          try {
            const hasInput = await win.webContents.executeJavaScript(`
              Boolean(document.querySelector('input[type="file"]'))
            `)

            if (hasInput) {
              if (!win.webContents.debugger.isAttached()) {
                win.webContents.debugger.attach('1.3')
              }
              const { root } = await win.webContents.debugger.sendCommand('DOM.getDocument')
              const { nodeId } = await win.webContents.debugger.sendCommand('DOM.querySelector', {
                nodeId: root.nodeId,
                selector: 'input[type="file"]'
              })

              if (nodeId) {
                await win.webContents.debugger.sendCommand('DOM.setFileInputFiles', {
                  nodeId,
                  files: filePaths
                })

                await win.webContents.executeJavaScript(`
                  (() => {
                    const inp = document.querySelector('input[type="file"]');
                    if (inp) {
                      inp.dispatchEvent(new Event('change', { bubbles: true }));
                      inp.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  })()
                `)

                await injectBanner(
                  win,
                  '✅ ¡Libros cargados en Amazon! Revisa la lista y pulsa el botón amarillo "Enviar" abajo para completar.',
                  '#1E3F32'
                )
                return true
              }
            }
          } catch (e) {
            // retry
          }
          await new Promise(r => setTimeout(r, 600))
        }

        await injectBanner(
          win,
          `📖 ${shortTitles} listos en ${fmName}. Puedes arrastrarlos a la web para enviarlos.`,
          '#285666'
        )
        return false
      }

      kindleUploadWin.webContents.on('did-finish-load', () => {
        if (kindleUploadWin && !kindleUploadWin.isDestroyed()) {
          tryAutoUpload(kindleUploadWin)
        }
      })

      await kindleUploadWin.loadURL(kindleUrl)

      return {
        success: true,
        message: `¡Ventana Send to Kindle abierta!\n${existingFiles.length === 1 ? `"${existingFiles[0].title}"` : `${existingFiles.length} libros`} listos.`
      }
    } catch (err: any) {
      return { success: false, message: `Error al abrir Send to Kindle: ${err.message}` }
    }
  })

  ipcMain.handle('open-send-to-kindle-web', async (_, domain?: string) => {
    const targetDomain = domain || 'amazon.es'
    const kindleUrl = `https://www.${targetDomain}/sendtokindle`
    shell.openExternal(kindleUrl)
    return { success: true }
  })

  // -------------------------------------------------------------
  // Export Library & Readings Handlers
  // -------------------------------------------------------------
  function escapeHtml(str: string): string {
    if (!str) return ''
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function generateReadingsMarkdown(books: any[]): string {
    const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    let md = `# Mis Lecturas — Bibliosfera\n`
    md += `*Exportado el ${dateStr} • ${books.length} libros leídos*\n\n---\n\n`

    books.forEach((book, idx) => {
      const stars = book.rating ? '★'.repeat(book.rating) + '☆'.repeat(5 - book.rating) : 'Sin calificar'
      const dateFormatted = book.dateRead ? new Date(book.dateRead).toLocaleDateString('es-ES') : 'Fecha no registrada'
      
      md += `### ${idx + 1}. ${book.title}\n`
      md += `- **Autor:** ${book.author || 'Desconocido'}\n`
      if (book.rating) md += `- **Puntuación:** ${stars} (${book.rating}/5)\n`
      if (book.dateRead) md += `- **Fecha de lectura:** ${dateFormatted}\n`
      if (book.pages) md += `- **Páginas:** ${book.pages}\n`
      if (book.readingTime) md += `- **Tiempo de lectura:** ${book.readingTime} min\n`
      if (book.genre) md += `- **Género:** ${book.genre}\n`
      if (book.year) md += `- **Año publicación:** ${book.year}\n`
      if (book.synopsis) md += `\n**Sinopsis:**\n> ${book.synopsis.split('\n').join('\n> ')}\n`
      if (book.comment) md += `\n**Comentarios y notas personales:**\n> ${book.comment.split('\n').join('\n> ')}\n`
      md += `\n---\n\n`
    })

    return md
  }

  function generateReadingsHtml(books: any[]): string {
    const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    const totalPages = books.reduce((acc, b) => acc + (parseInt(b.pages) || 0), 0)
    const totalMinutes = books.reduce((acc, b) => acc + (parseInt(b.readingTime) || 0), 0)
    const avgRating = books.filter(b => b.rating).length > 0
      ? (books.reduce((acc, b) => acc + (b.rating || 0), 0) / books.filter(b => b.rating).length).toFixed(1)
      : 'N/A'

    const booksHtml = books.map((b, idx) => {
      const stars = b.rating ? '★'.repeat(b.rating) + '☆'.repeat(5 - b.rating) : ''
      const dateFormatted = b.dateRead ? new Date(b.dateRead).toLocaleDateString('es-ES') : ''
      return `
        <article class="book-card">
          <div class="book-header">
            <span class="book-number">#${idx + 1}</span>
            <div class="book-title-wrap">
              <h2>${escapeHtml(b.title)}</h2>
              <p class="book-author">${escapeHtml(b.author || 'Autor desconocido')}</p>
            </div>
            ${b.rating ? `<span class="rating">${stars} <small>(${b.rating}/5)</small></span>` : ''}
          </div>
          <div class="book-meta">
            ${dateFormatted ? `<span><strong>Leído:</strong> ${dateFormatted}</span>` : ''}
            ${b.pages ? `<span><strong>Páginas:</strong> ${escapeHtml(b.pages)}</span>` : ''}
            ${b.readingTime ? `<span><strong>Tiempo:</strong> ${escapeHtml(b.readingTime)} min</span>` : ''}
            ${b.genre ? `<span><strong>Género:</strong> ${escapeHtml(b.genre)}</span>` : ''}
            ${b.year ? `<span><strong>Año:</strong> ${escapeHtml(b.year)}</span>` : ''}
          </div>
          ${b.synopsis ? `<div class="synopsis"><p>${escapeHtml(b.synopsis)}</p></div>` : ''}
          ${b.comment ? `<div class="comment"><strong>Notas personales:</strong><p>${escapeHtml(b.comment)}</p></div>` : ''}
        </article>
      `
    }).join('')

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Mis Lecturas — Bibliosfera</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
    :root { --bg: #F9F6F0; --surface: #FFFFFF; --ink: #1F2421; --muted: #6B7280; --accent: #285666; --line: #E5DFD7; --gold: #B45309; }
    body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--ink); line-height: 1.6; margin: 0; padding: 40px 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    header { border-bottom: 2px solid var(--line); padding-bottom: 24px; margin-bottom: 32px; }
    h1 { font-size: 32px; margin: 0 0 8px 0; color: var(--accent); }
    .stats-bar { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; }
    .stat-pill { background: var(--surface); border: 1px solid var(--line); padding: 6px 14px; border-radius: 20px; font-size: 14px; color: var(--muted); }
    .book-card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); page-break-inside: avoid; }
    .book-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
    .book-number { font-size: 14px; font-weight: bold; color: var(--accent); background: rgba(40,86,102,0.1); padding: 2px 8px; border-radius: 6px; }
    .book-title-wrap { flex: 1; }
    .book-title-wrap h2 { margin: 0 0 4px 0; font-size: 20px; }
    .book-author { margin: 0; font-size: 15px; color: var(--muted); }
    .rating { color: var(--gold); font-weight: bold; font-size: 16px; }
    .book-meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: var(--muted); margin-bottom: 14px; border-top: 1px dashed var(--line); padding-top: 10px; }
    .synopsis { font-size: 13.5px; color: #374151; background: #F4F1EA; padding: 12px 16px; border-radius: 8px; margin-bottom: 10px; }
    .comment { font-size: 13.5px; border-left: 3px solid var(--accent); padding-left: 12px; margin-top: 10px; }
    @media print { body { background: #FFF; padding: 0; } .book-card { box-shadow: none; border-color: #CCC; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Mis Lecturas</h1>
      <p style="margin:0;color:var(--muted)">Exportado desde Bibliosfera • ${dateStr}</p>
      <div class="stats-bar">
        <div class="stat-pill"><strong>${books.length}</strong> libros leídos</div>
        ${totalPages > 0 ? `<div class="stat-pill"><strong>${totalPages}</strong> páginas totales</div>` : ''}
        ${totalMinutes > 0 ? `<div class="stat-pill"><strong>${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m</strong> tiempo de lectura</div>` : ''}
        ${avgRating !== 'N/A' ? `<div class="stat-pill"><strong>★ ${avgRating}</strong> valoración media</div>` : ''}
      </div>
    </header>
    ${booksHtml}
  </div>
</body>
</html>`
  }

  function generateLibraryHtmlCatalog(library: any[]): string {
    const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    const booksHtml = library.map((b) => {
      return `
        <div class="card" data-title="${escapeHtml(b.title.toLowerCase())}" data-author="${escapeHtml((b.author || '').toLowerCase())}">
          <div class="cover-box">
            ${b.coverUrl ? `<img src="${b.coverUrl}" alt="${escapeHtml(b.title)}" />` : `<div class="no-cover"><span>${escapeHtml(b.title.substring(0, 2).toUpperCase())}</span></div>`}
          </div>
          <div class="info">
            <span class="badge ${b.format.toLowerCase()}">${b.format.toUpperCase()}</span>
            <h3>${escapeHtml(b.title)}</h3>
            <p class="author">${escapeHtml(b.author || 'Autor desconocido')}</p>
            <div class="meta">
              ${b.pages ? `<span>${escapeHtml(b.pages)} págs</span>` : ''}
              <span>${b.fileSize ? Math.round(b.fileSize / 1024) + ' KB' : ''}</span>
            </div>
          </div>
        </div>
      `
    }).join('')

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Biblioteca Digital — Bibliosfera</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
    body { font-family: 'DM Sans', sans-serif; background: #F5EFEB; color: #1F2421; margin: 0; padding: 40px 24px; }
    .wrap { max-width: 1200px; margin: 0 auto; }
    header { margin-bottom: 28px; }
    h1 { margin: 0 0 6px; font-size: 32px; color: #285666; }
    .search-input { width: 100%; max-width: 400px; padding: 10px 16px; border: 1px solid #D5C2B7; border-radius: 999px; font-size: 14px; margin-top: 16px; outline: none; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; margin-top: 24px; }
    .card { background: #FFFFFF; border: 1px solid #E2D5CD; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .cover-box { height: 260px; background: #EAE3DC; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .cover-box img { width: 100%; height: 100%; object-fit: cover; }
    .no-cover { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #285666; color: #FFF; font-size: 36px; font-weight: bold; }
    .info { padding: 14px; display: flex; flex-direction: column; flex: 1; }
    .badge { align-self: flex-start; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 4px; background: #285666; color: #FFF; margin-bottom: 8px; }
    .badge.pdf { background: #663A24; }
    h3 { margin: 0 0 4px; font-size: 14px; line-height: 1.3; }
    .author { margin: 0 0 8px; font-size: 12px; color: #6B7280; }
    .meta { margin-top: auto; font-size: 11px; color: #9CA3AF; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Biblioteca Digital</h1>
      <p style="margin:0;color:#6B7280">Catálogo exportado • ${dateStr} • ${library.length} libros</p>
      <input type="text" id="q" class="search-input" placeholder="Buscar por título o autor..." oninput="filterCards()" />
    </header>
    <div class="grid" id="grid">${booksHtml}</div>
  </div>
  <script>
    function filterCards() {
      const q = document.getElementById('q').value.toLowerCase();
      document.querySelectorAll('.card').forEach(c => {
        const t = c.getAttribute('data-title');
        const a = c.getAttribute('data-author');
        c.style.display = (t.includes(q) || a.includes(q)) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`
  }

  function escapeXml(str: any): string {
    if (str === null || str === undefined) return ''
    return String(str)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  function unescapeXml(str: string): string {
    if (!str) return ''
    return str
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&amp;/g, '&')
  }

  function generateReadingsXlsx(books: any[], outPath: string): void {
    const cp = require('child_process')
    const tempDir = join(app.getPath('temp'), `bibliosfera_xlsx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`)
    fs.mkdirSync(join(tempDir, '_rels'), { recursive: true })
    fs.mkdirSync(join(tempDir, 'xl', '_rels'), { recursive: true })
    fs.mkdirSync(join(tempDir, 'xl', 'worksheets'), { recursive: true })

    try {
      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

      const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

      const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Mis Lecturas" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`

      const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

      const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF285666"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`

      const headers = [
        'Título',
        'Autor',
        'Valoración',
        'Fecha de lectura',
        'Páginas',
        'Tiempo lectura (min)',
        'Género',
        'Año',
        'ISBN',
        'Sinopsis',
        'Comentario'
      ]
      const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

      let rowsXml = `<row r="1">`
      headers.forEach((h, idx) => {
        rowsXml += `<c r="${colLetters[idx]}1" s="1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`
      })
      rowsXml += `</row>`

      books.forEach((b: any, rowIdx: number) => {
        const r = rowIdx + 2
        const vals = [
          { val: b.title || '', isNum: false },
          { val: b.author || '', isNum: false },
          { val: b.rating !== undefined && b.rating !== null && b.rating !== '' ? Number(b.rating) : '', isNum: b.rating !== undefined && b.rating !== null && b.rating !== '' && !isNaN(Number(b.rating)) },
          { val: b.dateRead || '', isNum: false },
          { val: b.pages && !isNaN(Number(b.pages)) ? Number(b.pages) : (b.pages || ''), isNum: Boolean(b.pages && !isNaN(Number(b.pages))) },
          { val: b.readingTime || '', isNum: false },
          { val: b.genre || '', isNum: false },
          { val: b.year && !isNaN(Number(b.year)) ? Number(b.year) : (b.year || ''), isNum: Boolean(b.year && !isNaN(Number(b.year))) },
          { val: b.isbn || '', isNum: false },
          { val: b.synopsis || '', isNum: false },
          { val: b.comment || '', isNum: false }
        ]
        rowsXml += `<row r="${r}">`
        vals.forEach((cell, cIdx) => {
          const ref = `${colLetters[cIdx]}${r}`
          if (cell.isNum) {
            rowsXml += `<c r="${ref}" s="0" t="n"><v>${cell.val}</v></c>`
          } else {
            rowsXml += `<c r="${ref}" s="0" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.val)}</t></is></c>`
          }
        })
        rowsXml += `</row>`
      })

      const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="34" customWidth="1"/>
    <col min="2" max="2" width="24" customWidth="1"/>
    <col min="3" max="3" width="14" customWidth="1"/>
    <col min="4" max="4" width="16" customWidth="1"/>
    <col min="5" max="5" width="12" customWidth="1"/>
    <col min="6" max="6" width="18" customWidth="1"/>
    <col min="7" max="7" width="18" customWidth="1"/>
    <col min="8" max="8" width="10" customWidth="1"/>
    <col min="9" max="9" width="16" customWidth="1"/>
    <col min="10" max="10" width="45" customWidth="1"/>
    <col min="11" max="11" width="40" customWidth="1"/>
  </cols>
  <sheetData>${rowsXml}</sheetData>
</worksheet>`

      fs.writeFileSync(join(tempDir, '[Content_Types].xml'), contentTypes, 'utf-8')
      fs.writeFileSync(join(tempDir, '_rels', '.rels'), rootRels, 'utf-8')
      fs.writeFileSync(join(tempDir, 'xl', 'workbook.xml'), workbookXml, 'utf-8')
      fs.writeFileSync(join(tempDir, 'xl', '_rels', 'workbook.xml.rels'), workbookRels, 'utf-8')
      fs.writeFileSync(join(tempDir, 'xl', 'styles.xml'), stylesXml, 'utf-8')
      fs.writeFileSync(join(tempDir, 'xl', 'worksheets', 'sheet1.xml'), sheetXml, 'utf-8')

      if (fs.existsSync(outPath)) {
        fs.unlinkSync(outPath)
      }
      cp.execFileSync('/usr/bin/zip', ['-q', '-r', outPath, '[Content_Types].xml', '_rels', 'xl'], { cwd: tempDir })
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (e) {}
    }
  }

  async function generateReadingsPdf(books: any[], outPath: string): Promise<void> {
    const tempHtmlPath = join(app.getPath('temp'), `bibliosfera_readings_${Date.now()}.html`)
    const htmlContent = generateReadingsHtml(books)
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8')

    const pdfWin = new BrowserWindow({
      width: 960,
      height: 1280,
      show: false,
      webPreferences: {
        sandbox: false
      }
    })

    try {
      await pdfWin.loadFile(tempHtmlPath)
      const pdfBuffer = await pdfWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
      })
      fs.writeFileSync(outPath, pdfBuffer)
    } finally {
      try {
        pdfWin.destroy()
      } catch (e) {}
      try {
        if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath)
      } catch (e) {}
    }
  }

  ipcMain.handle('export-readings', async (_, format: 'excel' | 'pdf' | 'json' | 'csv' | 'markdown' | 'html') => {
    const books = getStoredBooks()
    if (books.length === 0) {
      return { success: false, message: 'No hay lecturas registradas para exportar.' }
    }

    const extMap: Record<string, string> = {
      excel: 'xlsx',
      pdf: 'pdf',
      json: 'json',
      csv: 'csv',
      markdown: 'md',
      html: 'html'
    }
    const defaultExt = extMap[format] || 'txt'

    const saveRes = await dialog.showSaveDialog({
      title: `Exportar mis lecturas en formato ${format.toUpperCase()}`,
      defaultPath: `Mis_Lecturas_Bibliosfera_${new Date().toISOString().split('T')[0]}.${defaultExt}`,
      filters: [
        format === 'excel' ? { name: 'Libro de Excel (.xlsx)', extensions: ['xlsx'] } :
        format === 'pdf' ? { name: 'Documento PDF (.pdf)', extensions: ['pdf'] } :
        format === 'json' ? { name: 'JSON (.json)', extensions: ['json'] } :
        format === 'csv' ? { name: 'CSV (.csv)', extensions: ['csv'] } :
        format === 'markdown' ? { name: 'Markdown (.md)', extensions: ['md'] } :
        { name: 'Página Web / Imprimible HTML', extensions: ['html'] }
      ]
    })
    if (saveRes.canceled || !saveRes.filePath) {
      return { success: false, message: 'Exportación cancelada.' }
    }

    const outPath = saveRes.filePath

    try {
      if (format === 'excel') {
        generateReadingsXlsx(books, outPath)
      } else if (format === 'pdf') {
        await generateReadingsPdf(books, outPath)
      } else if (format === 'json') {
        fs.writeFileSync(outPath, JSON.stringify(books, null, 2), 'utf-8')
      } else if (format === 'csv') {
        const header = 'ID,Título,Autor,Valoración,Fecha de lectura,Tiempo lectura (min),Páginas,Género,Año,Sinopsis,Comentario\n'
        const rows = books.map((b: any) => {
          const escapeCsv = (str: string = '') => `"${(str || '').toString().replace(/"/g, '""')}"`
          return [
            escapeCsv(b.id),
            escapeCsv(b.title),
            escapeCsv(b.author),
            b.rating ?? '',
            escapeCsv(b.dateRead || ''),
            escapeCsv(b.readingTime || ''),
            escapeCsv(b.pages || ''),
            escapeCsv(b.genre || ''),
            escapeCsv(b.year || ''),
            escapeCsv(b.synopsis || ''),
            escapeCsv(b.comment || '')
          ].join(',')
        }).join('\n')
        fs.writeFileSync(outPath, '\uFEFF' + header + rows, 'utf-8')
      } else if (format === 'markdown') {
        fs.writeFileSync(outPath, generateReadingsMarkdown(books), 'utf-8')
      } else if (format === 'html') {
        fs.writeFileSync(outPath, generateReadingsHtml(books), 'utf-8')
      }
      return { success: true, path: outPath, message: `¡Mis lecturas exportadas con éxito!\nGuardado en: ${outPath}` }
    } catch (e: any) {
      return { success: false, message: `Error al exportar: ${e.message}` }
    }
  })

  ipcMain.handle('export-library', async (_, format: 'json' | 'csv' | 'html' | 'files', selectedIds?: string[]) => {
    const fullLibrary = getStoredLibrary()
    const library = (selectedIds && selectedIds.length > 0)
      ? fullLibrary.filter(b => selectedIds.includes(b.id))
      : fullLibrary

    if (library.length === 0) {
      return { success: false, message: 'No hay libros para exportar.' }
    }

    if (format === 'files') {
      const dirRes = await dialog.showOpenDialog({
        title: 'Selecciona la carpeta donde exportar la Biblioteca completa',
        buttonLabel: 'Exportar biblioteca aquí',
        properties: ['openDirectory', 'createDirectory']
      })
      if (dirRes.canceled || dirRes.filePaths.length === 0) {
        return { success: false, message: 'Exportación cancelada.' }
      }
      const targetDir = dirRes.filePaths[0]
      let count = 0
      for (const book of library) {
        if (!book.fileName) continue
        const src = join(getLibraryFilesDir(), book.fileName)
        if (fs.existsSync(src)) {
          const author = book.author && book.author !== 'Autor desconocido' ? ` - ${book.author}` : ''
          const cleanName = `${book.title}${author}`.replace(/[/\\?%*:|"<>]/g, '').trim()
          const dest = join(targetDir, `${cleanName}.${book.format}`)
          try {
            fs.copyFileSync(src, dest)
            count++
          } catch (e) {}
        }
      }
      return {
        success: true,
        count,
        path: targetDir,
        message: `¡Se han exportado ${count} archivos de tu Biblioteca a:\n${targetDir}!`
      }
    }

    const defaultExt = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'html'
    const saveRes = await dialog.showSaveDialog({
      title: `Exportar biblioteca en formato ${format.toUpperCase()}`,
      defaultPath: `Biblioteca_Bibliosfera_${new Date().toISOString().split('T')[0]}.${defaultExt}`,
      filters: [
        format === 'json' ? { name: 'JSON', extensions: ['json'] } :
        format === 'csv' ? { name: 'CSV', extensions: ['csv'] } :
        { name: 'Página Web HTML', extensions: ['html'] }
      ]
    })
    if (saveRes.canceled || !saveRes.filePath) {
      return { success: false, message: 'Exportación cancelada.' }
    }

    const outPath = saveRes.filePath

    try {
      if (format === 'json') {
        fs.writeFileSync(outPath, JSON.stringify(library, null, 2), 'utf-8')
      } else if (format === 'csv') {
        const header = 'ID,Título,Autor,Formato,Páginas,Tamaño (Bytes),Estado,Fecha de alta\n'
        const rows = library.map(b => {
          const escapeCsv = (str: string = '') => `"${(str || '').replace(/"/g, '""')}"`
          return [
            escapeCsv(b.id),
            escapeCsv(b.title),
            escapeCsv(b.author),
            escapeCsv(b.format),
            escapeCsv(b.pages || ''),
            b.fileSize || 0,
            escapeCsv(b.status),
            escapeCsv(b.dateAdded)
          ].join(',')
        }).join('\n')
        fs.writeFileSync(outPath, '\uFEFF' + header + rows, 'utf-8')
      } else if (format === 'html') {
        fs.writeFileSync(outPath, generateLibraryHtmlCatalog(library), 'utf-8')
      }
      return {
        success: true,
        path: outPath,
        message: `¡Biblioteca exportada con éxito en ${outPath}!`
      }
    } catch (e: any) {
      return { success: false, message: `Error al exportar: ${e.message}` }
    }
  })

  // -------------------------------------------------------------
  // Multi-format Readings Importer (Excel .xlsx/.xls, CSV, Markdown .md, JSON)
  // -------------------------------------------------------------
  function normalizeDateInput(raw: string): string {
    if (!raw) return ''
    const trimmed = String(raw).trim()
    if (!trimmed || trimmed.toLowerCase().includes('no registrada')) return ''
    // Check if Excel serial number (e.g. 45366)
    if (/^\d{5}$/.test(trimmed)) {
      const serial = parseInt(trimmed, 10)
      if (serial > 20000 && serial < 75000) {
        const d = new Date(Math.round((serial - 25569) * 86400 * 1000))
        if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10)
      }
    }
    // YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
    }
    // DD/MM/YYYY or DD-MM-YYYY
    const esMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
    if (esMatch) {
      return `${esMatch[3]}-${esMatch[2].padStart(2, '0')}-${esMatch[1].padStart(2, '0')}`
    }
    const parsed = new Date(trimmed)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().substring(0, 10)
    }
    return ''
  }

  function normalizeRatingInput(raw: any): number {
    if (raw === undefined || raw === null || raw === '') return 0
    if (typeof raw === 'number') return Math.min(5, Math.max(0, raw))
    const s = String(raw).trim()
    // Match "(4/5)" or "4.5/5"
    const slashMatch = s.match(/(\d+(?:[.,]\d+)?)\s*\/\s*5/)
    if (slashMatch) {
      return Math.min(5, Math.max(0, parseFloat(slashMatch[1].replace(',', '.'))))
    }
    // Count ★ stars if present
    const starCount = (s.match(/★/g) || []).length
    if (starCount > 0) return Math.min(5, starCount)
    const num = parseFloat(s.replace(',', '.'))
    if (!isNaN(num)) return Math.min(5, Math.max(0, num))
    return 0
  }

  function parseCsvRows(text: string): string[][] {
    const clean = text.replace(/^\uFEFF/, '')
    const firstLine = clean.split(/\r?\n/).find(l => l.trim().length > 0) || ''
    const commaCount = (firstLine.match(/,/g) || []).length
    const semiCount = (firstLine.match(/;/g) || []).length
    const tabCount = (firstLine.match(/\t/g) || []).length
    const delim = tabCount > commaCount && tabCount > semiCount ? '\t' : semiCount > commaCount ? ';' : ','

    const rows: string[][] = []
    let currentRow: string[] = []
    let currentCell = ''
    let inQuotes = false

    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i]
      const next = clean[i + 1]
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          currentCell += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          currentCell += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === delim) {
          currentRow.push(currentCell.trim())
          currentCell = ''
        } else if (ch === '\r' && next === '\n') {
          currentRow.push(currentCell.trim())
          if (currentRow.some(c => c !== '')) rows.push(currentRow)
          currentRow = []
          currentCell = ''
          i++
        } else if (ch === '\n' || ch === '\r') {
          currentRow.push(currentCell.trim())
          if (currentRow.some(c => c !== '')) rows.push(currentRow)
          currentRow = []
          currentCell = ''
        } else {
          currentCell += ch
        }
      }
    }
    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell.trim())
      if (currentRow.some(c => c !== '')) rows.push(currentRow)
    }
    return rows
  }

  function mapTableRowsToBooks(rows: string[][]): any[] {
    if (rows.length === 0) return []
    const normHeader = (h: string) =>
      (h || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')

    const firstRowNorm = rows[0].map(normHeader)
    const hasHeader = firstRowNorm.some(h =>
      h.includes('titulo') || h.includes('title') || h.includes('autor') || h.includes('author') || h.includes('libro') || h.includes('book')
    )

    const headers = hasHeader ? firstRowNorm : ['titulo', 'autor', 'valoracion', 'fechadelectura', 'paginas', 'tiempolctura', 'genero', 'ano', 'sinopsis', 'comentario']
    const dataRows = hasHeader ? rows.slice(1) : rows

    const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)))

    const idxId = findCol(['id'])
    const idxTitle = findCol(['titulo', 'title', 'libro', 'book', 'nombre'])
    const idxAuthor = findCol(['autor', 'author', 'escritor'])
    const idxRating = findCol(['puntuacion', 'valoracion', 'rating', 'nota', 'estrellas', 'calificacion', 'score'])
    const idxDate = findCol(['fecha', 'date', 'leido', 'terminado'])
    const idxTime = findCol(['tiempo', 'time', 'minutos', 'duracion'])
    const idxPages = findCol(['pagina', 'page', 'pags'])
    const idxGenre = findCol(['genero', 'genre', 'categoria', 'tematica'])
    const idxYear = findCol(['ano', 'year', 'publicacion'])
    const idxIsbn = findCol(['isbn'])
    const idxSynopsis = findCol(['sinopsis', 'synopsis', 'resumen', 'descripcion'])
    const idxComment = findCol(['comentario', 'comment', 'opinion', 'nota', 'rese'])

    const result: any[] = []
    dataRows.forEach((r, idx) => {
      const title = (idxTitle !== -1 ? r[idxTitle] : r[0] || '').trim()
      if (!title) return
      const author = (idxAuthor !== -1 ? r[idxAuthor] : r[1] || '').trim() || 'Autor desconocido'
      const rating = idxRating !== -1 ? normalizeRatingInput(r[idxRating]) : 0
      const dateRead = idxDate !== -1 ? normalizeDateInput(r[idxDate]) : ''
      const readingTime = idxTime !== -1 ? (r[idxTime] || '').replace(/\s*min.*$/i, '').trim() : ''
      const pages = idxPages !== -1 ? (r[idxPages] || '').replace(/[^\d]/g, '').trim() : ''
      const genre = idxGenre !== -1 ? (r[idxGenre] || '').trim() : ''
      const year = idxYear !== -1 ? (r[idxYear] || '').trim() : ''
      const isbn = idxIsbn !== -1 ? (r[idxIsbn] || '').trim() : ''
      const synopsis = idxSynopsis !== -1 ? (r[idxSynopsis] || '').trim() : ''
      const comment = idxComment !== -1 ? (r[idxComment] || '').trim() : ''
      const id = (idxId !== -1 && r[idxId] ? r[idxId].trim() : '') || `imp_${Date.now()}_${idx}`

      result.push({
        id,
        title,
        author,
        rating,
        dateRead,
        readingTime,
        pages,
        genre,
        year,
        isbn,
        synopsis,
        comment
      })
    })
    return result
  }

  function parseXlsxFile(filePath: string): any[] {
    const cp = require('child_process')
    try {
      // 1. Check if it's a valid ZIP (.xlsx)
      const listOut = cp.execFileSync('/usr/bin/unzip', ['-l', filePath], { encoding: 'utf-8' })
      const sharedStrings: string[] = []
      if (listOut.includes('xl/sharedStrings.xml')) {
        try {
          const ssXml = cp.execFileSync('/usr/bin/unzip', ['-p', filePath, 'xl/sharedStrings.xml'], { encoding: 'utf-8', maxBuffer: 15 * 1024 * 1024 })
          const siMatches = ssXml.match(/<si[\s>][\s\S]*?<\/si>/g) || []
          for (const si of siMatches) {
            const tMatches = si.match(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g) || []
            const combined = tMatches
              .map(t => {
                const inner = t.replace(/^<t(?:\s+[^>]*)?>/, '').replace(/<\/t>$/, '')
                return unescapeXml(inner)
              })
              .join('')
            sharedStrings.push(combined)
          }
        } catch (e) {}
      }

      const sheetMatch = listOut.match(/xl\/worksheets\/sheet\d*\.xml/)
      const sheetEntry = sheetMatch ? sheetMatch[0] : 'xl/worksheets/sheet1.xml'
      const sheetXml = cp.execFileSync('/usr/bin/unzip', ['-p', filePath, sheetEntry], { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 })

      const colRefToIndex = (ref: string): number => {
        const letters = (ref.match(/^[A-Z]+/i)?.[0] || 'A').toUpperCase()
        let col = 0
        for (let i = 0; i < letters.length; i++) {
          col = col * 26 + (letters.charCodeAt(i) - 64)
        }
        return Math.max(0, col - 1)
      }

      const rows: string[][] = []
      const rowMatches = sheetXml.match(/<row[\s>][\s\S]*?<\/row>/g) || []
      for (const rowXml of rowMatches) {
        const rowCells: string[] = []
        const cellMatches = rowXml.match(/<c[\s>][\s\S]*?<\/c>/g) || []
        cellMatches.forEach((cellXml, fallbackIdx) => {
          const refAttr = cellXml.match(/\br=["']([A-Z]+\d+)["']/i)
          const colIdx = refAttr ? colRefToIndex(refAttr[1]) : fallbackIdx
          const typeAttr = cellXml.match(/\bt=["']([^"']+)["']/i)?.[1] || ''

          let val = ''
          if (typeAttr === 'inlineStr') {
            const tMatch = cellXml.match(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/)
            val = tMatch ? unescapeXml(tMatch[1]) : ''
          } else {
            const vMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/)
            const rawV = vMatch ? unescapeXml(vMatch[1]) : ''
            if (typeAttr === 's') {
              const sIdx = parseInt(rawV, 10)
              val = !isNaN(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : rawV
            } else {
              val = rawV
            }
          }
          while (rowCells.length <= colIdx) rowCells.push('')
          rowCells[colIdx] = val.trim()
        })
        if (rowCells.some(c => c !== '')) {
          rows.push(rowCells)
        }
      }
      return mapTableRowsToBooks(rows)
    } catch (zipErr) {
      // Fallback: XML 2003 Spreadsheet (.xls) or CSV/TSV saved with .xls extension
      const rawText = fs.readFileSync(filePath, 'utf-8')
      if (rawText.includes('<Row') && rawText.includes('<Data')) {
        const rows: string[][] = []
        const rowMatches = rawText.match(/<Row[\s>][\s\S]*?<\/Row>/gi) || []
        for (const rXml of rowMatches) {
          const dataMatches = rXml.match(/<Data[^>]*>([\s\S]*?)<\/Data>/gi) || []
          const cells = dataMatches.map(d => unescapeXml(d.replace(/^<Data[^>]*>/i, '').replace(/<\/Data>$/i, '').trim()))
          if (cells.some(c => c !== '')) rows.push(cells)
        }
        return mapTableRowsToBooks(rows)
      }
      return mapTableRowsToBooks(parseCsvRows(rawText))
    }
  }

  function parseMarkdownReadings(mdText: string): any[] {
    const books: any[] = []
    // 1. Check if it contains ### N. Title sections (Bibliosfera Markdown format)
    const sectionRegex = /^#{2,3}\s+(?:\d+\.\s*)?(.+)$/gm
    const headings: { title: string; startIndex: number; matchEnd: number }[] = []
    let m: RegExpExecArray | null
    while ((m = sectionRegex.exec(mdText)) !== null) {
      const hTitle = m[1].trim()
      if (hTitle.toLowerCase().includes('mis lecturas')) continue
      headings.push({ title: hTitle, startIndex: m.index, matchEnd: m.index + m[0].length })
    }

    if (headings.length > 0) {
      headings.forEach((h, idx) => {
        const end = idx + 1 < headings.length ? headings[idx + 1].startIndex : mdText.length
        const block = mdText.slice(h.matchEnd, end)

        const extractField = (labelPattern: string): string => {
          const re = new RegExp(`[-*]\\s*\\*\\*(?:${labelPattern}):?\\*\\*:?\\s*(.+)`, 'i')
          const match = block.match(re)
          return match ? match[1].trim() : ''
        }

        const author = extractField('Autor|Author') || 'Autor desconocido'
        const ratingRaw = extractField('Puntuaci[oó]n|Valoraci[oó]n|Nota|Rating')
        const dateRaw = extractField('Fecha de lectura|Fecha|Le[ií]do')
        const pagesRaw = extractField('P[aá]ginas|Pages')
        const timeRaw = extractField('Tiempo de lectura|Tiempo')
        const genre = extractField('G[eé]nero|Genre')
        const year = extractField('A[ñn]o publicaci[oó]n|A[ñn]o|Year')

        let synopsis = ''
        const synMatch = block.match(/\*\*Sinopsis:\*\*\s*\n((?:>\s*.*\n?)+)/i)
        if (synMatch) {
          synopsis = synMatch[1].replace(/^>\s?/gm, '').trim()
        }

        let comment = ''
        const comMatch = block.match(/\*\*(?:Comentarios y notas personales|Comentarios|Opini[oó]n|Notas):\*\*\s*\n((?:>\s*.*\n?)+)/i)
        if (comMatch) {
          comment = comMatch[1].replace(/^>\s?/gm, '').trim()
        }

        books.push({
          id: `imp_md_${Date.now()}_${idx}`,
          title: h.title,
          author,
          rating: normalizeRatingInput(ratingRaw),
          dateRead: normalizeDateInput(dateRaw),
          pages: pagesRaw.replace(/[^\d]/g, ''),
          readingTime: timeRaw.replace(/\s*min.*$/i, '').trim(),
          genre,
          year,
          synopsis,
          comment
        })
      })
      return books
    }

    // 2. Check if Markdown Table (| Título | Autor | ...)
    const tableLines = mdText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.startsWith('|') && l.endsWith('|'))
    if (tableLines.length >= 2) {
      const rows: string[][] = []
      for (const line of tableLines) {
        const cells = line
          .slice(1, -1)
          .split('|')
          .map(c => c.trim())
        // Skip separator row like |---|---|
        if (cells.every(c => /^[-:]+$/.test(c))) continue
        rows.push(cells)
      }
      return mapTableRowsToBooks(rows)
    }

    // 3. Fallback: Bullet list (- **Title** - Author)
    const bulletLines = mdText.split(/\r?\n/).filter(l => /^\s*[-*]\s+/.test(l))
    bulletLines.forEach((line, idx) => {
      const cleanLine = line.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '').trim()
      const parts = cleanLine.split(/\s+[-–—]\s+|\s+de\s+/i)
      if (parts[0]) {
        books.push({
          id: `imp_md_${Date.now()}_${idx}`,
          title: parts[0].trim(),
          author: parts[1] ? parts[1].trim() : 'Autor desconocido',
          rating: normalizeRatingInput(cleanLine),
          dateRead: ''
        })
      }
    })
    return books
  }

  async function handleImportReadings(formatFilter?: 'excel' | 'csv' | 'md' | 'json' | 'all') {
    const filters =
      formatFilter === 'excel'
        ? [{ name: 'Excel (.xlsx, .xls)', extensions: ['xlsx', 'xls'] }]
        : formatFilter === 'csv'
          ? [{ name: 'CSV (.csv)', extensions: ['csv'] }]
          : formatFilter === 'md'
            ? [{ name: 'Markdown (.md)', extensions: ['md', 'markdown'] }]
            : formatFilter === 'json'
              ? [{ name: 'JSON (.json)', extensions: ['json'] }]
              : [
                  { name: 'Formatos compatibles (Excel, CSV, Markdown, JSON)', extensions: ['xlsx', 'xls', 'csv', 'md', 'markdown', 'json'] },
                  { name: 'Excel (.xlsx, .xls)', extensions: ['xlsx', 'xls'] },
                  { name: 'CSV (.csv)', extensions: ['csv'] },
                  { name: 'Markdown (.md)', extensions: ['md', 'markdown'] },
                  { name: 'JSON (.json)', extensions: ['json'] }
                ]

    const openRes = await dialog.showOpenDialog({
      title: 'Importar títulos a Mis lecturas',
      buttonLabel: 'Importar lecturas',
      filters,
      properties: ['openFile']
    })
    if (openRes.canceled || openRes.filePaths.length === 0) {
      return { success: false, message: 'Operación cancelada.' }
    }

    const filePath = openRes.filePaths[0]
    const ext = (filePath.split('.').pop() || '').toLowerCase()

    try {
      let parsedBooks: any[] = []
      if (ext === 'xlsx' || ext === 'xls') {
        parsedBooks = parseXlsxFile(filePath)
      } else if (ext === 'csv') {
        const raw = fs.readFileSync(filePath, 'utf-8')
        parsedBooks = mapTableRowsToBooks(parseCsvRows(raw))
      } else if (ext === 'md' || ext === 'markdown') {
        const raw = fs.readFileSync(filePath, 'utf-8')
        parsedBooks = parseMarkdownReadings(raw)
      } else if (ext === 'json') {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const json = JSON.parse(raw)
        parsedBooks = Array.isArray(json) ? json : Array.isArray(json?.books) ? json.books : []
      } else {
        return { success: false, message: `Formato de archivo (.${ext}) no soportado.` }
      }

      if (!Array.isArray(parsedBooks) || parsedBooks.length === 0) {
        return { success: false, message: 'No se encontraron títulos válidos en el archivo seleccionado.' }
      }

      const current = getStoredBooks()
      let added = 0
      const newlyAddedBooks: any[] = []

      for (const b of parsedBooks) {
        if (!b || !b.title) continue
        const cleanTitle = String(b.title).trim()
        if (!cleanTitle) continue
        const exists = current.some(
          c =>
            (b.id && c.id === b.id) ||
            (c.title?.toLowerCase().trim() === cleanTitle.toLowerCase() &&
              (!b.author || !c.author || c.author?.toLowerCase().trim() === String(b.author).toLowerCase().trim()))
        )
        if (!exists) {
          const newEntry = {
            id: b.id || `read_${Date.now()}_${added}`,
            title: cleanTitle,
            author: b.author || 'Autor desconocido',
            rating: typeof b.rating === 'number' ? b.rating : normalizeRatingInput(b.rating),
            dateRead: b.dateRead || new Date().toISOString().substring(0, 10),
            readingTime: b.readingTime ? String(b.readingTime) : '',
            pages: b.pages ? String(b.pages) : '',
            genre: b.genre || '',
            year: b.year ? String(b.year) : '',
            isbn: b.isbn || '',
            synopsis: b.synopsis || '',
            comment: b.comment || '',
            coverUrl: b.coverUrl || ''
          }
          current.push(newEntry)
          newlyAddedBooks.push(newEntry)
          added++
        }
      }

      // Enrich up to 10 newly imported books that lack coverUrl or synopsis
      let enriched = 0
      for (const nb of newlyAddedBooks) {
        if ((!nb.coverUrl || !nb.synopsis || nb.author === 'Autor desconocido') && enriched < 10) {
          enriched++
          try {
            const q = nb.author && nb.author !== 'Autor desconocido' ? `${nb.title} ${nb.author}` : nb.title
            const online = await searchBookOnline(q)
            if (online) {
              if ((!nb.author || nb.author === 'Autor desconocido') && online.author) nb.author = online.author
              if (!nb.coverUrl && online.coverUrl) {
                nb.coverUrl = await downloadAndSaveCover(nb.id, online.coverUrl)
              }
              if (!nb.pages && online.pages) nb.pages = online.pages
              if (!nb.year && online.year) nb.year = online.year
              if (!nb.genre && online.genre) nb.genre = online.genre
              if (!nb.synopsis && online.synopsis) nb.synopsis = online.synopsis
            }
          } catch (e) {}
        }
      }

      setStoredBooks(current)
      return {
        success: true,
        count: added,
        message: `¡Se han importado ${added} lecturas nuevas desde el archivo .${ext.toUpperCase()} con éxito!`
      }
    } catch (e: any) {
      return { success: false, message: `Error al importar el archivo: ${e.message}` }
    }
  }

  ipcMain.handle('import-readings', async (_, formatFilter?: 'excel' | 'csv' | 'md' | 'json' | 'all') => {
    return handleImportReadings(formatFilter)
  })

  ipcMain.handle('import-readings-json', async () => {
    return handleImportReadings('json')
  })

  // Choose a custom eReader / USB folder manually
  ipcMain.handle('select-custom-device-folder', async () => {
    const dirRes = await dialog.showOpenDialog({
      title: 'Seleccionar carpeta de tu eReader o memoria USB',
      buttonLabel: 'Usar esta carpeta',
      properties: ['openDirectory', 'createDirectory']
    })
    if (dirRes.canceled || dirRes.filePaths.length === 0) {
      return { success: false, message: 'Operación cancelada.' }
    }
    const path = dirRes.filePaths[0]
    return {
      success: true,
      path,
      device: {
        connected: true,
        name: 'eReader / USB',
        volumePath: path,
        targetFolder: path
      }
    }
  })

  // -------------------------------------------------------------
  // Book Recommendations based on 4-5 Star Readings
  // -------------------------------------------------------------
  ipcMain.handle('get-recommendations', async (_, seed: number = 0) => {
    const { net } = require('electron')
    const books = getStoredBooks()
    const library = getStoredLibrary()

    const favBooks = books
      .filter((b: any) => (b.rating || 0) >= 4)
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))

    if (favBooks.length === 0) {
      return { recommendations: [], basedOnCount: 0 }
    }

    const normalizeStr = (s: string = '') =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')

    const existingTitles = new Set<string>()
    for (const b of books) {
      if (b.title) existingTitles.add(normalizeStr(b.title))
    }
    for (const lb of library) {
      if (lb.title) existingTitles.add(normalizeStr(lb.title))
    }

    const isAlreadyKnown = (candidateTitle: string) => {
      const norm = normalizeStr(candidateTitle)
      if (!norm || norm.length < 3) return true
      if (existingTitles.has(norm)) return true
      for (const ex of existingTitles) {
        if (ex.length > 5 && (norm.includes(ex) || ex.includes(norm))) return true
      }
      return false
    }

    const recommendations: any[] = []
    const addedNormTitles = new Set<string>()

    const tryAddCandidate = (cand: {
      title: string
      author: string
      coverUrl?: string
      year?: string
      pages?: string
      genre?: string
      synopsis?: string
      reason: string
      basedOnTitle?: string
      basedOnRating?: number
    }) => {
      if (!cand.title || !cand.author) return false
      const cleanTitle = cand.title.replace(/\s*\([^)]*(?:edición|edition|colección|collection|pack)[^)]*\)/gi, '').trim()
      const lowerT = cleanTitle.toLowerCase()
      if (
        lowerT.includes('resumen de') ||
        lowerT.includes('summary of') ||
        lowerT.includes('study guide') ||
        lowerT.includes('guía de lectura')
      ) {
        return false
      }
      const norm = normalizeStr(cleanTitle)
      if (isAlreadyKnown(cleanTitle) || addedNormTitles.has(norm)) return false

      addedNormTitles.add(norm)
      recommendations.push({
        id: `rec_${Date.now()}_${recommendations.length}`,
        title: cleanTitle,
        author: cand.author,
        coverUrl: cand.coverUrl || '',
        year: cand.year || '',
        pages: cand.pages || '',
        genre: cand.genre || '',
        synopsis: cand.synopsis ? cand.synopsis.replace(/<[^>]+>/g, '').trim() : '',
        reason: cand.reason,
        basedOnTitle: cand.basedOnTitle,
        basedOnRating: cand.basedOnRating
      })
      return true
    }

    // Rotate favorite books using seed so refreshing yields varied results
    const rotatedFavs = [...favBooks]
    if (seed > 0 && rotatedFavs.length > 1) {
      const offset = seed % rotatedFavs.length
      rotatedFavs.push(...rotatedFavs.splice(0, offset))
    }

    const selectedFavs = rotatedFavs.slice(0, 4)
    const startIndex = (seed * 3) % 10

    // 1. Search by favorite authors and genres via Google Books API (Spanish preference) & OpenLibrary
    for (const fav of selectedFavs) {
      if (recommendations.length >= 8) break

      const author = fav.author && fav.author !== 'Autor desconocido' ? fav.author.split(',')[0].trim() : ''
      const genre = fav.genre ? fav.genre.split(',')[0].trim() : ''
      const starsStr = fav.rating ? `${fav.rating}★` : '4-5★'

      // A) Other acclaimed works by the same author
      if (author) {
        try {
          const gbAuthorUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`inauthor:"${author}"`)}&langRestrict=es&printType=books&maxResults=8&startIndex=${startIndex}`
          const res = await net.fetch(gbAuthorUrl)
          if (res.ok) {
            const data = await res.json()
            let addedForAuthor = 0
            for (const item of data.items || []) {
              const info = item.volumeInfo || {}
              if (!info.title || !info.authors?.length) continue
              const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || ''
              const coverUrl = thumb ? thumb.replace(/^http:\/\//i, 'https://') : ''
              const ok = tryAddCandidate({
                title: info.title,
                author: info.authors.join(', '),
                coverUrl,
                year: info.publishedDate ? String(info.publishedDate).substring(0, 4) : '',
                pages: info.pageCount ? String(info.pageCount) : '',
                genre: info.categories?.[0] || genre || '',
                synopsis: info.description || '',
                reason: `Del mismo autor que «${fav.title}» (${starsStr})`,
                basedOnTitle: fav.title,
                basedOnRating: fav.rating
              })
              if (ok) {
                addedForAuthor++
                if (addedForAuthor >= 2) break
              }
            }
          }
        } catch (e) {}

        // Fallback to OpenLibrary for author if Google Books gave none
        if (recommendations.filter(r => r.basedOnTitle === fav.title).length === 0) {
          try {
            const olAuthorUrl = `https://openlibrary.org/search.json?author=${encodeURIComponent(author)}&limit=8&offset=${startIndex}`
            const olRes = await net.fetch(olAuthorUrl)
            if (olRes.ok) {
              const olData = await olRes.json()
              let addedOl = 0
              for (const doc of olData.docs || []) {
                if (!doc.title || !doc.author_name?.length) continue
                const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : ''
                const ok = tryAddCandidate({
                  title: doc.title,
                  author: doc.author_name.slice(0, 2).join(', '),
                  coverUrl,
                  year: doc.first_publish_year ? String(doc.first_publish_year) : '',
                  pages: doc.number_of_pages_median ? String(doc.number_of_pages_median) : '',
                  genre: doc.subject?.[0] || genre || '',
                  synopsis: '',
                  reason: `Del mismo autor que «${fav.title}» (${starsStr})`,
                  basedOnTitle: fav.title,
                  basedOnRating: fav.rating
                })
                if (ok) {
                  addedOl++
                  if (addedOl >= 2) break
                }
              }
            }
          } catch (e) {}
        }
      }

      // B) Related books by genre / theme / similar subject
      const searchTopic = genre || fav.title
      if (searchTopic) {
        try {
          const queryStr = genre
            ? `subject:"${genre}"`
            : `"${fav.title}" ${author ? author : ''}`
          const gbGenreUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryStr)}&langRestrict=es&printType=books&maxResults=8&startIndex=${startIndex}`
          const res = await net.fetch(gbGenreUrl)
          if (res.ok) {
            const data = await res.json()
            let addedForTopic = 0
            for (const item of data.items || []) {
              const info = item.volumeInfo || {}
              if (!info.title || !info.authors?.length) continue
              const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || ''
              const coverUrl = thumb ? thumb.replace(/^http:\/\//i, 'https://') : ''
              const ok = tryAddCandidate({
                title: info.title,
                author: info.authors.join(', '),
                coverUrl,
                year: info.publishedDate ? String(info.publishedDate).substring(0, 4) : '',
                pages: info.pageCount ? String(info.pageCount) : '',
                genre: info.categories?.[0] || genre || '',
                synopsis: info.description || '',
                reason: genre
                  ? `Afinidad con «${fav.title}» (${starsStr}) • ${genre}`
                  : `Relacionado con tu lectura «${fav.title}» (${starsStr})`,
                basedOnTitle: fav.title,
                basedOnRating: fav.rating
              })
              if (ok) {
                addedForTopic++
                if (addedForTopic >= 2) break
              }
            }
          }
        } catch (e) {}
      }
    }

    // Enrich any recommendation missing synopsis or cover using searchBookOnline (up to 4 items to stay fast)
    let enrichedCount = 0
    for (const rec of recommendations) {
      if ((!rec.synopsis || !rec.coverUrl) && enrichedCount < 4) {
        enrichedCount++
        try {
          const extra = await searchBookOnline(`${rec.title} ${rec.author}`)
          if (extra) {
            if (!rec.coverUrl && extra.coverUrl) rec.coverUrl = extra.coverUrl
            if (!rec.synopsis && extra.synopsis) rec.synopsis = extra.synopsis
            if (!rec.pages && extra.pages) rec.pages = extra.pages
            if (!rec.year && extra.year) rec.year = extra.year
            if (!rec.genre && extra.genre) rec.genre = extra.genre
          }
        } catch (e) {}
      }
    }

    return {
      recommendations: recommendations.slice(0, 8),
      basedOnCount: favBooks.length
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  try {
    flushToDisk()
  } catch {}
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
