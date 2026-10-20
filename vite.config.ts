/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Nella versione costruita le pagine possono caricare solo i propri file: niente da internet.
// (Nello sviluppo no: Vite ha bisogno di script in linea per ricaricare le pagine.)
const SICUREZZA =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"

function sicurezzaNellaCostruzione(): Plugin {
  return {
    name: 'sicurezza-nella-costruzione',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${SICUREZZA}" />`,
      ),
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Le pagine si aprono da file (Electron, loadFile): i percorsi devono essere relativi.
  base: './',
  plugins: [react(), sicurezzaNellaCostruzione()],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
})
