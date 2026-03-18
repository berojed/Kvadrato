import { Suspense, useEffect, useState, useRef, useCallback, Component } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { X, AlertCircle, ChevronUp, ChevronDown, Home } from 'lucide-react'
import * as THREE from 'three'
import { getProperty3DConfig } from '@/lib/property3dConfig'

// Use local Draco decoder instead of Google CDN
useGLTF.setDecoderPath('/draco/')

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

// ─── Build searchable node index from GLTF scene ───
function buildNodeIndex(scene) {
  const index = new Map() // name → { center, size, radius }
  const tmpBox = new THREE.Box3()
  const tmpCenter = new THREE.Vector3()
  const tmpSize = new THREE.Vector3()

  scene.traverse((obj) => {
    if (!obj.name || obj.name === 'Scene' || obj.name === 'Root') return
    // Only index meshes and groups with geometry
    if (!obj.isMesh && !obj.isGroup) return

    tmpBox.setFromObject(obj)
    if (tmpBox.isEmpty()) return

    tmpBox.getCenter(tmpCenter)
    tmpBox.getSize(tmpSize)
    const radius = Math.max(tmpSize.x, tmpSize.z) * 0.5

    // Store with lowercase key for case-insensitive matching
    const key = obj.name.toLowerCase()
    // Keep the largest bounding box if duplicate names exist
    if (!index.has(key) || radius > index.get(key).radius) {
      index.set(key, {
        center: [tmpCenter.x, tmpCenter.y, tmpCenter.z],
        size: [tmpSize.x, tmpSize.y, tmpSize.z],
        radius,
      })
    }
  })

  return index
}

// ─── Resolve camera position and target for a room ───
// Priority: 1) GLTF node match  2) 3D volume  3) legacy 2D zone
function resolveRoomCamera(room, nodeIndex, modelBounds) {
  // Strategy 1: match configured node names against the scene index
  if (room.nodeNames?.length && nodeIndex.size > 0) {
    let entry = null
    for (const name of room.nodeNames) {
      entry = nodeIndex.get(name.toLowerCase())
      if (entry) break
    }
    if (!entry) {
      // Partial/substring match as second pass
      outer: for (const name of room.nodeNames) {
        const lower = name.toLowerCase()
        for (const [key, e] of nodeIndex) {
          if (key.includes(lower) || lower.includes(key)) { entry = e; break outer }
        }
      }
    }
    if (entry) {
      const [cx, cy, cz] = entry.center
      const height = room.height ?? 1.6
      const distance = room.distance ?? 1.2
      const yaw = room.yawBias ?? 0
      return {
        position: [cx + Math.sin(yaw) * distance, cy + height, cz + Math.cos(yaw) * distance],
        target: [cx, cy + height * 0.6, cz],
        radius: Math.max(entry.radius, 0.5),
        source: 'node',
      }
    }
  }

  if (!modelBounds) return null
  const [sx, sy, sz] = modelBounds.size
  const halfX = sx * 0.5, halfY = sy * 0.5, halfZ = sz * 0.5

  // Strategy 2: 3D volume — normalized [xMin, yMin, zMin, xMax, yMax, zMax]
  if (room.volume) {
    const [vxMin, vyMin, vzMin, vxMax, vyMax, vzMax] = room.volume
    // X/Z come from the room footprint volume
    const wxMin = -halfX + vxMin * sx,  wxMax = -halfX + vxMax * sx
    const wzMin = -halfZ + vzMin * sz,  wzMax = -halfZ + vzMax * sz

    const cx = (wxMin + wxMax) * 0.5
    const cz = (wzMin + wzMax) * 0.5
    const roomW = wxMax - wxMin
    const roomD = wzMax - wzMin

    // Y comes from a dedicated interior band when provided.
    // `interiorY` decouples usable floor-to-ceiling height from the coarser
    // volume bounds, which may include roof/structural space above the room.
    // Falls back to the volume's own Y range when not specified.
    const [iyMin, iyMax] = room.interiorY ?? [vyMin, vyMax]
    const wiyMin = -halfY + iyMin * sy
    const wiyMax = -halfY + iyMax * sy
    const interiorH = wiyMax - wiyMin

    // Eye level: configurable fraction of interior height from floor (default ≈ 38 %)
    const rawEyeY = wiyMin + interiorH * (room.eyeHeight ?? 0.38)
    // Clamp to the usable interior band as a safety net
    const eyeY = Math.max(wiyMin, Math.min(wiyMax, rawEyeY))

    // Pull camera toward one face of the room using facing hint or longest axis
    let dx = 0, dz = 0
    if (room.facing) {
      ;[dx, dz] = room.facing
    } else if (roomD >= roomW) {
      dz = -1
    } else {
      dx = 1
    }

    // Place camera inside the room volume.
    // `pullFactor` controls how far from center toward the facing wall:
    // 0 = exact center, 0.55 = near wall (default legacy behavior).
    const halfW = roomW * 0.5
    const halfD = roomD * 0.5
    const pullFactor = Math.max(0, Math.min(room.pullFactor ?? 0.55, 0.9))
    const pullDist = (Math.abs(dx) >= Math.abs(dz) ? halfW : halfD) * pullFactor

    return {
      position: [cx + dx * pullDist, eyeY, cz + dz * pullDist],
      target: [cx, eyeY, cz],
      radius: Math.max(halfW, halfD),
      source: 'volume',
    }
  }

  // Strategy 3: legacy 2D zone — normalized [xMin, zMin, xMax, zMax]
  if (room.zone) {
    const [xMin, zMin, xMax, zMax] = room.zone
    const worldXMin = -halfX + xMin * sx,  worldXMax = -halfX + xMax * sx
    const worldZMin = -halfZ + zMin * sz,  worldZMax = -halfZ + zMax * sz
    const cx = (worldXMin + worldXMax) * 0.5
    const cz = (worldZMin + worldZMax) * 0.5
    const cy = -halfY + sy * 0.3
    const height = room.height ?? 1.6
    const distance = room.distance ?? 1.2
    const yaw = room.yawBias ?? 0
    const radius = Math.max((worldXMax - worldXMin) * 0.5, (worldZMax - worldZMin) * 0.5, 0.5)
    return {
      position: [cx + Math.sin(yaw) * distance, cy + height, cz + Math.cos(yaw) * distance],
      target: [cx, cy + height * 0.6, cz],
      radius,
      source: 'zone',
    }
  }

  return null
}

