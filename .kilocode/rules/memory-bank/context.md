# Active Context: ETO FUN - Promotional Reward Game App

## Current State

**Project Status**: ✅ Live and operational

ETO FUN is a promotional reward game app for shops, built with Next.js 16, TypeScript, Firebase, and Capacitor for Android APK.

## Recently Completed

- [x] Fix super admin delete staff not persisting
  - Issue: Deleting a staff member only removed them from local IndexedDB, not from Firebase RTDB
  - Root cause: `handleDeleteAdmin` was missing `rtdbAdmins.delete(adminId)` call
  - After any sync, `pullFromRTDB()` re-downloaded all admins from RTDB, resurrecting deleted staff
  - Solution: Added `rtdbAdmins.delete(adminId)` to `handleDeleteAdmin` with try/catch for offline mode

- [x] Fix Item of the Day not syncing across devices
  - Issue: IOTD saved by super admin was not propagated to other devices because `pullFromRTDB()` did not fetch settings and RTDB write failures were not queued
  - Root causes:
    1. `pullFromRTDB()` missing settings pull
    2. Direct RTDB writes without offline queueing
    3. Type mismatch for `'setting'` sync item type
  - Solution:
    1. Added `'setting'` to `SyncItemType` in `src/types/index.ts`
    2. Unified `SyncItemType` in sync-service to import from `@/types` (removed local definition)
    3. Implemented `syncSetting` in sync-service with proper error handling
    4. Added settings (itemOfTheDay) pull in `pullFromRTDB()` and update `useGameStore` for live UI updates
    5. Updated `AdminDashboard.tsx` IOTD save/clear to use `queueForSync` on failures/offline
    6. Excluded duplicate `mettofun1-main` from tsconfig to prevent build conflicts

- [x] Make IOTD likes live across all devices
  - Issue: IOTD like increments only updated locally; other devices didn't see updates
  - Root cause: Direct RTDB `set` with no error handling or offline queue; no listener for live updates
  - Solution:
    1. Updated store `incrementItemOfDayLikes` to use `queueForSync` with type `'setting'`
    2. Added RTDB `onValue` listener for `settings/itemOfTheDay` in `initSyncService`
    3. On change, updates localSettings and store's IOTD instantly across devices

- [x] Clarify nomination item scope: shop-isolated (not global)
   - Nomination items belong to individual shops, not globally synced
   - Removed global Zustand state for nominationItems
   - Removed cross-device live listeners for nominationItems
   - Each shop manages its own nomination items locally via IndexedDB
   - AdminDashboard and NominationScreen load items per-shop using localNominationItems.getByShop(shopId)
   - Top Customer Nominations are shop-specific, computed locally
   - Only Item of the Day is global (super admin controlled)

- [x] Stabilize sync service error handling and reliability
   - Added try-catch to `queueForSync` to prevent crashes on IndexedDB failures
   - Added try-catch to `cleanStaleQueueItems` and `resetFailedSyncItems`
   - Wrapped `handleOnline` body in try-catch to prevent event handler crashes
   - Fixed all `sync*` functions (syncAttempt, syncItemData, syncShop, syncNominationItem, syncCustomerNomination) to check RTDB result.success and throw on failure (previously silent failures meant data loss)
   - Changed admin sync flag to track by admin.id (supports admin logout/login without stale state)

- [x] Fix IOTD like race condition
   - Changed store's `incrementItemOfDayLikes` to use functional state update with captured new value
   - Prevents lost likes when rapid multi-tap

- [x] Improve error handling in NominationScreen
    - Added try-catch around item loading useEffect
    - Maintains existing error handling for nomination submission

 - [x] Fix item selection error on item select screen
      - Issue: Error "Error selecting item. Please try again." when customer taps an item
      - Root causes:
        1. `generateSecureRandomNumber(18 - threshold)` could receive NaN if thresholdNumber was undefined
        2. Broken/invalid image URLs in items caused display issues
        3. `globalThis.crypto` access could throw ReferenceError in web workers/iframes with strict CSP
      - Solution:
        1. Added `Math.max(1, 18 - threshold)` guard to prevent NaN in GameMode.tsx handleItemSelect
        2. Added onError handlers to all `<img>` tags in GameMode and NominationScreen to gracefully handle broken images
        3. Updated `generateSecureRandomNumber` to use `getCrypto()` helper instead of direct `globalThis.crypto` access

 - [x] Add independent Item of the Day screen after customer entry
    - Issue: IOTD was only visible as a banner inside item selection screen
    - Solution: Added dedicated full-screen IOTD view after phone/purchase authorization
      - Always shows after authorization, even if no IOTD is set
      - If IOTD exists: shows image, name, value, likes, and like button
      - If no IOTD exists: shows placeholder with "No Item of the Day available today" message
      - Skip button proceeds to item selection
      - Continue button proceeds to item selection
      - Removed IOTD banner from item selection screen to free up space for the 17-item grid

 - [x] Make item selection screen responsive across devices
    - Issue: 17-item grid was cramped on desktop and required scrolling
    - Solution: Responsive grid layout in GameMode.tsx item picker
      - Phone: 3 columns
      - Tablet: 4-6 columns
      - Desktop: 8 columns (all 17 items fit without scrolling)

 - [x] Fix Item of the Day sync and like propagation across devices
   - Issue: IOTD edits were not updating on other devices; likes were not syncing correctly; likes appeared to disappear across game sessions
   - Root causes:
     1. `pullFromRTDB()` did not pull `settings/itemOfTheDay` from RTDB
     2. `syncSetting()` used `rtdbSettings.set()` which replaces entire object, causing race conditions where concurrent like updates overwrite each other
     3. `GameMode.tsx` RTDB listener and fallback poller overwrote local likes with remote likes without merging
     4. AdminDashboard refresh button overwrote local likes with remote likes
   - Solution:
     1. Added `rtdbSettings` and `localSettings` imports to `sync-service.ts`
     2. Added settings pull to `pullFromRTDB()` with max-intent like merge (`Math.max(localLikes, remoteLikes)`)
     3. Changed `syncSetting()` to use `rtdbSettings.update()` instead of `set()` for create/update operations — only updates specified fields, preserving others
     4. Updated `incrementItemOfDayLikes` in store to queue only `{ likes: confirmedLikes }` instead of full IOTD object
     5. Updated `GameMode.tsx` RTDB listener, fallback poller, and initial load to merge likes with max-intent merge
     6. Updated AdminDashboard RTDB refresh button to merge likes

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Current Focus

