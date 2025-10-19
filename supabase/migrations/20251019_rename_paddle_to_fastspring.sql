-- Rename paddle_subscriptions table to fastspring_subscriptions
-- and update related columns

-- Rename the table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'paddle_subscriptions') THEN
        ALTER TABLE paddle_subscriptions RENAME TO fastspring_subscriptions;
    END IF;
END $$;

-- Update column names in profiles table if they exist
DO $$ 
BEGIN
    -- Rename paddle_customer_id to fastspring_customer_id if it exists
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_name = 'profiles' 
               AND column_name = 'paddle_customer_id') THEN
        ALTER TABLE profiles RENAME COLUMN paddle_customer_id TO fastspring_customer_id;
    END IF;
    
    -- Rename paddle_subscription_id to fastspring_subscription_id if it exists
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_name = 'profiles' 
               AND column_name = 'paddle_subscription_id') THEN
        ALTER TABLE profiles RENAME COLUMN paddle_subscription_id TO fastspring_subscription_id;
    END IF;
END $$;

-- Update any foreign key constraints if they exist
DO $$ 
BEGIN
    -- Update foreign key constraint name if it exists
    IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'profiles_paddle_subscription_id_fkey') THEN
        ALTER TABLE profiles 
        DROP CONSTRAINT profiles_paddle_subscription_id_fkey,
        ADD CONSTRAINT profiles_fastspring_subscription_id_fkey 
        FOREIGN KEY (fastspring_subscription_id) 
        REFERENCES fastspring_subscriptions(id);
    END IF;
END $$;

-- Add comment to document the change
COMMENT ON TABLE fastspring_subscriptions IS 'Stores FastSpring subscription data (renamed from paddle_subscriptions)';
