import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const APP_URL = 'http://127.0.0.1:4173'
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PROOF_MANIFEST =
  '/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/proof-softversko-rjesenje-2026-04-07/proof-manifest.json'
const OUT_FILE =
  '/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/section3-real-2026-04-07/kvadrato_real_seller_dashboard.png'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(PROOF_MANIFEST, 'utf-8'))
  const seller = manifest?.seeded_users?.seller
  if (!seller?.email || !seller?.password) {
    throw new Error('Seller credentials missing in proof-manifest.json')
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 900 },
  })
  try {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    await page.goto(`${APP_URL}/auth/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[type="email"]', { timeout: 20000 })
    await sleep(800)

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => {
        const txt = (b.textContent || '').trim()
        return txt.includes('Prodavac') || txt.includes('Prodavač') || txt.includes('Seller')
      })
      if (btn) btn.click()
    })
    await page.click('input[type="email"]', { clickCount: 3 })
    await page.type('input[type="email"]', seller.email, { delay: 10 })
    await page.click('input[type="password"]', { clickCount: 3 })
    await page.type('input[type="password"]', seller.password, { delay: 10 })

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null),
    ])
    await sleep(1200)

    await page.goto(`${APP_URL}/seller/dashboard`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('body', { timeout: 20000 })
    await sleep(1500)

    await page.screenshot({
      path: OUT_FILE,
      fullPage: false,
      captureBeyondViewport: false,
    })
    console.log(OUT_FILE)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
