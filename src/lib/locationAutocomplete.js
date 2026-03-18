/**
 * Static Croatia-wide location autocomplete.
 *
 * Lazy-fetches /data/hr-location-index.json on first call and caches it
 * in memory for the lifetime of the page — zero repeated network requests.
 *
 * Returns max MAX_RESULTS suggestions sorted so prefix-matches come first.
 */

const MAX_RESULTS = 6

/** Module-level cache — populated once, reused forever. */
let cache = null
let fetchPromise = null

async function loadIndex() {
  // Ensure only one in-flight fetch even with concurrent callers
  if (fetchPromise) return fetchPromise
  fetchPromise = fetch('/data/hr-location-index.json')
    .then((r) => r.json())
    .then((data) => {
      cache = data
      return data
    })
    .catch((err) => {
      if (import.meta.env.DEV) console.error('[locationAutocomplete] Failed to load index:', err)
      fetchPromise = null   // allow retry on next call
      return []
    })
  return fetchPromise
}

/**
 * Returns up to MAX_RESULTS location suggestions matching `query`.
 * Prefix matches are ranked first; ties resolved by Croatian locale sort.
 *
 * @param {string} query  Raw search string (will be trimmed + lower-cased internally)
 * @returns {Promise<Array<{ label: string, sublabel: string, type: string }>>}
 */
export async function getLocationSuggestions(query) {
  const q = (query ?? '').trim().toLowerCase()
  if (q.length < 2) return []

  const index = cache ?? await loadIndex()
  if (!index.length) return []

  const matches = index.filter((entry) => {
    const label = entry.label.toLowerCase()
    return label.startsWith(q) || label.includes(q)
  })

  matches.sort((a, b) => {
    const aLabel = a.label.toLowerCase()
    const bLabel = b.label.toLowerCase()
    const aStarts = aLabel.startsWith(q)
    const bStarts = bLabel.startsWith(q)
    if (aStarts && !bStarts) return -1
    if (!aStarts && bStarts) return 1
    // Within same rank: cities before counties, then alphabetical
    if (a.type !== b.type) return a.type === 'city' ? -1 : 1
    return a.label.localeCompare(b.label, 'hr')
  })

  return matches.slice(0, MAX_RESULTS)
}
