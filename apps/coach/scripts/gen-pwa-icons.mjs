#!/usr/bin/env node
/**
 * Generates the Pullim 입시코치 PWA app icons from the brand blue glyph.
 *
 * Glyph language (reused from public/favicon.svg):
 *   - solid Pullim blue (#0362DA) background
 *   - white "P" stroke mark
 *   - lemon (#E6FF4C) dot lower-right
 *
 * Outputs (all square PNG, solid blue bg, NO transparency):
 *   public/icon-192.png             192×192   any
 *   public/icon-512.png             512×512   any
 *   public/icon-maskable-512.png    512×512   maskable (extra safe-area padding)
 *   public/apple-touch-icon.png     180×180   apple touch (solid bg, opaque)
 *
 * Rasterization: sharp. Run with:  node scripts/gen-pwa-icons.mjs
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')

const BLUE = '#0362DA'
const WHITE = '#ffffff'
const LEMON = '#E6FF4C'

/**
 * Build the glyph SVG on a solid blue background, sized to `px`.
 * `glyphScale` controls the safe-area: 0.64 = glyph occupies ~64% of the
 * canvas, leaving ~18% padding on each side (survives maskable circle/squircle
 * cropping). The 64-unit design from favicon.svg is centered & scaled.
 */
function svg(px, glyphScale) {
  const G = 64 // design viewBox of the source glyph
  const scale = (px * glyphScale) / G
  const offset = (px - G * scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">
  <rect width="${px}" height="${px}" fill="${BLUE}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M23 17v30M23 17h11a9.5 9.5 0 0 1 0 19H23" fill="none" stroke="${WHITE}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="46" cy="46" r="7" fill="${LEMON}"/>
  </g>
</svg>`
}

async function render(name, px, glyphScale) {
  const buf = Buffer.from(svg(px, glyphScale))
  await sharp(buf, { density: 384 })
    .resize(px, px)
    .flatten({ background: BLUE }) // guarantee opaque, no transparency
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC, name))
  console.log(`✓ ${name} (${px}×${px})`)
}

await render('icon-192.png', 192, 0.62)
await render('icon-512.png', 512, 0.62)
// Maskable: tighter glyph (more padding) so it survives aggressive mask crops.
await render('icon-maskable-512.png', 512, 0.5)
await render('apple-touch-icon.png', 180, 0.62)

console.log('PWA icons generated.')
