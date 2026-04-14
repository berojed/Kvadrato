import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE_URL = 'http://127.0.0.1:4173'
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT_DIR = '/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/prikaz-softverskog-rjesenja-2026-04-07'
const TODAY = '2026-04-07'

const extractedFeatures = [
  {
    name: '3D konfiguracija prostorija i spremanje kamera',
    description:
      'Prodavatelj navigira 3D model i sprema pozicije kamere po prostorijama (CameraTracker + saveProperty3DRoom).',
    expectedRoute: '/seller/3d-config/:id',
    priority: 'high',
    relatedDocumentPart: 'Str. 61, 2.4 (kraj), Isječak 5',
  },
  {
    name: 'Kartografski prikaz lokacije nekretnine',
    description:
      'Odabir lokacije kroz Leaflet kartu: klik na kartu, geokodiranje adrese i povlačenje markera.',
    expectedRoute: '/seller/add (PropertyLocationPicker)',
    priority: 'high',
    relatedDocumentPart: 'Str. 61-63, 2.5, Isječak 6',
  },
  {
    name: 'Globalne UI preferencije (jezik, tema, font)',
    description:
      'Postavke sučelja pohranjene u localStorage i primijenjene prije prvog rendera kroz UIPreferencesContext.',
    expectedRoute: '/settings ili /seller/settings',
    priority: 'high',
    relatedDocumentPart: 'Str. 63-64, 2.6, Isječak 7',
  },
  {
    name: 'Poruke prema prodavatelju (Edge Function)',
    description:
      'Kupac šalje upit preko send-property-inquiry funkcije; UI prikazuje povijest poruka i status slanja.',
    expectedRoute: '/properties/:id (buyer view)',
    priority: 'high',
    relatedDocumentPart: 'Str. 64-65, 2.7, Isječak 8',
  },
  {
    name: 'Zahtjev za razgledavanje i prevencija duplikata',
    description:
      'Kupac kreira visit_request uz provjeru vlasništva i aktivnog postojećeg zahtjeva.',
    expectedRoute: '/properties/:id (buyer view), /my-viewings',
    priority: 'high',
    relatedDocumentPart: 'Str. 65, 2.7, Isječak 9',
  },
  {
    name: 'Upravljačka ploča prodavatelja s metrikama',
    description:
      'Pregled aktivnih oglasa, kontakata i razgledavanja te akcije uređivanja/brisanja.',
    expectedRoute: '/seller/dashboard',
    priority: 'high',
    relatedDocumentPart: 'Str. 68-69, SEL-03',
  },
  {
    name: '3D preglednik nekretnine s navigacijom soba',
    description: 'Otvaranje 3D modala i prebacivanje na predefinirane sobne poglede.',
    expectedRoute: '/properties/:id (3D modal)',
    priority: 'high',
    relatedDocumentPart: 'Str. 69, 3D-03',
  },
  {
    name: 'Prebacivanje jezika HR ↔ EN',
    description: 'Promjena jezika u postavkama i perzistencija odabira.',
    expectedRoute: '/settings (Appearance)',
    priority: 'medium',
    relatedDocumentPart: 'Str. 69, I18N-01',
  },
]

const captureResults = []
const issues = []

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function waitUi(page) {
  await page.waitForSelector('body', { timeout: 15000 })
  await sleep(1400)
}

async function resolveFirstPropertyPath(page) {
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href^="/properties/"]'))
    const match = anchors
      .map((a) => a.getAttribute('href'))
      .find((href) => href && /^\/properties\/[^/]+$/.test(href))
    return match || null
  })
}

