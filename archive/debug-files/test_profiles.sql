-- Test if profiles were created successfully
select 
  id, 
  email, 
  subscription_tier, 
  subscription_status,
  created_at
from profiles 
order by created_at desc 
limit 5;
