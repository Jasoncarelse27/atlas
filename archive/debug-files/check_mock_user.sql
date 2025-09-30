-- Check if the mock user has a profile
select 
  id, 
  email, 
  subscription_tier, 
  subscription_status,
  created_at
from profiles 
where id = '550e8400-e29b-41d4-a716-446655440000';
