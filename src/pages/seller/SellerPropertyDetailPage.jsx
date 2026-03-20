import { useState, useEffect, lazy, Suspense, Component } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Bed, Bath, Maximize2, MapPin, Share2, ChevronLeft,
  ChevronRight, ArrowLeft, Map, Box, Edit2
} from 'lucide-react'
import { getSellerListingById, getListingStatuses, updateListingStatus } from '@/services/properties'
import { formatPrice, formatDate } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import PropertyLocationPicker from '@/components/ui/PropertyLocationPicker'

const Property3DViewerModal = lazy(() => import('@/components/ui/Property3DViewerModal'))

class Viewer3DErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err) {
    if (import.meta.env.DEV) console.warn('[3DViewer] Nedostupno:', err.message)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={this.props.onClose} />
          <div className="relative bg-gray-950 rounded-xl p-10 text-center z-10">
            <p className="text-white font-semibold mb-2">3D preglednik nije dostupan</p>
            <p className="text-sm text-gray-400 mb-4">Vaš preglednik ne podržava WebGL.</p>
            <button onClick={this.props.onClose} className="btn btn-secondary text-sm">Zatvori</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const PROPERTY_TYPE_LABELS = {
  apartment: 'Stan', house: 'Kuća', commercial: 'Poslovni prostor',
  land: 'Zemljište', garage: 'Garaža',
}

const STATUS_LABELS = {
  ACTIVE: 'Aktivan',
  INACTIVE: 'Neaktivan',
  SOLD: 'Prodano',
  RENTED: 'Iznajmljeno',
  EXPIRED: 'Isteklo',
}

export default function SellerPropertyDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()

  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [show3DViewer, setShow3DViewer] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // Status management
  const [statuses, setStatuses] = useState([])
  const [statusUpdating, setStatusUpdating] = useState(false)

  useEffect(() => {
    if (!user) return
    loadListing()
  }, [id, user])

  const loadListing = async () => {
    setLoading(true)
    setImageIndex(0)
    const [listingRes, statusesRes] = await Promise.all([
      getSellerListingById(id, user.id),
      getListingStatuses(),
    ])
    if (listingRes.error) setError(listingRes.error.message)
    else setListing(listingRes.data)
    if (statusesRes.data) setStatuses(statusesRes.data)
    setLoading(false)
  }

