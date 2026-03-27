import { useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'
import { geocodeAddress } from '@/lib/geocoding'
import { useI18n } from '@/context/I18nContext'

// Fix Leaflet default marker icon (broken by bundlers)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const CROATIA_CENTER = [45.1, 16.0]
const DEFAULT_ZOOM = 7
const MARKER_ZOOM = 16

/**
 * Click handler — places marker on map click (interactive mode only).
 */
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

/**
 * Debounced geocoder — recenters map from address + city text.
 */
function GeocodeCenterer({ address, city }) {
  const map = useMap()
  const timerRef = useRef(null)
  const lastQueryRef = useRef('')

  useEffect(() => {
    const query = [address, city, 'Hrvatska'].filter(Boolean).join(', ')
    if (!query || query === 'Hrvatska' || query === lastQueryRef.current) return

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      lastQueryRef.current = query
      const result = await geocodeAddress(query)
      if (result) {
        map.setView([result.lat, result.lng], 15)
      }
    }, 1100)

    return () => clearTimeout(timerRef.current)
  }, [address, city, map])

  return null
}

/**
 * Draggable marker that emits new position on drag end.
 */
function DraggableMarker({ lat, lng, onDragEnd }) {
  const markerRef = useRef(null)
  const map = useMap()

  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15))
  }, [lat, lng, map])

  const handleDragEnd = useCallback(() => {
    const marker = markerRef.current
    if (marker) {
      const pos = marker.getLatLng()
      onDragEnd({ lat: pos.lat, lng: pos.lng })
    }
  }, [onDragEnd])

  return (
    <Marker
      position={[lat, lng]}
      draggable
      ref={markerRef}
      eventHandlers={{ dragend: handleDragEnd }}
    />
  )
}

/**
 * Static marker (read-only mode) — not draggable.
 */
function StaticMarker({ lat, lng }) {
  const map = useMap()

  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15))
  }, [lat, lng, map])

  return <Marker position={[lat, lng]} />
}

/**
 * One-time geocode centerer for read-only maps without saved coordinates.
 */
function ReadOnlyGeocoder({ address, city }) {
  const map = useMap()
  const didGeocode = useRef(false)

  useEffect(() => {
    if (didGeocode.current) return
    const query = [address, city, 'Hrvatska'].filter(Boolean).join(', ')
    if (!query || query === 'Hrvatska') return

    didGeocode.current = true
    geocodeAddress(query).then((result) => {
      if (result) map.setView([result.lat, result.lng], 15)
    })
  }, [address, city, map])

  return null
}

/**
 * Reusable map location picker / display component.
 *
 * Uses Leaflet + OpenStreetMap (free, no API key).
 *
 * Props:
 * - address (string) — street address for geocoding center
 * - city (string) — city for geocoding center
 * - latitude (number|null) — saved coordinate
 * - longitude (number|null) — saved coordinate
 * - onLocationSelect({ lat, lng }) — called on map click (interactive only)
 * - readOnly (boolean) — disables click-to-place, shows static marker
 * - height (string) — CSS height (default '288px')
 */
export default function PropertyLocationPicker({
  address,
  city,
  latitude,
  longitude,
  onLocationSelect,
  readOnly = false,
  height = '288px',
}) {
  const { t } = useI18n()
  const hasCoords = latitude != null && longitude != null
  const center = hasCoords ? [latitude, longitude] : CROATIA_CENTER
  const zoom = hasCoords ? MARKER_ZOOM : DEFAULT_ZOOM

  return (
    <div className="space-y-2">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full rounded-lg border border-border z-0"
        style={{ height }}
        scrollWheelZoom={!readOnly}
        dragging={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {readOnly ? (
          <>
            {hasCoords && <StaticMarker lat={latitude} lng={longitude} />}
            {!hasCoords && <ReadOnlyGeocoder address={address} city={city} />}
          </>
        ) : (
          <>
            <MapClickHandler onLocationSelect={onLocationSelect} />
            {/* Only geocode from text when no marker exists — avoids conflict
                with coordinates supplied by autocomplete or map click */}
            {!hasCoords && <GeocodeCenterer address={address} city={city} />}
            {hasCoords && (
              <DraggableMarker lat={latitude} lng={longitude} onDragEnd={onLocationSelect} />
            )}
          </>
        )}
      </MapContainer>

      {!readOnly && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <MapPin size={12} />
          {hasCoords ? (
            <span>{t('common.selectedLocation')}: {latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
          ) : (
            <span>{t('common.clickMapToSelect')}</span>
          )}
        </div>
      )}
    </div>
  )
}
