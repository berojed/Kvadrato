import { supabase } from '@/lib/supabase'

/**
 * ─── NAPOMENA O SHEMI ───
 * "Oglas" = listing tablica, "Nekretnina" = property tablica.
 * Kad korisnik vidi popis oglasa, dohvaćamo listing + property + location + images.
 */

/**
 * Dohvaća sve aktivne oglase s nekretninama, lokacijama i slikama
 */
export async function getListings({
  search = '',
  propertyType = '',
  listingType = '',
  minPrice = null,
  maxPrice = null,
  minBedrooms = null,
  minBathrooms = null,
  minSize = null,
  maxSize = null,
  stateRegion = '',
  city = '',
  sortBy = 'date_listed',
  sortOrder = 'desc',
  page = 0,
  pageSize = 12,
} = {}) {
  if (import.meta.env.DEV) console.log('[properties] getListings pozvan:', { search, propertyType, listingType, stateRegion, city })

  // Treba li !inner join na location (kad filtriramo po županiji ili gradu)
  const needsLocationInner = !!(stateRegion || city)

  // Primjeni zajedničke filtere (listing + property + location)
  const applyCommon = (q) => {
    q = q.eq('listing_status.status_code', 'ACTIVE')
    if (listingType) q = q.eq('listing_type', listingType)
    if (minPrice !== null) q = q.gte('price_amount', minPrice)
    if (maxPrice !== null) q = q.lte('price_amount', maxPrice)
    if (propertyType) q = q.eq('property.property_type.type_name', propertyType)
    if (minBedrooms !== null) q = q.gte('property.bedrooms', minBedrooms)
    if (minBathrooms !== null) q = q.gte('property.bathrooms', minBathrooms)
    if (minSize !== null) q = q.gte('property.area_size', minSize)
    if (maxSize !== null) q = q.lte('property.area_size', maxSize)
    if (stateRegion) q = q.eq('property.location.state_region', stateRegion)
    if (city) q = q.eq('property.location.city', city)
    return q
  }

  // Ako ima search – pokrećemo dva upita (title OR city) i spajamo rezultate
  if (search) {
    const locationJoin = needsLocationInner ? 'location!inner' : 'location'
    const propertyTypeJoin = propertyType ? 'property_type!inner' : 'property_type'

    const selectStr = (locJoin) => `
      *,
      currency(currency_name, symbol),
      listing_status!inner(status_code, description),
      property!inner(
        *,
        ${propertyTypeJoin}(type_name),
        ${locJoin}(city, state_region, country, postal_code),
        image(image_id, url, is_primary, sort_order)
      ),
      seller:user!listing_seller_id_fkey(user_id, first_name, last_name, email)
    `

    const [r1, r2] = await Promise.all([
      applyCommon(
        supabase.from('listing').select(selectStr(locationJoin))
      )
        .ilike('property.title', `%${search}%`)
        .order(sortBy, { ascending: sortOrder === 'asc' }),
      applyCommon(
        supabase.from('listing').select(selectStr('location!inner'))
      )
        .ilike('property.location.city', `%${search}%`)
        .order(sortBy, { ascending: sortOrder === 'asc' }),
    ])

    const error = r1.error || r2.error
    if (error && import.meta.env.DEV) console.error('[properties] getListings greška:', error.message)

    // Spoji i deduplikaj po listing_id
    const data1 = r1.data ?? []
    const data2 = r2.data ?? []
    const seen = new Set(data1.map((l) => l.listing_id))
    const merged = [...data1, ...data2.filter((l) => !seen.has(l.listing_id))]

    // Sortiraj spojene rezultate
    merged.sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      if (av < bv) return sortOrder === 'asc' ? -1 : 1
      if (av > bv) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    const totalCount = merged.length
    const paginated = merged.slice(page * pageSize, (page + 1) * pageSize)
    if (import.meta.env.DEV) console.log('[properties] Dohvaćeno oglasa (search):', paginated.length, '/ ukupno:', totalCount)

    return {
      data: paginated,
      error,
      totalCount,
      hasMore: (page + 1) * pageSize < totalCount,
    }
  }

  // Standardni slučaj bez search – jedan upit s paginacijom
  const needsPropertyInner = !!(minBedrooms !== null || minBathrooms !== null || minSize !== null || maxSize !== null || propertyType || needsLocationInner)
  const propertyJoin = needsPropertyInner ? 'property!inner' : 'property'
  const propertyTypeJoin = propertyType ? 'property_type!inner' : 'property_type'
  const locationJoin = needsLocationInner ? 'location!inner' : 'location'

  let query = applyCommon(
    supabase.from('listing').select(`
      *,
      currency(currency_name, symbol),
      listing_status!inner(status_code, description),
      ${propertyJoin}(
        *,
        ${propertyTypeJoin}(type_name),
        ${locationJoin}(city, state_region, country, postal_code),
        image(image_id, url, is_primary, sort_order)
      ),
      seller:user!listing_seller_id_fkey(user_id, first_name, last_name, email)
    `, { count: 'exact' })
  )

  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  const { data, error, count } = await query

  if (error) {
    if (import.meta.env.DEV) console.error('[properties] getListings greška:', error.message)
  } else {
    if (import.meta.env.DEV) console.log('[properties] Dohvaćeno oglasa:', data?.length, '/ ukupno:', count)
  }

  return {
    data: data ?? [],
    error,
    totalCount: count ?? 0,
    hasMore: count ? (page + 1) * pageSize < count : false,
  }
}