  const handleStatusChange = async (newStatusId) => {
    if (!listing || statusUpdating) return
    setStatusUpdating(true)
    const { data, error: err } = await updateListingStatus({
      listingId: listing.listing_id,
      sellerId: user.id,
      statusId: Number(newStatusId),
    })
    setStatusUpdating(false)
    if (err) {
      alert('Greška: ' + (err.message || 'Neuspješna promjena statusa.'))
    } else if (data) {
      setListing((prev) => ({
        ...prev,
        status_id: data.status_id,
        listing_status: data.listing_status,
      }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="container py-20 text-center">
        <h2 className="text-xl font-semibold mb-2">Oglas nije pronađen</h2>
        <p className="text-gray-500 mb-6 text-sm">{error || 'Oglas ne postoji ili nemate pristup.'}</p>
        <Link to="/seller/dashboard" className="btn btn-secondary">← Natrag na moje nekretnine</Link>
      </div>
    )
  }

  const prop = listing.property ?? {}
  const details = prop.property_details ?? {}
  const seller = listing.seller ?? null

  const images = [...(prop.image ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(img => img.url)
    .filter(Boolean)

  const primaryAddress = prop.property_address
    ? [prop.property_address.street_address, prop.property_address.unit_number].filter(Boolean).join(', ')
    : null
  const locationLabel = prop.location
    ? [prop.location.city, prop.location.state_region, prop.location.country].filter(Boolean).join(', ')
    : null
  const addressDisplay = primaryAddress || locationLabel

  return (
    <div className="container py-8">
      {/* Back */}
      <Link to="/seller/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6 transition-colors">
        <ArrowLeft size={14} />
        Natrag na moje nekretnine
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left: Images + Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Image gallery */}
          {images.length > 0 ? (
            <div className="space-y-2">
              <div className="relative aspect-[16/9] rounded overflow-hidden bg-gray-100">
                <img
                  src={images[imageIndex]}
                  alt={`${prop.title} – slika ${imageIndex + 1}`}
                  className="w-full h-full object-cover"
                />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setImageIndex((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setImageIndex((i) => (i + 1) % images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setImageIndex(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${i === imageIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {images.slice(0, 6).map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setImageIndex(i)}
                      className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all ${i === imageIndex ? 'border-black' : 'border-transparent'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[16/9] rounded bg-gray-100 flex items-center justify-center">
              <span className="text-gray-400 text-sm">Nema slika</span>
            </div>
          )}

          {/* 3D model button */}
          {prop.model3dUrl && (
            <button
              onClick={() => setShow3DViewer(true)}
              className="btn btn-secondary flex items-center gap-2 text-sm"
            >
              <Box size={16} />
              3D model nekretnine
            </button>
          )}

          {/* Title + price */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                {prop.property_type?.type_name && (
                  <span className="badge badge-muted mb-2">
                    {PROPERTY_TYPE_LABELS[prop.property_type.type_name] ?? prop.property_type.type_name}
                  </span>
                )}
                <h1 className="text-2xl md:text-3xl font-bold">{prop.title}</h1>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  to={`/seller/edit/${listing.listing_id}`}
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-gray-500 hover:text-black transition-colors"
                  title="Uredi oglas"
                  aria-label="Uredi oglas"
                >
                  <Edit2 size={15} />
                </Link>
                <button
                  onClick={async () => {
                    const publicUrl = `${window.location.origin}/properties/${listing.listing_id}`
                    if (navigator.share) {
                      navigator.share({ title: prop.title, url: publicUrl })
                    } else {
                      await navigator.clipboard?.writeText(publicUrl)
                      setShareCopied(true)
                      setTimeout(() => setShareCopied(false), 2000)
                    }
                  }}
                  aria-label={shareCopied ? 'Kopirano!' : 'Dijeli'}
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-gray-500 hover:text-black transition-colors"
                  title={shareCopied ? 'Kopirano!' : 'Dijeli oglas'}
                >
                  {shareCopied ? <span className="text-xs">✓</span> : <Share2 size={15} />}
                </button>
              </div>
            </div>

            {addressDisplay && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
                <MapPin size={13} />
                {addressDisplay}
              </div>
            )}

            <div className="text-3xl font-bold text-black">
              {formatPrice(listing.price_amount, listing.currency)}
              {listing.listing_type === 'RENT' && <span className="text-sm font-normal text-gray-500">/mj.</span>}
            </div>
          </div>

          {/* Quick specs */}
          <div className="grid grid-cols-3 gap-4">
            {prop.area_size && (
              <div className="border border-border rounded p-4 text-center">
                <Maximize2 size={18} className="mx-auto mb-2 text-gray-400" />
                <div className="font-semibold">{prop.area_size} m²</div>
                <div className="text-xs text-gray-500">Površina</div>
              </div>
            )}
            {prop.bedrooms != null && (
              <div className="border border-border rounded p-4 text-center">
                <Bed size={18} className="mx-auto mb-2 text-gray-400" />
                <div className="font-semibold">{prop.bedrooms}</div>
                <div className="text-xs text-gray-500">Spavaće sobe</div>
              </div>
            )}
            {prop.bathrooms != null && (
              <div className="border border-border rounded p-4 text-center">
                <Bath size={18} className="mx-auto mb-2 text-gray-400" />
                <div className="font-semibold">{prop.bathrooms}</div>
                <div className="text-xs text-gray-500">Kupaonice</div>
              </div>
            )}
          </div>

          {/* Description */}
          {prop.description && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Opis</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {prop.description}
              </p>
            </div>
          )}

          {/* Details grid */}
          {[
            details.year_built && { label: 'Godina izgradnje', value: details.year_built },
            details.total_floors != null && { label: 'Broj katova', value: details.total_floors },
            details.furnishing_type?.furnishing_name && { label: 'Namještaj', value: details.furnishing_type.furnishing_name },
            details.heating_type?.heating_name && { label: 'Grijanje', value: details.heating_type.heating_name },
            details.property_condition?.condition_name && { label: 'Stanje', value: details.property_condition.condition_name },
          ].filter(Boolean).length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Detalji</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  details.year_built && { label: 'Godina izgradnje', value: details.year_built },
                  details.total_floors != null && { label: 'Broj katova', value: details.total_floors },
                  details.furnishing_type?.furnishing_name && { label: 'Namještaj', value: details.furnishing_type.furnishing_name },
                  details.heating_type?.heating_name && { label: 'Grijanje', value: details.heating_type.heating_name },
                  details.property_condition?.condition_name && { label: 'Stanje', value: details.property_condition.condition_name },
                ]
                  .filter(Boolean)
                  .map((detail, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-4">
                      <div className="text-[11px] text-gray-500 uppercase tracking-widest font-medium mb-1.5">
                        {detail.label}
                      </div>
                      <div className="font-semibold text-sm text-gray-900">{detail.value}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Amenities */}
          {prop.property_amenity?.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Pogodnosti</h2>
              <div className="flex flex-wrap gap-2">
                {prop.property_amenity.map((pa, i) => (
                  <span key={i} className="badge badge-muted">
                    {pa.amenity?.amenity_name ?? '—'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Location map — Leaflet only */}
          {(addressDisplay || (prop.latitude && prop.longitude)) && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Map size={18} className="text-gray-400" />
                Lokacija
              </h2>
              <PropertyLocationPicker
                address={prop.property_address?.street_address ?? ''}
                city={prop.location?.city ?? ''}
                latitude={prop.latitude ?? null}
                longitude={prop.longitude ?? null}
                readOnly
                height="320px"
              />
            </div>
          )}
        </div>

        {/* Right sidebar: Status management + listing info */}
        <div className="space-y-6">
          {/* Status management */}
          {statuses.length > 0 && (
            <div className="border border-border rounded p-5 bg-amber-50/30">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Status oglasa
              </h3>
              <select
                value={listing.status_id ?? ''}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusUpdating}
                className="select w-full"
              >
                {statuses.map((s) => (
                  <option key={s.status_id} value={s.status_id}>
                    {STATUS_LABELS[s.status_code] ?? s.description}
                  </option>
                ))}
              </select>
              {statusUpdating && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  Ažuriranje…
                </p>
              )}
            </div>
          )}

          {/* Listing info card */}
          <div className="border border-border rounded p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Informacije o oglasu</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tip oglasa</span>
                <span className="font-medium">{listing.listing_type === 'SALE' ? 'Prodaja' : 'Najam'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${
                  listing.listing_status?.status_code === 'ACTIVE' ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {STATUS_LABELS[listing.listing_status?.status_code] ?? listing.listing_status?.description ?? '—'}
                </span>
              </div>
              {listing.date_listed && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Objavljeno</span>
                  <span className="font-medium">{formatDate(listing.date_listed)}</span>
                </div>
              )}
              {listing.expiration_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Istječe</span>
                  <span className="font-medium">{formatDate(listing.expiration_date)}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 3D Viewer Modal */}
      {show3DViewer && prop.model3dUrl && (
        <Viewer3DErrorBoundary onClose={() => setShow3DViewer(false)}>
          <Suspense fallback={null}>
            <Property3DViewerModal
              url={prop.model3dUrl}
              propertyId={prop.property_id}
              onClose={() => setShow3DViewer(false)}
            />
          </Suspense>
        </Viewer3DErrorBoundary>
      )}
    </div>
  )
}
