import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import puppeteer from 'puppeteer-core'

const APP_URL = 'http://127.0.0.1:4173'
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT_DIR = '/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/proof-softversko-rjesenje-2026-04-07'
const ENV_PATH = '/Users/bernard/Desktop/Kvadrato/kvadrato/.env.local'
const TODAY = '2026-04-07'
const PASSWORD = 'Kvadrato123!'

const FEATURES_ANALYZED = [
  {
    feature_name: 'Konfiguracija 3D prostorija i spremanje kamera',
    document_part: 'Str. 61, 2.4 (kraj), Isječak 5',
    has_code_explanation: 'yes',
    proof_requirement:
      'Prodavatelj mora imati otvorenu stranicu /seller/3d-config/:id s učitanim modelom i vidljivim UI-em za spremanje soba.',
    app_location: '/seller/3d-config/:id',
  },
  {
    feature_name: 'Kartografski prikaz i odabir lokacije nekretnine',
    document_part: 'Str. 61-63, 2.5, Isječak 6',
    has_code_explanation: 'yes',
    proof_requirement:
      'Na seller formi mora biti vidljiv Leaflet picker s markerom i odabranom lokacijom.',
    app_location: '/seller/edit/:id',
  },
  {
    feature_name: 'Globalne UI preferencije (UIPreferencesContext)',
    document_part: 'Str. 63-64, 2.6, Isječak 7',
    has_code_explanation: 'yes',
    proof_requirement:
      'Na postavkama mora biti vidljiv Appearance ekran s jezikom, temom i fontom.',
    app_location: '/settings',
  },
  {
    feature_name: 'Slanje poruke putem Edge Function',
    document_part: 'Str. 64-65, 2.7, Isječak 8',
    has_code_explanation: 'yes',
    proof_requirement:
      'Buyer mora poslati poruku na detalju oglasa i UI mora prikazati rezultat/povijest poruka.',
    app_location: '/properties/:id',
  },
  {
    feature_name: 'Kreiranje zahtjeva za razgledavanje i prevencija duplikata',
    document_part: 'Str. 65, 2.7, Isječak 9',
    has_code_explanation: 'yes',
    proof_requirement:
      'Buyer mora poslati visit request i potom vidjeti summary postojećeg aktivnog zahtjeva umjesto forme.',
    app_location: '/properties/:id',
  },
]

const STATE = {
  issues: [],
  screenshots: [],
  users: null,
  seeded_listing: null,
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseEnv(raw) {
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    out[key] = value
  }
  return out
}

function createAnonClient(url, key) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function ensureUser({ supabaseUrl, supabaseKey, roleCode, firstName, lastName }) {
  const client = createAnonClient(supabaseUrl, supabaseKey)
  const { data: roleRows, error: roleErr } = await client
    .from('role')
    .select('role_id, role_code')
    .eq('role_code', roleCode)
    .limit(1)

  if (roleErr || !roleRows?.length) {
    throw new Error(`Role lookup failed for ${roleCode}: ${roleErr?.message || 'missing role'}`)
  }
  const roleId = roleRows[0].role_id

  const email = `proof.${roleCode.toLowerCase()}.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`
  const signUpRes = await client.auth.signUp({
    email,
    password: PASSWORD,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role_id: roleId,
      },
    },
  })
  if (signUpRes.error) throw new Error(`Sign up failed (${roleCode}): ${signUpRes.error.message}`)

  let userId = signUpRes.data.user?.id
  if (!signUpRes.data.session) {
    const signInRes = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (signInRes.error || !signInRes.data.session) {
      throw new Error(`Sign in after sign up failed (${roleCode}): ${signInRes.error?.message || 'NO_SESSION'}`)
    }
    userId = signInRes.data.user?.id
  }

  if (!userId) throw new Error(`No user id for ${roleCode}`)

  // Wait for public.user trigger row
  let profileReady = false
  for (let i = 0; i < 12; i += 1) {
    const { data: profile } = await client
      .from('user')
      .select('user_id, role:role_id(role_code)')
      .eq('user_id', userId)
      .maybeSingle()
    if (profile?.user_id) {
      profileReady = true
      break
    }
    await sleep(300)
  }
  if (!profileReady) {
    throw new Error(`Profile row not available in public.user for ${roleCode} (${userId})`)
  }

  return { client, email, password: PASSWORD, user_id: userId, role_code: roleCode }
}

