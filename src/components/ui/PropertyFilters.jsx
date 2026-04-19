import { Search, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/context/I18nContext'
import { CROATIAN_LOCATIONS, STATE_OPTIONS } from '@/lib/croatianLocations'

/* ── Search + Sort top bar (rendered separately in PropertiesPage) ── */
export function PropertySearchBar({ filters, onFiltersChange }) {
  const { t } = useI18n()
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

  const handleSortChange = (e) => {
    const [sortBy, sortOrder] = e.target.value.split(':')
    onFiltersChange({ sortBy, sortOrder })
  }

  const currentSort = `${filters.sortBy}:${filters.sortOrder}`

  const sortOptions = [
    { value: 'date_listed:desc', label: t('filters.sortNewest') },
    { value: 'date_listed:asc', label: t('filters.sortOldest') },
    { value: 'price_amount:asc', label: t('filters.sortPriceAsc') },
    { value: 'price_amount:desc', label: t('filters.sortPriceDesc') },
  ]

  return (
    <div className="flex gap-3">
      <div className="flex-1 relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={t('property.searchPlaceholder')}
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
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ── Sidebar filters (always visible) ── */
export default function PropertyFilters({ filters, onFiltersChange, onReset, totalCount }) {
  const { t } = useI18n()

  const propertyTypes = [
    { value: '', label: t('filters.allTypes') },
    { value: 'Stan', label: 'Stan' },
    { value: 'Kuća', label: 'Kuća' },
    { value: 'Poslovni prostor', label: 'Poslovni prostor' },
  ]

  const listingTypeOptions = [
    { value: '', label: t('common.all') },
    { value: 'SALE', label: t('common.sale') },
    { value: 'RENT', label: t('common.rent') },
  ]

  const bedroomOptions = [
    { value: null, label: t('common.all') },
    { value: 1, label: '1+' },
    { value: 2, label: '2+' },
    { value: 3, label: '3+' },
    { value: 4, label: '4+' },
  ]

  const bathroomOptions = [
    { value: null, label: t('common.all') },
    { value: 1, label: '1+' },
    { value: 2, label: '2+' },
    { value: 3, label: '3+' },
  ]

  const handleStateChange = (e) => {
    const state = e.target.value
    onFiltersChange({ stateRegion: state, city: '' })
  }

  const selectedState = filters.stateRegion ?? ''
  const cityOptions = selectedState ? (CROATIAN_LOCATIONS[selectedState] ?? []) : []

  const hasActiveFilters =
    filters.propertyType ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minBedrooms ||
    filters.minBathrooms ||
    filters.minSize ||
    filters.maxSize ||
    filters.stateRegion ||
    filters.city ||
    filters.listingType

  return (
    <div className="space-y-6">
      {/* Listing type toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filters.listingType')}</label>
        <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 w-full">
          {listingTypeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFiltersChange({ listingType: opt.value })}
              className={cn(
                'flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all',
                (filters.listingType ?? '') === opt.value
                  ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Property type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filters.propertyType')}</label>
        <select
          value={filters.propertyType ?? ''}
          onChange={(e) => onFiltersChange({ propertyType: e.target.value })}
          className="select"
        >
          {propertyTypes.map((pt) => (
            <option key={pt.value} value={pt.value}>
              {pt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Price range */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filters.price')}</label>
        <div className="space-y-2">
          <input
            type="number"
            placeholder={t('filters.from')}
            value={filters.minPrice ?? ''}
            onChange={(e) =>
              onFiltersChange({ minPrice: e.target.value ? Number(e.target.value) : null })
            }
            className="input"
            min={0}
          />
          <input
            type="number"
            placeholder={t('filters.to')}
            value={filters.maxPrice ?? ''}
            onChange={(e) =>
              onFiltersChange({ maxPrice: e.target.value ? Number(e.target.value) : null })
            }
            className="input"
            min={0}
          />
        </div>
      </div>

      {/* Bedrooms */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filters.minBedrooms')}</label>
        <div className="flex gap-1.5">
          {bedroomOptions.map((opt) => (
            <button
              key={opt.value ?? 'all'}
              onClick={() => onFiltersChange({ minBedrooms: opt.value })}
              className={cn(
                'flex-1 py-2 text-xs font-medium border rounded transition-colors',
                filters.minBedrooms === opt.value
                  ? 'bg-black text-white border-black'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-border hover:border-gray-500'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bathrooms */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filters.minBathrooms')}</label>
        <div className="flex gap-1.5">
          {bathroomOptions.map((opt) => (
            <button
              key={opt.value ?? 'all'}
              onClick={() => onFiltersChange({ minBathrooms: opt.value })}
              className={cn(
                'flex-1 py-2 text-xs font-medium border rounded transition-colors',
                filters.minBathrooms === opt.value
                  ? 'bg-black text-white border-black'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-border hover:border-gray-500'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Property size */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filters.area')}</label>
        <div className="space-y-2">
          <input
            type="number"
            placeholder={t('filters.from')}
            value={filters.minSize ?? ''}
            onChange={(e) =>
              onFiltersChange({ minSize: e.target.value ? Number(e.target.value) : null })
            }
            className="input"
            min={0}
          />
          <input
            type="number"
            placeholder={t('filters.to')}
            value={filters.maxSize ?? ''}
            onChange={(e) =>
              onFiltersChange({ maxSize: e.target.value ? Number(e.target.value) : null })
            }
            className="input"
            min={0}
          />
        </div>
      </div>

      {/* Location — State */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filters.county')}</label>
        <select
          value={selectedState}
          onChange={handleStateChange}
          className="select"
        >
          <option value="">{t('filters.allCounties')}</option>
          {STATE_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Location — City */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filters.city')}</label>
        <select
          value={filters.city ?? ''}
          onChange={(e) => onFiltersChange({ city: e.target.value })}
          disabled={!selectedState}
          className="select disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="">{t('filters.allCities')}</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Results + reset */}
      <div className="pt-4 border-t border-border space-y-3">
        <div className="text-xs text-gray-500">
          {t('filters.resultsCount', { count: totalCount })}
        </div>
        {hasActiveFilters && (
          <button onClick={onReset} className="text-xs text-gray-500 hover:text-black dark:hover:text-white underline">
            {t('property.resetFilters')}
          </button>
        )}
      </div>
    </div>
  )
}
