# Active Context: METOFUN - Promotional Reward Game App

## Current State

**Project Status**: ✅ Live and operational

METOFUN is a promotional reward game app for shops, built with Next.js 16, TypeScript, Firebase, and Capacitor for Android APK.

## Recently Completed

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