// ─── Model component with auto-centering and scene analysis ───
function Model({ url, transform, onSceneReady }) {
  // Second arg enables Draco decoder (uses Google CDN)
  const { scene } = useGLTF(url, true)
  const reported = useRef(false)

  const s = transform?.scale ?? [1, 1, 1]
  const r = transform?.rotation ?? [0, 0, 0]

  useEffect(() => {
    if (!scene || reported.current) return

    // Build node index BEFORE centering (names are preserved, positions shift)
    // We'll rebuild after centering for accurate world positions

    // Compute bounding box and center model at origin
    const box = new THREE.Box3().setFromObject(scene)
    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)

    scene.position.sub(center)

    // Now rebuild node index with corrected positions (post-centering)
    // Force a matrix update so bounding boxes reflect the new position
    scene.updateMatrixWorld(true)
    const nodeIndex = buildNodeIndex(scene)

    reported.current = true
    onSceneReady?.({
      bounds: {
        size: [size.x, size.y, size.z],
        maxDim: Math.max(size.x, size.y, size.z),
      },
      nodeIndex,
    })
  }, [scene, onSceneReady])

  return (
    <primitive
      object={scene}
      scale={s}
      rotation={r}
    />
  )
}

// ─── Smooth camera animator ───
function CameraAnimator({ targetPosition, targetLookAt, controlsRef, speed }) {
  const { camera } = useThree()
  const posVec = useRef(new THREE.Vector3())
  const lookVec = useRef(new THREE.Vector3())
  const isAnimating = useRef(false)
  const lerpSpeed = speed ?? 0.07

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
  return (
    <div className="absolute inset-0 flex items-center justify-center z-[1]">
      <div className="text-center">
        <div className="spinner mb-3" />
        <p className="text-sm text-gray-400">Učitavanje 3D modela…</p>
      </div>
    </div>
  )
}

// ─── Error display ───
function ErrorDisplay({ onClose }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-center p-8">
      <div>
        <AlertCircle size={40} className="mx-auto mb-4 text-gray-500" />
        <h3 className="text-base font-semibold text-white mb-2">
          Greška pri učitavanju modela
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          3D model nije moguće prikazati. Provjerite povezanost.
        </p>
        <button onClick={onClose} className="btn btn-secondary text-sm">
          Zatvori
        </button>
      </div>
    </div>
  )
}

