-- Fix profiles table mismatch between backend and frontend
-- Backend expects 'profiles' table, but migration created 'user_profiles'

-- Create profiles table if it doesn't exist (matching backend expectations)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'core', 'studio')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'trialing')),
  subscription_id TEXT,
  paddle_subscription_id TEXT,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  first_payment_date TIMESTAMP WITH TIME ZONE,
  last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for quick email lookups
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

-- Create index for subscription lookups
CREATE INDEX IF NOT EXISTS profiles_subscription_tier_idx ON public.profiles (subscription_tier);

-- Enable RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Migrate data from user_profiles to profiles if user_profiles exists
INSERT INTO public.profiles (id, email, subscription_tier, subscription_status, subscription_id, paddle_subscription_id, trial_ends_at, created_at, updated_at)
SELECT 
  id, 
  email, 
  subscription_tier, 
  subscription_status, 
  subscription_id, 
  paddle_subscription_id, 
  trial_ends_at, 
  created_at, 
  updated_at
FROM public.user_profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = user_profiles.id
)
ON CONFLICT (id) DO NOTHING;

-- Insert existing users if they don't have a profile yet
INSERT INTO public.profiles (id, email, subscription_tier)
SELECT 
  au.id,
  au.email,
  'free'
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Update foreign key constraints to reference profiles instead of user_profiles
-- First, drop existing constraints that reference user_profiles
DO $$
BEGIN
  -- Drop foreign key constraints that might reference user_profiles
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_conversations_user_id' 
    AND table_name = 'conversations'
  ) THEN
    ALTER TABLE conversations DROP CONSTRAINT fk_conversations_user_id;
  END IF;
END $$;

-- Recreate foreign key constraint to reference profiles
ALTER TABLE conversations 
ADD CONSTRAINT fk_conversations_user_id 
FOREIGN KEY (user_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Update function to handle new user creation (use profiles instead of user_profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create profiles on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
