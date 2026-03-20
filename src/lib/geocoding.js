/**
 * Geocoding helper using OpenStreetMap Nominatim (free, no API key).
 * Respects Nominatim usage policy: max 1 request per second.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'Kvadrato/0.1 (student-project)'

/**
 * Geocode an address string → { lat, lng } or null.
 * Biased toward Croatia results.
 */
export async function geocodeAddress(query) {
  if (!query || query.trim().length < 3) return null

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'hr',
    })

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    })

    if (!res.ok) return null

    const data = await res.json()
    if (data.length === 0) return null

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    }
  } catch {
    return null
  }
}

/**
 * Search for addresses across Croatia using Nominatim.
 * Returns up to `limit` structured results with parsed address components.
 *
 * Each result: {
 *   displayName,     // full display label
 *   streetAddress,   // street + house number (or place name)
 *   city,            // city / town / village
 *   postalCode,      // postal code (if available)
 *   stateRegion,     // county / state
 *   country,         // always 'Hrvatska'
 *   lat, lng,        // coordinates
 * }
 */
export async function searchAddresses(query, limit = 6) {
  if (!query || query.trim().length < 3) return []

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: String(limit),
      countrycodes: 'hr',
      addressdetails: '1',
      'accept-language': 'hr',
      dedupe: '1',
    })

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    })

    if (!res.ok) return []

    const data = await res.json()
    if (!data.length) return []

    return data.map((item) => {
      const addr = item.address ?? {}
      // Build street address from road + house_number
      const road = addr.road ?? addr.pedestrian ?? addr.neighbourhood ?? ''
      const houseNumber = addr.house_number ?? ''
      const streetAddress = [road, houseNumber].filter(Boolean).join(' ').trim()

      // City: try city → town → village → municipality
      const city =
        addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? ''

      return {
        displayName: item.display_name,
        streetAddress: streetAddress || (item.display_name.split(',')[0] ?? ''),
        city,
        postalCode: addr.postcode ?? '',
        stateRegion: addr.county ?? addr.state ?? '',
        country: 'Hrvatska',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }
    })
  } catch {
    return []
  }
}