/**
 * Dohvaća jedan oglas po listing_id s punim detaljima
 */
export async function getListingById(listingId) {
  if (import.meta.env.DEV) console.log('[properties] getListingById:', listingId)

  const { data, error } = await supabase
    .from('listing')
    .select(`
      *,
      currency(currency_name, symbol),
      listing_status!inner(status_code, description),
      property(
        *,
        property_type(type_name),
        location(city, state_region, country, postal_code),
        property_address(street_address, floor_number),
        image(image_id, url, caption, is_primary, sort_order),
        model3d(model_id, url),
        property_details(
          total_floors, year_built,
          property_condition(condition_name),
          heating_type(heating_name),
          furnishing_type(furnishing_name)
        ),
        property_amenity(amenity(amenity_name))
      ),
      seller:user!listing_seller_id_fkey(user_id, first_name, last_name, email)
    `)
    .eq('listing_id', listingId)
    .single()

  if (error && import.meta.env.DEV) {
    console.error('[properties] getListingById greška:', error.message)
  }

  // Normalize to JS-friendly model3dUrl.
  // model3d relation is now canonical; fall back to legacy "3d_model_url" column during migration.
  if (data?.property) {
    const m3d = Array.isArray(data.property.model3d)
      ? data.property.model3d[0]
      : data.property.model3d
    data.property.model3dUrl = m3d?.url ?? data.property['3d_model_url'] ?? null

    // Auto-heal: if no model3dUrl but storage might have a file, attempt backfill
    if (!data.property.model3dUrl && data.property.property_id) {
      const { backfilled } = await backfillModel3dIfNeeded(data.property.property_id)
      if (backfilled) {
        // Re-fetch the model3d row after backfill
        const { data: m3dRow } = await supabase
          .from('model3d')
          .select('url')
          .eq('property_id', data.property.property_id)
          .maybeSingle()
        if (m3dRow?.url) data.property.model3dUrl = m3dRow.url
      }
    }
  }

  return { data, error }
}

/**
 * Dohvaća oglase određenog prodavača
 */
export async function getListingsBySeller(sellerId) {
  if (import.meta.env.DEV) console.log('[properties] getListingsBySeller:', sellerId)

  const { data, error } = await supabase
    .from('listing')
    .select(`
      *,
      currency(currency_name, symbol),
      listing_status!inner(status_code, description),
      property(
        title, description, bedrooms, bathrooms, area_size,
        property_type(type_name),
        location(city, state_region),
        image(url, is_primary, sort_order)
      )
    `)
    .eq('seller_id', sellerId)
    .order('date_listed', { ascending: false })

  if (error && import.meta.env.DEV) {
    console.error('[properties] getListingsBySeller greška:', error.message)
  }

  return { data: data ?? [], error }
}

/**
 * Kreira novu nekretninu i oglas (multi-step)
 */
