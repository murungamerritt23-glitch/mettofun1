# Active Context: ETO FUN - Promotional Reward Game App

## Current State

**Project Status**: ✅ Live and operational

ETO FUN is a promotional reward game app for shops, built with Next.js 16, TypeScript, Firebase, and Capacitor for Android APK.

## Recently Completed

- [x] Fix game flow: ensure winning number is set only after item is selected
  - In AdminDashboard.handleLaunchCustomer, setCorrectNumber was called unconditionally even when the selected item lookup failed (item === undefined). This could set a winning number without a selected item, causing inconsistent state.
  - Fixed: Moved setCorrectNumber inside the `if (item)` block and added error handling to abort launch if item not found.
  - GameMode.handleItemSelect already had correct order (setSelectedItem first, then setCorrectNumber).
  - Now the winning number is guaranteed to be set only after an item is successfully selected.

- [x] Change analytics "Most Selected Items" to "Top 10 Nominated Items"
  - The analytics dashboard previously showed the 5 most selected game items (what customers picked when winning). Changed to display the top 10 customer nomination items sorted by nominationCount descending.
  - Updated AdminDashboard.tsx analytics view to use `topNominations` state with proper sorting (already loaded by `loadTopNominations`). Now admins see which nomination items customers want to see more of.
  - Also fixed a bug: the original `loadTopNominations` used `.slice(0, 10)` without sorting, so it showed arbitrary items instead of actual top 10. Added `.sort((a, b) => b.nominationCount - a.nominationCount)` to ensure correct ranking.

- [x] Ensure likes and nomination counts persist across logout and sync reliably
  - Issue: Item of the Day likes and nomination item counts could be lost when offline or if admin logged out before sync completed. RTDB writes didn't check `result.success`, causing silent failures and no retry.
  - Root cause: `saveNominationWithSync`, `saveNominationItemWithSync`, and `incrementItemOfDayLikes` did not verify RTDB operation results. Failed writes were ignored, not queued for retry.
  - Solution:
    1. Added `'setting'` to `SyncItemType` and implemented `syncSetting` handler in sync-service.
    2. Modified `incrementItemOfDayLikes` (store/index.ts) to always queue RTDB updates via `queueForSync` instead of direct RTDB call.
    3. Fixed `saveNominationWithSync` to check `result.success` from `rtdbCustomerNominations.create` and queue on failure.
    4. Fixed `saveNominationItemWithSync` to check create/update results and queue on failure.
    5. All queued items now retry with exponential backoff, ensuring eventual consistency across devices.
  - Likes and nomination counts now survive logout and sync correctly even after network interruptions.

- [x] Fix offline attempts not syncing to Firebase when back online
  - Issue: Attempts made while offline were never synced to RTDB, especially noticeable across different devices. Online sync worked but offline→online sync failed silently.
  - Root cause: In `sync-service.ts`, the sync functions (`syncAttempt`, `syncItemData`, `syncShop`, `syncNominationItem`, `syncCustomerNomination`) ignored the `{ success }` result from RTDB operations and never threw on failure. In `processSyncQueue`, failed items were incorrectly marked as synced and removed from the queue without actually being saved to RTDB.
  - Solution: Modified all sync* functions to check `result.success` and throw an error if false, causing the queue processing to catch, increment retry count, and keep items pending. Also added `ensureAdminInRTDB()` check at start of `processSyncQueue` to verify admin permissions before any writes.
  - Now offline attempts will retry until they successfully reach RTDB, ensuring cross-device sync works.

- [x] Fix customer mode loading spinner stuck
  - Issue: Customer mode shows loading indefinitely on first load, but exiting and re-entering shows customer mode immediately (data was loaded in background)
  - Root cause: In `GameMode.tsx`, `setIsLoading(false)` was inside `if (currentShop)` block. When component mounted before `currentShop` was available, the early return prevented `setIsLoading(false)` from ever being called.
  - Solution: Moved `setIsLoading(false)` to a `finally` block and added early exit with `setIsLoading(false)` when `currentShop` is falsy. Guarantees loading state always clears.

