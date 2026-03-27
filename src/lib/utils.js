import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Formatira cijenu — locale-aware
 * Podržava i string ('EUR') i objekt ({ currency_name, symbol })
 * @param {number} price
 * @param {string|object} currency
 * @param {string} locale - BCP 47 locale tag, default 'hr-HR'
 */
export function formatPrice(price, currency = 'EUR', locale = 'hr-HR') {
  if (!price && price !== 0) return '—'

  // Ako je currency objekt iz Supabase, koristi symbol
  if (typeof currency === 'object' && currency !== null) {
    const symbol = currency.symbol || '€'
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(price)} ${symbol}`
  }

  // Ako je string (ISO kod), koristi Intl
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(price)
  } catch {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(price)} €`
  }
}

/**
 * Formatira datum u čitljiv oblik — locale-aware
 * @param {string|Date} date
 * @param {string} locale - BCP 47 locale tag, default 'hr-HR'
 */
export function formatDate(date, locale = 'hr-HR') {
  if (!date) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Skraćuje tekst na zadanu duljinu
 */
export function truncate(text, maxLength = 150) {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '…'
}
