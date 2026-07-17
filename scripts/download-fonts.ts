/**
 * scripts/download-fonts.mjs
 * Lädt Google Fonts lokal herunter (nur lateinische Subsets).
 * Ersetzt den CDN-Link in nuxt.config.ts für Offline-Fähigkeit.
 */

import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@600;700;800&display=swap'

const OUT_DIR = path.resolve('public/fonts')

function fetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res: IncomingMessage) => {
      let data = ''
      res.on('data', (c: string | Buffer) => { data += c.toString() })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res: IncomingMessage) => {
      if (res.statusCode !== 200) {
        reject(new Error(`${res.statusCode} ${url}`))
        return
      }
      const ws = fs.createWriteStream(dest)
      res.pipe(ws)
      ws.on('finish', () => resolve())
      ws.on('error', reject)
    }).on('error', reject)
  })
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const css = await fetch(CSS_URL)
  
  // Parse @font-face blocks with latin subset
  const blocks = css.split('@font-face')
  const toDownload = []

  for (const block of blocks) {
    if (!block.includes('latin')) continue
    
    const family = block.match(/font-family:\s*'([^']+)'/)
    const weight = block.match(/font-weight:\s*(\d+)/)
    const urlMatch = block.match(/url\(([^)]+)\)/)
    const formatMatch = block.match(/format\('([^']+)'\)/)
    
    if (!family || !weight || !urlMatch) continue
    
    const name = family[1]?.replace(/\s+/g, '')
    if (!name) continue
    const ext = formatMatch?.[1] === 'woff2' ? '.woff2' : '.ttf'
    const w = weight[1]
    if (!w) continue
    const fname = `${name}-${w}${ext}`
    const dest = path.join(OUT_DIR, fname)
    
    if (fs.existsSync(dest)) {
      console.log(`✔ Bereits vorhanden: ${fname}`)
      continue
    }
    
    const u = urlMatch[1]
    if (!u) continue
    toDownload.push({ url: u, dest, fname })
  }

  if (toDownload.length === 0) {
    console.log('Keine neuen Fonts zum Download gefunden.')
    return
  }

  console.log(`Download von ${toDownload.length} Font-Dateien …`)
  for (const { url, dest, fname } of toDownload) {
    try {
      await download(url, dest)
      const size = fs.statSync(dest).size
      console.log(`  ✔ ${fname} (${(size / 1024).toFixed(1)} kB)`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  ✘ ${fname}: ${msg}`)
    }
  }
  console.log('Fertig!')
}

main().catch(console.error)
