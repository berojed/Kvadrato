/**
 * Per-property 3D viewer configuration — COMPATIBILITY FALLBACK ONLY.
 *
 * The standardized viewer path (Property3DViewerModal) auto-centers, normalizes
 * scale, derives overview camera from bounding box, and attempts room detection
 * from GLTF node names. This file only applies when a property has a specific
 * config entry — new models should NOT need one.
 *
 * When `getProperty3DConfig(propertyId)` returns null, the viewer runs in
 * fully standardized mode. When it returns a config, the viewer uses it as-is
 * (legacy compatibility path) with no scale normalization.
 *
 * ─── Room definition contract ───
 *  - `nodeNames`: GLTF node/group names to search for (first match wins)
 *  - `volume`: normalised [xMin, yMin, zMin, xMax, yMax, zMax] bounding volume
 *    in 0–1 range relative to model bounding box (fallback when no node matches)
 *  - `interiorY`: optional [yMin, yMax] (0–1) overriding usable floor-to-ceiling Y
 *  - `facing`: optional [dx, dz] pull direction
 *  - `pullFactor`: 0..0.9 camera pull toward facing side (default 0.55)
 *  - `eyeHeight`: fraction of interior height for camera Y (default 0.38)
 */

const PROPERTY_3D_CONFIGS = {
  // ─── Vila s bazenom – Pula ─────────────────────────────────────────────────
  // Model: "Realistic House (With Interior)" by Blender Studio™ (CC BY 4.0)
  // Architectural model with no room-specific nodes — rooms resolved via volume.
  // This entry exists only because the model predates the standardized viewer.
  'a1000000-0000-0000-0000-000000000008': {
    modelTransform: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    overview: { position: [12, 10, 12], target: [0, 1, 0] },
    roomGroups: [
      {
        label: 'Dnevni boravak',
        rooms: [{
          label: 'Dnevni boravak',
          nodeNames: [],
          volume: [0.35, 0.02, 0.5, 0.65, 0.48, 0.8],
          facing: [0, -1],
        }],
      },
      {
        label: 'Kuhinja',
        rooms: [{
          label: 'Kuhinja',
          nodeNames: [],
          volume: [0.05, 0.02, 0.55, 0.35, 0.48, 0.85],
          facing: [1, 0],
        }],
      },
      {
        label: 'Spavaće sobe',
        rooms: [
          {
            label: 'Spavaća soba 1', nodeNames: [],
            volume: [0.55, 0.52, 0.05, 0.9, 0.93, 0.4],
            interiorY: [0.52, 0.78], facing: [0, 1],
            pullFactor: 0.28, eyeHeight: 0.24,
          },
          {
            label: 'Spavaća soba 2', nodeNames: [],
            volume: [0.1, 0.52, 0.05, 0.45, 0.93, 0.4],
            interiorY: [0.52, 0.78], facing: [0, 1],
            pullFactor: 0.28, eyeHeight: 0.24,
          },
        ],
      },
      {
        label: 'Kupaonice',
        rooms: [
          {
            label: 'Kupaonica 1', nodeNames: [],
            volume: [0.55, 0.52, 0.35, 0.8, 0.93, 0.52],
            interiorY: [0.52, 0.78], facing: [-1, 0],
            pullFactor: 0.25, eyeHeight: 0.22,
          },
          {
            label: 'Kupaonica 2', nodeNames: [],
            volume: [0.1, 0.52, 0.35, 0.4, 0.93, 0.52],
            interiorY: [0.52, 0.78], facing: [1, 0],
            pullFactor: 0.25, eyeHeight: 0.22,
          },
        ],
      },
      {
        label: 'Stubište',
        rooms: [{
          label: 'Stubište',
          nodeNames: ['Stairs', 'stairs'],
          volume: [0.4, 0.02, 0.4, 0.55, 0.93, 0.6],
          facing: [0, -1], eyeHeight: 0.2,
        }],
      },
    ],
  },
}

/**
 * Look up 3D viewer config for a specific property.
 * Returns null if no legacy config exists — the viewer then uses
 * the standardized auto-detection path.
 */
export function getProperty3DConfig(propertyId) {
  return PROPERTY_3D_CONFIGS[propertyId] ?? null
}
