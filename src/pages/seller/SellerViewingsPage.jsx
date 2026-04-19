import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, MapPin, AlertCircle, CheckCircle, XCircle, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { getVisitRequestsBySeller, sellerUpdateVisitStatus } from '@/services/visits'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_CLASSNAMES = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  CONFIRMED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  REJECTED: 'bg-red-50 text-red-600',
}

function ViewingRow({ visit, isUpcoming, actionLoading, onAction, t, locale }) {
  const listing = visit.listing
  const property = listing?.property
  const location = property?.location
  const images = [...(property?.image ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const primaryImage = images.find((i) => i.is_primary) ?? images[0]
  const statusClassName = STATUS_CLASSNAMES[visit.status] ?? STATUS_CLASSNAMES.PENDING
  const statusLabel = t('status.' + visit.status) ?? t('status.PENDING')

  const buyer = visit.buyer
  const buyerName = [buyer?.first_name, buyer?.last_name].filter(Boolean).join(' ') || buyer?.email || t('common.user')

  const dateTime = visit.requested_datetime ? new Date(visit.requested_datetime) : null
  const formattedDate = dateTime ? formatDate(dateTime, locale) : '—'
  const formattedTime = dateTime
    ? dateTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : '—'

  const locationText = location
    ? [location.city, location.state_region].filter(Boolean).join(', ')
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        {primaryImage?.url ? (
          <img src={primaryImage.url} alt={property?.title ?? ''} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Calendar size={24} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <Link
            to={`/properties/${listing?.listing_id}`}
            className="text-sm font-semibold hover:underline truncate"
          >
            {property?.title ?? t('common.property')}
          </Link>
          {isUpcoming && (
            <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0', statusClassName)}>
              {statusLabel}
            </span>
          )}
        </div>

        {locationText && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
            <MapPin size={11} />
            <span>{locationText}</span>
          </div>
        )}

        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
          <User size={11} />
          <span>{buyerName}</span>
        </div>

        {visit.notes && (
          <p className="text-xs text-gray-500 italic mb-1.5 line-clamp-2">„{visit.notes}"</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {formattedDate}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {formattedTime}
            </span>
          </div>

          {/* Actions — only for upcoming PENDING items */}
          {isUpcoming && visit.status === 'PENDING' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAction(visit.request_id, 'CONFIRMED')}
                disabled={actionLoading}
                className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-800 disabled:opacity-50 transition-colors"
              >
                <CheckCircle size={12} />
                {t('viewing.confirmAction')}
              </button>
              <button
                onClick={() => onAction(visit.request_id, 'REJECTED')}
                disabled={actionLoading}
                className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                <XCircle size={12} />
                {t('viewing.rejectAction')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SellerViewingsPage() {
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoadingId, setActionLoadingId] = useState(null)

  useEffect(() => {
    if (!user) return
    loadVisits()
  }, [user])

  const loadVisits = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await getVisitRequestsBySeller(user.id)
    if (err) setError(err.message)
    else setVisits(data)
    setLoading(false)
  }

  const handleAction = async (requestId, newStatus) => {
    setActionLoadingId(requestId)
    const { error: err } = await sellerUpdateVisitStatus(requestId, user.id, newStatus)
    if (err) {
      setError(err.message)
    } else {
      setVisits((prev) =>
        prev.map((v) => (v.request_id === requestId ? { ...v, status: newStatus } : v))
      )
    }
    setActionLoadingId(null)
  }

  const now = new Date()

  const upcoming = visits.filter((v) => {
    if (v.status === 'CANCELLED' || v.status === 'REJECTED') return false
    return new Date(v.requested_datetime) >= now
  })

  const past = visits.filter((v) => {
    if (v.status === 'CANCELLED' || v.status === 'REJECTED') return true
    return new Date(v.requested_datetime) < now
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="container py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">{t('seller.viewingsTitle')}</h1>
          <p className="text-sm text-gray-500">{t('seller.viewingsSubtitle')}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-6">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Upcoming */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">
            {t('viewing.upcoming')}
            {upcoming.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">({upcoming.length})</span>
            )}
          </h2>
          {upcoming.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200 shadow-sm">
              <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
              <h3 className="font-semibold mb-2">{t('viewing.sellerNoUpcoming')}</h3>
              <p className="text-sm text-gray-500">
                {t('viewing.sellerNoUpcomingHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((v) => (
                <ViewingRow
                  key={v.request_id}
                  visit={v}
                  isUpcoming={true}
                  actionLoading={actionLoadingId === v.request_id}
                  onAction={handleAction}
                  t={t}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </section>

        {/* Past */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            {t('viewing.past')}
            {past.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">({past.length})</span>
            )}
          </h2>
          {past.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200 shadow-sm">
              <Clock size={40} className="mx-auto mb-3 text-gray-300" />
              <h3 className="font-semibold mb-2">{t('viewing.sellerNoPast')}</h3>
              <p className="text-sm text-gray-500">
                {t('viewing.sellerNoPastHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {past.map((v) => (
                <ViewingRow
                  key={v.request_id}
                  visit={v}
                  isUpcoming={false}
                  actionLoading={false}
                  onAction={() => {}}
                  t={t}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
