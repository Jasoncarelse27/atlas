# Atlas Changelog — November 2025 Launch Hotfix

## 🔥 Critical Fixes

- Fixed user ghosting ("User from sub claim does not exist")
- Fixed web+iOS session mismatch
- Fixed 403/406/409 loops in profile loading
- Fixed React #310 on login (ghost user trigger)
- Fixed tutorial loading failures
- Fixed Supabase profile row missing issues
- Added Supabase auto-create-profile trigger
- Hardened JWT verification across backend

## 🛠 Stability Improvements

- Clear session automatically when server instructs client
- Unified session handling between tabs/devices
- Improved tier/profile loading reliability
- Added fail-safe onAuthStateChange cleanup
- Improved API resilience for expired/stale tokens

## 🚀 Launch Ready

Atlas authentication is now stable across:

- Web (Chrome, Safari, Edge)
- iOS Safari PWA
- Android Chrome
- Desktop PWA

All ghost user, ghost token, and missing profile inconsistencies resolved.

