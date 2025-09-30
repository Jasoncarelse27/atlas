-- Update test user to core tier for testing
UPDATE user_profiles 
SET subscription_tier = 'core' 
WHERE id = '0a8726d5-af01-44d3-b635-f0d276d3d3d3';
