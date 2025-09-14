
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'profiles' 
AND indexname LIKE 'idx_profiles_%'
ORDER BY indexname;
