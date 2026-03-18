/**
 * Per-property 3D viewer configuration.
 * Keyed by property_id. Each entry defines camera presets and room navigation.
 *
 * Room definitions are model-driven:
 *  - `nodeNames`: GLTF node/group names to search for (first match wins).
 *    Leave empty [] when the model has no meaningful room-level nodes.
 *  - `volume`: fallback normalized 3D bounding volume
 *    [xMin, yMin, zMin, xMax, yMax, zMax] in 0–1 range relative to the
 *    model bounding box (used when no node match is found).
 *    y=0 → model bottom, y=1 → model top.
 *    Ground-floor rooms: yMin ≈ 0.02, yMax ≈ 0.48
 *    Upper-floor rooms:  yMin ≈ 0.52, yMax ≈ 0.93
 *  - `facing`: optional [dx, dz] unit vector in the XZ plane.
 *    Determines which face the camera is pulled toward
 *    (camera is placed 55 % of the half-span from center, looking inward).
 *    If omitted, the longer horizontal axis is used.
 *  - `pullFactor`: optional [0..0.9] factor controlling how far camera is
 *    pulled from room center toward the facing side in volume mode.
 *    Lower values keep camera more centered (e.g. 0.25–0.35).
 *  - `eyeHeight`: optional fraction of room height for camera Y (default 0.38,
 *    roughly 1.4 m in a 3.6 m room).
 *
 * Node-matched rooms (source = 'node') still support the legacy
 * `height` / `distance` / `yawBias` hints if needed.
 *
 * Overview camera is computed from scene bounds or optionally overridden.
 */

const PROPERTY_3D_CONFIGS = {
  // Vila s bazenom – Pula
  // Model: "Realistic House (With Interior)" by Blender Studio™ (CC BY 4.0)
  // Architectural model — no room-specific nodes; rooms resolved via volume fallback.
  // Key nodes: House_120, walls_94, walls.001_95, strop_93, roof_91, Stairs.003_92,
  //   Door.001–016, DoorFrame.001–015, Window.001–030, Plane.001–019, Cube.001–033
  'a1000000-0000-0000-0000-000000000008': {
    modelTransform: {
      scale: [1, 1, 1],
      rotation: [0, 0, 0],
    },
    overview: {
      position: [12, 10, 12],
      target: [0, 1, 0],
    },
    roomGroups: [
      {
        label: 'Dnevni boravak',
        rooms: [
          {
            label: 'Dnevni boravak',
            nodeNames: [],
            // Ground floor – center-right, front-facing zone
            volume: [0.35, 0.02, 0.5, 0.65, 0.48, 0.8],
            facing: [0, -1],   // camera near back wall, looks toward front
          },
        ],
      },
      {
        label: 'Kuhinja',
        rooms: [
          {
            label: 'Kuhinja',
            nodeNames: [],
            // Ground floor – left strip
            volume: [0.05, 0.02, 0.55, 0.35, 0.48, 0.85],
            facing: [1, 0],    // camera near left wall, looks right
          },
        ],
      },
      {
        label: 'Spavaće sobe',
        rooms: [
          {
            label: 'Spavaća soba 1',
            nodeNames: [],
            // Upper floor – right wing
            volume: [0.55, 0.52, 0.05, 0.9, 0.93, 0.4],
            // interiorY caps usable floor-to-ceiling band, excluding roof structure
            // above this storey (volume yMax 0.93 reaches into the roof ridge)
            interiorY: [0.52, 0.78],
            facing: [0, 1],    // camera near front wall, looks toward back
            pullFactor: 0.28,  // keep camera closer to room center
            eyeHeight: 0.24,   // lower eye level for upper-floor room
          },
          {
            label: 'Spavaća soba 2',
            nodeNames: [],
            // Upper floor – left wing
            volume: [0.1, 0.52, 0.05, 0.45, 0.93, 0.4],
            interiorY: [0.52, 0.78],
            facing: [0, 1],
            pullFactor: 0.28,
            eyeHeight: 0.24,
          },
        ],
      },
      {
        label: 'Kupaonice',
        rooms: [
          {
            label: 'Kupaonica 1',
            nodeNames: [],
            // Upper floor – small room, right side
            volume: [0.55, 0.52, 0.35, 0.8, 0.93, 0.52],
            interiorY: [0.52, 0.78],
            facing: [-1, 0],   // camera near right wall, looks left
            pullFactor: 0.25,  // bathrooms need stronger centering
            eyeHeight: 0.22,   // slightly lower eye level in compact rooms
          },
          {
            label: 'Kupaonica 2',
            nodeNames: [],
            // Upper floor – small room, left side
            volume: [0.1, 0.52, 0.35, 0.4, 0.93, 0.52],
            interiorY: [0.52, 0.78],
            facing: [1, 0],    // camera near left wall, looks right
            pullFactor: 0.25,
            eyeHeight: 0.22,
          },
        ],
      },
      {
        label: 'Stubište',
        rooms: [
          {
            label: 'Stubište',
            nodeNames: ['Stairs', 'stairs'],
            // Full-height central shaft
            volume: [0.4, 0.02, 0.4, 0.55, 0.93, 0.6],
            facing: [0, -1],
            eyeHeight: 0.2,    // low view looks up the staircase
          },
        ],
      },
    ],
  },
}

/**
 * Look up 3D viewer config for a specific property.
 * Returns null if no config exists for this property.
 */
export function getProperty3DConfig(propertyId) {
  return PROPERTY_3D_CONFIGS[propertyId] ?? null
}
