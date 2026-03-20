import { useState, useEffect, lazy, Suspense, Component } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import {
  Bed, Bath, Maximize2, MapPin, Heart, Share2, ChevronLeft,
  ChevronRight, Mail, Globe, Calendar, Building,
  Flame, Car, Layers, ArrowLeft, Map, MessageSquare, Box
} from 'lucide-react'

const Property3DViewerModal = lazy(() => import('@/components/ui/Property3DViewerModal'))

// Error boundary for the 3D viewer – prevents WebGL failures from crashing the page
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
import { getListingById } from '@/services/properties'
import { createVisitRequest } from '@/services/visits'
import { sendMessage } from '@/services/messages'
import { formatPrice, formatDate } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/hooks/useFavorites'
import CalendarPicker from '@/components/ui/CalendarPicker'
import TimeSlotPicker from '@/components/ui/TimeSlotPicker'
import PropertyLocationPicker from '@/components/ui/PropertyLocationPicker'

const PROPERTY_TYPE_LABELS = {
  apartment: 'Stan', house: 'Kuća', commercial: 'Poslovni prostor',
  land: 'Zemljište', garage: 'Garaža',
}

export default function PropertyDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { user, profile: authProfile, isAuthenticated, isBuyer, isSeller } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()

  const isFavoritesContext = location.pathname.startsWith('/favorites')
  const backTo = isFavoritesContext ? '/favorites' : '/properties'
  const backLabel = isFavoritesContext ? 'Natrag na omiljene' : 'Natrag na pregled'

  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)
  const [visitNotes, setVisitNotes] = useState('')
  const [visitLoading, setVisitLoading] = useState(false)
  const [visitSuccess, setVisitSuccess] = useState(false)
  const [visitError, setVisitError] = useState(null)

  const [messageText, setMessageText] = useState('')
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgSuccess, setMsgSuccess] = useState(false)   // full success: stored + emailed
  const [msgPartial, setMsgPartial] = useState(null)     // partial: stored but email failed (warning string)
  const [msgError, setMsgError] = useState(null)
  const [show3DViewer, setShow3DViewer] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    loadListing()
  }, [id])

  useEffect(() => {
    setImageIndex(0)
    setSelectedDate(null)
    setSelectedTime(null)
    setVisitNotes('')
    setVisitSuccess(false)
    setVisitError(null)
    setMessageText('')
    setMsgSuccess(false)
    setMsgPartial(null)
    setMsgError(null)
  }, [id])

  const loadListing = async () => {
    setLoading(true)
    const { data, error: err } = await getListingById(id)
    if (err) setError(err.message)
    else setListing(data)
    setLoading(false)
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
        <h2 className="text-xl font-semibold mb-2">Nekretnina nije pronađena</h2>
        <p className="text-gray-500 mb-6 text-sm">{error}</p>
        <Link to={backTo} className="btn btn-secondary">← {backLabel}</Link>
      </div>
    )
  }

  // ─── Izvlačimo podatke iz ugniježđene strukture ───
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

  const sellerFullName = seller
    ? [seller.first_name, seller.last_name].filter(Boolean).join(' ')
    : null

  const isFav = isFavorite(listing.listing_id)
  // Use canonical FK column from the listing row as the primary ownership check;
  // fall back to the joined relation only if seller_id is somehow absent.
  const ownerId = listing.seller_id ?? listing.seller?.user_id
  const isOwnListing = !!(user?.id && ownerId && user.id === ownerId)
  const canBuyerAct = isBuyer && !isOwnListing

  const handleVisitSubmit = async (e) => {
    e.preventDefault()
    if (!canBuyerAct) return          // defensive: should never reach here via UI
    if (!selectedDate || !selectedTime) return

    setVisitLoading(true)
    setVisitError(null)

    // Combine date + time into ISO datetime
    const [hours, minutes] = selectedTime.split(':').map(Number)
    const datetime = new Date(selectedDate)
    datetime.setHours(hours, minutes, 0, 0)

    const { error: err } = await createVisitRequest({
      buyerId: user.id,
      listingId: listing.listing_id,
      requestedDatetime: datetime.toISOString(),
      notes: visitNotes || null,
    })

    setVisitLoading(false)
    if (err) setVisitError(err.message)
    else setVisitSuccess(true)
  }

  const handleMessageSubmit = async (e) => {
    e.preventDefault()
    if (!canBuyerAct) return          // defensive: should never reach here via UI
    if (!messageText.trim() || !seller) return

    setMsgLoading(true)
    setMsgError(null)
    setMsgPartial(null)

    const { data: result, error: err } = await sendMessage({
      senderId: user.id,
      recipientId: seller.user_id,
      listingId: listing.listing_id,
      content: messageText,
    })

    setMsgLoading(false)

    if (err) {
      setMsgError(err.message || 'Slanje upita nije uspjelo. Pokušajte ponovo.')
    } else if (result?.status === 'success') {
      // Full success: stored in DB + email sent
      setMsgSuccess(true)
      setMessageText('')
    } else if (result?.status === 'partial') {
      // Partial: stored in DB but email delivery failed
      setMsgPartial(result.warning || 'Poruka je spremljena, ali email nije poslan.')
      setMessageText('')
    } else {
      // Unexpected response shape — treat as success if stored
      if (result?.stored) {
        setMsgPartial('Poruka je spremljena.')
        setMessageText('')
      } else {
        setMsgError('Neočekivani odgovor poslužitelja.')
      }
    }
  }

  return (
    <div className="container py-8">
      {/* Back */}
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6 transition-colors">
        <ArrowLeft size={14} />
        {backLabel}
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

              {/* Thumbnails */}
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

          {/* Title + price + actions */}
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
                {canBuyerAct && (
                  <button
                    onClick={() => toggleFavorite(listing.listing_id)}
                    aria-label={isFav ? 'Ukloni iz omiljenih' : 'Dodaj u omiljene'}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${isFav ? 'bg-accent border-accent text-white' : 'border-border text-gray-500 hover:border-accent hover:text-accent'}`}
                  >
                    <Heart size={15} fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (navigator.share) {
                      navigator.share({ title: prop.title, url: window.location.href })
                    } else {
                      await navigator.clipboard?.writeText(window.location.href)
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

          {/* Location map */}
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

        {/* Right: Seller card + Visit form */}
        <div className="space-y-6">
          {/* Seller */}
          {seller && (
            <div className="border border-border rounded p-5">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Prodavač</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-semibold">
                  {seller.first_name?.charAt(0) ?? '?'}
                </div>
                <div>
                  <div className="font-semibold text-sm">{sellerFullName}</div>
                </div>
              </div>

              <div className="space-y-2">
                {seller.email && (
                  <a
                    href={`mailto:${seller.email}`}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-black transition-colors"
                  >
                    <Mail size={13} />
                    {seller.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Visit request form — hidden for sellers */}
          {!isSeller && <div className="border border-border rounded p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-gray-500" />
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
                Zakaži pregled
              </h3>
            </div>

            {!canBuyerAct ? (
              <div className="text-center py-4">
                {isOwnListing ? (
                  <p className="text-sm text-gray-500">Vlasnik ste ovog oglasa.</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-3">
                      {isAuthenticated ? 'Dostupno samo kupcima' : 'Prijavite se za zakazivanje pregleda'}
                    </p>
                    {!isAuthenticated && <Link to="/auth/login" className="btn btn-primary text-sm">Prijava</Link>}
                  </>
                )}
              </div>
            ) : visitSuccess ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">✓</div>
                <p className="font-semibold text-sm mb-1">Zahtjev je poslan!</p>
                <p className="text-xs text-gray-500">Prodavač će vas kontaktirati.</p>
              </div>
            ) : (
              <form onSubmit={handleVisitSubmit} className="space-y-4">
                {/* Calendar date picker – always visible */}
                <CalendarPicker
                  selectedDate={selectedDate}
                  onDateSelect={(date) => {
                    setSelectedDate(date)
                    setSelectedTime(null)
                  }}
                  minDate={new Date()}
                />

                {/* Time and notes – shown only after a date is picked */}
                {selectedDate && (
                  <>
                    <TimeSlotPicker
                      selectedTime={selectedTime}
                      onTimeSelect={setSelectedTime}
                    />

                    <textarea
                      placeholder="Napomena (opcionalno)"
                      rows={3}
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                      className="input resize-none"
                    />
                  </>
                )}

                {visitError && (
                  <p className="text-xs text-red-600">{visitError}</p>
                )}

                <button
                  type="submit"
                  disabled={visitLoading || !selectedDate || !selectedTime}
                  className="btn btn-primary w-full"
                >
                  {visitLoading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Slanje...
                    </span>
                  ) : (
                    <>
                      <Calendar size={14} />
                      Zakaži pregled
                    </>
                  )}
                </button>
              </form>
            )}
          </div>}
          {/* Inquiry form — hidden for sellers */}
          {!isSeller && seller && (
            <div className="border border-border rounded p-5">
              <div className="flex items-center gap-2 mb-4">
                <Mail size={16} className="text-gray-500" />
                <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
                  Pošalji upit
                </h3>
              </div>

              {!canBuyerAct ? (
                <div className="text-center py-4">
                  {isOwnListing ? (
                    <p className="text-sm text-gray-500">Vlasnik ste ovog oglasa.</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 mb-3">
                        {isAuthenticated ? 'Dostupno samo kupcima' : 'Prijavite se za slanje upita'}
                      </p>
                      {!isAuthenticated && <Link to="/auth/login" className="btn btn-primary text-sm">Prijava</Link>}
                    </>
                  )}
                </div>
              ) : msgSuccess ? (
                <div className="text-center py-6">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-green-600 text-lg font-bold">✓</span>
                  </div>
                  <p className="font-semibold text-sm mb-1">Upit je poslan!</p>
                  <p className="text-xs text-gray-500 mb-4">Prodavač će primiti email s Vašom porukom i kontakt podacima.</p>
                  <button
                    onClick={() => { setMsgSuccess(false); setMsgPartial(null) }}
                    className="text-xs text-gray-500 hover:text-black underline"
                  >
                    Pošalji još jedan upit
                  </button>
                </div>
              ) : msgPartial ? (
                <div className="text-center py-6">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-amber-600 text-lg font-bold">!</span>
                  </div>
                  <p className="font-semibold text-sm mb-1">Poruka je spremljena</p>
                  <p className="text-xs text-amber-600 mb-4">{msgPartial}</p>
                  <button
                    onClick={() => { setMsgPartial(null); setMsgSuccess(false) }}
                    className="text-xs text-gray-500 hover:text-black underline"
                  >
                    Pošalji još jedan upit
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMessageSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Poruka prodavaču</label>
                    <textarea
                      placeholder="Zanima me više informacija o ovoj nekretnini…"
                      rows={4}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="input resize-none"
                    />
                  </div>

                  {msgError && (
                    <p className="text-xs text-red-600">{msgError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={msgLoading || !messageText.trim()}
                    className="btn btn-primary w-full"
                  >
                    {msgLoading ? (
                      <span className="flex items-center gap-2 justify-center">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Slanje...
                      </span>
                    ) : (
                      <>
                        <Mail size={14} />
                        Pošalji upit emailom
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-gray-400 text-center">
                    Prodavač će primiti email s Vašom porukom i kontakt podacima.
                  </p>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3D Viewer Modal – lazy mounted only when open */}
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