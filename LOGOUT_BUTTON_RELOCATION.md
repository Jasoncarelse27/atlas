# Logout Button Relocation

## Overview
Moved the logout button from the top header to the side drawer, positioned under the Privacy Mode toggle with a visual separator.

## Changes Made

### 1. **Removed from Header**
- Removed the logout button from the top-right corner of the header
- Kept only the SyncStatus indicator in the header for a cleaner look

### 2. **Added to Side Drawer**
- Positioned below Privacy Mode toggle
- Added a visual divider for clear separation
- Styled consistently with other sidebar components

### 3. **Design Details**
- **Icon**: 🚪 (door emoji for intuitive logout representation)
- **Text**: "Sign Out" with subtitle "End your session"
- **Styling**: Matches sidebar component design with:
  - Dark background (`bg-[#2c2f36]`)
  - Hover effect (`hover:bg-[#353840]`)
  - Rounded corners and shadow
  - Consistent padding and spacing

## Benefits
1. **Cleaner Header** - Less cluttered top navigation
2. **Logical Grouping** - Account actions (privacy, logout) grouped together
3. **Mobile Friendly** - Reduces header complexity on small screens
4. **Better UX** - Logout is still easily accessible but not accidentally clickable
5. **Visual Hierarchy** - Less prominent placement prevents accidental logouts

## Result
The logout button is now:
- ✅ In the side drawer (accessible via menu button)
- ✅ Under Privacy Mode toggle
- ✅ Visually separated with a divider
- ✅ Styled consistently with other sidebar components
- ✅ Mobile-responsive and touch-friendly

The header is now cleaner and the logout action is grouped with other account-related settings in a logical location.
