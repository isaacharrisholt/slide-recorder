import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder'
import puppeteer, { Page } from 'puppeteer'
import * as fs from 'fs'

const PORT = 9000

const RECORDER_CONFIG = {
  fps: 60,
  aspectRatio: '16:9',
  videoFrame: {
    width: 2560,
    height: 1440,
  },
}

const VIDEO_LENGTH_SECONDS = 15

async function getSlideNumber(page: Page): Promise<number> {
  // Get slide number from URL hash
  const slideNumber = await page.evaluate(() => {
    const pathParts = window.location.hash.split('/')
    const slideNumber = parseInt(pathParts[pathParts.length - 1])
    return slideNumber || 0
  })

  return slideNumber
}

async function nextSlide(page: Page): Promise<boolean> {
  // Try to go to next slide. If there is no next slide, return false

  // Get current slide from URL hash
  const currentSlide = await getSlideNumber(page)

  // Use right arrow key to go to next slide
  await page.keyboard.press('ArrowRight')

  // Check if slide changed
  const newSlide = await getSlideNumber(page)

  return currentSlide !== newSlide
}

async function handleSlide(page: Page, outputDir: string, slide: number) {
  // Screenshot and record for 15s if slide has a gif or webp

  // Screenshot
  console.log('Screenshotting')
  await page.screenshot({
    path: `${outputDir}/slides/Slide ${slide}.png`,
  })
  console.log('Screenshot done')

  // Check if slide has gif
  const hasGif = await page.evaluate(() => {
    // Get slide (section) with class 'present'
    const currentSlide = document.querySelectorAll('section.present')[0]
    if (!currentSlide) {
      console.log('No current slide')
      return
    }

    const images = currentSlide.querySelectorAll('img')
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      if (image.src.endsWith('.gif') || image.src.endsWith('.webp')) {
        return true
      }
    }
    return false
  })

  if (!hasGif) {
    return
  }

  // Record
  console.log('Recording')
  const recorder = new PuppeteerScreenRecorder(page, RECORDER_CONFIG)

  await recorder.start(`${outputDir}/gifs/Slide ${slide}.mp4`)
  await new Promise((resolve) => setTimeout(resolve, VIDEO_LENGTH_SECONDS * 1000))
  await recorder.stop()
  console.log('Recording done')
}

async function main() {
  console.log('Starting server')
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: {
      width: RECORDER_CONFIG.videoFrame.width,
      height: RECORDER_CONFIG.videoFrame.height,
    },
    args: [
      `--window-size=${RECORDER_CONFIG.videoFrame.width},${RECORDER_CONFIG.videoFrame.height + 160}`,
    ]
  })
  const page = await browser.newPage()
  await page.goto(`http://localhost:${PORT}`)

  // Create output directory
  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output')
  }

  // Create date directory
  const date = new Date()
  const dateDir = `./output/${date.toISOString().split('.')[0].replace(/:/g, '-')}`
  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir)
  }
  if (!fs.existsSync(`${dateDir}/slides`)) {
    fs.mkdirSync(`${dateDir}/slides`)
  }
  if (!fs.existsSync(`${dateDir}/gifs`)) {
    fs.mkdirSync(`${dateDir}/gifs`)
  }

  let slide = 0
  console.log('Starting recording')
  while (true) {
    console.log(`Slide ${slide}`)
    await handleSlide(page, dateDir, slide)
    slide++

    const hasNextSlide = await nextSlide(page)
    if (!hasNextSlide) {
      break
    }
  }

  await browser.close()
  console.log('Done')
}

await main()