async function clickByText(page, candidates) {
  const escaped = candidates.map((v) => v.replace(/"/g, '\\"'))
  const ok = await page.evaluate((texts) => {
    const nodes = Array.from(document.querySelectorAll('button, a, [role="button"]'))
    const target = nodes.find((n) => {
      const txt = (n.textContent || '').trim()
      return texts.some((t) => txt.includes(t))
    })
    if (!target) return false
    target.click()
    return true
  }, escaped)
  return ok
}

async function shot(page, filename, meta) {
  const filePath = path.join(OUT_DIR, filename)
  await page.screenshot({ path: filePath, fullPage: true })
  captureResults.push({
    filename,
    filePath,
    ...meta,
    capturedAt: TODAY,
    status: 'captured',
  })
}

function addMissingShot(filename, meta, note) {
  captureResults.push({
    filename,
    filePath: path.join(OUT_DIR, filename),
    ...meta,
    capturedAt: TODAY,
    status: 'not_captured',
    notes: note,
  })
}

async function registerThroughUI(context, roleCode, label) {
  const page = await context.newPage()
  await page.setViewport({ width: 1512, height: 982 })
  const random = `${Date.now()}_${Math.floor(Math.random() * 100000)}`
  const email = `kvadrato.${roleCode.toLowerCase()}.${random}@example.com`
  const password = 'Kvadrato123!'

  await page.goto(`${BASE_URL}/auth/register`, { waitUntil: 'domcontentloaded' })
  await waitUi(page)

  const selectedRole = await clickByText(
    page,
    roleCode === 'BUYER'
      ? ['Tražim nekretninu', 'Kupac', 'Buyer', 'Tražim']
      : ['Prodajem nekretninu', 'Prodavac', 'Prodavač', 'Seller', 'Prodajem']
  )
  if (!selectedRole) {
    issues.push(`${label}: nije pronađen gumb za odabir role na /auth/register.`)
    await page.close()
    return { ok: false, page: null, email, password }
  }

  await waitUi(page)
  await page.type('input[name="firstName"]', roleCode === 'BUYER' ? 'Kupac' : 'Prodavac')
  await page.type('input[name="lastName"]', `Test${random.slice(-4)}`)
  await page.type('input[name="email"]', email)
  await page.type('input[name="password"]', password)
  await page.type('input[name="confirmPassword"]', password)

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null),
  ])
  await waitUi(page)

  const state = await page.evaluate(() => {
    const txt = (document.body?.innerText || '').toLowerCase()
    const hasConfirmMessage =
      txt.includes('potvrd') || txt.includes('check your email') || txt.includes('provjerite e-poštu')
    const hasAuthError = txt.includes('error') || txt.includes('greška') || txt.includes('already')
    return {
      href: location.pathname,
      hasConfirmMessage,
      hasAuthError,
    }
  })

  if (state.hasConfirmMessage && state.href.includes('/auth')) {
    issues.push(`${label}: registracija traži potvrdu e-pošte; autentificirani screenshotovi za ovu ulogu nisu dostupni.`)
    await page.close()
    return { ok: false, page: null, email, password, reason: 'email_confirmation_required' }
  }
  if (state.hasAuthError) {
    issues.push(`${label}: registracija nije uspjela (provjeriti auth poruku na UI).`)
    await page.close()
    return { ok: false, page: null, email, password, reason: 'registration_failed' }
  }

  return { ok: true, page, email, password }
}

