import { supabase } from '@/lib/supabase'

/**
 * Fetch all saved room presets for a property.
 * Returns rows ordered by created_at ascending.
 */
export async function getProperty3DRooms(propertyId) {
  if (!propertyId) return { data: [], error: null }

  const { data, error } = await supabase
    .from('property_3d_room')
    .select('id, room_name, position_x, position_y, position_z, target_x, target_y, target_z, camera_fov, created_at')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true })

  if (error && import.meta.env.DEV) {
    console.error('[model3dRooms] getProperty3DRooms error:', error.message)
  }

  return { data: data ?? [], error }
}

/**
 * Save (upsert) a single room preset.
 * Upserts on (property_id, room_name) — overwrites coordinates if room name already exists.
 */
export async function saveProperty3DRoom({
  propertyId,
  roomName,
  cameraPosition,
  cameraTarget,
  cameraFov = null,
}) {
  const name = roomName?.trim()
  if (!name) return { data: null, error: { message: 'Room name is required.' } }

  const [px, py, pz] = cameraPosition ?? []
  const [tx, ty, tz] = cameraTarget ?? []

  if (![px, py, pz, tx, ty, tz].every(Number.isFinite)) {
    return { data: null, error: { message: 'Invalid camera coordinates.' } }
  }

  if (cameraFov !== null && !Number.isFinite(cameraFov)) {
    return { data: null, error: { message: 'Invalid camera FOV.' } }
  }

  const row = {
    property_id: propertyId,
    room_name: name,
    position_x: px,
    position_y: py,
    position_z: pz,
    target_x: tx,
    target_y: ty,
    target_z: tz,
    camera_fov: cameraFov,
  }

  const { data, error } = await supabase
    .from('property_3d_room')
    .upsert(row, { onConflict: 'property_id,room_name' })
    .select()
    .single()

  if (error && import.meta.env.DEV) {
    console.error('[model3dRooms] saveProperty3DRoom error:', error.message)
  }

  return { data, error }
}

/**
 * Delete a single room preset by id.
 * Only succeeds if the calling user owns a listing for the associated property.
 */
export async function deleteProperty3DRoom(id) {
  if (!id) return { error: { message: 'Room id required.' } }

  const { error } = await supabase
    .from('property_3d_room')
    .delete()
    .eq('id', id)

  if (error && import.meta.env.DEV) {
    console.error('[model3dRooms] deleteProperty3DRoom error:', error.message)
  }

  return { error }
}

/**
 * Remove all room presets for a property.
 * Used when a 3D model is replaced or removed — saved cameras are
 * tied to the previous model geometry and must be invalidated.
 */
export async function clearProperty3DRooms(propertyId) {
  if (!propertyId) return { error: null }

  const { error } = await supabase
    .from('property_3d_room')
    .delete()
    .eq('property_id', propertyId)

  if (error && import.meta.env.DEV) {
    console.error('[model3dRooms] clearProperty3DRooms error:', error.message)
  }

  return { error }
}
