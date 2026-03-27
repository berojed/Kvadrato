import { Suspense, useEffect, useState, useRef, useCallback, Component } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { X, AlertCircle } from 'lucide-react'
import { useI18n } from '@/context/I18nContext'
import { getProperty3DRooms } from '@/services/model3dRooms'
import * as THREE from 'three'

// Use local Draco decoder instead of Google CDN
useGLTF.setDecoderPath('/draco/')

// ─── Constants ───
const TARGET_NORMALIZED_SIZE = 10 // Standardized model size for consistent camera behaviour

// ─── Error boundary ───
class ViewerErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err) {
    if (import.meta.env.DEV) console.error('[3DViewer] Render error:', err)
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

// ─── Model component with auto-centering and scale normalization ───
function Model({ url, onSceneReady }) {
  const { scene } = useGLTF(url, true)
  const reported = useRef(false)

  useEffect(() => {
    if (!scene || reported.current) return

    // Center model at origin
    const box = new THREE.Box3().setFromObject(scene)
    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)
    scene.position.sub(center)

    // Scale normalization — brings any model to a consistent bounding-box size
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0) {
      const scale = TARGET_NORMALIZED_SIZE / maxDim
      scene.scale.multiplyScalar(scale)
    }

    // Recompute bounds after scaling
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

// ─── Smooth camera animator ───
function CameraAnimator({ targetPosition, targetLookAt, controlsRef }) {
  const { camera } = useThree()
  const posVec = useRef(new THREE.Vector3())
  const lookVec = useRef(new THREE.Vector3())
  const isAnimating = useRef(false)
  const lerpSpeed = 0.07

  useEffect(() => {
    if (targetPosition && targetLookAt) {
      posVec.current.set(...targetPosition)
      lookVec.current.set(...targetLookAt)
      isAnimating.current = true
    }
  }, [targetPosition, targetLookAt])

  useFrame(() => {
    if (!isAnimating.current) return

    camera.position.lerp(posVec.current, lerpSpeed)
    const dist = camera.position.distanceTo(posVec.current)

    if (controlsRef.current) {
      const ct = controlsRef.current.target
      ct.lerp(lookVec.current, lerpSpeed)
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

// ─── Loading overlay ───
function LoadingOverlay() {
  const { t } = useI18n()
  return (
    <div className="absolute inset-0 flex items-center justify-center z-[1]">
      <div className="text-center">
        <div className="spinner mb-3" />
        <p className="text-sm text-gray-400">{t('errors.loadingModel')}</p>
      </div>
    </div>
  )
}

// ─── Error display ───
function ErrorDisplay({ onClose }) {
  const { t } = useI18n()
  return (
    <div className="absolute inset-0 flex items-center justify-center text-center p-8">
      <div>
        <AlertCircle size={40} className="mx-auto mb-4 text-gray-500" />
        <h3 className="text-base font-semibold text-white mb-2">
          {t('errors.modelLoadError')}
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          {t('errors.modelLoadErrorDesc')}
        </p>
        <button onClick={onClose} className="btn btn-secondary text-sm">
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}

// ─── Compute overview camera from bounding box using FOV-based fit ───
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

// ─── Interaction hint ───
function ViewerHint() {
  const { t } = useI18n()
  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-xs text-gray-500 pointer-events-none whitespace-nowrap">
      {t('errors.viewer3dHint')}
    </div>
  )
}

// ─── Room navigation bar (bottom of viewer) ───
function RoomBar({ rooms, activeRoomId, onRoomClick, onOverviewClick }) {
  const { t } = useI18n()
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent overflow-x-auto">
      <button
        onClick={onOverviewClick}
        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          activeRoomId === null
            ? 'bg-white text-black'
            : 'bg-white/20 text-white hover:bg-white/30'
        }`}
      >
        {t('viewer3d.overview')}
      </button>
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onRoomClick(room)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeRoomId === room.id
              ? 'bg-white text-black'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          {room.room_name}
        </button>
      ))}
    </div>
  )
}

// ─── Main modal ───
export default function Property3DViewerModal({ url, onClose, propertyId }) {
  const [loaded, setLoaded] = useState(false)
  const [cameraTarget, setCameraTarget] = useState(null)
  const [lookAtTarget, setLookAtTarget] = useState(null)
  const [sceneBounds, setSceneBounds] = useState(null)
  const [rooms, setRooms] = useState([])
  const [activeRoomId, setActiveRoomId] = useState(null)
  const controlsRef = useRef()

  const overview = computeOverview(sceneBounds)
  const initialCamera = overview.position
  const initialTarget = overview.target

  // Lazy-load room presets when modal opens
  useEffect(() => {
    if (!propertyId) return
    getProperty3DRooms(propertyId).then(({ data }) => {
      if (data?.length) setRooms(data)
    })
  }, [propertyId])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Set stable overview OrbitControls constraints
  useEffect(() => {
    if (!controlsRef.current) return
    const c = controlsRef.current
    const maxDim = sceneBounds?.maxDim ?? TARGET_NORMALIZED_SIZE
    c.minDistance = 0.5
    c.maxDistance = Math.max(maxDim * 3, 20)
    c.maxPolarAngle = Math.PI * 0.95
    c.minPolarAngle = 0.05
  }, [sceneBounds])

  // After model loads, animate to overview
  const handleSceneReady = useCallback(({ bounds }) => {
    setSceneBounds(bounds)
    if (import.meta.env.DEV) {
      console.log('[3DViewer] Scene ready — maxDim:', bounds.maxDim.toFixed(2))
    }
    const ov = computeOverview(bounds)
    setCameraTarget(ov.position)
    setLookAtTarget(ov.target)
  }, [])

  const handleRoomClick = useCallback((room) => {
    setActiveRoomId(room.id)
    setCameraTarget([room.position_x, room.position_y, room.position_z])
    setLookAtTarget([room.target_x, room.target_y, room.target_z])
  }, [])

  const handleOverviewClick = useCallback(() => {
    setActiveRoomId(null)
    if (sceneBounds) {
      const ov = computeOverview(sceneBounds)
      setCameraTarget(ov.position)
      setLookAtTarget(ov.target)
    }
  }, [sceneBounds])

  const hasRooms = rooms.length > 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Modal content */}
      <div className="relative w-full h-full md:w-[90vw] md:h-[85vh] md:max-w-5xl md:rounded-xl overflow-hidden bg-gray-950">
        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <X size={18} />
        </button>

        <ViewerErrorBoundary fallback={<ErrorDisplay onClose={onClose} />}>
          {!loaded && <LoadingOverlay />}
          <Suspense fallback={<LoadingOverlay />}>
            <Canvas
              camera={{ position: initialCamera, fov: 50, near: 0.1, far: 1000 }}
              style={{ width: '100%', height: '100%' }}
              onCreated={({ gl, camera }) => {
                gl.setClearColor('#0a0a0a')
                camera.lookAt(...initialTarget)
                setLoaded(true)
              }}
            >
              <ambientLight intensity={0.7} />
              <directionalLight position={[5, 8, 5]} intensity={1} />
              <directionalLight position={[-5, 5, -3]} intensity={0.4} />
              <hemisphereLight color="#ffffff" groundColor="#444444" intensity={0.3} />
              <Suspense fallback={null}>
                <Model url={url} onSceneReady={handleSceneReady} />
              </Suspense>
              <OrbitControls
                ref={controlsRef}
                target={initialTarget}
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                enableDamping={true}
                dampingFactor={0.08}
                minDistance={0.5}
                maxDistance={30}
              />
              <CameraAnimator
                targetPosition={cameraTarget}
                targetLookAt={lookAtTarget}
                controlsRef={controlsRef}
              />
            </Canvas>
          </Suspense>
        </ViewerErrorBoundary>

        {/* Interaction hint — shift up when room bar is visible */}
        {loaded && !hasRooms && <ViewerHint />}

        {/* Room navigation bar */}
        {loaded && hasRooms && (
          <RoomBar
            rooms={rooms}
            activeRoomId={activeRoomId}
            onRoomClick={handleRoomClick}
            onOverviewClick={handleOverviewClick}
          />
        )}
      </div>
    </div>
  )
}