- [x] Fix super admin delete staff not persisting
  - Issue: Deleting a staff member only removed them from local IndexedDB, not from Firebase RTDB
  - Root cause: `handleDeleteAdmin` was missing `rtdbAdmins.delete(adminId)` call
  - After any sync, `pullFromRTDB()` re-downloaded all admins from RTDB, resurrecting deleted staff
  - Solution: Added `rtdbAdmins.delete(adminId)` to `handleDeleteAdmin` with try/catch for offline mode

- [x] Fix shop credentials logging into wrong shop
  - Issue: A shop with valid credentials could log into a different shop instead of their own
  - Root causes:
    1. Shop resolution used deviceId first, which could match multiple shops (collision)
    2. Device lock override unconditionally overwrote shop's deviceId with current device's ID
    3. Offline login path never called `setCurrentShop()` for shop_admin
    4. `page.tsx` session restore didn't check `assignedShops` fallback
  - Solution:
    1. Changed shop resolution priority: adminEmail (most specific) → assignedShops → deviceId (only if exactly 1 match)
    2. Offline login now resolves shop by adminEmail/assignedShops and calls setCurrentShop
    3. Added assignedShops fallback to page.tsx session restore
    4. deviceId only used if exactly one shop matches to prevent ambiguity

- [x] Fix super admin dashboard not synchronizing all devices
  - Issue: Super admin couldn't see data from all devices/shops
  - Root causes:
    1. `pullFromRTDB()` was missing customer nominations and nomination items
    2. Initial dashboard load only read from local IndexedDB, never pulled from RTDB for super admin
    3. Failed sync items were permanently skipped after 3 retries with no retry mechanism
    4. Auto-sync only pushed data, never pulled from RTDB
  - Solution:
    1. Added `rtdbCustomerNominations` and `rtdbNominationItems` to `pullFromRTDB()` (both shop-specific and all-shops paths)
    2. Added `pullFromRTDB()` call in dashboard initial load for super_admin/agent_admin after fetching shops from RTDB
    3. Added `resetFailedSyncItems()` function that resets failed items to pending with retry count 0
    4. Call `resetFailedSyncItems()` when going back online, on force sync, and on manual trigger sync
    5. Added `pullFromRTDB()` call at end of `processSyncQueue()` so local stays in sync with all devices after every sync cycle

- [x] Enhance offline feature for extended operation (hours/days offline)
  - Add automatic periodic sync (every 5 minutes) when online
  - Implement exponential backoff for failed sync retries (2s base, max 5min)
  - Add queue size limits (max 1000 items) to prevent overflow
  - Add stale queue item cleanup (items older than 7 days are cleaned)
  - Add queue management with batch processing (50 items per sync cycle)
  - Track time offline and show in sync status UI
  - Add background sync registration for Chrome/Edge
  - Enhanced service worker with better caching strategies
  - Add push notification handlers for future use
  - Fixed TypeScript types for retryCount handling

- [x] Add anti-tamper protection for game attempts
  - Added integrityHash and hashSeed fields to GameAttempt type
  - Generate SHA256 integrity hash when game attempt is created
  - Verify integrity hash when loading attempts from IndexedDB
  - Add tamperedCount to ShopAnalytics for admin monitoring
  - Show Tampered count in analytics dashboard
  - Add getTamperedAttempts and getTamperedCount functions
  - Old game attempts (without hash) are marked as unverified

- [x] Fix test mode to only affect super_admin in customer mode
  - Issue: Test mode was affecting shop_admin customer mode, causing likes/nominations not to count
  - Solution: 
    1. Added isSuperAdminTestMode check - true only when isTestMode is true AND admin.level === 'super_admin'
    2. Phone formatting: only adds TEST prefix for super_admin test mode
    3. Game attempts: saved as real data (isTest: false) for shop_admin
    4. Likes: always increment for shop_admin (only skipped for super_admin test mode)
    5. Nominations: always count for shop_admin (only skipped for super_admin test mode)
    6. Test mode indicator: only shown for super_admin
  - Now super_admin can test while shop admins serve real customers with real analytics

