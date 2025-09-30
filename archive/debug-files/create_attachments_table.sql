-- Create the attachments table for storing uploaded file metadata
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid, -- optional if you track conversations
  feature text CHECK (feature IN ('image','camera','audio','file')) NOT NULL,
  url text NOT NULL,
  content_type text,
  size_bytes bigint,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own attachments"
ON attachments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attachments"
ON attachments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can do everything"
ON attachments FOR ALL
USING (true);

-- Create index for efficient querying of pending uploads
CREATE INDEX IF NOT EXISTS idx_attachments_status ON attachments(status) WHERE status = 'pending';

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_attachments_updated_at ON attachments;
CREATE TRIGGER trigger_update_attachments_updated_at
  BEFORE UPDATE ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_attachments_updated_at();

-- Verify the table was created
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'attachments' 
ORDER BY ordinal_position;
