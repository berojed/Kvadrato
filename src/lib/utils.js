import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Formatira cijenu
 * Podržava i string ('EUR') i objekt ({ currency_name, symbol })
 */
export function formatPrice(price, currency = 'EUR') {
  if (!price && price !== 0) return '—'

  // Ako je currency objekt iz Supabase, koristi symbol
  if (typeof currency === 'object' && currency !== null) {
    const symbol = currency.symbol || '€'
    return `${new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 0 }).format(price)} ${symbol}`
  }

  // Ako je string (ISO kod), koristi Intl
  try {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(price)
  } catch {
    return `${new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 0 }).format(price)} €`
  }
}

/**
 * Formatira datum u čitljiv oblik
 */
export function formatDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('hr-HR', {
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