export interface SpinePalette {
  bg: string
  text: string
  accent: string
  ribbon: string
  isLight: boolean
}

// Fallback editorial bookcloth palette with guaranteed high contrast
export const SPINE_PALETTES: SpinePalette[] = [
  { bg: '#663A24', text: '#FDFBF7', accent: '#D7BA9D', ribbon: '#C3DDE6', isLight: false }, // Terracota cálido
  { bg: '#285666', text: '#FDFBF7', accent: '#8EAFC0', ribbon: '#F4D06F', isLight: false }, // Azul petróleo
  { bg: '#3C6655', text: '#FDFBF7', accent: '#A3C2B3', ribbon: '#E29578', isLight: false }, // Verde bosque
  { bg: '#7A3B43', text: '#FDFBF7', accent: '#D89BA4', ribbon: '#FFE6A7', isLight: false }, // Granate / Borgoña
  { bg: '#3B4E61', text: '#FDFBF7', accent: '#9EBAD2', ribbon: '#FFDDD2', isLight: false }, // Azul pizarra
  { bg: '#8C6239', text: '#FDFBF7', accent: '#E0C5A8', ribbon: '#83C5BE', isLight: false }, // Ocre tabaco
  { bg: '#2B333E', text: '#FDFBF7', accent: '#CBD5E0', ribbon: '#FEB2B2', isLight: false }, // Grafito / Marino
  { bg: '#5C4033', text: '#FDFBF7', accent: '#C8B097', ribbon: '#90E0EF', isLight: false }, // Cuero tostado
  { bg: '#4A5859', text: '#FDFBF7', accent: '#BACECF', ribbon: '#F4A261', isLight: false }, // Gris mineral
  { bg: '#6B4C35', text: '#FDFBF7', accent: '#D7BA9D', ribbon: '#A8DADC', isLight: false }  // Habana suave
]

const coverPaletteCache = new Map<string, SpinePalette>()

// Extract dominant color from book cover (specifically sampling the spine/left edge of the cover)
export function extractCoverPalette(coverUrl: string, fallbackIdx: number): Promise<SpinePalette> {
  return new Promise((resolve) => {
    if (!coverUrl) {
      resolve(SPINE_PALETTES[fallbackIdx % SPINE_PALETTES.length])
      return
    }

    if (coverPaletteCache.has(coverUrl)) {
      resolve(coverPaletteCache.get(coverUrl)!)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = coverUrl

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(SPINE_PALETTES[fallbackIdx % SPINE_PALETTES.length])
          return
        }

        // Sample the left 35% of the cover image
        canvas.width = 16
        canvas.height = 32
        ctx.drawImage(img, 0, 0, img.naturalWidth * 0.35, img.naturalHeight, 0, 0, 16, 32)

        const imgData = ctx.getImageData(0, 0, 16, 32).data
        let rTotal = 0, gTotal = 0, bTotal = 0, count = 0

        for (let i = 0; i < imgData.length; i += 4) {
          const a = imgData[i + 3]
          if (a > 128) {
            rTotal += imgData[i]
            gTotal += imgData[i + 1]
            bTotal += imgData[i + 2]
            count++
          }
        }

        if (count === 0) {
          resolve(SPINE_PALETTES[fallbackIdx % SPINE_PALETTES.length])
          return
        }

        let r = Math.round(rTotal / count)
        let g = Math.round(gTotal / count)
        let b = Math.round(bTotal / count)

        // Perceived luminance using standard ITU-R BT.709
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

        // If color is washed out / blinding white, tone down to warm parchment
        if (luminance > 0.88) {
          r = Math.round(r * 0.92)
          g = Math.round(g * 0.90)
          b = Math.round(b * 0.88)
        }

        const isLight = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55

        // High-Contrast Typography:
        // Light spine -> Deep charcoal ink text (#14232A)
        // Dark spine -> Crisp porcelain cream white (#FDFBF7)
        const text = isLight ? '#14232A' : '#FDFBF7'
        const accent = isLight ? 'rgba(20, 35, 42, 0.45)' : 'rgba(253, 251, 247, 0.6)'
        const ribbon = isLight ? '#285666' : '#F4D06F'
        const bg = `rgb(${r}, ${g}, ${b})`

        const palette: SpinePalette = { bg, text, accent, ribbon, isLight }
        coverPaletteCache.set(coverUrl, palette)
        resolve(palette)
      } catch {
        resolve(SPINE_PALETTES[fallbackIdx % SPINE_PALETTES.length])
      }
    }

    img.onerror = () => {
      resolve(SPINE_PALETTES[fallbackIdx % SPINE_PALETTES.length])
    }
  })
}
