import { Suspense, useState, useEffect, useRef, useCallback, Component } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { ArrowLeft, Box, Save, Trash2, AlertCircle, Pencil } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { getSellerListingById } from '@/services/properties'
import {
  getProperty3DRooms,
  saveProperty3DRoom,
  deleteProperty3DRoom,
} from '@/services/model3dRooms'
import * as THREE from 'three'

useGLTF.setDecoderPath('/draco/')

const TARGET_NORMALIZED_SIZE = 10

// Class component: hooks cannot be used in error boundaries.
class ConfigViewerErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) {
    if (import.meta.env.DEV) console.error('[3DConfig] Viewer error:', err)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-950">
          <p className="text-white text-sm">3D viewer unavailable.</p>
        </div>
      )
    }
    return this.props.children
  }
}

// Same normalization pipeline as Property3DViewerModal.
function Model({ url, onSceneReady }) {
  const { scene } = useGLTF(url, true)
  const reported = useRef(false)

  useEffect(() => {
    if (!scene || reported.current) return

    const box = new THREE.Box3().setFromObject(scene)
    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)
    scene.position.sub(center)

    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0) scene.scale.multiplyScalar(TARGET_NORMALIZED_SIZE / maxDim)

    scene.updateMatrixWorld(true)
    const postBox = new THREE.Box3().setFromObject(scene)
    const postSize = new THREE.Vector3()
    postBox.getSize(postSize)

    reported.current = true
    onSceneReady?.({
      bounds: {
        size: [postSize.x, postSize.y, postSize.z],
        maxDim: Math.max(postSize.x, postSize.y, postSize.z),
      },
    })
  }, [scene, onSceneReady])

  return <primitive object={scene} />
}

function CameraAnimator({ targetPosition, targetLookAt, controlsRef }) {
  const { camera } = useThree()
  const posVec = useRef(new THREE.Vector3())
  const lookVec = useRef(new THREE.Vector3())
  const isAnimating = useRef(false)

  useEffect(() => {
    if (targetPosition && targetLookAt) {
      posVec.current.set(...targetPosition)
      lookVec.current.set(...targetLookAt)
      isAnimating.current = true
    }
  }, [targetPosition, targetLookAt])

  useFrame(() => {
    if (!isAnimating.current) return
    camera.position.lerp(posVec.current, 0.07)
    const dist = camera.position.distanceTo(posVec.current)
    if (controlsRef.current) {
      controlsRef.current.target.lerp(lookVec.current, 0.07)
      controlsRef.current.update()
    }
    if (dist < 0.02) {
      camera.position.copy(posVec.current)
      if (controlsRef.current) {
        controlsRef.current.target.copy(lookVec.current)
        controlsRef.current.update()
      }
      isAnimating.current = false
    }
  })

  return null
}

// Reads live camera position and OrbitControls target into a ref each frame.
// Lets React code outside the Canvas access the current pose without causing re-renders.
function CameraTracker({ poseRef, controlsRef }) {
  const { camera } = useThree()

  useFrame(() => {
    poseRef.current = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: controlsRef.current
        ? [
            controlsRef.current.target.x,
            controlsRef.current.target.y,
            controlsRef.current.target.z,
          ]
        : [0, 0, 0],
    }
  })

  return null
}

function computeOverview(bounds) {
  const maxDim = bounds?.maxDim ?? TARGET_NORMALIZED_SIZE
  const [sx, sy, sz] = bounds?.size ?? [maxDim, maxDim, maxDim]
  const target = [0, 0, 0]
  const fovRad = (50 * Math.PI) / 180
  const halfFov = fovRad / 2
  const extent = Math.max(sx, sy, sz)
  const distance = (extent / (2 * Math.tan(halfFov))) * 1.3
  const angle = Math.PI / 6
  const d = Math.max(distance, 4)
  const position = [
    d * Math.sin(Math.PI / 4) * Math.cos(angle),
    d * Math.sin(angle) + sy * 0.15,
    d * Math.cos(Math.PI / 4) * Math.cos(angle),
  ]
  return { position, target }
}

