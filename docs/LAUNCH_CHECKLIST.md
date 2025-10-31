# Atlas Launch Checklist

## Phase 1: Foundation & Critical Fixes ✅

- [x] Fix hardcoded IP in `src/utils/getBaseUrl.ts`
- [ ] Run profiles migration (`run_profiles_migration.sql` in Supabase)
- [x] Verify backend model configuration (already correct)

## Phase 2: Mobile Infrastructure Setup

- [x] Add Expo dependencies to `package.json`
- [x] Update `app.json` with build numbers and metadata
- [ ] Install dependencies: `npm install`
- [ ] Generate Android project: `npx expo prebuild --platform android --clean`
- [x] Create `eas.json` configuration
- [ ] Initialize EAS: `eas init` (requires Expo account)
- [ ] Set up EAS environment variables

## Phase 3: Store Assets Creation

- [ ] Create iOS app icon (1024x1024 PNG)
- [ ] Create Android adaptive icon assets
- [ ] Generate iOS screenshots (iPhone 15 Pro Max, iPad Pro)
- [ ] Generate Android screenshots (Phone, Tablet)
- [ ] Write App Store metadata (description, keywords, etc.)
- [ ] Write Play Store metadata

## Phase 4: Web Launch

- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway
- [ ] Verify production environment variables
- [ ] Run end-to-end tests
- [ ] Verify FastSpring checkout works

## Phase 5: Mobile Builds

- [ ] Build iOS development build
- [ ] Build Android development build
- [ ] Test development builds on devices
- [ ] Build iOS production build
- [ ] Build Android production build
- [ ] Test production builds

## Phase 6: Store Submission

- [ ] Set up App Store Connect account
- [ ] Create app listing in App Store Connect
- [ ] Upload iOS screenshots and metadata
- [ ] Set up Google Play Console account
- [ ] Create app listing in Play Console
- [ ] Upload Android screenshots and metadata
- [ ] Submit iOS app via EAS
- [ ] Submit Android app via EAS

## Phase 7: Final Verification

- [ ] Monitor store review status
- [ ] Set up production monitoring
- [ ] Verify Sentry error tracking
- [ ] Test FastSpring webhooks
- [ ] Prepare support documentation

