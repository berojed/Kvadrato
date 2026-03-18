import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const PROPERTY_TYPES = [
  { value: '', label: 'Svi tipovi' },
  { value: 'Stan', label: 'Stan' },
  { value: 'Kuća', label: 'Kuća' },
  { value: 'Poslovni prostor', label: 'Poslovni prostor' },
]

const SORT_OPTIONS = [
  { value: 'date_listed:desc', label: 'Najnovije' },
  { value: 'date_listed:asc', label: 'Najstarije' },
  { value: 'price_amount:asc', label: 'Cijena: rastuće' },
  { value: 'price_amount:desc', label: 'Cijena: padajuće' },
]

const LISTING_TYPE_OPTIONS = [
  { value: '', label: 'Sve' },
  { value: 'SALE', label: 'Prodaja' },
  { value: 'RENT', label: 'Najam' },
]

const BEDROOM_OPTIONS = [
  { value: null, label: 'Sve' },
  { value: 1, label: '1+' },
  { value: 2, label: '2+' },
  { value: 3, label: '3+' },
  { value: 4, label: '4+' },
]

// Croatian counties → major cities/towns
const CROATIAN_LOCATIONS = {
  'Grad Zagreb': ['Zagreb'],
  'Zagrebačka': ['Samobor', 'Zaprešić', 'Velika Gorica', 'Dugo Selo', 'Sveta Nedelja', 'Jastrebarsko', 'Vrbovec', 'Sv. Ivan Zelina'],
  'Splitsko-dalmatinska': ['Split', 'Kaštela', 'Solin', 'Sinj', 'Trogir', 'Makarska', 'Omiš', 'Imotski', 'Hvar', 'Supetar', 'Vis'],
  'Primorsko-goranska': ['Rijeka', 'Opatija', 'Crikvenica', 'Krk', 'Mali Lošinj', 'Novi Vinodolski', 'Čabar'],
  'Istarska': ['Pula', 'Rovinj', 'Poreč', 'Umag', 'Pazin', 'Labin', 'Novigrad', 'Buje'],
  'Osječko-baranjska': ['Osijek', 'Đakovo', 'Beli Manastir', 'Belišće', 'Donji Miholjac', 'Valpovo', 'Našice'],
  'Varaždinska': ['Varaždin', 'Ludbreg', 'Ivanec', 'Lepoglava', 'Novi Marof', 'Varaždinske Toplice'],
  'Karlovačka': ['Karlovac', 'Ogulin', 'Duga Resa', 'Slunj', 'Ozalj', 'Vojnić'],
  'Sisačko-moslavačka': ['Sisak', 'Petrinja', 'Kutina', 'Novska', 'Glina', 'Hrvatska Kostajnica'],
  'Zadarska': ['Zadar', 'Biograd na Moru', 'Benkovac', 'Obrovac', 'Nin', 'Pag'],
  'Šibensko-kninska': ['Šibenik', 'Knin', 'Drniš', 'Vodice', 'Skradin'],
  'Dubrovačko-neretvanska': ['Dubrovnik', 'Metković', 'Korčula', 'Ploče', 'Opuzen', 'Cavtat'],
  'Vukovarsko-srijemska': ['Vinkovci', 'Vukovar', 'Županja', 'Ilok', 'Otok'],
  'Brodsko-posavska': ['Slavonski Brod', 'Nova Gradiška', 'Okučani', 'Pleternica'],
  'Požeško-slavonska': ['Požega', 'Pakrac', 'Pleternica', 'Kutjevo'],
  'Virovitičko-podravska': ['Virovitica', 'Slatina', 'Orahovica', 'Pitomača'],
  'Koprivničko-križevačka': ['Koprivnica', 'Križevci', 'Đurđevac'],
  'Bjelovarsko-bilogorska': ['Bjelovar', 'Čazma', 'Daruvar', 'Garešnica', 'Grubišno Polje'],
  'Krapinsko-zagorska': ['Krapina', 'Zabok', 'Zlatar', 'Pregrada', 'Donja Stubica', 'Oroslavje'],
  'Međimurska': ['Čakovec', 'Prelog', 'Mursko Središće'],
  'Ličko-senjska': ['Gospić', 'Otočac', 'Senj', 'Novalja', 'Gračac'],
}

