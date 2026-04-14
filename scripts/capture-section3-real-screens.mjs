import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const APP_URL = 'http://127.0.0.1:4173'
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const TODAY = '2026-04-07'
const OUT_DIR = '/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/section3-real-2026-04-07'
const PROOF_MANIFEST =
  '/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/proof-softversko-rjesenje-2026-04-07/proof-manifest.json'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUi(page, ms = 1200) {
  await page.waitForSelector('body', { timeout: 20000 })
  await sleep(ms)
}

async function screenshot(page, file) {
  const filePath = path.join(OUT_DIR, file)
  await page.screenshot({
    path: filePath,
    fullPage: false,
    captureBeyondViewport: false,
  })
  return filePath
}

async function chooseRole(page, roleCode) {
  return page.evaluate((role) => {
    const wanted =
      role === 'SELLER'
        ? ['Prodavac', 'Prodavač', 'Seller']
        : ['Kupac', 'Buyer', 'Tražim nekretninu']
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
    const hit = buttons.find((b) => {
      const txt = (b.textContent || '').trim()
      return wanted.some((w) => txt.includes(w))
    })
    if (!hit) return false
    hit.click()
    return true
  }, roleCode)
}

async function login(page, creds) {
  await page.goto(`${APP_URL}/auth/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await sleep(900)
  await chooseRole(page, creds.role_code || 'BUYER')

  await page.click('input[type="email"]', { clickCount: 3 })
  await page.type('input[type="email"]', creds.email, { delay: 12 })
  await page.click('input[type="password"]', { clickCount: 3 })
  await page.type('input[type="password"]', creds.password, { delay: 12 })
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null),
  ])
  await sleep(1400)
}

async function applySearchAndFilters(page, title) {
  await page.goto(`${APP_URL}/properties`, { waitUntil: 'domcontentloaded' })
  await waitUi(page, 1500)

  await page.evaluate((query) => {
    const input =
      document.querySelector('input[placeholder*="Pretraži"]') ||
      document.querySelector('input[type="search"]')
    if (input) {
      input.focus()
      input.value = query
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, title)
  await sleep(1400)

  const visibleTitles = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href^="/properties/"]'))
      .map((a) => (a.textContent || '').trim().replace(/\s+/g, ' '))
      .filter((t) => t.length > 0)
      .slice(0, 12)
  })

  await screenshot(page, 'kvadrato_real_listing_overview.png')

  await page.evaluate(() => {
    const clickFirstMatchingButton = (candidates) => {
      const nodes = Array.from(document.querySelectorAll('button'))
      const hit = nodes.find((n) => {
        const txt = (n.textContent || '').trim()
        return candidates.some((c) => txt === c || txt.includes(c))
      })
      if (hit) hit.click()
    }
    clickFirstMatchingButton(['Prodaja', 'SALE'])
    clickFirstMatchingButton(['2+'])
    const fromInputs = Array.from(document.querySelectorAll('input[placeholder="Od"]'))
    if (fromInputs[0]) {
      fromInputs[0].focus()
      fromInputs[0].value = '180000'
      fromInputs[0].dispatchEvent(new Event('input', { bubbles: true }))
      fromInputs[0].dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await sleep(1200)

  await screenshot(page, 'kvadrato_real_filters_search.png')
  return visibleTitles
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const proofRaw = await fs.readFile(PROOF_MANIFEST, 'utf-8')
  const proof = JSON.parse(proofRaw)
  const listingId = proof?.seeded_listing?.listing_id
  const listingTitle = proof?.seeded_listing?.title
  const buyer = proof?.seeded_users?.buyer

  if (!listingId || !listingTitle || !buyer?.email || !buyer?.password) {
    throw new Error('Missing seeded listing or buyer credentials in proof-manifest.json')
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 900 },
  })

  const created = []
  const notes = []

  try {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()

    await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded' })
    await waitUi(page, 1200)
    created.push(await screenshot(page, 'kvadrato_real_homepage_balanced.png'))

    await page.goto(`${APP_URL}/auth/login`, { waitUntil: 'domcontentloaded' })
    await waitUi(page, 1200)
    created.push(await screenshot(page, 'kvadrato_real_authentication_login.png'))

    const titles = await applySearchAndFilters(page, listingTitle)
    notes.push({ listing_overview_titles: titles })
    created.push(path.join(OUT_DIR, 'kvadrato_real_listing_overview.png'))
    created.push(path.join(OUT_DIR, 'kvadrato_real_filters_search.png'))

    await page.goto(`${APP_URL}/properties/${listingId}`, { waitUntil: 'domcontentloaded' })
    await waitUi(page, 1500)
    const detailHasTitle = await page.evaluate((title) => {
      const txt = (document.body?.innerText || '').toLowerCase()
      return txt.includes(title.toLowerCase())
    }, listingTitle)
    notes.push({ property_detail_has_expected_title: detailHasTitle, listing_id: listingId })
    created.push(await screenshot(page, 'kvadrato_real_property_detail.png'))

    await login(page, { ...buyer, role_code: 'BUYER' })
    await page.goto(`${APP_URL}/settings`, { waitUntil: 'domcontentloaded' })
    await waitUi(page, 1000)
    await page.evaluate(() => {
      const hit = Array.from(document.querySelectorAll('button')).find((b) => {
        const txt = (b.textContent || '').trim()
        return txt.includes('Izgled') || txt.includes('Appearance')
      })
      if (hit) hit.click()
    })
    await sleep(900)
    created.push(await screenshot(page, 'kvadrato_real_settings_preferences.png'))

    const manifest = {
      generatedAt: `${TODAY}T20:00:00+02:00`,
      source: 'capture-section3-real-screens.mjs',
      listing: {
        listing_id: listingId,
        title: listingTitle,
      },
      screenshots: created,
      notes,
    }
    await fs.writeFile(
      path.join(OUT_DIR, 'section3-real-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf-8'
    )
  } finally {
    await browser.close()
  }

  for (const file of created) {
    console.log(file)
  }
  console.log(path.join(OUT_DIR, 'section3-real-manifest.json'))
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
