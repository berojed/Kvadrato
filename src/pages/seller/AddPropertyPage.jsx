import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  createPropertyAndListing,
  updatePropertyAndListing,
  getListingForEdit,
  getPropertyTypes,
  getCurrencies,
  getFurnishingTypes,
  getHeatingTypes,
  getPropertyConditions,
  getAmenities,
  resolveLocationId,
  upsertPropertyModel,
  removePropertyModel,
  addPropertyImages,
  removePropertyImage,
} from '@/services/properties'
import { ArrowLeft, Box, X, ImagePlus } from 'lucide-react'
import PropertyLocationPicker from '@/components/ui/PropertyLocationPicker'

// ── Stable wrapper components (module scope → no remount on parent re-render) ──
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

const defaultForm = {
  title: '',
  description: '',
  bedrooms: '',
  bathrooms: '',
  areaSize: '',
  propertyTypeId: '',
  listingType: 'SALE',
  priceAmount: '',
  currencyId: '',
  latitude: null,
  longitude: null,
  // Address (manual input)
  street: '',
  houseNumber: '',
  city: '',
  // Property details
  yearBuilt: '',
  totalFloors: '',
  conditionId: '',
  heatingId: '',
  furnishingId: '',
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

  // Lookups
  const [propertyTypes, setPropertyTypes] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [furnishingTypes, setFurnishingTypes] = useState([])
  const [heatingTypes, setHeatingTypes] = useState([])
  const [propertyConditions, setPropertyConditions] = useState([])
  const [allAmenities, setAllAmenities] = useState([])
  const [lookupLoading, setLookupLoading] = useState(true)

  // Selected amenity IDs
  const [selectedAmenities, setSelectedAmenities] = useState([])


  // Image files state (new upload)
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  // Edit mode: existing images from DB
  const [existingImages, setExistingImages] = useState([])
  const [imageRemoving, setImageRemoving] = useState(null) // image_id being removed

  // 3D model state
  const [modelFile, setModelFile] = useState(null)
  const [existingModel, setExistingModel] = useState(null)
  const [modelUploading, setModelUploading] = useState(false)
  const [modelRemoved, setModelRemoved] = useState(false)

  useEffect(() => {
    loadLookups()
  }, [])


  const loadLookups = async () => {
    const [pt, cur, ft, ht, pc, am] = await Promise.all([
      getPropertyTypes(),
      getCurrencies(),
      getFurnishingTypes(),
      getHeatingTypes(),
      getPropertyConditions(),
      getAmenities(),
    ])
    setPropertyTypes(pt.data)
    setCurrencies(cur.data)
    setFurnishingTypes(ft.data)
    setHeatingTypes(ht.data)
    setPropertyConditions(pc.data)
    setAllAmenities(am.data)

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
      const loc = prop.location ?? {}
      const imgs = [...(prop.image ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      setExistingImages(imgs)
      const m3d = Array.isArray(prop.model3d) ? prop.model3d[0] : prop.model3d
      if (m3d?.url) setExistingModel(m3d)

      // Property details
      const det = Array.isArray(prop.property_details) ? prop.property_details[0] : prop.property_details
      // Selected amenities
      const existingAmenityIds = (prop.property_amenity ?? []).map((pa) => pa.amenity_id)
      setSelectedAmenities(existingAmenityIds)

      setEditIds({ propertyId: data.property_id, addressId: addr.address_id ?? null })

      // Parse street address into street + house number
      const rawAddr = addr.street_address ?? ''
      const addrMatch = rawAddr.match(/^(.+?)\s+(\d+.*)$/)
      const parsedStreet = addrMatch ? addrMatch[1] : rawAddr
      const parsedHouseNum = addrMatch ? addrMatch[2] : ''

      setForm({
        title: prop.title ?? '',
        description: prop.description ?? '',
        bedrooms: prop.bedrooms ?? '',
        bathrooms: prop.bathrooms ?? '',
        areaSize: prop.area_size ?? '',
        propertyTypeId: prop.property_type_id ?? pt.data[0]?.property_type_id ?? '',
        listingType: data.listing_type ?? 'SALE',
        priceAmount: data.price_amount ?? '',
        currencyId: data.currency_id ?? cur.data[0]?.currency_id ?? '',
        latitude: prop.latitude ?? null,
        longitude: prop.longitude ?? null,
        street: parsedStreet,
        houseNumber: parsedHouseNum,
        city: loc.city ?? '',
        yearBuilt: det?.year_built ?? '',
        totalFloors: det?.total_floors ?? '',
        conditionId: det?.condition_id ?? '',
        heatingId: det?.heating_id ?? '',
        furnishingId: det?.furnishing_id ?? '',
      })
      setLookupLoading(false)
      return
    }

    setForm((f) => ({
      ...f,
      propertyTypeId: pt.data[0]?.property_type_id ?? '',
      currencyId: cur.data[0]?.currency_id ?? '',
    }))
    setLookupLoading(false)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleLocationSelect = useCallback(({ lat, lng }) => {
    setForm((f) => ({ ...f, latitude: lat, longitude: lng }))
  }, [])

  // ── Amenity toggles ──
  const toggleAmenity = (amenityId) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenityId)
        ? prev.filter((id) => id !== amenityId)
        : [...prev, amenityId]
    )
  }

  // ── Image handlers ──
  const handleImageFilesChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newPreviews = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setImageFiles((prev) => [...prev, ...files])
    setImagePreviews((prev) => [...prev, ...newPreviews])
  }

  const handleRemoveImage = (index) => {
    if (imageFiles.length <= 3) {
      setError('Oglas mora imati najmanje 3 slike.')
      return
    }
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Edit-mode image handlers ──
  const handleRemoveExistingImage = async (imageId) => {
    if (existingImages.length <= 3) {
      setError('Oglas mora imati najmanje 3 slike.')
      return
    }
    setImageRemoving(imageId)
    const { error: rmErr } = await removePropertyImage(imageId)
    setImageRemoving(null)
    if (rmErr) {
      setError('Greška pri brisanju slike: ' + rmErr.message)
      return
    }
    setExistingImages((prev) => prev.filter((img) => img.image_id !== imageId))
  }

  const handleAddEditImages = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !editIds.propertyId) return
    setLoading(true)
    const { data: newImages, error: upErr } = await addPropertyImages(editIds.propertyId, files)
    setLoading(false)
    if (upErr) {
      setError('Greška pri dodavanju slika: ' + upErr.message)
      return
    }
    setExistingImages((prev) => [...prev, ...newImages])
  }

  // ── 3D model handlers ──
  const handleModelFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setModelFile(file)
      setModelRemoved(false)
    }
  }

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate address fields
    if (!form.street.trim() || !form.houseNumber.trim() || !form.city.trim()) {
      setError('Ulica, kućni broj i grad su obavezni.')
      setLoading(false)
      return
    }

    // Validate minimum images
    const totalImages = isEdit
      ? existingImages.length
      : imageFiles.length
    if (totalImages < 3) {
      setError('Potrebno je najmanje 3 slike nekretnine.')
      setLoading(false)
      return
    }

    // Validate coordinates
    if (form.latitude == null || form.longitude == null) {
      setError('Odaberite točnu lokaciju nekretnine klikom na kartu.')
      setLoading(false)
      return
    }

    // Validate property details
    if (!form.conditionId || !form.heatingId || !form.furnishingId) {
      setError('Sva polja u sekciji "Detalji nekretnine" su obavezna.')
      setLoading(false)
      return
    }

    // Build street address from manual inputs
    const streetAddress = [form.street.trim(), form.houseNumber.trim()].filter(Boolean).join(' ')

    // Resolve location
    const { locationId, error: locErr } = await resolveLocationId({
      city: form.city.trim(),
      stateRegion: '',
      postalCode: '',
      country: 'Hrvatska',
    })
    if (locErr) {
      setError('Greška pri razrješavanju lokacije: ' + locErr.message)
      setLoading(false)
      return
    }

    const propertyDetails = {
      yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : null,
      totalFloors: form.totalFloors ? Number(form.totalFloors) : null,
      conditionId: Number(form.conditionId),
      heatingId: Number(form.heatingId),
      furnishingId: Number(form.furnishingId),
    }

    if (isEdit) {
      const { error: err } = await updatePropertyAndListing({
        listingId: editId,
        propertyId: editIds.propertyId,
        addressId: editIds.addressId,
        streetAddress,
        title: form.title,
        description: form.description,
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        areaSize: Number(form.areaSize),
        propertyTypeId: Number(form.propertyTypeId),
        locationId,
        listingType: form.listingType,
        priceAmount: Number(form.priceAmount),
        currencyId: Number(form.currencyId),
        latitude: form.latitude,
        longitude: form.longitude,
        propertyDetails,
        amenityIds: selectedAmenities,
      })
      if (err) {
        setLoading(false)
        setError(err.message)
        return
      }
      // Upload/remove model
      if (modelFile && editIds.propertyId) {
        setModelUploading(true)
        await upsertPropertyModel(editIds.propertyId, modelFile)
        setModelUploading(false)
      } else if (modelRemoved && !modelFile && editIds.propertyId) {
        await removePropertyModel(editIds.propertyId)
      }
      setLoading(false)
      navigate(`/my_properties/${editId}`)
      return
    }

    const { data, error: err } = await createPropertyAndListing({
      streetAddress,
      title: form.title,
      description: form.description,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      areaSize: Number(form.areaSize),
      propertyTypeId: Number(form.propertyTypeId),
      locationId,
      sellerId: user.id,
      listingType: form.listingType,
      priceAmount: Number(form.priceAmount),
      currencyId: Number(form.currencyId),
      imageFiles,
      latitude: form.latitude,
      longitude: form.longitude,
      propertyDetails,
      amenityIds: selectedAmenities,
    })

    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    // Upload model if selected
    if (modelFile && data.property?.property_id) {
      setModelUploading(true)
      await upsertPropertyModel(data.property.property_id, modelFile)
      setModelUploading(false)
    }

    navigate(`/my_properties/${data.listing.listing_id}`)
  }

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
          <Field label="Opis" required>
            <textarea
              name="description"
              rows={5}
              required
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
            <Field label="Valuta" required>
              <select name="currencyId" value={form.currencyId} onChange={handleChange} className="select" required>
                {currencies.map((c) => (
                  <option key={c.currency_id} value={c.currency_id}>
                    {c.currency_name}{c.symbol ? ` (${c.symbol})` : ''}
                  </option>
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

        {/* Lokacija — manual input */}
        <Section title="Lokacija">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ulica" required>
              <input
                name="street"
                type="text"
                required
                value={form.street}
                onChange={handleChange}
                className="input"
                placeholder="npr. Ilica"
              />
            </Field>
            <Field label="Kućni broj" required>
              <input
                name="houseNumber"
                type="text"
                required
                value={form.houseNumber}
                onChange={handleChange}
                className="input"
                placeholder="npr. 10"
              />
            </Field>
          </div>
          <Field label="Grad" required>
            <input
              name="city"
              type="text"
              required
              value={form.city}
              onChange={handleChange}
              className="input"
              placeholder="npr. Zagreb"
            />
          </Field>

          <Field label="Točna lokacija na karti" required>
            <p className="text-xs text-gray-500 mb-2">Kliknite na kartu da postavite pin na točnu lokaciju nekretnine.</p>
            <PropertyLocationPicker
              address={[form.street, form.houseNumber].filter(Boolean).join(' ')}
              city={form.city}
              latitude={form.latitude}
              longitude={form.longitude}
              onLocationSelect={handleLocationSelect}
            />
            {form.latitude != null && form.longitude != null && (
              <p className="text-xs text-green-600 mt-1.5">
                Lokacija odabrana ({form.latitude.toFixed(5)}, {form.longitude.toFixed(5)})
              </p>
            )}
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
            <Field label="Površina (m²)" required>
              <input name="areaSize" type="number" min={0} required value={form.areaSize} onChange={handleChange} className="input" placeholder="65" />
            </Field>
            <Field label="Spavaće sobe" required>
              <input name="bedrooms" type="number" min={0} max={20} required value={form.bedrooms} onChange={handleChange} className="input" placeholder="2" />
            </Field>
            <Field label="Kupaonice" required>
              <input name="bathrooms" type="number" min={0} max={10} required value={form.bathrooms} onChange={handleChange} className="input" placeholder="1" />
            </Field>
          </div>
        </Section>

        {/* Detalji nekretnine */}
        <Section title="Detalji nekretnine">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Godina izgradnje">
              <input
                name="yearBuilt"
                type="number"
                min={1800}
                max={2030}
                value={form.yearBuilt}
                onChange={handleChange}
                className="input"
                placeholder="2015"
              />
            </Field>
            <Field label="Broj katova">
              <input
                name="totalFloors"
                type="number"
                min={0}
                max={100}
                value={form.totalFloors}
                onChange={handleChange}
                className="input"
                placeholder="5"
              />
            </Field>
            <Field label="Stanje nekretnine" required>
              <select name="conditionId" value={form.conditionId} onChange={handleChange} className="select" required>
                <option value="">— Odaberi —</option>
                {propertyConditions.map((c) => (
                  <option key={c.condition_id} value={c.condition_id}>{c.condition_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Grijanje" required>
              <select name="heatingId" value={form.heatingId} onChange={handleChange} className="select" required>
                <option value="">— Odaberi —</option>
                {heatingTypes.map((h) => (
                  <option key={h.heating_id} value={h.heating_id}>{h.heating_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Namještaj" required>
              <select name="furnishingId" value={form.furnishingId} onChange={handleChange} className="select" required>
                <option value="">— Odaberi —</option>
                {furnishingTypes.map((f) => (
                  <option key={f.furnishing_id} value={f.furnishing_id}>{f.furnishing_name}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* Pogodnosti / Amenities */}
        <Section title="Pogodnosti">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allAmenities.map((a) => (
              <label
                key={a.amenity_id}
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedAmenities.includes(a.amenity_id)
                    ? 'border-accent bg-accent/5 text-black'
                    : 'border-border hover:border-gray-300 text-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(a.amenity_id)}
                  onChange={() => toggleAmenity(a.amenity_id)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  selectedAmenities.includes(a.amenity_id) ? 'bg-accent border-accent text-white' : 'border-gray-300'
                }`}>
                  {selectedAmenities.includes(a.amenity_id) && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm">{a.amenity_name}</span>
              </label>
            ))}
          </div>
          {allAmenities.length === 0 && (
            <p className="text-xs text-gray-400">Nema dostupnih pogodnosti u bazi.</p>
          )}
        </Section>

        {/* Slike */}
        {isEdit ? (
          <Section title="Slike">
            {/* Existing images */}
            {existingImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{existingImages.length} {existingImages.length === 1 ? 'slika' : 'slika'} — prva je naslovna</p>
                <div className="flex flex-wrap gap-2">
                  {existingImages.map((img, i) => (
                    <div key={img.image_id} className="relative group">
                      <img
                        src={img.url}
                        alt={`Slika ${i + 1}`}
                        className={`w-20 h-16 object-cover rounded border-2 ${img.is_primary ? 'border-accent' : 'border-border'}`}
                      />
                      {img.is_primary && (
                        <span className="absolute -top-1.5 -left-1.5 bg-accent text-white text-[9px] font-bold px-1 py-0.5 rounded">
                          Naslovna
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingImage(img.image_id)}
                        disabled={imageRemoving === img.image_id}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                        title="Ukloni"
                      >
                        {imageRemoving === img.image_id ? (
                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <X size={10} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add more images */}
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-accent hover:bg-gray-50 transition-colors">
              <ImagePlus size={22} className="text-gray-400 mb-1" />
              <span className="text-sm text-gray-600 font-medium">Dodaj slike</span>
              <span className="text-xs text-gray-400 mt-0.5">JPG, PNG ili WebP — do 10 MB po slici (min. 3 slike)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleAddEditImages}
                className="hidden"
              />
            </label>
          </Section>
        ) : (
          <Section title="Slike">
            <Field label="Fotografije nekretnine" required>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-accent hover:bg-gray-50 transition-colors">
                <ImagePlus size={28} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-600 font-medium">Odaberi slike</span>
                <span className="text-xs text-gray-400 mt-1">JPG, PNG ili WebP — do 10 MB po slici (min. 3 slike)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageFilesChange}
                  className="hidden"
                />
              </label>

              {imagePreviews.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-500">{imagePreviews.length} {imagePreviews.length === 1 ? 'slika odabrana' : 'slika odabrano'} — prva slika je naslovna</p>
                  <div className="flex flex-wrap gap-2">
                    {imagePreviews.map((item, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={item.previewUrl}
                          alt={`Slika ${i + 1}`}
                          className={`w-20 h-16 object-cover rounded border-2 ${i === 0 ? 'border-accent' : 'border-border'}`}
                        />
                        {i === 0 && (
                          <span className="absolute -top-1.5 -left-1.5 bg-accent text-white text-[9px] font-bold px-1 py-0.5 rounded">
                            Naslovna
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Ukloni"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