const STATE_OPTIONS = ['', ...Object.keys(CROATIAN_LOCATIONS).sort((a, b) => {
  if (a === 'Grad Zagreb') return -1
  if (b === 'Grad Zagreb') return 1
  return a.localeCompare(b, 'hr')
})]

export default function PropertyFilters({ filters, onFiltersChange, onReset, totalCount }) {
  const [expanded, setExpanded] = useState(false)
  const [searchValue, setSearchValue] = useState(filters.search ?? '')
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!filters.search) setSearchValue('')
  }, [filters.search])

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchValue(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ search: value })
    }, 300)
  }

  const handleSearchClear = () => {
    clearTimeout(debounceRef.current)
    setSearchValue('')
    onFiltersChange({ search: '' })
  }

  const handleStateChange = (e) => {
    const state = e.target.value
    onFiltersChange({ stateRegion: state, city: '' })
  }

  const handleSortChange = (e) => {
    const [sortBy, sortOrder] = e.target.value.split(':')
    onFiltersChange({ sortBy, sortOrder })
  }

  const currentSort = `${filters.sortBy}:${filters.sortOrder}`
  const selectedState = filters.stateRegion ?? ''
  const cityOptions = selectedState ? (CROATIAN_LOCATIONS[selectedState] ?? []) : []

  const hasActiveFilters =
    filters.search ||
    filters.propertyType ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minBedrooms ||
    filters.stateRegion ||
    filters.city

  return (
    <div className="space-y-4">
      {/* Search + sort bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Pretraži po nazivu ili lokaciji…"
            value={searchValue}
            onChange={handleSearchChange}
            className="input pl-9 pr-9"
          />
          {searchValue && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <select
          value={currentSort}
          onChange={handleSortChange}
          className="select w-auto min-w-[160px]"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setExpanded(!expanded)}
          className={cn('btn btn-secondary flex items-center gap-2', expanded && 'border-black')}
        >
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Filteri</span>
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          )}
        </button>
      </div>

      {/* Listing type toggle */}
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        {LISTING_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onFiltersChange({ listingType: opt.value })}
            className={cn(
              'px-5 py-2 text-xs font-medium rounded-md transition-all',
              (filters.listingType ?? '') === opt.value
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Extended filters */}
      {expanded && (
        <div className="border border-border rounded p-4 bg-gray-50 animate-slide-up space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Property type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Tip nekretnine</label>
              <select
                value={filters.propertyType ?? ''}
                onChange={(e) => onFiltersChange({ propertyType: e.target.value })}
                className="select"
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Min price */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Cijena od (€)</label>
              <input
                type="number"
                placeholder="0"
                value={filters.minPrice ?? ''}
                onChange={(e) =>
                  onFiltersChange({ minPrice: e.target.value ? Number(e.target.value) : null })
                }
                className="input"
                min={0}
              />
            </div>

            {/* Max price */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Cijena do (€)</label>
              <input
                type="number"
                placeholder="Bez ograničenja"
                value={filters.maxPrice ?? ''}
                onChange={(e) =>
                  onFiltersChange({ maxPrice: e.target.value ? Number(e.target.value) : null })
                }
                className="input"
                min={0}
              />
            </div>

            {/* Bedrooms */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Min soba</label>
              <div className="flex gap-1.5">
                {BEDROOM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value ?? 'all'}
                    onClick={() => onFiltersChange({ minBedrooms: opt.value })}
                    className={cn(
                      'flex-1 py-2 text-xs font-medium border rounded transition-colors',
                      filters.minBedrooms === opt.value
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-border hover:border-gray-500'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* State/region */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Županija</label>
              <select
                value={selectedState}
                onChange={handleStateChange}
                className="select"
              >
                <option value="">Sve županije</option>
                {STATE_OPTIONS.filter(Boolean).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Grad / naselje</label>
              <select
                value={filters.city ?? ''}
                onChange={(e) => onFiltersChange({ city: e.target.value })}
                disabled={!selectedState}
                className="select disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Svi gradovi</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="pt-3 border-t border-border flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {totalCount} {totalCount === 1 ? 'rezultat' : 'rezultata'}
              </span>
              <button onClick={onReset} className="text-xs text-gray-500 hover:text-black underline">
                Resetiraj filtere
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-gray-500">
        {totalCount} {totalCount === 1 ? 'nekretnina' : 'nekretnina'}
      </div>
    </div>
  )
}
