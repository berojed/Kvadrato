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

