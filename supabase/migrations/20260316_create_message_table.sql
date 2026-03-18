-- Message table for buyer-seller communication
-- Idempotent: safe to run on databases that already have this table

CREATE TABLE IF NOT EXISTS message (
  message_id   SERIAL PRIMARY KEY,
  sender_id    UUID NOT NULL REFERENCES auth.users(id),
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  listing_id   INTEGER REFERENCES listing(listing_id),
  content      TEXT NOT NULL,
  notes        TEXT,
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'message' AND policyname = 'Korisnik vidi vlastite poruke'
  ) THEN
    CREATE POLICY "Korisnik vidi vlastite poruke"
      ON message FOR SELECT
      USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'message' AND policyname = 'Korisnik salje poruke'
  ) THEN
    CREATE POLICY "Korisnik salje poruke"
      ON message FOR INSERT
      WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;
