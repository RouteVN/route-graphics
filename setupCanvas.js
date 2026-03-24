import { createCanvas, registerFont } from 'canvas'
import { JSDOM } from 'jsdom'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, vi } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const notoSansPath = join(__dirname, 'spec/assets/fonts/NotoSans-Regular.ttf')

// Pin text metrics in tests to a vendored font instead of host-specific Arial.
registerFont(notoSansPath, { family: 'Arial' })
registerFont(notoSansPath, { family: 'RouteGraphicsTestSans' })

// Create a DOM environment
const dom = new JSDOM('<!doctype html><html><body></body></html>')

// Expose globals so your code sees them
global.window = dom.window
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
global.HTMLCanvasElement = dom.window.HTMLCanvasElement

// Patch <canvas> to use node-canvas
global.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type === '2d') {
    const width = this.width || 1280
    const height = this.height || 720
    const canvas = createCanvas(width, height)
    return canvas.getContext('2d')
  }
  return null
}

beforeEach(async () => {
  const pixi = await vi.importActual('pixi.js')
  pixi.CanvasTextMetrics.clearMetrics()
})