- [x] Fix Test Mode affecting real data
  - Issue: Test Mode was updating real nomination counts, likes, and analytics
  - Root cause: No checks to prevent saving test data to real analytics
  - Solution: 
    1. Skip incrementing nomination count when isTestMode is true in NominationScreen
    2. Skip incrementing Item of the Day likes when isTestMode is true in store
    3. Filter out test attempts from getAll, getByShop, getByPhone, getUnsynced functions
    4. All functions now accept optional `includeTest` parameter (default: false)
  - Test Mode now properly isolates test data from real analytics

- [x] Fix qualifying purchase not saving to Firebase
  - Root cause: Date objects were being passed directly to Firebase, which cannot store them
  - Solution: Convert Date to ISO string before saving, and handle both ISO strings and Firebase timestamps when reading
  - Also added missing fields (addedBy, addedByName) to save/load operations
  - Fixed all shop retrieval functions: getAllActive, getAll, getByCode, subscribeToActiveShops

- [x] Fix minimum qualifying purchase not updating in customer mode
  - Issue: When admin updated qualifying purchase, customer mode showed old value
  - Root cause: loadShops only set currentShop if none existed, using stale cached data from localStorage
  - Solution: Now always updates currentShop with fresh data from Firebase when loading
  - Fixed in both AdminDashboard.tsx and page.tsx

- [x] Hide Customer Mode button from admin login screen
  - Removed the "Customer Mode →" button from the login page
  - This prevents customers from accessing customer mode through the admin login screen

- [x] Add 4-digit password protection to admin dashboard (super_admin, agent_admin, shop_admin)
  - Default PIN is "0000"
  - Password prompt shown when any admin accesses dashboard
  - Password change functionality available in Settings tab
  - Added "Back to Login" button for super_admin and agent_admin on password prompt

- [x] Fix shop_admin activate/deactivate button in super admin
  - Issue: shop_admin couldn't see the activate/deactivate button for their shop
  - Root cause: shop_admin had canManageAssignedShops and canActivateShops set to false in permissions
  - Solution: Reverted - this is correct behavior. Only super_admin has authority to activate/deactivate shops
  - shop_admin should NOT have access to this feature

- [x] Fix shop qualifying purchase not saving issue
  - Root cause: Admin Dashboard loaded shops but didn't set currentShop in Zustand store
  - Solution: Added auto-select first shop logic when admin logs in
  - This enables qualifying purchase editing for shop_admin

