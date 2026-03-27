-- Create property_3d_room table for seller-defined named camera presets
-- Each row stores one named view (position + look-at target) for a 3D model.

create table if not exists property_3d_room (
  id            uuid           primary key default gen_random_uuid(),
  property_id   uuid           not null references property(property_id) on delete cascade,
  room_name     text           not null,
  position_x    double precision not null,
  position_y    double precision not null,
  position_z    double precision not null,
  target_x      double precision not null,
  target_y      double precision not null,
  target_z      double precision not null,
  camera_fov    double precision null,
  created_at    timestamptz    default now()
);

-- Unique room name per property
create unique index if not exists property_3d_room_property_name_idx
  on property_3d_room(property_id, room_name);

-- Fast lookup by property
create index if not exists property_3d_room_property_idx
  on property_3d_room(property_id);

-- Enable RLS
alter table property_3d_room enable row level security;

-- Public read — any visitor can load room presets for any property
create policy "property_3d_room_select_public"
  on property_3d_room for select
  using (true);

-- Seller insert — only the seller who owns a listing for this property
create policy "property_3d_room_insert_seller"
  on property_3d_room for insert
  with check (
    exists (
      select 1 from listing
      where listing.property_id = property_3d_room.property_id
        and listing.seller_id = auth.uid()
    )
  );

-- Seller update
create policy "property_3d_room_update_seller"
  on property_3d_room for update
  using (
    exists (
      select 1 from listing
      where listing.property_id = property_3d_room.property_id
        and listing.seller_id = auth.uid()
    )
  );

-- Seller delete
create policy "property_3d_room_delete_seller"
  on property_3d_room for delete
  using (
    exists (
      select 1 from listing
      where listing.property_id = property_3d_room.property_id
        and listing.seller_id = auth.uid()
    )
  );
