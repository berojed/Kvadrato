import fs from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const manifest = JSON.parse(
  await fs.readFile(
    '/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/proof-softversko-rjesenje-2026-04-07/proof-manifest.json',
    'utf8'
  )
)
const buyer = manifest.seeded_users.buyer
const listingId = manifest.seeded_listing.listing_id

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})

const page = await browser.newPage()
await page.goto('http://127.0.0.1:4173/auth/login', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 700))

await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) =>
    (b.textContent || '').includes('Kupac')
  )
  if (btn) btn.click()
})

await page.type('input[type="email"]', buyer.email)
await page.type('input[type="password"]', buyer.password)
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null),
])
await new Promise((r) => setTimeout(r, 1000))

await page.goto(`http://127.0.0.1:4173/properties/${listingId}`, {
  waitUntil: 'domcontentloaded',
})
await new Promise((r) => setTimeout(r, 1500))

const before = await page.evaluate(() => {
  const body = document.body?.innerText || ''
  const dayBtns = Array.from(
    document.querySelectorAll('div.grid.grid-cols-7.gap-1 button')
  ).filter((b) => !b.disabled)
  const timeBtns = Array.from(
    document.querySelectorAll('div.grid.grid-cols-5.gap-1\\.5 button')
  )
  const scheduleBtn = Array.from(document.querySelectorAll('button')).find((b) =>
    (b.textContent || '').includes('Zakaži pregled')
  )
  return {
    hasSummary: body.includes('Pogledaj detalje'),
    hasScheduleTitle: body.includes('Zakaži pregled'),
    dayBtns: dayBtns.length,
    timeBtns: timeBtns.length,
    hasScheduleBtn: !!scheduleBtn,
  }
})
console.log('before', before)

if (before.dayBtns > 0) {
  await page.click('div.grid.grid-cols-7.gap-1 button:not([disabled])')
  await new Promise((r) => setTimeout(r, 700))
}

const afterDay = await page.evaluate(() => {
  const timeBtns = Array.from(
    document.querySelectorAll('div.grid.grid-cols-5.gap-1\\.5 button')
  )
  return { timeBtns: timeBtns.length }
})
console.log('afterDay', afterDay)

if (afterDay.timeBtns > 0) {
  await page.click('div.grid.grid-cols-5.gap-1\\.5 button')
  await new Promise((r) => setTimeout(r, 300))
}

const hasSchedule = await page.evaluate(() => {
  return !!Array.from(document.querySelectorAll('button')).find((b) =>
    (b.textContent || '').includes('Zakaži pregled')
  )
})
console.log('hasScheduleButtonNow', hasSchedule)

if (hasSchedule) {
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('Zakaži pregled')
    )
    if (btn) btn.click()
  })
  await new Promise((r) => setTimeout(r, 2200))
}

const after = await page.evaluate(() => {
  const body = document.body?.innerText || ''
  return {
    hasViewDetails: body.includes('Pogledaj detalje'),
    hasScheduleTitle: body.includes('Zakaži pregled'),
    hasDuplicateError: body.includes('DUPLICATE_VISIT_REQUEST'),
    hasSelfError: body.includes('SELF_VIEWING_DENIED'),
  }
})
console.log('after', after)

await page.screenshot({
  path: '/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/proof-softversko-rjesenje-2026-04-07/debug_visit_flow.png',
  fullPage: true,
})

await browser.close()