async function capturePublic(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1512, height: 982 })

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
  await waitUi(page)
  await shot(page, 'kvadrato_homepage_full.png', {
    feature: 'Početna stranica aplikacije',
    relatedDocumentPart: 'Str. 61-70, opći prikaz UI-a',
    notes: 'Javni ulazni ekran platforme.',
  })

  await page.goto(`${BASE_URL}/properties`, { waitUntil: 'domcontentloaded' })
  await waitUi(page)
  await shot(page, 'kvadrato_properties_full.png', {
    feature: 'Popis nekretnina s filtrima',
    relatedDocumentPart: 'Str. 69 (potvrđene funkcionalnosti pregleda nekretnina)',
    notes: 'Prikaz liste oglasa i filtera.',
  })

  const propertyPath = await resolveFirstPropertyPath(page)
  if (!propertyPath) {
    issues.push('Nije pronađen niti jedan oglas na /properties pa detaljni prikazi nisu mogli biti snimljeni.')
    addMissingShot(
      'kvadrato_listing_detail_full.png',
      {
        feature: 'Detalj nekretnine',
        relatedDocumentPart: 'Str. 64-65, 2.7',
      },
      'Nema dostupnog oglasa.'
    )
    await page.close()
    await context.close()
    return null
  }

  await page.goto(`${BASE_URL}${propertyPath}`, { waitUntil: 'domcontentloaded' })
  await waitUi(page)
  await shot(page, 'kvadrato_listing_detail_full.png', {
    feature: 'Detaljni prikaz nekretnine',
    relatedDocumentPart: 'Str. 64-65, 2.7 (poruke i razgledavanje)',
    notes: `Korišten oglas: ${propertyPath}`,
  })

  const mapExists = await page.$('.leaflet-container')
  if (mapExists) {
    await page.evaluate(() => {
      const m = document.querySelector('.leaflet-container')
      if (m) m.scrollIntoView({ behavior: 'instant', block: 'center' })
    })
    await sleep(1200)
    await shot(page, 'kvadrato_map_view.png', {
      feature: 'Kartografski prikaz lokacije',
      relatedDocumentPart: 'Str. 61-63, 2.5',
      notes: 'Karta na detalju nekretnine.',
    })
  } else {
    issues.push(`Karta nije pronađena na ${propertyPath}.`)
    addMissingShot(
      'kvadrato_map_view.png',
      {
        feature: 'Kartografski prikaz lokacije',
        relatedDocumentPart: 'Str. 61-63, 2.5',
      },
      'Leaflet karta nije renderirana na detalju nekretnine.'
    )
  }

  const opened3D = await clickByText(page, ['3D model nekretnine', '3D property model'])
  if (opened3D) {
    await sleep(3200)
    await shot(page, 'kvadrato_3d_viewer_modal.png', {
      feature: '3D preglednik nekretnine',
      relatedDocumentPart: 'Str. 69, 3D-03',
      notes: 'Modalni 3D preglednik iz detalja nekretnine.',
    })
  } else {
    issues.push(`3D gumb nije dostupan na ${propertyPath}.`)
    addMissingShot(
      'kvadrato_3d_viewer_modal.png',
      {
        feature: '3D preglednik nekretnine',
        relatedDocumentPart: 'Str. 69, 3D-03',
      },
      'Na odabranom oglasu nije dostupan 3D model.'
    )
  }

  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' })
  await waitUi(page)
  await shot(page, 'kvadrato_login_role_selection_full.png', {
    feature: 'Prijava i odabir korisničke uloge',
    relatedDocumentPart: 'Str. 68, AUTH-04',
    notes: 'Ekran prijave s BUYER/SELLER odabirom.',
  })

  await page.close()
  await context.close()
  return propertyPath
}

async function captureBuyer(browser, propertyPath) {
  const context = await browser.createBrowserContext()
  const auth = await registerThroughUI(context, 'BUYER', 'BUYER')
  if (!auth.ok || !auth.page) {
    addMissingShot(
      'kvadrato_buyer_message_visit_cards.png',
      {
        feature: 'Poruke i zahtjev za razgledavanje (BUYER)',
        relatedDocumentPart: 'Str. 64-65, 2.7, Isječak 8-9',
      },
      'Nije uspostavljena BUYER sesija.'
    )
    addMissingShot(
      'kvadrato_settings_appearance_full.png',
      {
        feature: 'Postavke izgleda (BUYER)',
        relatedDocumentPart: 'Str. 63-64, 2.6',
      },
      'Nije uspostavljena BUYER sesija.'
    )
    addMissingShot(
      'kvadrato_settings_language_en.png',
      {
        feature: 'Prebacivanje jezika HR ↔ EN',
        relatedDocumentPart: 'Str. 69, I18N-01',
      },
      'Nije uspostavljena BUYER sesija.'
    )
    await context.close()
    return
  }
  const page = auth.page

  if (propertyPath) {
    await page.goto(`${BASE_URL}${propertyPath}`, { waitUntil: 'domcontentloaded' })
    await waitUi(page)
    await shot(page, 'kvadrato_buyer_message_visit_cards.png', {
      feature: 'Kupac: poruka prodavaču i zahtjev za razgledavanje',
      relatedDocumentPart: 'Str. 64-65, 2.7, Isječak 8-9',
      notes: 'Prikaz buyer akcijskih kartica na detalju nekretnine.',
    })
  }

  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' })
  await waitUi(page)
  await shot(page, 'kvadrato_settings_appearance_full.png', {
    feature: 'Postavke sučelja (jezik/tema/font)',
    relatedDocumentPart: 'Str. 63-64, 2.6, Isječak 7',
    notes: 'UIPreferences zaslon za BUYER korisnika.',
  })

  const languageSwitched = await clickByText(page, ['English'])
  if (languageSwitched) {
    await sleep(1200)
    await shot(page, 'kvadrato_settings_language_en.png', {
      feature: 'Prebacivanje jezika HR ↔ EN',
      relatedDocumentPart: 'Str. 69, I18N-01',
      notes: 'Nakon klika na English.',
    })
  } else {
    issues.push('BUYER settings: nije pronađena opcija "English" za jezični switch.')
    addMissingShot(
      'kvadrato_settings_language_en.png',
      {
        feature: 'Prebacivanje jezika HR ↔ EN',
        relatedDocumentPart: 'Str. 69, I18N-01',
      },
      'Jezični gumb nije pronađen na settings stranici.'
    )
  }

  await page.close()
  await context.close()
}

