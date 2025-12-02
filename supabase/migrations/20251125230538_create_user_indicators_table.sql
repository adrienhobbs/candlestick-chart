/*
  # User Indicators Table

  This migration creates a table to store user indicator configurations.

  1. New Tables
    - `user_indicators`
      - `id` (uuid, primary key) - Unique identifier for the record
      - `user_id` (uuid, foreign key to auth.users) - User who owns this indicator
      - `indicator_id` (text) - Unique identifier for the indicator instance (e.g., 'sma-1', 'ema-2')
      - `definition_id` (text) - Type of indicator (e.g., 'sma', 'ema', 'rsi', 'bollinger')
      - `name` (text) - Display name for the indicator (e.g., 'SMA(1)', 'EMA(2)')
      - `settings` (jsonb) - Indicator settings as JSON object
      - `created_at` (timestamptz) - When the indicator was added
      - `updated_at` (timestamptz) - When the indicator was last modified

  2. Security
    - Enable RLS on `user_indicators` table
    - Add policies for authenticated users to:
      - Read their own indicators
      - Insert their own indicators
      - Update their own indicators
      - Delete their own indicators

  3. Indexes
    - Index on (user_id, indicator_id) for fast lookups and upsert operations
*/

CREATE TABLE IF NOT EXISTS user_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  indicator_id text NOT NULL,
  definition_id text NOT NULL,
  name text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, indicator_id)
);

ALTER TABLE user_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own indicators"
  ON user_indicators
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own indicators"
  ON user_indicators
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own indicators"
  ON user_indicators
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own indicators"
  ON user_indicators
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_indicators_user_id_indicator_id 
  ON user_indicators(user_id, indicator_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_user_indicators_updated_at'
  ) THEN
    CREATE TRIGGER update_user_indicators_updated_at
      BEFORE UPDATE ON user_indicators
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