- [x] Fix Top Customer Nominations visibility
  - Issue: Only visible to shop_admin (others couldn't see it)
  - Root cause: loadShops didn't filter by assigned shops for non-super_admin users
  - Solution: Added filtering by admin.assignedShops for shop_admin and other admins
  - Now all admins can see Top Customer Nominations for their assigned shops

- [x] Add optional nomination screen after game result (win or lose)
  - Customer can choose to nominate an item or skip
  - Nomination screen shows up to 100 items sorted by nomination count (highest first)
  - Each item shows: name, price/value, optional image, nomination count
  - Customers can only nominate once per game attempt
  - Nominations saved locally (offline-first), sync to Firebase when online
  - Nomination eligibility resets automatically for next attempt
  - Admins can edit/activate/deactivate nomination items via Items tab
  - Read-only for customers
  - Not affected by 80% pricing rule (feedback-only feature)

- [x] Fix Top Customer Nominations visibility
  - Issue: agent_admin and super_admin could see Top Customer Nominations (should only be visible to shop_admin)
  - Solution: Added check `admin?.level === 'shop_admin'` to the conditional rendering
  - Now only shop_admin can see Top Customer Nominations

- [x] Track which agent_admin added each shop
  - Added `addedBy` and `addedByName` fields to Shop type
  - When agent_admin adds a shop, the system now captures their ID and name
  - Super admin can now see "Added by agent_admin: [name]" note on shop list

- [x] Hide Customer Mode and Manage Items buttons from agent_admin and super_admin
  - Issue: These buttons in admin dashboard were visible to all admin types
  - Solution: Added `isShopAdmin` check to wrap both buttons
  - Now only shop_admin can see "Customer Mode" and "Manage Items" buttons on dashboard

- [x] Show Shops tab for agent_admin to enable add shop functionality
  - Issue: agent_admin couldn't see the Shops tab to add new shops
  - Root cause: Shops tab required `canManageAllShops` permission, but agent_admin only has `canManageAssignedShops`
  - Solution: Added check for `canManageAssignedShops` in tabs filter logic
  - Now agent_admin can see the Shops tab and add new shops

- [x] Shop admin goes directly to customer mode on login
  - Issue: Shop admin had to navigate to customer mode after login
  - Solution: Modified login flow to redirect shop_admin directly to customer mode
  - Now shop_admin sees customer game screen immediately after logging in

- [x] Add navigation back to admin dashboard for shop_admin
  - Issue: Shop admin couldn't get back to admin dashboard from customer mode
  - Solution: Added settings icon button in GameMode.tsx, visible only to shop_admin
  - Button calls setCurrentView('admin') to switch back to admin dashboard

- [x] Allow unlimited game sessions without logout/login
  - Issue: After playing one game, shop admin had to logout and login again to serve next customer
  - Root cause: handleSkipNominate didn't fully reset game state
  - Solution: Updated handleSkipNominate to clear all customer data, phone/amount fields, and all picker states
  - Now after skipping nomination, shop admin sees fresh entry form to serve next customer immediately

- [x] Fix: Allow item nomination and like on Item of the Day for every game attempt
  - Issue: After completing a nomination, the next game attempt wouldn't allow nomination or like
  - Root cause: NominationScreen handleExit only set gameStatus to 'idle', didn't reset flags
  - Solution: Added resetGame() call in handleExit to reset hasNominatedThisAttempt and hasLikedItemOfDay flags
  - Now every game attempt allows both nomination and like

- [x] Add custom METOFUN logo with dark navy background and gold theme
  - Created new logo SVG with:
    - Dark navy background (#0A1628)
    - Golden sphere with gradient effect
    - Shopping cart outline on ball
    - Gift box with "17" inside cart
    - Semi-circular gold ring below
    - "METO FUN" text along the ring
  - Updated web icons: icon-192.svg and icon-512.svg
  - Updated Android launcher icons: ic_launcher_background.xml and ic_launcher_foreground.xml
  - Updated manifest.json and layout.tsx theme colors

- [x] Animate METOFUN logo with bounce, glow, and sparkle effects
  - Added bounce animation to golden sphere, cart, and gift box
  - Added spinning wheels on cart
  - Added glowing ring with pulsing effect
  - Added shimmering gradient on cart and gift box
  - Added sparkle effects in corners that fade in/out
  - Applied animations to: metofun-logo.svg, icon-192.svg, icon-512.svg

- [x] Use animated logo in SplashScreen on app initialization
  - Replaced Framer Motion animations with the animated metofun-logo.svg
  - Updated splash container background to match METOFUN theme (#0A1628)
  - Now shows the custom animated logo when app starts

- [x] Restrict shop_admin to only their permanently assigned shop
  - Issue: Shop admin could access all shops assigned to them, could swap between multiple shops
  - Root cause: assignedShops array could contain multiple shops, My Shop tab showed list to choose from
  - Solution: 
    1. LoginPage now sets shop_admin's assignedShops to only their device-linked shop when logging in
    2. My Shop tab now shows only one shop for shop_admin (no list to choose from)
    3. Removed X button that allowed shop_admin to deselect their shop
  - Now shop_admin is permanently tied to one specific shop based on device

- [x] Display custom METOFUN logo on admin login, dashboard, and customer mode
  - Updated LoginPage.tsx to show metofun-logo.png instead of ShoppingCart icon
  - Updated AdminDashboard.tsx sidebar to show logo image instead of text
  - Updated GameMode.tsx to show logo image in customer entry screen
  - Removed unused ShoppingCart import from LoginPage

- [x] Improve nomination screen UX
  - Removed nominate button at bottom of screen
  - Now users can nominate by tapping directly on the item
  - Added Exit button that resets session (like results screen)
  - Removed selected item preview and skip button
  - Flow: tap item → immediate nomination → success → exit → new customer

- [x] Add refresh button on customer mode to reset session
  - Added refresh button on customer entry screen
  - When tapped, clears phone number and purchase amount fields
  - Resets all game state for a fresh session
  - Button labeled "New Session" (English) or "Fanya Upya" (Swahili)

- [x] Prevent duplicate shops with same shopCode or deviceId
  - Issue: System allowed saving shops with identical credentials
  - Solution: Added duplicate check in handleSaveShop function
  - Checks both local shops and Firebase for duplicates
  - Prevents saving if shopCode (case-insensitive) or deviceId already exists
  - Shows clear error messages to prevent confusion

- [x] Link shop to shop admin login email
  - Added adminEmail field to Shop type
  - When adding/editing a shop, admin must enter shop admin's email
  - Email is validated: must match shop admin's login email
  - Login now checks both deviceId (backward compat) AND email match
  - Prevents shop access if email doesn't match login email
  - Added duplicate email validation - each email can only link to one shop

- [x] Fix dashboard analytics not loading when shop is selected
  - Issue: Win rate, total attempts, and other analytics not updating on dashboard
  - Root cause: loadAttempts() was only called when clicking "Manage Items" button
  - Solution: Added loadAttempts() call in autoSelectShop function when shop is selected
  - Now analytics load automatically when dashboard loads or shop changes

- [x] Change price cup rule from 80% to 60%
  - Item values must now be ≤ 60% of qualifying purchase (was 80%)
  - Updated validation logic in game-utils.ts
  - Updated all UI text and alerts in AdminDashboard.tsx

- [x] Add search functionality to nomination screen
  - Added search input field to filter items by name
  - Users can now search for items instead of scrolling through all 100 items
  - Search is case-insensitive and filters in real-time
  - Clear button to reset search
  - Shows "No items found" message when search has no results
  - Both English and Swahili placeholders supported

- [x] Hide "active shops" in shop admin dashboard
  - Issue: Active Shops card was showing in shop_admin dashboard analytics
  - Solution: Added conditional check to only show Active Shops card for super_admin and agent_admin
  - Now shop_admin doesn't see Active Shops metric in their dashboard

- [x] Hide all analytics from agent admin dashboard
  - Issue: Agent admin was seeing Active Shops, Total Attempts, Win Rate, and Active Items metrics
  - Solution: Wrapped all analytics cards in `{admin?.level !== 'agent_admin' && (...)}` conditional
  - Now agent_admin sees only the action buttons (Customer Mode, Manage Items)
  - Active Shops now only visible to super_admin
  - shop_admin and super_admin still see all metrics

- [x] Update branding from METOFUN to ETO FUN
  - Removed "M" from logo text - now shows "ETO FUN" instead of "METO FUN"
  - Updated all logo files: metofun-logo.svg, icon-192.svg, icon-512.svg
  - Updated manifest.json to use SVG icons and new name
  - Updated service worker to use new SVG icons
  - Updated all React components: SplashScreen, LoginPage, AdminDashboard, GameMode
  - Updated layout.tsx metadata title
  - Updated Android strings.xml app name
  - Updated capacitor.config.ts appName

- [x] Use custom PNG logo from Google Photos on all pages
   - Replaced SVG logo with custom PNG (metofun-logo.png) on all components
   - Updated: LoginPage, AdminDashboard, GameMode, SplashScreen

- [x] Implement secure Firebase admin authentication with offline login support
   - First login requires online Firebase authentication
   - Subsequent logins can be offline using cached credentials
   - Added hasLoggedInBefore flag to track first-time login status
   - Session restoration tries online verification first, falls back to offline
   - Added "Offline Login" button on login page for returning users
   - Persistent session with 30-minute timeout
   - Failed attempt tracking with lockout protection

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
| Today | Fix customer mode loading spinner stuck - ensure setIsLoading(false) always called in GameMode |
| Today | Fix offline attempts not syncing - make sync* functions throw on failure and ensure admin exists before processing queue |
| Today | Ensure likes and nomination counts persist across logout and sync reliably - queue setting updates and fix nomination sync result checks |
| Today | Fix game flow: ensure correctNumber set only after item selected - guard admin launch path |
