import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { createPropertyAndListing, getPropertyTypes, getLocations, getCurrencies } from '@/services/properties'
import { ArrowLeft } from 'lucide-react'

const defaultForm = {
  // Adresa
  streetAddress: '',
  // Nekretnina
  title: '',
  description: '',
  bedrooms: '',
  bathrooms: '',
  areaSize: '',
  propertyTypeId: '',
  locationId: '',
  // Oglas
  listingType: 'SALE',
  priceAmount: '',
  currencyId: '',
  // Slike
  imageUrlsRaw: '',
}

export default function AddPropertyPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [propertyTypes, setPropertyTypes] = useState([])
  const [locations, setLocations] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [lookupLoading, setLookupLoading] = useState(true)

  useEffect(() => {
    loadLookups()
  }, [])

  const loadLookups = async () => {
    const [pt, loc, cur] = await Promise.all([
      getPropertyTypes(),
      getLocations(),
      getCurrencies(),
    ])
    setPropertyTypes(pt.data)
    setLocations(loc.data)
    setCurrencies(cur.data)
    setForm((f) => ({
      ...f,
      propertyTypeId: pt.data[0]?.property_type_id ?? '',
      locationId: loc.data[0]?.location_id ?? '',
      currencyId: cur.data[0]?.currency_id ?? '',
    }))
    setLookupLoading(false)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const imageUrls = form.imageUrlsRaw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)

    const { data, error: err } = await createPropertyAndListing({
      streetAddress: form.streetAddress,
      title: form.title,
      description: form.description,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      areaSize: form.areaSize ? Number(form.areaSize) : null,
      propertyTypeId: Number(form.propertyTypeId),
      locationId: Number(form.locationId),
      sellerId: user.id,
      listingType: form.listingType,
      priceAmount: form.priceAmount ? Number(form.priceAmount) : null,
      currencyId: Number(form.currencyId),
      imageUrls,
    })

    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      navigate(`/properties/${data.listing.listing_id}`)
    }
  }

  const Section = ({ title, children }) => (
    <div className="border border-border rounded p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">{title}</h2>
      {children}
    </div>
  )

  const Field = ({ label, required, children }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )

  if (lookupLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="container py-10">
      <Link to="/seller/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6 transition-colors">
        <ArrowLeft size={14} />
        Moje nekretnine
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Dodaj oglas</h1>
        <p className="text-sm text-gray-500">Ispuni podatke o nekretnini</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Osnovni podaci */}
        <Section title="Osnovni podaci">
          <Field label="Naslov" required>
            <input
              name="title"
              type="text"
              required
              value={form.title}
              onChange={handleChange}
              className="input"
              placeholder="npr. Trosoban stan, Zagreb – Trešnjevka"
            />
          </Field>
          <Field label="Opis">
            <textarea
              name="description"
              rows={5}
              value={form.description}
              onChange={handleChange}
              className="input resize-none"
              placeholder="Opiši nekretninu – lokacija, stanje, prednosti…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cijena" required>
              <input
                name="priceAmount"
                type="number"
                required
                min={0}
                value={form.priceAmount}
                onChange={handleChange}
                className="input"
                placeholder="150000"
              />
            </Field>
            <Field label="Valuta">
              <select name="currencyId" value={form.currencyId} onChange={handleChange} className="select">
                {currencies.map((c) => (
                  <option key={c.currency_id} value={c.currency_id}>{c.currency_code}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Tip oglasa" required>
            <select name="listingType" value={form.listingType} onChange={handleChange} className="select">
              <option value="SALE">Prodaja</option>
              <option value="RENT">Najam</option>
            </select>
          </Field>
        </Section>

        {/* Lokacija */}
        <Section title="Lokacija">
          <Field label="Ulica i kućni broj" required>
            <input
              name="streetAddress"
              type="text"
              required
              value={form.streetAddress}
              onChange={handleChange}
              className="input"
              placeholder="Ilica 10"
            />
          </Field>
          <Field label="Grad / Lokacija" required>
            <select name="locationId" value={form.locationId} onChange={handleChange} className="select">
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {[l.city, l.state_region, l.country].filter(Boolean).join(', ')}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        {/* Karakteristike */}
        <Section title="Karakteristike">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tip nekretnine" required>
              <select name="propertyTypeId" value={form.propertyTypeId} onChange={handleChange} className="select">
                {propertyTypes.map((t) => (
                  <option key={t.property_type_id} value={t.property_type_id}>{t.type_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Površina (m²)">
              <input name="areaSize" type="number" min={0} value={form.areaSize} onChange={handleChange} className="input" placeholder="65" />
            </Field>
            <Field label="Spavaće sobe">
              <input name="bedrooms" type="number" min={0} max={20} value={form.bedrooms} onChange={handleChange} className="input" placeholder="2" />
            </Field>
            <Field label="Kupaonice">
              <input name="bathrooms" type="number" min={0} max={10} value={form.bathrooms} onChange={handleChange} className="input" placeholder="1" />
            </Field>
          </div>
        </Section>

        {/* Slike */}
        <Section title="Slike">
          <Field label="URL-ovi slika (odvojeni zarezom)">
            <textarea
              name="imageUrlsRaw"
              rows={3}
              value={form.imageUrlsRaw}
              onChange={handleChange}
              className="input resize-none"
              placeholder="https://primjer.com/slika1.jpg, https://primjer.com/slika2.jpg"
            />
            <p className="text-xs text-gray-400 mt-1">
              Za upload slika koristi Supabase Storage i zalijepi dobivene URL-ove ovdje.
            </p>
          </Field>
        </Section>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Objava…
              </span>
            ) : (
              'Objavi oglas'
            )}
          </button>
          <Link to="/seller/dashboard" className="btn btn-secondary">
            Odustani
          </Link>
        </div>
      </form>
    </div>
  )
}