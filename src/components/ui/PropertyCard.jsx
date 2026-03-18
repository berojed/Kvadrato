import { Heart, Bed, Bath, Maximize2, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn, formatPrice } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

/**
 * PropertyCard prima listing objekt iz Supabase:
 * {
 *   listing_id, listing_type, price_amount, date_listed,
 *   currency: { currency_name, symbol },
 *   listing_status: { status_code },
 *   property: {
 *     title, description, bedrooms, bathrooms, area_size,
 *     property_type: { type_name },
 *     location: { city, state_region },
 *     image: [{ url, is_primary, sort_order }]
 *   },
 *   seller: { first_name, last_name }
 * }
 */
export default function PropertyCard({ listing, className, linkPrefix = '/properties', onToggleFavorite, isFavorited = false }) {
  const { isAuthenticated, isBuyer } = useAuth()

  const property = listing.property
  if (!property) return null

  // Pronađi primarnu sliku ili prvu po sort_order
  const images = property.image ?? []
  const primaryImage =
    images.find((img) => img.is_primary) ??
    images.sort((a, b) => a.sort_order - b.sort_order)[0]

  // Lokacija
  const location = property.location
  const locationText = location
    ? [location.city, location.state_region].filter(Boolean).join(', ')
    : null

  // Tip nekretnine
  const typeName = property.property_type?.type_name

  const isRent = listing.listing_type === 'RENT'

  return (
    <Link
      to={`${linkPrefix}/${listing.listing_id}`}
      className={cn('card block group', className)}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={property.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-gray-300 text-sm">Nema slike</div>
          </div>
        )}

        {/* Favorite button */}
        {isBuyer && onToggleFavorite && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(listing.listing_id) }}
            aria-label={isFavorited ? 'Ukloni iz omiljenih' : 'Dodaj u omiljene'}
            className={cn(
              'absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all',
              isFavorited
                ? 'bg-accent text-white'
                : 'bg-white/90 text-gray-500 hover:bg-white hover:text-accent'
            )}
          >
            <Heart size={14} fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Price */}
        <div className="text-lg font-semibold text-black mb-1">
          {formatPrice(listing.price_amount, listing.currency)}
          {isRent && <span className="text-sm font-normal text-gray-500">/mj.</span>}
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">
          {property.title}
        </h3>

        {/* Location */}
        {locationText && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
            <MapPin size={11} />
            <span className="line-clamp-1">{locationText}</span>
          </div>
        )}

        {/* Specs */}
        <div className="divider mb-3" />
        <div className="flex items-center gap-4 text-xs text-gray-600">
          {property.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bed size={12} />
              {property.bedrooms} {property.bedrooms === 1 ? 'soba' : 'sobe'}
            </span>
          )}
          {property.bathrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bath size={12} />
              {property.bathrooms} kup.
            </span>
          )}
          {property.area_size && (
            <span className="flex items-center gap-1">
              <Maximize2 size={12} />
              {Number(property.area_size)} m²
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}