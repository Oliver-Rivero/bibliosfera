import { app, shell, BrowserWindow, ipcMain, screen, dialog } from 'electron'
import { join, dirname, posix } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'

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

function getLibraryFilesDir() {
  const dir = join(app.getPath('userData'), 'library_files')
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

function getStoredBooks() {
  try {
    const file = getBooksFile()
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([]))
      return []
    }
    const books = JSON.parse(fs.readFileSync(file, 'utf-8'))
    let modified = false
    const library = getStoredLibrary()
    for (const b of books) {
      if (!b.pages && b.libraryBookId) {
        const libBook = library.find((lb: any) => lb.id === b.libraryBookId)
        if (libBook?.pages) {
          b.pages = libBook.pages
          modified = true
        }
      }
    }
    if (modified) {
      try {
        fs.writeFileSync(file, JSON.stringify(books, null, 2))
      } catch (we) {}
    }
    return books
  } catch (e) {
    return []
  }
}

function setStoredBooks(books: any[]) {
  try {
    fs.writeFileSync(getBooksFile(), JSON.stringify(books, null, 2))
  } catch (e) {
    console.error("Error saving books:", e)
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
    const file = getLibraryFile()
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([]))
      return []
    }
    const library = JSON.parse(fs.readFileSync(file, 'utf-8'))
    let modified = false
    for (const b of library) {
      if (!b.pages && b.fileName) {
        const filePath = join(getLibraryFilesDir(), b.fileName)
        if (fs.existsSync(filePath)) {
          const detected = detectPagesFromFile(filePath, b.format)
          if (detected) {
            b.pages = detected
            modified = true
          }
        }
      }
    }
    if (modified) {
      try {
        fs.writeFileSync(file, JSON.stringify(library, null, 2))
      } catch (we) {}
    }
    return library
  } catch (e) {
    return []
  }
}

