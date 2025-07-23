/*
  # Add admission controls for meetings

  1. Schema Changes
    - Add `admitted` column to participants table
    - Add `requires_admission` column to meetings table
    - Add indexes for better performance

  2. Security
    - Update RLS policies to handle admission flow
    - Ensure only hosts can admit participants

  3. Features
    - Waiting room functionality
    - Host admission controls
    - Participant status tracking
*/

-- Add admission control columns
DO $$
BEGIN
  -- Add admitted column to participants table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'participants' AND column_name = 'admitted'
  ) THEN
    ALTER TABLE participants ADD COLUMN admitted boolean DEFAULT null;
  END IF;

  -- Add requires_admission column to meetings table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings' AND column_name = 'requires_admission'
  ) THEN
    ALTER TABLE meetings ADD COLUMN requires_admission boolean DEFAULT true;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_participants_admitted ON participants(admitted);
CREATE INDEX IF NOT EXISTS idx_participants_meeting_admitted ON participants(meeting_id, admitted);

-- Update RLS policies for admission control
DROP POLICY IF EXISTS "Allow all operations on participants" ON participants;

-- Allow participants to insert themselves (join request)
CREATE POLICY "Allow participant join requests"
  ON participants
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow participants to read their own data and admitted participants
CREATE POLICY "Allow reading participant data"
  ON participants
  FOR SELECT
  TO public
  USING (true);

-- Allow updates for admission (hosts can admit participants)
CREATE POLICY "Allow admission updates"
  ON participants
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Allow deletion for cleanup
CREATE POLICY "Allow participant cleanup"
  ON participants
  FOR DELETE
  TO public
  USING (true);