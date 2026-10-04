import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tema visual: se elige al arrancar con la variable de entorno THEME
// (ver docker/docker-compose.yaml). Es un fichero de src/styles/themes/.
const THEMES_DIR = resolve(__dirname, 'src/styles/themes')
const theme = process.env.THEME || 'negro-naranja'
const themeFile = resolve(THEMES_DIR, `${theme}.css`)

if (!/^[a-z0-9-]+$/.test(theme) || !existsSync(themeFile)) {
  const available = readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith('.css'))
    .map((f) => f.replace(/\.css$/, ''))
  throw new Error(`Tema "${theme}" no encontrado. Temas disponibles: ${available.join(', ')}`)
}
console.log(`Tema: ${theme}`)

// Favicon con los colores del tema: fondo --background y líneas --primary
function themeColor(name: string) {
  const match = readFileSync(themeFile, 'utf-8').match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`El tema "${theme}" no define --${name}`)
  return match[1].trim()
}

function themeFavicon(): Plugin {
  const svg = () =>
    readFileSync(resolve(__dirname, 'src/assets/favicon.svg'), 'utf-8')
      .replaceAll('__BG__', themeColor('background'))
      .replaceAll('__FG__', themeColor('primary'))

  return {
    name: 'theme-favicon',
    configureServer(server) {
      server.middlewares.use('/favicon.svg', (_req, res) => {
        res.setHeader('Content-Type', 'image/svg+xml')
        res.end(svg())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'favicon.svg', source: svg() })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), themeFavicon()],
  resolve: {
    alias: {
      '@theme': themeFile,
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': process.env.API_PROXY_TARGET || 'http://localhost:8000',
    },
  },
  build: {
    rollupOptions: {
      // Dos páginas: la app (index.html) y la administración (admin.html)
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})
