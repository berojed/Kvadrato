import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Formats price according to locale and currency.
 * Supports both string ('EUR') and object ({ currency_name, symbol }) from Supabase.
 * @param {number} price
 * @param {string|object} currency
 * @param {string} locale - BCP 47 locale tag, default 'hr-HR'
 */
export function formatPrice(price, currency = 'EUR', locale = 'hr-HR') {
  if (!price && price !== 0) return '—'

  // If it's a currency object from Supabase, use the symbol
  if (typeof currency === 'object' && currency !== null) {
    const symbol = currency.symbol || '€'
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(price)} ${symbol}`
  }

  // If it's a string (ISO code), use Intl
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
 *  Formats date into a readable format, locale-aware.
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
 * Shortens text to a specified length
 */
export function truncate(text, maxLength = 150) {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '…'
}
