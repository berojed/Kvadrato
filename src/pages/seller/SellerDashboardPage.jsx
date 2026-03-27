import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, Home, MessageCircle, Calendar, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { getListingsBySeller, deleteListing } from '@/services/properties'
import { getVisitRequestsBySeller } from '@/services/visits'
import { getSellerContactsCount } from '@/services/sellers'
import { formatPrice } from '@/lib/utils'

const PER_PAGE = 6

export default function SellerDashboardPage() {
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [page, setPage] = useState(1)

  // Metrics
  const [metrics, setMetrics] = useState({ active: 0, upcomingViewings: 0, contacts: 0 })

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    const [listingsRes, visitsRes, contactsRes] = await Promise.all([
      getListingsBySeller(user.id),
      getVisitRequestsBySeller(user.id),
      getSellerContactsCount(user.id),
    ])

    if (listingsRes.error) {
      setError(listingsRes.error.message)
    } else {
      // Defensive client-side filter — guarantees we never display another
      // seller's listings even if the service layer returns unexpected data.
      const ownListings = (listingsRes.data ?? []).filter(
        (l) => l.seller_id === user.id
      )
      setListings(ownListings)
    }

    const now = new Date()
    const activeCount = (listingsRes.data ?? [])
      .filter((l) => l.seller_id === user.id)
      .filter((l) => l.listing_status?.status_code === 'ACTIVE').length

    const upcomingViewings = (visitsRes.data ?? []).filter((v) => {
      if (v.status === 'CANCELLED' || v.status === 'REJECTED') return false
      return new Date(v.requested_datetime) >= now
    }).length

    setMetrics({
      active: activeCount,
      upcomingViewings,
      contacts: contactsRes.count ?? 0,
    })

    setLoading(false)
  }

  const handleDelete = async (listingId) => {
    if (!window.confirm(t('seller.deleteConfirm'))) return
    setDeletingId(listingId)
    const { error: err } = await deleteListing(listingId)
    setDeletingId(null)
    if (err) alert(t('seller.deleteError') + ': ' + err.message)
    else {
      const deleted = listings.find((l) => l.listing_id === listingId)
      const wasActive = deleted?.listing_status?.status_code === 'ACTIVE'
      setListings((prev) => prev.filter((l) => l.listing_id !== listingId))
      if (wasActive) {
        setMetrics((m) => ({ ...m, active: Math.max(0, m.active - 1) }))
      }
    }
  }

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(listings.length / PER_PAGE))
  const pagedListings = listings.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // Reset to page 1 if current page is out of bounds after delete
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [listings.length])

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="container py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">{t('seller.dashboardTitle')}</h1>
            <p className="text-sm text-gray-500">{t('seller.dashboardSubtitle')}</p>
          </div>
          <Link to="/seller/add" className="btn btn-primary">
            <Plus size={15} />
            {t('seller.addListing')}
          </Link>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <Home size={16} className="text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">{t('seller.metricActive')}</span>
            </div>
            <div className="text-2xl font-bold">{loading ? '—' : metrics.active}</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Calendar size={16} className="text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">{t('seller.metricUpcoming')}</span>
            </div>
            <div className="text-2xl font-bold">{loading ? '—' : metrics.upcomingViewings}</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <MessageCircle size={16} className="text-purple-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">{t('seller.metricContacts')}</span>
            </div>
            <div className="text-2xl font-bold">{loading ? '—' : metrics.contacts}</div>
          </div>
        </div>

        {/* Listings */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{error}</div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200 shadow-sm">
            <Home size={40} className="mx-auto mb-3 text-gray-300" />
            <h3 className="font-semibold mb-2">{t('seller.noListings')}</h3>
            <p className="text-sm text-gray-500 mb-5">{t('seller.addFirstListing')}</p>
            <Link to="/seller/add" className="btn btn-primary">
              <Plus size={14} /> {t('seller.addListing')}
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {pagedListings.map((listing) => {
                const prop = listing.property ?? {}
                const images = [...(prop.image ?? [])].sort(
                  (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
                )
                const primaryImage = images.find((i) => i.is_primary) ?? images[0]
                const location = prop.location
                  ? [prop.location.city, prop.location.state_region].filter(Boolean).join(', ')
                  : null
                const isDeleting = deletingId === listing.listing_id
                const isActive = listing.listing_status?.status_code === 'ACTIVE'

                return (
                  <div
                    key={listing.listing_id}
                    onClick={() => navigate(`/my_properties/${listing.listing_id}`)}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    {/* Thumbnail */}
                    <div className="w-28 h-20 sm:w-36 sm:h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {primaryImage?.url ? (
                        <img
                          src={primaryImage.url}
                          alt={prop.title ?? ''}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Home size={24} />
                        </div>
                      )}
                    </div>

                    {/* Center: info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <Link
                          to={`/my_properties/${listing.listing_id}`}
                          className="text-sm font-semibold hover:underline truncate"
                        >
                          {prop.title ?? 'Nekretnina'}
                        </Link>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 whitespace-nowrap flex-shrink-0 uppercase tracking-wide">
                          {listing.listing_type === 'SALE' ? t('common.sale') : t('common.rent')}
                        </span>
                      </div>

                      {location && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
                          <MapPin size={11} />
                          <span className="truncate">{location}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {prop.bedrooms && <span>{prop.bedrooms} soba</span>}
                        {prop.bathrooms && <span>{prop.bathrooms} kup.</span>}
                        {prop.area_size && <span>{prop.area_size} m²</span>}
                      </div>
                    </div>

                    {/* Right: price, status, actions */}
                    <div className="flex flex-col items-end justify-between flex-shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          {formatPrice(listing.price_amount, listing.currency)}
                          {listing.listing_type === 'RENT' && (
                            <span className="text-xs font-normal text-gray-400">{t('common.perMonth')}</span>
                          )}
                        </div>
                        <span
                          className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                            isActive
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {isActive ? 'Aktivan' : listing.listing_status?.description ?? '—'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Link
                          to={`/seller/edit/${listing.listing_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-gray-400 hover:text-black rounded hover:bg-gray-50 transition-colors"
                          title={t('common.edit')}
                        >
                          <Edit2 size={14} />
                        </Link>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(listing.listing_id) }}
                          disabled={isDeleting}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                          title={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? 'bg-black text-white'
                        : 'border border-gray-200 text-gray-600 hover:border-gray-400 bg-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