// ─── Room navigation panel ───
function RoomPanel({ config, onRoomSelect, onReset, activeRoom }) {
  const [expanded, setExpanded] = useState(true)
  const [openGroup, setOpenGroup] = useState(null)

  if (!config?.roomGroups?.length) return null

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-2xl px-3 pb-3">
        {/* Toggle button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mx-auto mb-1 flex items-center gap-1 px-3 py-1 rounded-t-lg bg-black/60 backdrop-blur text-xs text-gray-300 hover:text-white transition-colors"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          {expanded ? 'Sakrij prostorije' : 'Prostorije'}
        </button>

        {expanded && (
          <div className="bg-black/60 backdrop-blur rounded-xl p-2 space-y-1">
            {/* Reset / overview button */}
            <button
              onClick={onReset}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                !activeRoom
                  ? 'bg-white/15 text-white'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Home size={12} />
              Pregled cijele nekretnine
            </button>

            {/* Room groups */}
            {config.roomGroups.map((group, gi) => {
              const isSingle = group.rooms.length === 1
              const isOpen = openGroup === gi

              if (isSingle) {
                const room = group.rooms[0]
                const isActive = activeRoom === `${gi}-0`
                return (
                  <button
                    key={gi}
                    onClick={() => onRoomSelect(room, `${gi}-0`)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {group.label}
                  </button>
                )
              }

              return (
                <div key={gi}>
                  <button
                    onClick={() => setOpenGroup(isOpen ? null : gi)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <span>{group.label}</span>
                    {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                  {isOpen && (
                    <div className="ml-3 space-y-0.5 mt-0.5">
                      {group.rooms.map((room, ri) => {
                        const key = `${gi}-${ri}`
                        const isActive = activeRoom === key
                        return (
                          <button
                            key={ri}
                            onClick={() => onRoomSelect(room, key)}
                            className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                              isActive
                                ? 'bg-white/15 text-white'
                                : 'text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {room.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Compute default overview camera from scene bounds ───
function computeOverview(maxDim) {
  const d = Math.max(maxDim * 1.2, 4)
  return {
    position: [d, d * 0.8, d],
    target: [0, 0, 0],
  }
}

// ─── Main modal ───
export default function Property3DViewerModal({ url, propertyId, onClose }) {
  const [loaded, setLoaded] = useState(false)
  const [cameraTarget, setCameraTarget] = useState(null)
  const [lookAtTarget, setLookAtTarget] = useState(null)
  const [activeRoom, setActiveRoom] = useState(null)
  const [isRoomMode, setIsRoomMode] = useState(false)
  const [sceneBounds, setSceneBounds] = useState(null)
  const [roomRadius, setRoomRadius] = useState(1)
  const nodeIndexRef = useRef(null)
  const controlsRef = useRef()

  const config = propertyId ? getProperty3DConfig(propertyId) : null

  // Derive overview camera: use config override or compute from bounds
  const overview = config?.overview ?? computeOverview(sceneBounds?.maxDim ?? 6)

  // Initial camera before bounds are known (will animate to overview after load)
  const initialCamera = overview.position
  const initialTarget = overview.target

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

  // Update OrbitControls constraints based on mode and room size
  useEffect(() => {
    if (!controlsRef.current) return
    const c = controlsRef.current
    if (isRoomMode) {
      // Room-relative constraints: tighter for smaller rooms
      const r = Math.max(roomRadius, 0.5)
      c.minDistance = 0.15
      c.maxDistance = r * 3
      c.maxPolarAngle = Math.PI * 0.78
      c.minPolarAngle = Math.PI * 0.12
    } else {
      c.minDistance = 0.5
      c.maxDistance = Math.max((sceneBounds?.maxDim ?? 6) * 3, 20)
      c.maxPolarAngle = Math.PI * 0.95
      c.minPolarAngle = 0.05
    }
  }, [isRoomMode, sceneBounds, roomRadius])

  // After model loads, store scene analysis and animate to overview
  const handleSceneReady = useCallback(({ bounds, nodeIndex }) => {
    setSceneBounds(bounds)
    nodeIndexRef.current = nodeIndex

    if (import.meta.env.DEV) {
      console.log('[3DViewer] Scene ready — nodes:', nodeIndex.size, 'maxDim:', bounds.maxDim.toFixed(2))
      if (nodeIndex.size > 0) {
        console.log('[3DViewer] Node names:', [...nodeIndex.keys()].join(', '))
      }
    }

    const ov = config?.overview ?? computeOverview(bounds.maxDim)
    setCameraTarget(ov.position)
    setLookAtTarget(ov.target)
  }, [config])

  const handleRoomSelect = (room, key) => {
    if (!sceneBounds) return

    const cam = resolveRoomCamera(room, nodeIndexRef.current ?? new Map(), sceneBounds)

    if (!cam) {
      if (import.meta.env.DEV) console.warn('[3DViewer] Could not resolve room:', room.label)
      return
    }

    if (import.meta.env.DEV) {
      console.log('[3DViewer] Room resolved:', room.label, '→', cam.source, cam.position.map(v => v.toFixed(2)))
    }

    setCameraTarget(cam.position)
    setLookAtTarget(cam.target)
    setRoomRadius(cam.radius)
    setActiveRoom(key)
    setIsRoomMode(true)
  }

  const handleReset = () => {
    setCameraTarget(overview.position)
    setLookAtTarget(overview.target)
    setActiveRoom(null)
    setIsRoomMode(false)
  }

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
              camera={{ position: initialCamera, fov: 50 }}
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
              <hemisphereLight
                color="#ffffff"
                groundColor="#444444"
                intensity={0.3}
              />
              <Suspense fallback={null}>
                <Model
                  url={url}
                  transform={config?.modelTransform}
                  onSceneReady={handleSceneReady}
                />
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
                speed={isRoomMode ? 0.055 : 0.07}
              />
            </Canvas>
          </Suspense>
        </ViewerErrorBoundary>

        {/* Room navigation panel */}
        {loaded && config && (
          <RoomPanel
            config={config}
            onRoomSelect={handleRoomSelect}
            onReset={handleReset}
            activeRoom={activeRoom}
          />
        )}

        {/* Hint - only when no room panel */}
        {loaded && !config && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-500 pointer-events-none">
            Kliknite i povucite za rotiranje · Scroll za zoom · Desni klik za pomicanje
          </div>
        )}
      </div>
    </div>
  )
}
