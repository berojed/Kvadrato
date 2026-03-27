import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, AlertCircle, XCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { getVisitRequestsByBuyer, cancelVisitRequest } from '@/services/visits'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_CLASSNAMES = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  CONFIRMED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  REJECTED: 'bg-red-50 text-red-600',
}

function ViewingCard({ visit, showCancel, onCancel, cancelling, showStatus = true }) {
  const navigate = useNavigate()
  const { t, locale } = useI18n()
  const listing = visit.listing
  const property = listing?.property
  const location = property?.location
  const images = property?.image ?? []
  const primaryImage = images.find((i) => i.is_primary) ?? images[0]
  const statusClassName = STATUS_CLASSNAMES[visit.status] ?? STATUS_CLASSNAMES.PENDING
  const statusLabel = t(`status.${visit.status}`) ?? t('status.PENDING')

  const dateTime = visit.requested_datetime
    ? new Date(visit.requested_datetime)
    : null

  const formattedDate = dateTime ? formatDate(dateTime, locale) : '—'
  const formattedTime = dateTime
    ? dateTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : '—'

  const handleCardClick = () => {
    if (listing?.listing_id) {
      navigate(`/properties/${listing.listing_id}`)
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className="card p-4 flex gap-4 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all"
    >
      {/* Thumbnail */}
      <div className="w-20 h-20 rounded overflow-hidden bg-gray-100 flex-shrink-0">
        {primaryImage?.url ? (
          <img
            src={primaryImage.url}
            alt={property?.title ?? t('common.property')}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Calendar size={24} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-semibold truncate">
            {property?.title ?? t('common.property')}
          </span>
          {showStatus && (
            <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap', statusClassName)}>
              {statusLabel}
            </span>
          )}
        </div>

        {location && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
            <MapPin size={11} />
            <span>{[location.city, location.state_region].filter(Boolean).join(', ')}</span>
          </div>
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

          {showCancel && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(visit.request_id) }}
              disabled={cancelling}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
            >
              <XCircle size={12} />
              {cancelling ? t('viewing.cancelling') : t('viewing.cancelButton')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyViewingsPage() {
  const { user, profile } = useAuth()
  const { t } = useI18n()
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  const buyerId = profile?.user_id ?? user?.id

  useEffect(() => {
    if (!buyerId) return

    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await getVisitRequestsByBuyer(buyerId)
      if (err) {
        setError(err.message)
      } else {
        setVisits(data)
      }
      setLoading(false)
    }

    load()
  }, [buyerId])

  const handleCancel = async (requestId) => {
    setCancellingId(requestId)
    const { error: err } = await cancelVisitRequest(requestId, buyerId)
    if (err) {
      setError(err.message)
    } else {
      setVisits((prev) =>
        prev.map((v) =>
          v.request_id === requestId ? { ...v, status: 'CANCELLED' } : v
        )
      )
    }
    setCancellingId(null)
  }

  const now = new Date()

  const upcoming = visits.filter((v) => {
    if (v.status === 'CANCELLED' || v.status === 'REJECTED') return false
    return new Date(v.requested_datetime) >= now
  })

  const past = visits.filter((v) => {
    if (v.status === 'CANCELLED' || v.status === 'REJECTED') {
      return true
    }
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
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">{t('nav.myViewings')}</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-6">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Upcoming viewings */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">
          {t('viewing.upcoming')}
          {upcoming.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">({upcoming.length})</span>
          )}
        </h2>
        {upcoming.length === 0 ? (
          <div className="card p-8 text-center">
            <Calendar size={40} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-base font-semibold mb-2">{t('viewing.noUpcoming')}</h3>
            <p className="text-sm text-gray-500 mb-6">
              {t('viewing.noUpcomingHint')}
            </p>
            <Link to="/properties" className="btn btn-primary">
              {t('viewing.browseProperties')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((v) => (
              <ViewingCard
                key={v.request_id}
                visit={v}
                showCancel={v.status === 'PENDING' || v.status === 'CONFIRMED'}
                onCancel={handleCancel}
                cancelling={cancellingId === v.request_id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past viewings */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          {t('viewing.past')}
          {past.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">({past.length})</span>
          )}
        </h2>
        {past.length === 0 ? (
          <div className="card p-8 text-center">
            <Clock size={40} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-base font-semibold mb-2">{t('viewing.noPast')}</h3>
            <p className="text-sm text-gray-500">
              {t('viewing.noPastHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {past.map((v) => (
              <ViewingCard key={v.request_id} visit={v} showStatus={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