function setStoredLibrary(books: any[]) {
  try {
    fs.writeFileSync(getLibraryFile(), JSON.stringify(books, null, 2))
  } catch (e) {
    console.error("Error saving library:", e)
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

function createWindow(): void {
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
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.oliver.bibliosfera')

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
    if (!book.pages) {
      if (book.libraryBookId) {
        const library = getStoredLibrary()
        const libBook = library.find((lb: any) => lb.id === book.libraryBookId)
        if (libBook?.pages) book.pages = libBook.pages
      }
      if (!book.pages && book.title) {
        try {
          const online = await searchBookOnline(book.author ? `${book.title} ${book.author}` : book.title)
          if (online?.pages) book.pages = online.pages
        } catch (e) {}
      }
    }
    books.push(book)
    setStoredBooks(books)
    return books
  })

  ipcMain.handle('update-book', async (_, updatedBook) => {
    const books = getStoredBooks()
    const index = books.findIndex(b => b.id === updatedBook.id)
    if (index !== -1) {
      if (updatedBook.coverUrl && (updatedBook.coverUrl.startsWith('http://') || updatedBook.coverUrl.startsWith('https://'))) {
        updatedBook.coverUrl = await downloadAndSaveCover(updatedBook.id, updatedBook.coverUrl)
      }
      books[index] = updatedBook
      setStoredBooks(books)
    }
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

    try {
      // 1. OpenLibrary search
      try {
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`
        const olRes = await net.fetch(url)
        if (olRes.ok) {
          const olData = await olRes.json()
          const doc = olData.docs?.find((d: any) => d.author_name && d.cover_i) || olData.docs?.[0]
          if (doc) {
            if (doc.title) result.title = doc.title
            result.author = doc.author_name ? doc.author_name.join(', ') : ''
            result.year = doc.first_publish_year ? String(doc.first_publish_year) : ''
            result.isbn = doc.isbn && doc.isbn.length > 0 ? doc.isbn[0] : ''
            if (doc.subject && doc.subject.length > 0) {
              result.genre = doc.subject.slice(0, 2).join(', ')
            }
            if (doc.cover_i) {
              result.coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
            }
            if (doc.number_of_pages_median) {
              result.pages = String(doc.number_of_pages_median)
            } else if (doc.number_of_pages) {
              result.pages = String(doc.number_of_pages)
            }

            // Also check OpenLibrary editions for page count if not yet found
            if (!result.pages && doc.key) {
              try {
                const edRes = await net.fetch(`https://openlibrary.org${doc.key}/editions.json?limit=10`)
                if (edRes.ok) {
                  const edData = await edRes.json()
                  const withPages = edData.entries?.find((e: any) => e.number_of_pages && e.number_of_pages > 10)
                  if (withPages) {
                    result.pages = String(withPages.number_of_pages)
                  }
                }
              } catch (ee) {}
            }

            // Also check OpenLibrary ISBN for page count
            if (!result.pages && doc.isbn && doc.isbn.length > 0) {
              try {
                const isbnRes = await net.fetch(`https://openlibrary.org/isbn/${doc.isbn[0]}.json`)
                if (isbnRes.ok) {
                  const isbnData = await isbnRes.json()
                  if (isbnData.number_of_pages) {
                    result.pages = String(isbnData.number_of_pages)
                  }
                }
              } catch (ie) {}
            }

            if (doc.key) {
              try {
                const workRes = await net.fetch(`https://openlibrary.org${doc.key}.json`)
                if (workRes.ok) {
                  const workData = await workRes.json()
                  if (workData.description) {
                    result.synopsis = typeof workData.description === 'string' 
                      ? workData.description 
                      : workData.description.value || ''
                  }
                  if (!result.author && workData.authors?.[0]?.author?.key) {
                    const authorRes = await net.fetch(`https://openlibrary.org${workData.authors[0].author.key}.json`)
                    if (authorRes.ok) {
                      const authorData = await authorRes.json()
                      if (authorData.name) result.author = authorData.name
                    }
                  }
                }
              } catch (we) {
                console.error('Error fetching work JSON:', we)
              }
            }
          }
        }
      } catch (e) {
        console.error('OpenLibrary error:', e)
      }

      // 2. Wikipedia fallback for synopsis/author if missing
      try {
        const wikiSearchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=`
        const wikiSearchRes = await net.fetch(wikiSearchUrl)
        if (wikiSearchRes.ok) {
          const wsData = await wikiSearchRes.json()
          const first = wsData.query?.search?.[0]
          if (first) {
            if (!result.author && first.snippet) {
              const cleanSnippet = first.snippet.replace(/<[^>]+>/g, '')
              const escapedQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              const m = cleanSnippet.match(new RegExp(escapedQ + '[,\\s]+([^,\\d\\.\\*]+)', 'i'))
              if (m && m[1] && m[1].trim()) {
                const candidate = m[1].trim()
                if (!candidate.toLowerCase().includes('editorial') && candidate.length > 2 && candidate.length < 50) {
                  result.author = candidate
                }
              }
            }

            const cleanTitle = first.title.toLowerCase()
            const cleanQ = query.toLowerCase()
            const isMatch = cleanTitle.includes(cleanQ) || cleanQ.includes(cleanTitle)

            if (isMatch) {
              const sumUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(first.title)}`
              const sumRes = await net.fetch(sumUrl)
              if (sumRes.ok) {
                const sumData = await sumRes.json()
                if (sumData.title && (!result.title || result.title.toLowerCase() === query.toLowerCase())) {
                  result.title = sumData.title
                }
                if (!result.synopsis && sumData.extract) {
                  result.synopsis = sumData.extract
                }
                if (!result.coverUrl && sumData.thumbnail?.source) {
                  result.coverUrl = sumData.thumbnail.source
                }
                if (!result.author && sumData.description && !sumData.description.toLowerCase().includes('editorial')) {
                  result.author = sumData.description.replace(/^(novela|libro|obra|ensayo)\s+(de|por)\s+/i, '')
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Wikipedia error:', e)
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
    // Auto-enrich any existing book that is missing author or cover
    let modified = false
    for (const b of library) {
      if ((!b.author || b.author === 'Autor desconocido' || !b.coverUrl) && b.title) {
        try {
          const online = await searchBookOnline(b.title)
          if (online && (online.author || online.coverUrl)) {
            if (online.title && online.title.length > 1) b.title = online.title
            if (online.author && (!b.author || b.author === 'Autor desconocido')) b.author = online.author
            if (online.coverUrl && !b.coverUrl) {
              b.coverUrl = await downloadAndSaveCover(`lib_${b.id}`, online.coverUrl)
            }
            if (online.pages && !b.pages) b.pages = online.pages
            if (online.year && !b.year) b.year = online.year
            if (online.genre && !b.genre) b.genre = online.genre
            if (online.synopsis && !b.synopsis) b.synopsis = online.synopsis
            modified = true
          }
        } catch (e) {}
      }
    }
    if (modified) {
      setStoredLibrary(library)
    }
    return library
  })

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

    const sourcePath = res.filePaths[0]
    const ext = (sourcePath.split('.').pop() || 'epub').toLowerCase()
    const rawFileName = sourcePath.split(/[/\\]/).pop() || 'libro'
    const id = Date.now().toString()
    const targetFileName = `${id}.${ext}`
    const targetPath = join(getLibraryFilesDir(), targetFileName)

    // Copy physical file to library folder
    fs.copyFileSync(sourcePath, targetPath)
    const stats = fs.statSync(targetPath)

    // 1. Try EPUB internal metadata
    const epubMeta = ext === 'epub' ? extractEpubMetadata(targetPath) : null

    // 2. Local page detection from file (works for both PDF and EPUB)
    let pages = detectPagesFromFile(targetPath, ext) || epubMeta?.pages || ''

    // 3. Parse filename
    const { clean, possibleTitle, possibleAuthor } = parseFilenameMetadata(rawFileName)

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

    // 3. Search online using OpenLibrary / Wikipedia to separate title, author and find cover
    const searchQuery = epubMeta?.title 
      ? (epubMeta.author ? `${epubMeta.title} ${epubMeta.author}` : epubMeta.title)
      : clean

    try {
      const online = await searchBookOnline(searchQuery)
      if (online) {
        if (online.title && online.title.length > 1) {
          title = online.title
        }
        if (online.author && (!author || author === 'Autor desconocido')) {
          author = online.author
        }
        if (online.pages && !pages) pages = online.pages
        if (online.year && !year) year = online.year
        if (online.genre && !genre) genre = online.genre
        if (online.synopsis && !synopsis) synopsis = online.synopsis

        if (!coverUrl && online.coverUrl) {
          coverUrl = await downloadAndSaveCover(`lib_${id}`, online.coverUrl)
        }
      }
    } catch (se) {
      console.error('Error auto-searching book metadata:', se)
    }

    // Secondary fallback search if author still unknown
    if ((!author || author === 'Autor desconocido') && clean !== searchQuery) {
      try {
        const online2 = await searchBookOnline(clean)
        if (online2) {
          if (online2.title) title = online2.title
          if (online2.author) author = online2.author
          if (online2.coverUrl && !coverUrl) {
            coverUrl = await downloadAndSaveCover(`lib_${id}`, online2.coverUrl)
          }
          if (online2.pages && !pages) pages = online2.pages
        }
      } catch (e) {}
    }

    const newBook = {
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

    const library = getStoredLibrary()
    library.unshift(newBook)
    setStoredLibrary(library)
    return newBook
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
    const filtered = library.filter(b => b.id !== id)
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
    let targetDir = detected ? detected.targetFolder : ''

    if (!targetDir) {
      const dirRes = await dialog.showOpenDialog({
        title: 'Selecciona la carpeta "documents" o raíz de tu eReader / USB',
        buttonLabel: 'Copiar a esta carpeta',
        properties: ['openDirectory']
      })
      if (dirRes.canceled || dirRes.filePaths.length === 0) {
        return { success: false, message: 'Operación cancelada' }
      }
      targetDir = dirRes.filePaths[0]
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
    let targetDir = customTargetFolder || (detected ? detected.targetFolder : '')

    if (!targetDir) {
      const dirRes = await dialog.showOpenDialog({
        title: 'Selecciona la memoria principal o carpeta "documents" de tu eReader',
        buttonLabel: 'Transferir a esta carpeta',
        properties: ['openDirectory']
      })
      if (dirRes.canceled || dirRes.filePaths.length === 0) {
        return { success: false, count: 0, message: 'Operación cancelada' }
      }
      targetDir = dirRes.filePaths[0]
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
      const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + '\n\n(Puedes arrastrar el archivo resaltado en el Finder para adjuntarlo).')}`
      shell.openExternal(mailto)
      return {
        success: true,
        message: 'Se ha abierto tu cliente de correo. El archivo ha sido copiado al portapapeles y resaltado en el Finder para que puedas adjuntarlo fácilmente.'
      }
    }

    return {
      success: true,
      message: `¡Borrador de correo abierto con "${book.title}.${book.format}" adjunto directamente!\n(También se ha copiado al portapapeles).`
    }
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

  ipcMain.handle('export-readings', async (_, format: 'json' | 'csv' | 'markdown' | 'html') => {
    const books = getStoredBooks()
    if (books.length === 0) {
      return { success: false, message: 'No hay lecturas registradas para exportar.' }
    }

    const extMap: Record<string, string> = {
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
        format === 'json' ? { name: 'JSON', extensions: ['json'] } :
        format === 'csv' ? { name: 'CSV', extensions: ['csv'] } :
        format === 'markdown' ? { name: 'Markdown (.md)', extensions: ['md'] } :
        { name: 'Página Web / Imprimible HTML', extensions: ['html'] }
      ]
    })
    if (saveRes.canceled || !saveRes.filePath) {
      return { success: false, message: 'Exportación cancelada.' }
    }

    const outPath = saveRes.filePath

    try {
      if (format === 'json') {
        fs.writeFileSync(outPath, JSON.stringify(books, null, 2), 'utf-8')
      } else if (format === 'csv') {
        const header = 'ID,Título,Autor,Puntuación,Fecha de lectura,Tiempo lectura (min),Páginas,Género,Año,Sinopsis,Comentario\n'
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
        title: 'Selecciona la carpeta donde exportar los archivos de e-books (.epub, .pdf)',
        buttonLabel: 'Exportar libros aquí',
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
        message: `¡Se han exportado ${count} archivos de e-book a la carpeta seleccionada!`
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

  // Import readings from a previously exported JSON backup
  ipcMain.handle('import-readings-json', async () => {
    const openRes = await dialog.showOpenDialog({
      title: 'Seleccionar copia de seguridad JSON de Mis lecturas',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (openRes.canceled || openRes.filePaths.length === 0) {
      return { success: false, message: 'Operación cancelada.' }
    }
    try {
      const raw = fs.readFileSync(openRes.filePaths[0], 'utf-8')
      const imported = JSON.parse(raw)
      if (!Array.isArray(imported)) {
        return { success: false, message: 'El archivo seleccionado no tiene un formato válido de lista de lecturas.' }
      }
      const current = getStoredBooks()
      let added = 0
      imported.forEach((b: any) => {
        if (b && b.title && !current.some(c => c.id === b.id || (c.title === b.title && c.author === b.author))) {
          current.push(b)
          added++
        }
      })
      setStoredBooks(current)
      return { success: true, count: added, message: `Se han importado ${added} lecturas nuevas con éxito a Mis lecturas.` }
    } catch (e: any) {
      return { success: false, message: `Error al importar: ${e.message}` }
    }
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