export async function createPropertyAndListing({
  streetAddress,
  floorNumber = null,
  title,
  description,
  bedrooms,
  bathrooms,
  areaSize,
  propertyTypeId,
  locationId,
  sellerId,
  listingType,
  priceAmount,
  currencyId,
  statusId = 1,
  imageFiles = [],
  latitude = null,
  longitude = null,
  propertyDetails = null,
  amenityIds = [],
}) {
  if (import.meta.env.DEV) console.log('[properties] createPropertyAndListing za seller:', sellerId)

  // Validate house number is present in streetAddress
  if (!streetAddress || !streetAddress.trim()) {
    return { data: null, error: { message: 'Adresa nekretnine je obavezna.' } }
  }

  // Validate minimum 3 images
  if (!imageFiles || imageFiles.length < 3) {
    return { data: null, error: { message: 'Potrebno je najmanje 3 slike nekretnine.' } }
  }

  // Validate required property details
  if (!propertyDetails?.yearBuilt) {
    return { data: null, error: { message: 'Godina izgradnje je obavezna.' } }
  }

  // At the start, look up the ACTIVE status from DB
  const { data: statusRow } = await supabase
    .from('listing_status').select('status_id').eq('status_code', 'ACTIVE').single()
  const resolvedStatusId = statusRow?.status_id ?? statusId

  // 1. Kreiraj adresu
  const { data: address, error: addrErr } = await supabase
    .from('property_address')
    .insert({ street_address: streetAddress, floor_number: floorNumber })
    .select()
    .single()

  if (addrErr) {
    if (import.meta.env.DEV) console.error('[properties] Greška kreiranja adrese:', addrErr.message)
    return { data: null, error: addrErr }
  }

  // 2. Kreiraj nekretninu
  const propertyInsert = {
    title,
    description,
    bedrooms,
    bathrooms,
    area_size: areaSize,
    address_id: address.address_id,
    property_type_id: propertyTypeId,
    location_id: locationId,
  }
  if (latitude != null && longitude != null) {
    propertyInsert.latitude = latitude
    propertyInsert.longitude = longitude
  }
  const { data: property, error: propErr } = await supabase
    .from('property')
    .insert(propertyInsert)
    .select()
    .single()

  if (propErr) {
    if (import.meta.env.DEV) console.error('[properties] Greška kreiranja nekretnine:', propErr.message)
    // Clean up orphaned address
    await supabase.from('property_address').delete().eq('address_id', address.address_id)
    return { data: null, error: propErr }
  }

  // 3. Kreiraj oglas (seller ownership lives here, not on property)
  const { data: listing, error: listErr } = await supabase
    .from('listing')
    .insert({
      listing_type: listingType,
      price_amount: priceAmount,
      currency_id: currencyId,
      status_id: resolvedStatusId,
      property_id: property.property_id,
      seller_id: sellerId,
    })
    .select()
    .single()

  if (listErr) {
    if (import.meta.env.DEV) console.error('[properties] Greška kreiranja oglasa:', listErr.message)
    // Clean up orphaned property and address
    await supabase.from('property').delete().eq('property_id', property.property_id)
    await supabase.from('property_address').delete().eq('address_id', address.address_id)
    return { data: null, error: listErr }
  }

  // 4. Insert property_details (1:1 with property) — MANDATORY
  if (propertyDetails) {
    const { error: detErr } = await supabase
      .from('property_details')
      .insert({
        property_id: property.property_id,
        year_built: propertyDetails.yearBuilt || null,
        total_floors: propertyDetails.totalFloors || null,
        condition_id: propertyDetails.conditionId || null,
        heating_id: propertyDetails.heatingId || null,
        furnishing_id: propertyDetails.furnishingId || null,
      })
    if (detErr) {
      if (import.meta.env.DEV) console.error('[properties] Greška dodavanja property_details:', detErr.message)
      // Rollback: delete listing, property, address
      await supabase.from('listing').delete().eq('listing_id', listing.listing_id)
      await supabase.from('property').delete().eq('property_id', property.property_id)
      await supabase.from('property_address').delete().eq('address_id', address.address_id)
      return { data: null, error: { message: 'Greška pri spremanju detalja nekretnine: ' + detErr.message } }
    }
  }

  // 5. Insert property_amenity rows — MANDATORY when selected
  if (amenityIds.length > 0) {
    const amenityRows = amenityIds.map((aid) => ({
      property_id: property.property_id,
      amenity_id: aid,
    }))
    const { error: amErr } = await supabase.from('property_amenity').insert(amenityRows)
    if (amErr) {
      if (import.meta.env.DEV) console.error('[properties] Greška dodavanja amenities:', amErr.message)
      // Rollback: delete details, listing, property, address
      await supabase.from('property_details').delete().eq('property_id', property.property_id)
      await supabase.from('listing').delete().eq('listing_id', listing.listing_id)
      await supabase.from('property').delete().eq('property_id', property.property_id)
      await supabase.from('property_address').delete().eq('address_id', address.address_id)
      return { data: null, error: { message: 'Greška pri spremanju pogodnosti: ' + amErr.message } }
    }
  }

  // 6. Upload slika u Storage i spremi URL-ove u image tablicu
  if (imageFiles.length > 0) {
    const imageRows = []
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const storagePath = `properties/${property.property_id}/${i}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('property-pictures')
        .upload(storagePath, file, { contentType: file.type, upsert: true })

      if (upErr) {
        if (import.meta.env.DEV) console.warn('[properties] Slika upload greška:', upErr.message)
        continue
      }

      const { data: urlData } = supabase.storage
        .from('property-pictures')
        .getPublicUrl(storagePath)

      imageRows.push({
        url: urlData.publicUrl,
        property_id: property.property_id,
        is_primary: i === 0,
        sort_order: i,
      })
    }

    if (imageRows.length > 0) {
      const { error: imgErr } = await supabase.from('image').insert(imageRows)
      if (imgErr && import.meta.env.DEV) {
        console.warn('[properties] Greška dodavanja slika u tablicu (oglas je kreiran):', imgErr.message)
      }
    }
  }

  if (import.meta.env.DEV) console.log('[properties] Oglas kreiran:', listing.listing_id)
  return { data: { listing, property, address }, error: null }
}

/**
 * Briše oglas i pripadajuću nekretninu
 */
export async function deleteListing(listingId) {
  if (import.meta.env.DEV) console.log('[properties] deleteListing:', listingId)

  // Fetch property_id and address_id before delete — needed for cleanup
  const { data: listing } = await supabase
    .from('listing')
    .select('property_id, property:property_id(address_id)')
    .eq('listing_id', listingId)
    .single()

  const { error: listErr } = await supabase
    .from('listing')
    .delete()
    .eq('listing_id', listingId)

  if (listErr) {
    if (import.meta.env.DEV) console.error('[properties] Greška brisanja oglasa:', listErr.message)
    return { error: listErr }
  }

  if (listing?.property_id) {
    // Clean up model3d, property_details, property_amenity rows (best-effort)
    // NOTE: if DB has CASCADE on property FK, these are redundant but safe
    await supabase.from('model3d').delete().eq('property_id', listing.property_id)
    await supabase.from('property_details').delete().eq('property_id', listing.property_id)
    await supabase.from('property_amenity').delete().eq('property_id', listing.property_id)
    await supabase.from('image').delete().eq('property_id', listing.property_id)

    // Best-effort storage cleanup for images and 3D model
    try {
      const { data: imgFiles } = await supabase.storage
        .from('property-pictures')
        .list(`properties/${listing.property_id}`)
      if (imgFiles?.length) {
        const paths = imgFiles.map((f) => `properties/${listing.property_id}/${f.name}`)
        await supabase.storage.from('property-pictures').remove(paths)
      }
    } catch { /* best-effort */ }
    try {
      await supabase.storage.from('property-models').remove([`properties/${listing.property_id}/model.glb`])
    } catch { /* best-effort */ }

    const addressId = listing.property?.address_id

    const { error: propErr } = await supabase
      .from('property')
      .delete()
      .eq('property_id', listing.property_id)

    if (propErr && import.meta.env.DEV) {
      console.warn('[properties] Greška brisanja nekretnine:', propErr.message)
    }

    // Clean up orphaned property_address
    if (addressId) {
      await supabase.from('property_address').delete().eq('address_id', addressId)
    }
  }

  return { error: null }
}

/**
 * Lookup podaci za forme
 */
export async function getPropertyTypes() {
  const { data, error } = await supabase
    .from('property_type')
    .select('*')
    .in('type_name', ['Stan', 'Kuća', 'Poslovni prostor'])
    .order('type_name')
  return { data: data ?? [], error }
}


export async function getCurrencies() {
  const { data, error } = await supabase.from('currency').select('*')
  return { data: data ?? [], error }
}

export async function getFurnishingTypes() {
  const { data, error } = await supabase.from('furnishing_type').select('furnishing_id, furnishing_name').order('furnishing_id')
  return { data: data ?? [], error }
}

export async function getHeatingTypes() {
  const { data, error } = await supabase.from('heating_type').select('heating_id, heating_name').order('heating_id')
  return { data: data ?? [], error }
}

export async function getPropertyConditions() {
  const { data, error } = await supabase.from('property_condition').select('condition_id, condition_name').order('condition_id')
  return { data: data ?? [], error }
}

export async function getAmenities() {
  const { data, error } = await supabase.from('amenity').select('amenity_id, amenity_name, amenity_description').order('amenity_id')
  return { data: data ?? [], error }
}

/**
 * Find or create a location row matching the given metadata.
 * Matches on (city, state_region, postal_code, country) for precise deduplication.
 * Falls back to (city, country) if postal_code or state_region are missing.
 */
export async function resolveLocationId({ city, stateRegion, postalCode, country = 'Hrvatska' }) {
  if (import.meta.env.DEV) console.log('[properties] resolveLocationId:', city, stateRegion, postalCode)

  if (!city) return { locationId: null, error: { message: 'Grad je obavezan.' } }

  // Try to find existing with full signature
  let query = supabase
    .from('location')
    .select('location_id')
    .eq('city', city)
    .eq('country', country)

  if (postalCode) query = query.eq('postal_code', postalCode)
  if (stateRegion) query = query.eq('state_region', stateRegion)

  const { data: existing } = await query.limit(1).maybeSingle()

  if (existing?.location_id) {
    return { locationId: existing.location_id, error: null }
  }

  // Create new
  const { data: created, error } = await supabase
    .from('location')
    .insert({
      city,
      state_region: stateRegion || null,
      postal_code: postalCode || null,
      country,
    })
    .select('location_id')
    .single()

  if (error) {
    if (import.meta.env.DEV) console.error('[properties] resolveLocationId greška:', error.message)
    return { locationId: null, error }
  }

  return { locationId: created.location_id, error: null }
}

/**
 * Dohvaća sve statuse oglasa iz listing_status tablice.
 */
export async function getListingStatuses() {
  const { data, error } = await supabase
    .from('listing_status')
    .select('status_id, status_code, description')
    .neq('status_code', 'EXPIRED')
    .order('status_id')
  return { data: data ?? [], error }
}

/**
 * Ažurira status oglasa (seller-only, zaštićeno RLS-om).
 * Provjerava vlasništvo i validnost statusId-a na service razini.
 */
export async function updateListingStatus({ listingId, sellerId, statusId }) {
  if (import.meta.env.DEV) console.log('[properties] updateListingStatus:', listingId, '→', statusId)

  // 1. Verify the listing belongs to this seller
  const { data: listing, error: fetchErr } = await supabase
    .from('listing')
    .select('listing_id, seller_id')
    .eq('listing_id', listingId)
    .eq('seller_id', sellerId)
    .single()

  if (fetchErr || !listing) {
    if (import.meta.env.DEV) console.error('[properties] updateListingStatus: oglas nije pronađen ili nije vaš')
    return { data: null, error: fetchErr || { message: 'Oglas nije pronađen ili nemate pristup.' } }
  }

  // 2. Verify the status exists
  const { data: status, error: statusErr } = await supabase
    .from('listing_status')
    .select('status_id')
    .eq('status_id', statusId)
    .single()

  if (statusErr || !status) {
    if (import.meta.env.DEV) console.error('[properties] updateListingStatus: nevažeći status')
    return { data: null, error: { message: 'Nevažeći status.' } }
  }

  // 3. Update the listing status
  const { data: updated, error: updateErr } = await supabase
    .from('listing')
    .update({ status_id: statusId })
    .eq('listing_id', listingId)
    .select('*, listing_status(status_id, status_code, description)')
    .single()

  if (updateErr) {
    if (import.meta.env.DEV) console.error('[properties] updateListingStatus greška:', updateErr.message)
    return { data: null, error: updateErr }
  }

  return { data: updated, error: null }
}

/**
 * Dohvaća jedan oglas za seller-only detalje (seller-scoped).
 * Identičan getListingById ali filtrira po seller_id.
 */
export async function getSellerListingById(listingId, sellerId) {
  if (import.meta.env.DEV) console.log('[properties] getSellerListingById:', listingId)

  const { data, error } = await supabase
    .from('listing')
    .select(`
      *,
      currency(currency_name, symbol),
      listing_status(status_id, status_code, description),
      property(
        *,
        property_type(type_name),
        location(city, state_region, country, postal_code),
        property_address(street_address, floor_number),
        image(image_id, url, caption, is_primary, sort_order),
        model3d(model_id, url),
        property_details(
          total_floors, year_built,
          property_condition(condition_name),
          heating_type(heating_name),
          furnishing_type(furnishing_name)
        ),
        property_amenity(amenity(amenity_name))
      ),
      seller:user!listing_seller_id_fkey(user_id, first_name, last_name, email)
    `)
    .eq('listing_id', listingId)
    .eq('seller_id', sellerId)
    .single()

  if (error && import.meta.env.DEV) {
    console.error('[properties] getSellerListingById greška:', error.message)
  }

  // Normalize model3dUrl
  if (data?.property) {
    const m3d = Array.isArray(data.property.model3d)
      ? data.property.model3d[0]
      : data.property.model3d
    data.property.model3dUrl = m3d?.url ?? data.property['3d_model_url'] ?? null

    // Auto-heal: backfill model3d from storage if DB row is missing
    if (!data.property.model3dUrl && data.property.property_id) {
      const { backfilled } = await backfillModel3dIfNeeded(data.property.property_id)
      if (backfilled) {
        const { data: m3dRow } = await supabase
          .from('model3d')
          .select('url')
          .eq('property_id', data.property.property_id)
          .maybeSingle()
        if (m3dRow?.url) data.property.model3dUrl = m3dRow.url
      }
    }
  }

  return { data, error }
}

/**
 * Dohvaća oglas za uređivanje (seller-scoped)
 */
export async function getListingForEdit(listingId, sellerId) {
  if (import.meta.env.DEV) console.log('[properties] getListingForEdit:', listingId)

  const { data, error } = await supabase
    .from('listing')
    .select(`
      *,
      property(
        *,
        location(location_id, city, state_region, country, postal_code),
        property_address(address_id, street_address, floor_number),
        image(image_id, url, is_primary, sort_order),
        model3d(model_id, url),
        property_details(details_id, year_built, total_floors, condition_id, heating_id, furnishing_id),
        property_amenity(amenity_id)
      )
    `)
    .eq('listing_id', listingId)
    .eq('seller_id', sellerId)
    .single()

  if (error && import.meta.env.DEV) {
    console.error('[properties] getListingForEdit greška:', error.message)
  }

  return { data, error }
}

/**
 * Ažurira postojeći oglas i nekretninu
 */
export async function updatePropertyAndListing({
  listingId,
  propertyId,
  addressId,
  streetAddress,
  title,
  description,
  bedrooms,
  bathrooms,
  areaSize,
  propertyTypeId,
  locationId,
  listingType,
  priceAmount,
  currencyId,
  latitude = null,
  longitude = null,
  propertyDetails = null,
  amenityIds = null,
}) {
  if (import.meta.env.DEV) console.log('[properties] updatePropertyAndListing:', listingId)

  // Validate required property details
  if (!propertyDetails?.yearBuilt) {
    return { error: { message: 'Godina izgradnje je obavezna.' } }
  }

  // 1. Ažuriraj adresu
  if (addressId) {
    const { error: addrErr } = await supabase
      .from('property_address')
      .update({ street_address: streetAddress })
      .eq('address_id', addressId)

    if (addrErr) {
      if (import.meta.env.DEV) console.error('[properties] Greška ažuriranja adrese:', addrErr.message)
      return { error: addrErr }
    }
  }

  // 2. Ažuriraj nekretninu
  const propertyUpdate = {
    title,
    description,
    bedrooms,
    bathrooms,
    area_size: areaSize,
    property_type_id: propertyTypeId,
    location_id: locationId,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
  }
  const { error: propErr } = await supabase
    .from('property')
    .update(propertyUpdate)
    .eq('property_id', propertyId)

  if (propErr) {
    if (import.meta.env.DEV) console.error('[properties] Greška ažuriranja nekretnine:', propErr.message)
    return { error: propErr }
  }

  // 3. Ažuriraj oglas
  const { error: listErr } = await supabase
    .from('listing')
    .update({
      listing_type: listingType,
      price_amount: priceAmount,
      currency_id: currencyId,
    })
    .eq('listing_id', listingId)

  if (listErr) {
    if (import.meta.env.DEV) console.error('[properties] Greška ažuriranja oglasa:', listErr.message)
    return { error: listErr }
  }

  // 4. Upsert property_details — MANDATORY
  if (propertyDetails && propertyId) {
    const detailsPayload = {
      property_id: propertyId,
      year_built: propertyDetails.yearBuilt || null,
      total_floors: propertyDetails.totalFloors || null,
      condition_id: propertyDetails.conditionId || null,
      heating_id: propertyDetails.heatingId || null,
      furnishing_id: propertyDetails.furnishingId || null,
    }
    const { error: detErr } = await supabase
      .from('property_details')
      .upsert(detailsPayload, { onConflict: 'property_id' })
    if (detErr) {
      if (import.meta.env.DEV) console.error('[properties] Greška upsert property_details:', detErr.message)
      return { error: { message: 'Greška pri spremanju detalja nekretnine: ' + detErr.message } }
    }
  }

  // 5. Replace property_amenity rows — MANDATORY when provided
  if (amenityIds !== null && propertyId) {
    // Delete existing
    const { error: delAmErr } = await supabase.from('property_amenity').delete().eq('property_id', propertyId)
    if (delAmErr) {
      if (import.meta.env.DEV) console.error('[properties] Greška brisanja starih amenities:', delAmErr.message)
      return { error: { message: 'Greška pri ažuriranju pogodnosti: ' + delAmErr.message } }
    }
    // Insert new
    if (amenityIds.length > 0) {
      const rows = amenityIds.map((aid) => ({ property_id: propertyId, amenity_id: aid }))
      const { error: amErr } = await supabase.from('property_amenity').insert(rows)
      if (amErr) {
        if (import.meta.env.DEV) console.error('[properties] Greška zamjene amenities:', amErr.message)
        return { error: { message: 'Greška pri spremanju pogodnosti: ' + amErr.message } }
      }
    }
  }

  return { error: null }
}

/**
 * Uploads a 3D model file to Supabase Storage and upserts the model3d row.
 * Enforces 1:1 per property — existing model at the same path is overwritten.
 * Clears saved room presets because coordinates are tied to the previous model geometry.
 */
export async function upsertPropertyModel(propertyId, file) {
  if (import.meta.env.DEV) console.log('[properties] upsertPropertyModel:', propertyId)

  const path = `properties/${propertyId}/model.glb`

  const { error: uploadErr } = await supabase.storage
    .from('property-models')
    .upload(path, file, { contentType: 'model/gltf-binary', upsert: true })

  if (uploadErr) {
    if (import.meta.env.DEV) console.error('[properties] Model upload greška:', uploadErr.message)
    return { data: null, error: uploadErr }
  }

  const { data: urlData } = supabase.storage
    .from('property-models')
    .getPublicUrl(path)

  const { data, error } = await supabase
    .from('model3d')
    .upsert(
      { property_id: propertyId, url: urlData.publicUrl },
      { onConflict: 'property_id' }
    )
    .select()
    .single()

  if (error && import.meta.env.DEV) {
    console.error('[properties] model3d upsert greška:', error.message)
  }

  // Clear saved room presets — they are tied to the previous model's geometry
  if (!error) {
    await supabase.from('property_3d_room').delete().eq('property_id', propertyId)
  }

  return { data, error }
}

/**
 * Removes the 3D model for a property from Storage and the model3d table.
 * Also clears all saved room presets since they have no model to reference.
 */
export async function removePropertyModel(propertyId) {
  if (import.meta.env.DEV) console.log('[properties] removePropertyModel:', propertyId)

  const path = `properties/${propertyId}/model.glb`
  await supabase.storage.from('property-models').remove([path])

  // Clear room presets first (they reference the model being removed)
  await supabase.from('property_3d_room').delete().eq('property_id', propertyId)

  const { error } = await supabase
    .from('model3d')
    .delete()
    .eq('property_id', propertyId)

  if (error && import.meta.env.DEV) {
    console.error('[properties] model3d delete greška:', error.message)
  }

  return { error }
}

/**
 * Backfills model3d rows for properties that have a model file in Storage
 * but no corresponding DB record. This handles models uploaded before the
 * upsertPropertyModel code was introduced.
 *
 * Safe to call multiple times — skips properties that already have a model3d row.
 *
 * @param {string} propertyId – property to check
 * @returns {{ backfilled: boolean, error: object|null }}
 */
export async function backfillModel3dIfNeeded(propertyId) {
  // Check if model3d row already exists
  const { data: existing } = await supabase
    .from('model3d')
    .select('model_id')
    .eq('property_id', propertyId)
    .maybeSingle()

  if (existing) return { backfilled: false, error: null }

  // Check if a file exists in storage at the expected path
  const path = `properties/${propertyId}/model.glb`
  const { data: files, error: listErr } = await supabase.storage
    .from('property-models')
    .list(`properties/${propertyId}`, { limit: 1, search: 'model.glb' })

  if (listErr || !files?.length) return { backfilled: false, error: listErr }

  // File exists in storage but no DB row — backfill
  const { data: urlData } = supabase.storage
    .from('property-models')
    .getPublicUrl(path)

  const { error: insertErr } = await supabase
    .from('model3d')
    .insert({ property_id: propertyId, url: urlData.publicUrl })

  if (insertErr) {
    if (import.meta.env.DEV) console.error('[properties] model3d backfill failed:', insertErr.message)
    return { backfilled: false, error: insertErr }
  }

  if (import.meta.env.DEV) console.log('[properties] model3d backfilled for property:', propertyId)
  return { backfilled: true, error: null }
}

/**
 * Uploads new images for an existing property.
 * Assigns sort_order starting after the current max.
 */
export async function addPropertyImages(propertyId, files) {
  if (import.meta.env.DEV) console.log('[properties] addPropertyImages:', propertyId, files.length, 'files')

  // Get current max sort_order
  const { data: existing } = await supabase
    .from('image')
    .select('sort_order')
    .eq('property_id', propertyId)
    .order('sort_order', { ascending: false })
    .limit(1)

  let nextOrder = (existing?.[0]?.sort_order ?? -1) + 1
  const hasPrimary = nextOrder > 0 // if images exist, primary is already set

  const imageRows = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const storagePath = `properties/${propertyId}/${nextOrder + i}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('property-pictures')
      .upload(storagePath, file, { contentType: file.type, upsert: true })

    if (upErr) {
      if (import.meta.env.DEV) console.warn('[properties] Slika upload greška:', upErr.message)
      continue
    }

    const { data: urlData } = supabase.storage
      .from('property-pictures')
      .getPublicUrl(storagePath)

    imageRows.push({
      url: urlData.publicUrl,
      property_id: propertyId,
      is_primary: !hasPrimary && i === 0,
      sort_order: nextOrder + i,
    })
  }

  if (imageRows.length === 0) {
    return { data: [], error: { message: 'Nijedna slika nije uspješno učitana.' } }
  }

  const { data, error } = await supabase.from('image').insert(imageRows).select()
  if (error && import.meta.env.DEV) {
    console.warn('[properties] Greška dodavanja slika:', error.message)
  }

  return { data: data ?? [], error }
}

