/**
 * seed-3d-models.mjs
 *
 * Seeds UNIQUE 3D models for multiple properties by:
 * 1. Downloading distinct open-source GLB models from Poly Pizza (CC-BY 3.0)
 * 2. Uploading each to its property path in Supabase Storage
 * 3. Creating/updating model3d DB rows
 *
 * Each property gets a DIFFERENT model — no duplicates.
 *
 * Usage: node scripts/seed-3d-models.mjs
 *
 * Sources (all CC-BY 3.0):
 * - "house interiors" by Gabriele Romagnoli — poly.pizza/m/9UGOIbCy8C
 * - "Chilled Cow Apt" by Julien Kleber — poly.pizza/m/4NNkEGLAdOb
 * - "Apartment 2" by Gabriele Romagnoli — poly.pizza/m/dtgO5dwwtkk
 * - "House Interior" by Alex Safayan — poly.pizza/m/7IGvVkETcSt
 * - "Minimalistic Japanese Room" by Timothy van de bilt — poly.pizza/m/8cWuXx5BASV
 *
 * Existing model kept for property 8:
 * - "Realistic House (With Interior)" by Blender Studio — CC BY 4.0 (Sketchfab)
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')

// Parse .env
const env = {}
readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) env[key.trim()] = rest.join('=').trim()
})

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const STORAGE_URL = `${SUPABASE_URL}/storage/v1`
const REST_URL = `${SUPABASE_URL}/rest/v1`
const BUCKET = 'property-models'

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
}

// Each property gets a UNIQUE model — no duplicates
const ASSIGNMENTS = [
  {
    propertyId: 'a1000000-0000-0000-0000-000000000008',
    desc: 'Vila s bazenom – Pula',
    source: 'existing', // Already in Supabase Storage
    modelName: 'Realistic House (With Interior)',
    author: 'Blender Studio',
  },
  {
    propertyId: 'a1000000-0000-0000-0000-000000000001',
    desc: 'Moderan stan u centru Zagreba',
    source: 'https://static.poly.pizza/54fb2bed-a4ee-476e-ba44-802ed2384d4e.glb',
    modelName: 'house interiors',
    author: 'Gabriele Romagnoli',
  },
  {
    propertyId: 'a1000000-0000-0000-0000-000000000003',
    desc: 'Obiteljska kuća u Maksimiru',
    source: 'https://static.poly.pizza/81c93ce6-5489-4cf4-b8ca-f5a2244c3b27.glb',
    modelName: 'Chilled Cow Apt',
    author: 'Julien Kleber',
  },
  {
    propertyId: 'a1000000-0000-0000-0000-000000000004',
    desc: 'Stan s pogledom na more – Split',
    source: 'https://static.poly.pizza/6430de99-980b-4039-a327-eabfe1f63918.glb',
    modelName: 'Apartment 2',
    author: 'Gabriele Romagnoli',
  },
  {
    propertyId: 'a1000000-0000-0000-0000-000000000005',
    desc: 'Renoviran stan na Korzu – Rijeka',
    source: 'https://static.poly.pizza/efa7840a-01c2-4ed6-91ee-97d218f33297.glb',
    modelName: 'House Interior',
    author: 'Alex Safayan',
  },
]

async function downloadModel(url, label) {
  console.log(`  Downloading "${label}"...`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Download failed for ${label}: ${res.status} ${res.statusText}`)
  }
  const buffer = await res.arrayBuffer()
  console.log(`  Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`)
  return buffer
}

async function uploadModel(propertyId, modelBuffer) {
  const path = `properties/${propertyId}/model.glb`
  const url = `${STORAGE_URL}/object/${BUCKET}/${path}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'model/gltf-binary',
      'x-upsert': 'true',
    },
    body: modelBuffer,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Upload failed for ${propertyId}: ${res.status} ${err}`)
  }

  console.log(`  Uploaded to storage: ${path}`)
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

async function upsertModel3dRow(propertyId, publicUrl) {
  const res = await fetch(`${REST_URL}/model3d?on_conflict=property_id`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({ property_id: propertyId, url: publicUrl }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`model3d upsert failed for ${propertyId}: ${res.status} ${err}`)
  }

  const data = await res.json()
  console.log(`  model3d row upserted: model_id=${data[0]?.model_id}`)
}

async function main() {
  console.log('=== Seeding UNIQUE 3D models ===\n')

  for (const assignment of ASSIGNMENTS) {
    const { propertyId, desc, source, modelName, author } = assignment
    console.log(`\n[${propertyId}] ${desc}`)
    console.log(`  Model: "${modelName}" by ${author}`)

    let publicUrl

    if (source === 'existing') {
      // Property 8 already has its model in storage — just ensure DB row exists
      publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/properties/${propertyId}/model.glb`
      console.log(`  Using existing storage file`)
    } else {
      // Download from Poly Pizza and upload to Supabase
      const buffer = await downloadModel(source, modelName)
      publicUrl = await uploadModel(propertyId, buffer)
    }

    await upsertModel3dRow(propertyId, publicUrl)
  }

  console.log('\n\n=== Done! ===')
  console.log(`Seeded ${ASSIGNMENTS.length} properties with UNIQUE 3D models:\n`)
  for (const { propertyId, desc, modelName, author } of ASSIGNMENTS) {
    console.log(`  ${propertyId}`)
    console.log(`    Property: ${desc}`)
    console.log(`    Model:    "${modelName}" by ${author}\n`)
  }
}

main().catch(err => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
