import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { createPropertyAndListing, updatePropertyAndListing, getListingForEdit, getPropertyTypes, getLocations, getCurrencies, upsertPropertyModel, removePropertyModel } from '@/services/properties'
import { ArrowLeft, Box } from 'lucide-react'

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
  const { id: editId } = useParams()
  const isEdit = !!editId

  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Edit-mode internal IDs for update calls
  const [editIds, setEditIds] = useState({ propertyId: null, addressId: null })

  const [propertyTypes, setPropertyTypes] = useState([])
  const [locations, setLocations] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [lookupLoading, setLookupLoading] = useState(true)

  // 3D model state
  const [modelFile, setModelFile] = useState(null)          // File selected for upload
  const [existingModel, setExistingModel] = useState(null)  // { url, model_id } from edit
  const [modelUploading, setModelUploading] = useState(false)
  const [modelRemoved, setModelRemoved] = useState(false)   // user requested removal

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

    // In edit mode, load existing listing data
    if (editId && user) {
      const { data, error: editErr } = await getListingForEdit(editId, user.id)
      if (editErr || !data) {
        setError(editErr?.message ?? 'Oglas nije pronađen.')
        setLookupLoading(false)
        return
      }
      const prop = data.property ?? {}
      const addr = prop.property_address?.[0] ?? prop.property_address ?? {}
      const imgs = [...(prop.image ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const m3d = Array.isArray(prop.model3d) ? prop.model3d[0] : prop.model3d
      if (m3d?.url) setExistingModel(m3d)

      setEditIds({ propertyId: data.property_id, addressId: addr.address_id ?? null })
      setForm({
        streetAddress: addr.street_address ?? '',
        title: prop.title ?? '',
        description: prop.description ?? '',
        bedrooms: prop.bedrooms ?? '',
        bathrooms: prop.bathrooms ?? '',
        areaSize: prop.area_size ?? '',
        propertyTypeId: prop.property_type_id ?? pt.data[0]?.property_type_id ?? '',
        locationId: prop.location_id ?? loc.data[0]?.location_id ?? '',
        listingType: data.listing_type ?? 'SALE',
        priceAmount: data.price_amount ?? '',
        currencyId: data.currency_id ?? cur.data[0]?.currency_id ?? '',
        imageUrlsRaw: imgs.map((i) => i.url).join(', '),
      })
      setLookupLoading(false)
      return
    }

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

  const handleModelFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setModelFile(file)
      setModelRemoved(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (isEdit) {
      const { error: err } = await updatePropertyAndListing({
        listingId: editId,
        propertyId: editIds.propertyId,
        addressId: editIds.addressId,
        streetAddress: form.streetAddress,
        title: form.title,
        description: form.description,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        areaSize: form.areaSize ? Number(form.areaSize) : null,
        propertyTypeId: Number(form.propertyTypeId),
        locationId: Number(form.locationId),
        listingType: form.listingType,
        priceAmount: form.priceAmount ? Number(form.priceAmount) : null,
        currencyId: Number(form.currencyId),
      })
      if (err) {
        setLoading(false)
        setError(err.message)
        return
      }
      // Upload new model if selected
      if (modelFile && editIds.propertyId) {
        setModelUploading(true)
        const { error: modelErr } = await upsertPropertyModel(editIds.propertyId, modelFile)
        setModelUploading(false)
        if (modelErr && import.meta.env.DEV) {
          console.error('[AddProperty] Model upload greška:', modelErr.message)
        }
      } else if (modelRemoved && !modelFile && editIds.propertyId) {
        await removePropertyModel(editIds.propertyId)
      }
      setLoading(false)
      navigate(`/properties/${editId}`)
      return
    }

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
      return
    }

    // Upload model if file was selected
    if (modelFile && data.property?.property_id) {
      setModelUploading(true)
      const { error: modelErr } = await upsertPropertyModel(data.property.property_id, modelFile)
      setModelUploading(false)
      if (modelErr && import.meta.env.DEV) {
        console.error('[AddProperty] Model upload greška:', modelErr.message)
      }
    }

    navigate(`/properties/${data.listing.listing_id}`)
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
        <h1 className="text-3xl font-bold mb-1">{isEdit ? 'Uredi oglas' : 'Dodaj oglas'}</h1>
        <p className="text-sm text-gray-500">{isEdit ? 'Ažuriraj podatke o nekretnini' : 'Ispuni podatke o nekretnini'}</p>
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
        {isEdit ? (
          <div className="border border-border rounded p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">Slike</h2>
            <p className="text-xs text-gray-400">Uređivanje slika dostupno uskoro.</p>
          </div>
        ) : (
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
        )}

        {/* 3D model */}
        <div className="border border-border rounded p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Box size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">3D model</h2>
          </div>

          {isEdit && existingModel && !modelRemoved ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-border text-sm">
                <span className="text-gray-700 truncate mr-3">Trenutni model: model.glb</span>
                <div className="flex gap-2 flex-shrink-0">
                  <label className="btn btn-secondary cursor-pointer text-xs px-3 py-1.5 text-sm">
                    Zamijeni
                    <input
                      type="file"
                      accept=".glb,.gltf"
                      className="hidden"
                      onChange={handleModelFileChange}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => { setModelRemoved(true); setModelFile(null) }}
                    className="btn btn-secondary text-xs px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Ukloni
                  </button>
                </div>
              </div>
              {modelFile && (
                <p className="text-xs text-gray-500">Novi model odabran: {modelFile.name}</p>
              )}
            </div>
          ) : (
            <Field label="GLB / GLTF datoteka (opcionalno)">
              <input
                type="file"
                accept=".glb,.gltf"
                onChange={handleModelFileChange}
                className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              <p className="text-xs text-gray-400 mt-1">
                Prihvaća se .glb i .gltf format. Preporučuje se Draco kompresija za manje datoteke.
              </p>
              {modelRemoved && (
                <p className="text-xs text-amber-600 mt-1">Model će biti uklonjen pri spremanju.</p>
              )}
            </Field>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading || modelUploading} className="btn btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isEdit ? 'Spremanje…' : 'Objava…'}
              </span>
            ) : modelUploading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Učitavanje modela…
              </span>
            ) : (
              isEdit ? 'Spremi promjene' : 'Objavi oglas'
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