/**
 * Removes a single image by image_id.
 * Tries to remove from Storage too (best-effort).
 */
export async function removePropertyImage(imageId) {
  if (import.meta.env.DEV) console.log('[properties] removePropertyImage:', imageId)

  // Get the image row to find the URL for storage cleanup
  const { data: img } = await supabase
    .from('image')
    .select('image_id, url, property_id, is_primary')
    .eq('image_id', imageId)
    .single()

  if (!img) return { error: { message: 'Slika nije pronađena.' } }

  // Delete DB row
  const { error } = await supabase.from('image').delete().eq('image_id', imageId)
  if (error) {
    if (import.meta.env.DEV) console.error('[properties] Greška brisanja slike:', error.message)
    return { error }
  }

  // Best-effort Storage cleanup — extract path from public URL
  try {
    const urlObj = new URL(img.url)
    const pathMatch = urlObj.pathname.match(/\/property-pictures\/(.+)$/)
    if (pathMatch) {
      await supabase.storage.from('property-pictures').remove([pathMatch[1]])
    }
  } catch {
    // Storage cleanup is best-effort
  }

  // If we deleted the primary, promote the next image
  if (img.is_primary) {
    const { data: nextImg } = await supabase
      .from('image')
      .select('image_id')
      .eq('property_id', img.property_id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (nextImg) {
      await supabase.from('image').update({ is_primary: true }).eq('image_id', nextImg.image_id)
    }
  }

  return { error: null }
}