async function captureSeller(browser) {
  const context = await browser.createBrowserContext()
  const auth = await registerThroughUI(context, 'SELLER', 'SELLER')
  if (!auth.ok || !auth.page) {
    addMissingShot(
      'kvadrato_seller_dashboard_full.png',
      {
        feature: 'Upravljačka ploča prodavatelja',
        relatedDocumentPart: 'Str. 68-69, SEL-03',
      },
      'Nije uspostavljena SELLER sesija.'
    )
    addMissingShot(
      'kvadrato_seller_add_map_picker.png',
      {
        feature: 'Odabir lokacije na karti (SELLER)',
        relatedDocumentPart: 'Str. 61-63, 2.5',
      },
      'Nije uspostavljena SELLER sesija.'
    )
    addMissingShot(
      'kvadrato_seller_3d_config.png',
      {
        feature: '3D konfiguracija prostorija (SELLER)',
        relatedDocumentPart: 'Str. 61, 2.4 (kraj)',
      },
      'Nije uspostavljena SELLER sesija.'
    )
    await context.close()
    return
  }
  const page = auth.page

  await page.goto(`${BASE_URL}/seller/dashboard`, { waitUntil: 'domcontentloaded' })
  await waitUi(page)
  await shot(page, 'kvadrato_seller_dashboard_full.png', {
    feature: 'Upravljačka ploča prodavatelja',
    relatedDocumentPart: 'Str. 68-69, SEL-03',
    notes: 'Dashboard metrika i popisa oglasa.',
  })

  await page.goto(`${BASE_URL}/seller/add`, { waitUntil: 'domcontentloaded' })
  await waitUi(page)
  const mapNode = await page.$('.leaflet-container')
  if (mapNode) {
    await page.evaluate(() => {
      const m = document.querySelector('.leaflet-container')
      if (m) m.scrollIntoView({ behavior: 'instant', block: 'center' })
    })
    await sleep(1000)
    await shot(page, 'kvadrato_seller_add_map_picker.png', {
      feature: 'PropertyLocationPicker (SELLER Add Listing)',
      relatedDocumentPart: 'Str. 61-63, 2.5, Isječak 6',
      notes: 'Karta i marker u formi za dodavanje nekretnine.',
    })
  } else {
    issues.push('SELLER /seller/add: Leaflet karta nije pronađena.')
    addMissingShot(
      'kvadrato_seller_add_map_picker.png',
      {
        feature: 'PropertyLocationPicker (SELLER Add Listing)',
        relatedDocumentPart: 'Str. 61-63, 2.5, Isječak 6',
      },
      'Karta nije renderirana na /seller/add.'
    )
  }

  const sellerListingPath = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/seller/listings/"]'))
    return links[0]?.getAttribute('href') || null
  })

  if (!sellerListingPath) {
    issues.push('SELLER sesija nema dostupan listing za ulaz u /seller/3d-config/:id.')
    addMissingShot(
      'kvadrato_seller_3d_config.png',
      {
        feature: '3D konfiguracija prostorija (SELLER)',
        relatedDocumentPart: 'Str. 61, 2.4 (kraj), Isječak 5',
      },
      'Nije pronađen prodavateljev oglas za otvaranje konfiguracije prostorija.'
    )
  } else {
    await page.goto(`${BASE_URL}${sellerListingPath}`, { waitUntil: 'domcontentloaded' })
    await waitUi(page)
    const openConfig = await clickByText(page, ['Konfiguriraj 3D prostorije', 'Configure 3D rooms'])
    if (openConfig) {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null)
      await waitUi(page)
      await shot(page, 'kvadrato_seller_3d_config.png', {
        feature: '3D konfiguracija prostorija (SELLER)',
        relatedDocumentPart: 'Str. 61, 2.4 (kraj), Isječak 5',
        notes: 'Stranica spremanja sobnih kamera.',
      })
    } else {
      issues.push('SELLER listing ne prikazuje gumb za 3D konfiguraciju prostorija.')
      addMissingShot(
        'kvadrato_seller_3d_config.png',
        {
          feature: '3D konfiguracija prostorija (SELLER)',
          relatedDocumentPart: 'Str. 61, 2.4 (kraj), Isječak 5',
        },
        'Gumb za 3D konfiguraciju nije dostupan na detalju prodavatelja.'
      )
    }
  }

  await page.close()
  await context.close()
}