export default function Seller3DConfigPage() {
  const { id } = useParams() // listing id
  const { user } = useAuth()
  const { t } = useI18n()

  const [listing, setListing] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState(null)

  const [rooms, setRooms] = useState([])
  const [roomName, setRoomName] = useState('')
  const [editingRoomId, setEditingRoomId] = useState(null) // id of room being overwritten
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Viewer state
  const [sceneBounds, setSceneBounds] = useState(null)
  const [cameraTarget, setCameraTarget] = useState(null)
  const [lookAtTarget, setLookAtTarget] = useState(null)
  const [viewerLoaded, setViewerLoaded] = useState(false)
  const controlsRef = useRef()
  const poseRef = useRef({ position: [0, 0, 0], target: [0, 0, 0] })

  // Load listing on mount
  useEffect(() => {
    if (!user) return
    setPageLoading(true)
    getSellerListingById(id, user.id).then(({ data, error }) => {
      if (error || !data) {
        setPageError(error?.message || t('seller.listingNotFound'))
      } else {
        setListing(data)
      }
      setPageLoading(false)
    })
  }, [id, user])

  // Load saved rooms once listing is resolved
  useEffect(() => {
    if (!listing?.property?.property_id) return
    getProperty3DRooms(listing.property.property_id).then(({ data }) => {
      setRooms(data ?? [])
    })
  }, [listing])

  const handleSceneReady = useCallback(({ bounds }) => {
    setSceneBounds(bounds)
    const ov = computeOverview(bounds)
    setCameraTarget(ov.position)
    setLookAtTarget(ov.target)
  }, [])

  const handleGoToRoom = useCallback((room) => {
    setEditingRoomId(room.id)
    setRoomName(room.room_name)
    setCameraTarget([room.position_x, room.position_y, room.position_z])
    setLookAtTarget([room.target_x, room.target_y, room.target_z])
  }, [])

  const handleSave = async () => {
    const name = roomName.trim()
    if (!name) { setSaveError(t('viewer3d.roomNameRequired')); return }

    const pose = poseRef.current
    setSaving(true)
    setSaveError(null)

    const { data, error } = await saveProperty3DRoom({
      propertyId: listing.property.property_id,
      roomName: name,
      cameraPosition: pose.position,
      cameraTarget: pose.target,
    })

    setSaving(false)

    if (error) {
      setSaveError(error.message)
      return
    }

    // Update local list
    setRooms((prev) => {
      const existing = prev.findIndex((r) => r.room_name === name)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = data
        return updated
      }
      return [...prev, data]
    })
    setEditingRoomId(null)
    setRoomName('')
  }

  const handleDelete = async (roomId) => {
    if (!window.confirm(t('viewer3d.deleteRoomConfirm'))) return
    const { error } = await deleteProperty3DRoom(roomId)
    if (!error) {
      setRooms((prev) => prev.filter((r) => r.id !== roomId))
      if (editingRoomId === roomId) { setEditingRoomId(null); setRoomName('') }
    }
  }

  const handleOverview = useCallback(() => {
    if (!sceneBounds) return
    setEditingRoomId(null)
    setRoomName('')
    const ov = computeOverview(sceneBounds)
    setCameraTarget(ov.position)
    setLookAtTarget(ov.target)
  }, [sceneBounds])

  // ── Render states ──
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    )
  }

  if (pageError || !listing) {
    return (
      <div className="container py-20 text-center">
        <h2 className="text-xl font-semibold mb-2">{t('seller.listingNotFound')}</h2>
        <p className="text-gray-500 mb-6 text-sm">{pageError || ''}</p>
        <Link to="/seller/dashboard" className="btn btn-secondary">← {t('seller.backToListings')}</Link>
      </div>
    )
  }

  const prop = listing.property ?? {}
  const modelUrl = prop.model3dUrl

  if (!modelUrl) {
    return (
      <div className="container py-20 text-center">
        <Box size={40} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold mb-2">{t('viewer3d.noModel')}</h2>
        <p className="text-gray-500 mb-6 text-sm">{t('viewer3d.noModelHint')}</p>
        <Link to={`/seller/edit/${id}`} className="btn btn-secondary">
          {t('seller.editListing')}
        </Link>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <Link
        to={`/my_properties/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        {t('seller.backToListings')}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">{t('viewer3d.configTitle')}</h1>
        <p className="text-sm text-gray-500">{prop.title}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-gray-950">
            {!viewerLoaded && (
              <div className="absolute inset-0 flex items-center justify-center z-[1]">
                <div className="text-center">
                  <div className="spinner mb-3" />
                  <p className="text-sm text-gray-400">{t('errors.loadingModel')}</p>
                </div>
              </div>
            )}
            <ConfigViewerErrorBoundary>
              <Suspense fallback={null}>
                <Canvas
                  camera={{ position: computeOverview(null).position, fov: 50, near: 0.1, far: 1000 }}
                  style={{ width: '100%', height: '100%' }}
                  onCreated={({ gl }) => {
                    gl.setClearColor('#0a0a0a')
                    setViewerLoaded(true)
                  }}
                >
                  <ambientLight intensity={0.7} />
                  <directionalLight position={[5, 8, 5]} intensity={1} />
                  <directionalLight position={[-5, 5, -3]} intensity={0.4} />
                  <hemisphereLight color="#ffffff" groundColor="#444444" intensity={0.3} />
                  <Suspense fallback={null}>
                    <Model url={modelUrl} onSceneReady={handleSceneReady} />
                  </Suspense>
                  <OrbitControls
                    ref={controlsRef}
                    target={[0, 0, 0]}
                    enablePan
                    enableZoom
                    enableRotate
                    enableDamping
                    dampingFactor={0.08}
                    minDistance={0.5}
                    maxDistance={Math.max((sceneBounds?.maxDim ?? TARGET_NORMALIZED_SIZE) * 3, 20)}
                    maxPolarAngle={Math.PI * 0.95}
                    minPolarAngle={0.05}
                  />
                  <CameraAnimator
                    targetPosition={cameraTarget}
                    targetLookAt={lookAtTarget}
                    controlsRef={controlsRef}
                  />
                  <CameraTracker poseRef={poseRef} controlsRef={controlsRef} />
                </Canvas>
              </Suspense>
            </ConfigViewerErrorBoundary>
            {viewerLoaded && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-500 pointer-events-none whitespace-nowrap">
                {t('errors.viewer3dHint')}
              </div>
            )}
          </div>

          {viewerLoaded && (
            <button onClick={handleOverview} className="mt-3 btn btn-secondary text-xs">
              {t('viewer3d.overview')}
            </button>
          )}
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">
              {editingRoomId ? t('viewer3d.editRoom') : t('viewer3d.saveCurrentCamera')}
            </h3>
            <p className="text-xs text-gray-500 mb-3">{t('viewer3d.saveInstruction')}</p>
            <input
              type="text"
              className="input mb-3"
              placeholder={t('viewer3d.roomNamePlaceholder')}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            />
            {saveError && (
              <p className="text-xs text-red-600 mb-2">{saveError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !roomName.trim()}
                className="btn btn-primary text-xs flex items-center gap-1.5 flex-1"
              >
                <Save size={12} />
                {saving ? t('common.saving') : t('viewer3d.saveCamera')}
              </button>
              {editingRoomId && (
                <button
                  onClick={() => { setEditingRoomId(null); setRoomName('') }}
                  className="btn btn-secondary text-xs"
                >
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">{t('viewer3d.savedRooms')}</h3>
            {rooms.length === 0 ? (
              <p className="text-xs text-gray-400">{t('viewer3d.noRooms')}</p>
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-sm transition-colors cursor-pointer ${
                      editingRoomId === room.id
                        ? 'border-black bg-gray-50 dark:border-white dark:bg-gray-800'
                        : 'border-border hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => handleGoToRoom(room)}
                  >
                    <span className="font-medium truncate">{room.room_name}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGoToRoom(room) }}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={t('common.edit')}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(room.id) }}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border p-4 text-xs text-gray-500 space-y-1.5">
            <div className="flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-amber-500" />
              <p>{t('viewer3d.replacedModelWarning')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