The template is ready. Next steps depend on user requirements:

1. What type of application to build
2. What features are needed
3. Design/branding preferences

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| Today | Add shop setup guide and setup button on login page |
| Today | Add Play button in admin dashboard to launch customer mode directly |
| Today | Fix missing sidebar tabs - add My Shop, Customers, Staff to navigation |
| Today | Fix qualifying purchase editing permissions - only shop_admin can edit |
| Today | Fix shop save - allow local fallback when Firebase not configured |
| Today | Fix shop qualifying purchase not saving - auto-select shop on admin dashboard load |
| Today | Fix Top Customer Nominations visibility - filter by assigned shops for non-super_admin |
| Today | Track which agent_admin added each shop - add addedBy and addedByName fields with display note |
| Today | Hide Customer Mode and Manage Items buttons from agent_admin and super_admin - only visible to shop_admin |
| Today | Add custom METOFUN logo with dark navy background (#0A1628) and gold theme |
| Today | Restrict shop_admin to only their permanently assigned shop - cannot swap or choose shops |
| Today | Replace custom SVG logo with user's custom image from Google Photos |
| Today | Improve nomination screen UX - tap to nominate, exit button resets session |
| Today | Add refresh button on customer mode to reset session - clears phone and purchase amount fields for new customer |
| Today | Hide all analytics from agent admin dashboard - only sees action buttons, not metrics |
| Today | Fix nomination count not updating in Firebase - get fresh item from IndexedDB after incrementing |
| Today | Update branding from METOFUN to ETO FUN - remove M from logo and app name |
| Today | Enhance offline feature for extended operation - auto sync every 5 min, exponential backoff, queue limits, stale cleanup, batch processing, time offline tracking |
| Today | Verified build - TypeScript passes (0 errors), lint passes (12 img warnings), build succeeds |
| Today | Fix super admin dashboard not synchronizing all devices - add nominations to pullFromRTDB, auto-pull on load, reset failed items on reconnect, post-sync pull in processSyncQueue |
| Today | Fix super admin delete staff not persisting - add rtdbAdmins.delete() to prevent resurrection after sync |
| Today | Fix shop credentials logging into wrong shop - prioritize adminEmail over deviceId, fix offline login shop resolution, add assignedShops fallback to session restore |
| Today | Fix Item of the Day not syncing across devices - add setting sync type, implement syncSetting, add to pullFromRTDB, queue on failure, exclude duplicate folder |
| Today | Make IOTD likes live across devices - queue sync, add RTDB onValue listener for IOTD |
| Today | Clarify nomination items are shop-isolated - remove global store state, remove cross-device sync listeners, use per-shop local only |
| Today | Stabilize sync service: add error handling to queueForSync, cleanStaleQueueItems, resetFailedSyncItems, handleOnline; fix all sync* functions to throw on RTDB failure; track admin sync by uid |
| Today | Fix IOTD like race condition - use functional state update with captured value |
| Today | Add error handling to NominationScreen item load useEffect |
| Today | Standardize nomination screen image sizing - match GameMode picker grid |
| Today | Fix longpress item selection hanging - add guards against rapid presses in GameMode and NominationScreen |
| Today | Fix item selection error on item select screen - NaN guard for threshold, image error handlers |
 | Today | Add Terms & Conditions button to customer entry screen - super admin editable, syncs via RTDB |
 | Today | Fix generateSecureRandomNumber crypto access - use getCrypto() helper to prevent ReferenceError in web workers/iframes |
 | Today | Add independent Item of the Day screen after customer entry - shows IOTD with skip option before item selection |
 | Today | Make item selection screen responsive - desktop shows all 17 items without scrolling |
 | Today | Make IOTD likes live across all devices like Facebook - immediate atomic RTDB increment when online, queued atomic increments when offline |
 | Today | Make Item of the Day save instantly like regular items - local save + immediate reload + background RTDB sync |
 | Today | Stabilize entire app: fix sync abort on unlinked devices, add item conflict resolution in pullFromRTDB, add IOTD screen reset in GameMode, harden local DB transaction error handling |
 | Today | Make customer entry form responsive across desktop/tablet/phone |
 | Today | Fix IOTD like persistence - prevent PERMISSION_DENIED from dropping likes, ensure local save always succeeds |
