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
  stateRegion = '',
  city = '',
  sortBy = 'date_listed',
  sortOrder = 'desc',
  page = 0,
  pageSize = 12,
} = {}) {
  console.log('[properties] getListings pozvan:', { search, propertyType, listingType, stateRegion, city })

  // Treba li !inner join na location (kad filtriramo po županiji ili gradu)
  const needsLocationInner = !!(stateRegion || city)

  // Primjeni zajedničke filtere (listing + property + location)
  const applyCommon = (q) => {
    if (listingType) q = q.eq('listing_type', listingType)
    if (minPrice !== null) q = q.gte('price_amount', minPrice)
    if (maxPrice !== null) q = q.lte('price_amount', maxPrice)
    if (propertyType) q = q.eq('property.property_type.type_name', propertyType)
    if (minBedrooms !== null) q = q.gte('property.bedrooms', minBedrooms)
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
      listing_status(status_code, description),
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
    if (error) console.error('[properties] getListings greška:', error.message)

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
    console.log('[properties] Dohvaćeno oglasa (search):', paginated.length, '/ ukupno:', totalCount)

    return {
      data: paginated,
      error,
      totalCount,
      hasMore: (page + 1) * pageSize < totalCount,
    }
  }

  // Standardni slučaj bez search – jedan upit s paginacijom
  const needsPropertyInner = !!(minBedrooms !== null || propertyType || needsLocationInner)
  const propertyJoin = needsPropertyInner ? 'property!inner' : 'property'
  const propertyTypeJoin = propertyType ? 'property_type!inner' : 'property_type'
  const locationJoin = needsLocationInner ? 'location!inner' : 'location'

  let query = applyCommon(
    supabase.from('listing').select(`
      *,
      currency(currency_name, symbol),
      listing_status(status_code, description),
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
    console.error('[properties] getListings greška:', error.message)
  } else {
    console.log('[properties] Dohvaćeno oglasa:', data?.length, '/ ukupno:', count)
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
  console.log('[properties] getListingById:', listingId)

  const { data, error } = await supabase
    .from('listing')
    .select(`
      *,
      currency(currency_name, symbol),
      listing_status(status_code, description),
      property(
        *,
        property_type(type_name),
        location(city, state_region, country, postal_code),
        property_address(street_address, floor_number),
        image(image_id, url, caption, is_primary, sort_order),
        model3d(model_id, url, description),
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

  if (error) {
    console.error('[properties] getListingById greška:', error.message)
  }

  return { data, error }
}

/**
 * Dohvaća oglase određenog prodavača
 */
export async function getListingsBySeller(sellerId) {
  console.log('[properties] getListingsBySeller:', sellerId)

  const { data, error } = await supabase
    .from('listing')
    .select(`
      *,
      currency(currency_name, symbol),
      listing_status(status_code, description),
      property(
        title, description, bedrooms, bathrooms, area_size,
        property_type(type_name),
        location(city, state_region),
        image(url, is_primary, sort_order)
      )
    `)
    .eq('seller_id', sellerId)
    .order('date_listed', { ascending: false })

  if (error) {
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
  currencyId = 1,
  statusId = 1,
  imageUrls = [],
}) {
  console.log('[properties] createPropertyAndListing za seller:', sellerId)

  // 1. Kreiraj adresu
  const { data: address, error: addrErr } = await supabase
    .from('property_address')
    .insert({ street_address: streetAddress, floor_number: floorNumber })
    .select()
    .single()

  if (addrErr) {
    console.error('[properties] Greška kreiranja adrese:', addrErr.message)
    return { data: null, error: addrErr }
  }

  // 2. Kreiraj nekretninu
  const { data: property, error: propErr } = await supabase
    .from('property')
    .insert({
      title,
      description,
      bedrooms,
      bathrooms,
      area_size: areaSize,
      address_id: address.address_id,
      property_type_id: propertyTypeId,
      location_id: locationId,
      seller_id: sellerId,
    })
    .select()
    .single()

  if (propErr) {
    console.error('[properties] Greška kreiranja nekretnine:', propErr.message)
    return { data: null, error: propErr }
  }

  // 3. Kreiraj oglas
  const { data: listing, error: listErr } = await supabase
    .from('listing')
    .insert({
      listing_type: listingType,
      price_amount: priceAmount,
      currency_id: currencyId,
      status_id: statusId,
      property_id: property.property_id,
      seller_id: sellerId,
    })
    .select()
    .single()

  if (listErr) {
    console.error('[properties] Greška kreiranja oglasa:', listErr.message)
    return { data: null, error: listErr }
  }

  // 4. Dodaj slike (ako ih ima)
  if (imageUrls.length > 0) {
    const images = imageUrls.map((url, i) => ({
      url,
      property_id: property.property_id,
      is_primary: i === 0,
      sort_order: i,
    }))

    const { error: imgErr } = await supabase.from('image').insert(images)
    if (imgErr) {
      console.warn('[properties] Greška dodavanja slika (oglas je kreiran):', imgErr.message)
    }
  }

  console.log('[properties] Oglas kreiran:', listing.listing_id)
  return { data: { listing, property, address }, error: null }
}

/**
 * Briše oglas i pripadajuću nekretninu
 */
export async function deleteListing(listingId) {
  console.log('[properties] deleteListing:', listingId)

  const { data: listing } = await supabase
    .from('listing')
    .select('property_id')
    .eq('listing_id', listingId)
    .single()

  const { error: listErr } = await supabase
    .from('listing')
    .delete()
    .eq('listing_id', listingId)

  if (listErr) {
    console.error('[properties] Greška brisanja oglasa:', listErr.message)
    return { error: listErr }
  }

  if (listing?.property_id) {
    const { error: propErr } = await supabase
      .from('property')
      .delete()
      .eq('property_id', listing.property_id)

    if (propErr) {
      console.warn('[properties] Greška brisanja nekretnine:', propErr.message)
    }
  }

  return { error: null }
}

/**
 * Lookup podaci za forme
 */
export async function getPropertyTypes() {
  const { data, error } = await supabase.from('property_type').select('*')
  return { data: data ?? [], error }
}

export async function getLocations() {
  const { data, error } = await supabase.from('location').select('*')
  return { data: data ?? [], error }
}

export async function getCurrencies() {
  const { data, error } = await supabase.from('currency').select('*')
  return { data: data ?? [], error }
}