async function writeOutputs() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDocument: '/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni.docx',
    pageRangeAnalyzed: '61-70',
    focusedSection: 'Prikaz softverskog rješenja',
    extractedFeatures,
    screenshots: captureResults,
    issues,
  }

  const manifestPath = path.join(OUT_DIR, 'screenshot-manifest.json')
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

  const lines = []
  lines.push('# Kvadrato - Screenshot Mapping')
  lines.push('')
  lines.push(`- Datum generiranja: ${TODAY}`)
  lines.push('- Izvor: Zavrsni.docx, str. 61-70')
  lines.push('')
  lines.push('## Detektirane funkcionalnosti')
  lines.push('')
  for (const f of extractedFeatures) {
    lines.push(`- ${f.name} | ruta: ${f.expectedRoute} | prioritet: ${f.priority} | dio dokumenta: ${f.relatedDocumentPart}`)
  }
  lines.push('')
  lines.push('## Screenshotovi')
  lines.push('')
  for (const s of captureResults) {
    lines.push(`- ${s.filename} | status: ${s.status} | mapiranje: ${s.feature} | dokument: ${s.relatedDocumentPart} | napomena: ${s.notes || 'n/a'}`)
  }
  lines.push('')
  lines.push('## Predloženi potpisi (formalni hrvatski)')
  lines.push('')

  const captionByFile = {
    'kvadrato_homepage_full.png': 'Slika X: Početni prikaz aplikacije Kvadrato s glavnim ulaznim funkcionalnostima.',
    'kvadrato_properties_full.png': 'Slika X: Prikaz popisa nekretnina s dostupnim filtrima pretraživanja.',
    'kvadrato_listing_detail_full.png': 'Slika X: Detaljni prikaz pojedine nekretnine unutar aplikacije Kvadrato.',
    'kvadrato_map_view.png': 'Slika X: Kartografski prikaz lokacije nekretnine integriran putem Leaflet komponente.',
    'kvadrato_3d_viewer_modal.png': 'Slika X: Trodimenzionalni preglednik nekretnine s prikazom modela u modalnom prozoru.',
    'kvadrato_login_role_selection_full.png': 'Slika X: Ekran prijave s odabirom korisničke uloge (kupac/prodavač).',
    'kvadrato_buyer_message_visit_cards.png': 'Slika X: Prikaz korisničkih kartica za slanje upita i zahtjev za razgledavanje.',
    'kvadrato_settings_appearance_full.png': 'Slika X: Postavke korisničkog sučelja za upravljanje jezikom, temom i fontom.',
    'kvadrato_settings_language_en.png': 'Slika X: Prikaz sučelja nakon prebacivanja jezika na engleski.',
    'kvadrato_seller_dashboard_full.png': 'Slika X: Upravljačka ploča prodavača s ključnim metrikama i popisom oglasa.',
    'kvadrato_seller_add_map_picker.png': 'Slika X: Odabir geolokacije nekretnine u formi za unos oglasa.',
    'kvadrato_seller_3d_config.png': 'Slika X: Konfiguracijska stranica za spremanje 3D prikaza prostorija nekretnine.',
  }

  for (const s of captureResults) {
    const caption = captionByFile[s.filename] || 'Slika X: Prikaz funkcionalnosti unutar aplikacije Kvadrato.'
    lines.push(`- ${s.filename}: ${caption}`)
  }
  lines.push('')
  lines.push('## Problemi')
  lines.push('')
  if (!issues.length) {
    lines.push('- Nisu zabilježeni blokirajući problemi.')
  } else {
    for (const issue of issues) lines.push(`- ${issue}`)
  }

  const mapPath = path.join(OUT_DIR, 'screenshot-mapping.md')
  await fs.writeFile(mapPath, lines.join('\n'), 'utf8')

  console.log(`Manifest: ${manifestPath}`)
  console.log(`Mapping: ${mapPath}`)
}

async function main() {
  await ensureDir(OUT_DIR)

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1512,982'],
    defaultViewport: { width: 1512, height: 982 },
  })

  try {
    const propertyPath = await capturePublic(browser)
    await captureBuyer(browser, propertyPath)
    await captureSeller(browser)
    await writeOutputs()
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
