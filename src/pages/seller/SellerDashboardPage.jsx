import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit2, Trash2, Eye, BarChart2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getListingsBySeller, deleteListing } from '@/services/properties'
import { formatPrice } from '@/lib/utils'

export default function SellerDashboardPage() {
  const { user } = useAuth()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    loadListings()
  }, [user])

  const loadListings = async () => {
    if (!user) return
    setLoading(true)
    const { data, error: err } = await getListingsBySeller(user.id)
    if (err) setError(err.message)
    else setListings(data)
    setLoading(false)
  }

  const handleDelete = async (listingId) => {
    if (!window.confirm('Jesi li siguran da želiš obrisati ovaj oglas?')) return
    setDeletingId(listingId)
    const { error: err } = await deleteListing(listingId)
    setDeletingId(null)
    if (err) alert('Greška pri brisanju: ' + err.message)
    else setListings((prev) => prev.filter((l) => l.listing_id !== listingId))
  }

  const stats = {
    total: listings.length,
  }

  return (
    <div className="container py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Moje nekretnine</h1>
          <p className="text-sm text-gray-500">Upravljaj svojih oglasima</p>
        </div>
        <Link to="/seller/add" className="btn btn-primary">
          <Plus size={15} />
          Dodaj oglas
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border border-border rounded p-5">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">Aktivni oglasi</div>
        </div>
        <div className="border border-border rounded p-5">
          <div className="text-2xl font-bold">—</div>
          <div className="text-xs text-gray-500 mt-1">Ukupno pregleda</div>
        </div>
        <div className="border border-border rounded p-5">
          <div className="text-2xl font-bold">—</div>
          <div className="text-xs text-gray-500 mt-1">Dodano u omiljene</div>
        </div>
      </div>

      {/* Listing list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-4">{error}</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded">
          <div className="text-4xl mb-3">🏠</div>
          <h3 className="font-semibold mb-2">Nema oglasa</h3>
          <p className="text-sm text-gray-500 mb-5">Dodaj svoju prvu nekretninu</p>
          <Link to="/seller/add" className="btn btn-primary">
            <Plus size={14} /> Dodaj oglas
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const prop = listing.property ?? {}
            const images = [...(prop.image ?? [])]
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            const primaryImage = images.find(i => i.is_primary) ?? images[0]
            const location = prop.location
              ? [prop.location.city, prop.location.state_region].filter(Boolean).join(', ')
              : null

            return (
              <div
                key={listing.listing_id}
                className="flex items-center gap-4 border border-border rounded p-4 hover:border-gray-400 transition-colors"
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-gray-100">
                  {primaryImage?.url ? (
                    <img src={primaryImage.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                      bez slike
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{prop.title}</h3>
                  {location && <p className="text-xs text-gray-500 truncate">{location}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{listing.listing_status?.status_name ?? '—'}</span>
                    <span>{listing.listing_type}</span>
                  </div>
                </div>

                {/* Price */}
                <div className="hidden sm:block text-sm font-semibold">
                  {formatPrice(listing.price_amount, listing.currency?.currency_code)}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <Link
                    to={`/properties/${listing.listing_id}`}
                    className="w-8 h-8 border border-border rounded flex items-center justify-center text-gray-500 hover:text-black hover:border-gray-500 transition-colors"
                    title="Pregledaj"
                  >
                    <Eye size={13} />
                  </Link>
                  <Link
                    to={`/seller/edit/${listing.listing_id}`}
                    className="w-8 h-8 border border-border rounded flex items-center justify-center text-gray-500 hover:text-black hover:border-gray-500 transition-colors"
                    title="Uredi"
                  >
                    <Edit2 size={13} />
                  </Link>
                  <button
                    onClick={() => handleDelete(listing.listing_id)}
                    disabled={deletingId === listing.listing_id}
                    className="w-8 h-8 border border-border rounded flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                    title="Obriši"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}