async function seedListing({ sellerClient }) {
  const listingTitle = 'Moderan dvosoban stan s balkonom u centru Zagreba'
  const listingDescription =
    'Prodaje se moderan dvosoban stan na odličnoj lokaciji u centru Zagreba, idealan za obiteljski život ili dugoročnu investiciju. ' +
    'Stan je svijetao, funkcionalnog rasporeda i nedavno renoviran, s kvalitetnim završnim materijalima i ugodnim dnevnim boravkom. ' +
    'Nekretnina uključuje balkon, osigurano parkirno mjesto i lift u zgradi, a svi ključni sadržaji dostupni su pješice.'

  const imageUrls = [
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80',
  ]

  const [propertyTypes, currencies, statuses, conditions, heatings, furnishings, amenities, locations, modelRows] = await Promise.all([
    sellerClient.from('property_type').select('property_type_id, type_name'),
    sellerClient.from('currency').select('currency_id, currency_name, symbol'),
    sellerClient.from('listing_status').select('status_id, status_code'),
    sellerClient.from('property_condition').select('condition_id, condition_name'),
    sellerClient.from('heating_type').select('heating_id, heating_name'),
    sellerClient.from('furnishing_type').select('furnishing_id, furnishing_name'),
    sellerClient.from('amenity').select('amenity_id, amenity_name'),
    sellerClient.from('location').select('location_id, city, state_region, postal_code, country').eq('city', 'Zagreb').eq('country', 'Hrvatska').limit(5),
    sellerClient.from('model3d').select('url').limit(1),
  ])

  const propTypeId =
    propertyTypes.data?.find((r) => (r.type_name || '').toLowerCase().includes('stan'))?.property_type_id ||
    propertyTypes.data?.[0]?.property_type_id
  const currencyId =
    currencies.data?.find((r) => (r.symbol || '').includes('€') || (r.currency_name || '').toLowerCase().includes('eur'))?.currency_id ||
    currencies.data?.[0]?.currency_id
  const activeStatusId =
    statuses.data?.find((r) => r.status_code === 'ACTIVE')?.status_id ||
    statuses.data?.[0]?.status_id
  const conditionId =
    conditions.data?.find((r) => (r.condition_name || '').toLowerCase().includes('renov'))?.condition_id ||
    conditions.data?.[0]?.condition_id
  const heatingId = heatings.data?.[0]?.heating_id
  const furnishingId = furnishings.data?.[0]?.furnishing_id

  if (!propTypeId || !currencyId || !activeStatusId || !conditionId || !heatingId || !furnishingId) {
    throw new Error('Lookup data missing (property_type/currency/status/property details).')
  }

  let locationId =
    locations.data?.find((r) => (r.state_region || '').toLowerCase().includes('zagreb'))?.location_id ||
    locations.data?.[0]?.location_id
  if (!locationId) {
    const inserted = await sellerClient
      .from('location')
      .insert({
        city: 'Zagreb',
        state_region: 'Grad Zagreb',
        country: 'Hrvatska',
        postal_code: '10000',
      })
      .select('location_id')
      .single()
    if (inserted.error) throw new Error(`Location insert failed: ${inserted.error.message}`)
    locationId = inserted.data.location_id
  }

  const amenityPatterns = ['balkon', 'parking', 'lift']
  const amenityIds = (amenities.data || [])
    .filter((a) => amenityPatterns.some((p) => (a.amenity_name || '').toLowerCase().includes(p)))
    .map((a) => a.amenity_id)

  const addrRes = await sellerClient
    .from('property_address')
    .insert({ street_address: 'Ilica 120', floor_number: 3 })
    .select('address_id')
    .single()
  if (addrRes.error) throw new Error(`Address insert failed: ${addrRes.error.message}`)

  const propertyRes = await sellerClient
    .from('property')
    .insert({
      title: listingTitle,
      description: listingDescription,
      bedrooms: 2,
      bathrooms: 1,
      area_size: 68,
      property_type_id: propTypeId,
      location_id: locationId,
      address_id: addrRes.data.address_id,
      latitude: 45.8129,
      longitude: 15.9684,
    })
    .select('property_id')
    .single()
  if (propertyRes.error) throw new Error(`Property insert failed: ${propertyRes.error.message}`)

  const listingRes = await sellerClient
    .from('listing')
    .insert({
      listing_type: 'SALE',
      price_amount: 185000,
      currency_id: currencyId,
      status_id: activeStatusId,
      seller_id: STATE.users.seller.user_id,
      property_id: propertyRes.data.property_id,
    })
    .select('listing_id')
    .single()
  if (listingRes.error) throw new Error(`Listing insert failed: ${listingRes.error.message}`)

  const detailsRes = await sellerClient.from('property_details').insert({
    property_id: propertyRes.data.property_id,
    year_built: 2018,
    total_floors: 6,
    condition_id: conditionId,
    heating_id: heatingId,
    furnishing_id: furnishingId,
  })
  if (detailsRes.error) throw new Error(`Property details insert failed: ${detailsRes.error.message}`)

  if (amenityIds.length) {
    const amRows = amenityIds.map((aid) => ({ property_id: propertyRes.data.property_id, amenity_id: aid }))
    const amRes = await sellerClient.from('property_amenity').insert(amRows)
    if (amRes.error) STATE.issues.push(`Amenity insert warning: ${amRes.error.message}`)
  }

  const imgRows = imageUrls.map((url, i) => ({
    property_id: propertyRes.data.property_id,
    url,
    is_primary: i === 0,
    sort_order: i,
  }))
  const imgRes = await sellerClient.from('image').insert(imgRows)
  if (imgRes.error) throw new Error(`Image URL insert failed: ${imgRes.error.message}`)

  const modelUrl = modelRows.data?.[0]?.url || null
  if (!modelUrl) {
    STATE.issues.push('No existing model3d URL found in DB, 3D config proof may not be reproducible.')
  } else {
    const mRes = await sellerClient
      .from('model3d')
      .insert({ property_id: propertyRes.data.property_id, url: modelUrl })
    if (mRes.error) {
      STATE.issues.push(`model3d insert failed: ${mRes.error.message}`)
    } else {
      const roomRes = await sellerClient
        .from('property_3d_room')
        .upsert(
          [
            {
              property_id: propertyRes.data.property_id,
              room_name: 'dnevna',
              position_x: 5.4,
              position_y: 2.3,
              position_z: 4.9,
              target_x: 0.0,
              target_y: 1.4,
              target_z: 0.0,
              camera_fov: null,
            },
            {
              property_id: propertyRes.data.property_id,
              room_name: 'soba 2',
              position_x: -4.2,
              position_y: 2.2,
              position_z: 3.7,
              target_x: -0.7,
              target_y: 1.3,
              target_z: 0.2,
              camera_fov: null,
            },
          ],
          { onConflict: 'property_id,room_name' }
        )
      if (roomRes.error) STATE.issues.push(`property_3d_room insert failed: ${roomRes.error.message}`)
    }
  }

  return {
    listing_id: listingRes.data.listing_id,
    property_id: propertyRes.data.property_id,
    title: listingTitle,
    city: 'Zagreb',
    price: 185000,
    area_size: 68,
    description: listingDescription,
    features_required: ['balkon', 'parking', 'renovirano', 'lift'],
    image_urls: imageUrls,
  }
}

async function login(page, { email, password, roleCode }) {
  await page.goto(`${APP_URL}/auth/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await sleep(800)

  await page.evaluate((roleCodeParam) => {
    const findByText = (texts) => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return buttons.find((b) => {
        const txt = (b.textContent || '').trim()
        return texts.some((t) => txt.includes(t))
      })
    }
    if (roleCodeParam === 'SELLER') {
      const btn = findByText(['Prodavac', 'Prodavač', 'Seller'])
      if (btn) btn.click()
    } else {
      const btn = findByText(['Kupac', 'Buyer'])
      if (btn) btn.click()
    }
  }, roleCode)

  await page.click('input[type="email"]', { clickCount: 3 })
  await page.type('input[type="email"]', email)
  await page.click('input[type="password"]', { clickCount: 3 })
  await page.type('input[type="password"]', password)
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null),
  ])
  await sleep(1400)
}

async function saveShot(page, filename, feature) {
  const fullPath = path.join(OUT_DIR, filename)
  await page.screenshot({ path: fullPath, fullPage: true })
  STATE.screenshots.push({ file: filename, feature, path: fullPath })
}

async function captureProofScreenshots() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1512,982'],
    defaultViewport: { width: 1512, height: 982 },
  })

  try {
    // SELLER proofs: map picker + 3D config
    {
      const ctx = await browser.createBrowserContext()
      const page = await ctx.newPage()
      await login(page, {
        email: STATE.users.seller.email,
        password: STATE.users.seller.password,
        roleCode: 'SELLER',
      })

      await page.goto(`${APP_URL}/seller/edit/${STATE.seeded_listing.listing_id}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('form', { timeout: 20000 })
      await page.evaluate(() => {
        const m = document.querySelector('.leaflet-container')
        if (m) m.scrollIntoView({ behavior: 'instant', block: 'center' })
      })
      await sleep(1500)
      await saveShot(
        page,
        'kvadrato_proof_cartographic_picker.png',
        'Kartografski prikaz i odabir lokacije nekretnine'
      )

      await page.goto(`${APP_URL}/seller/3d-config/${STATE.seeded_listing.listing_id}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('body', { timeout: 20000 })
      await sleep(2600)

      const hasNoModelHint = await page.evaluate(() => {
        const txt = (document.body?.innerText || '').toLowerCase()
        return txt.includes('3d model nije dostupan') || txt.includes('no 3d model')
      })

      if (hasNoModelHint) {
        STATE.issues.push('3D config page opened, but model is unavailable for seeded listing.')
      } else {
        await saveShot(
          page,
          'kvadrato_proof_3d_room_configuration.png',
          'Konfiguracija 3D prostorija i spremanje kamera'
        )
      }

      await page.close()
      await ctx.close()
    }

    // BUYER proofs: UI preferences + message + visit request
    {
      const ctx = await browser.createBrowserContext()
      const page = await ctx.newPage()
      await login(page, {
        email: STATE.users.buyer.email,
        password: STATE.users.buyer.password,
        roleCode: 'BUYER',
      })

      await page.goto(`${APP_URL}/settings`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('body', { timeout: 20000 })
      await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('button'))
        const target = nodes.find((n) => (n.textContent || '').trim().includes('Izgled') || (n.textContent || '').trim().includes('Appearance'))
        if (target) target.click()
      })
      await sleep(1200)
      await saveShot(
        page,
        'kvadrato_proof_ui_preferences.png',
        'Globalne UI preferencije (UIPreferencesContext)'
      )

      await page.goto(`${APP_URL}/properties/${STATE.seeded_listing.listing_id}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('body', { timeout: 20000 })
      await sleep(1400)

      // Message proof (send one message)
      const msgText = 'Poštovani, molim dodatne informacije o mogućnosti useljenja i procjeni mjesečnih režija.'
      const messageSent = await page.evaluate((text) => {
        const area = document.querySelector('textarea[rows="4"]')
        if (!area) return false
        area.value = text
        area.dispatchEvent(new Event('input', { bubbles: true }))
        const btn = Array.from(document.querySelectorAll('button')).find((b) => {
          const t = (b.textContent || '').trim()
          return t.includes('Pošalji upit') || t.includes('Send inquiry')
        })
        if (!btn) return false
        btn.click()
        return true
      }, msgText)
      if (!messageSent) {
        STATE.issues.push('Message form not found or submit failed on seeded listing detail.')
      }
      await sleep(2600)
      await saveShot(
        page,
        'kvadrato_proof_message_edge_function.png',
        'Slanje poruke putem Edge Function'
      )

      // Visit request proof (select date+time and submit)
      let visitState = { hasSummary: false, dayButtons: 0 }
      for (let i = 0; i < 10; i += 1) {
        visitState = await page.evaluate(() => {
          const txt = (document.body?.innerText || '').toLowerCase()
          const dayButtons = Array.from(document.querySelectorAll('div.grid.grid-cols-7.gap-1 button')).filter(
            (b) => !b.disabled
          ).length
          return {
            hasSummary: txt.includes('pogledaj detalje') || txt.includes('view details'),
            dayButtons,
          }
        })
        if (visitState.hasSummary || visitState.dayButtons > 0) break
        await sleep(450)
      }

      if (!visitState.hasSummary && visitState.dayButtons > 0) {
        const submitTriggered = await page.evaluate(() => {
          const dayBtn = Array.from(document.querySelectorAll('div.grid.grid-cols-7.gap-1 button')).find(
            (b) => !b.disabled
          )
          if (!dayBtn) return false
          dayBtn.click()

          const slot = Array.from(document.querySelectorAll('div.grid.grid-cols-5.gap-1\\.5 button'))[0]
          if (!slot) return false
          slot.click()

          const submit = Array.from(document.querySelectorAll('button')).find((b) => {
            const txt = (b.textContent || '').trim()
            return txt.includes('Zakaži pregled') || txt.includes('Schedule viewing')
          })
          if (!submit) return false
          submit.click()
          return true
        })

        if (!submitTriggered) {
          STATE.issues.push('Visit request controls were detected, but submit could not be triggered.')
        } else {
          await sleep(2200)
          const summaryAfterSubmit = await page.evaluate(() => {
            const txt = (document.body?.innerText || '').toLowerCase()
            return txt.includes('pogledaj detalje') || txt.includes('view details')
          })
          if (!summaryAfterSubmit) {
            STATE.issues.push('Visit request submit was triggered, but summary state was not observed.')
          }
        }
      } else if (!visitState.hasSummary) {
        STATE.issues.push('Visit request summary not visible and submit controls were not found.')
      }

      await sleep(1000)
      await saveShot(
        page,
        'kvadrato_proof_visit_request_flow.png',
        'Kreiranje zahtjeva za razgledavanje i prevencija duplikata'
      )

      await page.close()
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
}

function deriveFeatureStatuses() {
  const map = new Map(STATE.screenshots.map((s) => [s.feature, true]))
  return FEATURES_ANALYZED.map((f) => {
    const proven = map.get(f.feature_name) || map.get(
      f.feature_name === 'Kartografski prikaz i odabir lokacije nekretnine'
        ? 'Kartografski prikaz i odabir lokacije nekretnine'
        : f.feature_name
    )
    // Direct name mapping for created entries
    const derived =
      f.feature_name === 'Kartografski prikaz i odabir lokacije nekretnine'
        ? map.has('Kartografski prikaz i odabir lokacije nekretnine')
        : f.feature_name === 'Konfiguracija 3D prostorija i spremanje kamera'
        ? map.has('Konfiguracija 3D prostorija i spremanje kamera')
        : f.feature_name === 'Globalne UI preferencije (UIPreferencesContext)'
        ? map.has('Globalne UI preferencije (UIPreferencesContext)')
        : f.feature_name === 'Slanje poruke putem Edge Function'
        ? map.has('Slanje poruke putem Edge Function')
        : f.feature_name === 'Kreiranje zahtjeva za razgledavanje i prevencija duplikata'
        ? map.has('Kreiranje zahtjeva za razgledavanje i prevencija duplikata')
        : !!proven
    return {
      ...f,
      status: derived ? 'proven' : 'not_implemented',
    }
  })
}

function captionFor(filename) {
  const captions = {
    'kvadrato_proof_3d_room_configuration.png':
      'Slika X: Prikaz konfiguracije 3D prostorija i spremanja kamera u aplikaciji Kvadrato.',
    'kvadrato_proof_cartographic_picker.png':
      'Slika X: Prikaz kartografskog odabira lokacije nekretnine kroz interaktivnu kartu.',
    'kvadrato_proof_ui_preferences.png':
      'Slika X: Prikaz upravljanja globalnim korisničkim preferencijama sučelja (jezik, tema i font).',
    'kvadrato_proof_message_edge_function.png':
      'Slika X: Prikaz funkcionalnosti slanja upita prodavatelju putem Edge Function mehanizma.',
    'kvadrato_proof_visit_request_flow.png':
      'Slika X: Prikaz kreiranja zahtjeva za razgledavanje i prikaza aktivnog zahtjeva umjesto obrasca.',
  }
  return captions[filename] || 'Slika X: Prikaz implementirane funkcionalnosti u aplikaciji Kvadrato.'
}

async function writeOutputs() {
  const features = deriveFeatureStatuses()
  const serialUsers = {
    seller: STATE.users?.seller
      ? {
          email: STATE.users.seller.email,
          password: STATE.users.seller.password,
          user_id: STATE.users.seller.user_id,
          role_code: STATE.users.seller.role_code,
        }
      : null,
    buyer: STATE.users?.buyer
      ? {
          email: STATE.users.buyer.email,
          password: STATE.users.buyer.password,
          user_id: STATE.users.buyer.user_id,
          role_code: STATE.users.buyer.role_code,
        }
      : null,
  }

  const payload = {
    generated_at: new Date().toISOString(),
    focused_document: '/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni.docx (str. 61-70)',
    selected_rule: 'ONLY code-explained features',
    seeded_listing: STATE.seeded_listing,
    seeded_users: serialUsers,
    features_analyzed: features,
    screenshots: STATE.screenshots,
    issues: STATE.issues,
  }

  const jsonPath = path.join(OUT_DIR, 'proof-manifest.json')
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8')

  const lines = []
  lines.push('# Kvadrato - Proof of Implemented Features')
  lines.push('')
  lines.push(`- Datum: ${TODAY}`)
  lines.push('- Dokument: Zavrsni.docx, str. 61-70')
  lines.push('- Pravilo odabira: samo funkcionalnosti objašnjene kodom')
  lines.push('')
  lines.push('## Features analyzed')
  lines.push('')
  for (const f of features) {
    lines.push(`- ${f.feature_name} | has_code_explanation: ${f.has_code_explanation} | status: ${f.status}`)
  }
  lines.push('')
  lines.push('## Screenshots')
  lines.push('')
  for (const s of STATE.screenshots) {
    lines.push(`- ${s.file} | feature: ${s.feature}`)
  }
  lines.push('')
  lines.push('## Captions (HR)')
  lines.push('')
  for (const s of STATE.screenshots) {
    lines.push(`- ${s.file}: ${captionFor(s.file)}`)
  }
  lines.push('')
  lines.push('## Issues')
  lines.push('')
  if (!STATE.issues.length) {
    lines.push('- Nema blokirajućih problema.')
  } else {
    for (const issue of STATE.issues) lines.push(`- ${issue}`)
  }

  const mdPath = path.join(OUT_DIR, 'proof-summary.md')
  await fs.writeFile(mdPath, lines.join('\n'), 'utf8')

  console.log(`Proof manifest: ${jsonPath}`)
  console.log(`Proof summary: ${mdPath}`)
}

async function main() {
  await ensureDir(OUT_DIR)

  const envRaw = await fs.readFile(ENV_PATH, 'utf8')
  const env = parseEnv(envRaw)
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  }

  const seller = await ensureUser({
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabaseKey: env.VITE_SUPABASE_ANON_KEY,
    roleCode: 'SELLER',
    firstName: 'Proof',
    lastName: 'Seller',
  })

  const buyer = await ensureUser({
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabaseKey: env.VITE_SUPABASE_ANON_KEY,
    roleCode: 'BUYER',
    firstName: 'Proof',
    lastName: 'Buyer',
  })

  STATE.users = { seller, buyer }
  STATE.seeded_listing = await seedListing({ sellerClient: seller.client })

  await captureProofScreenshots()
  await writeOutputs()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
