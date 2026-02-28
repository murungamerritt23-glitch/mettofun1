# METOFUN Setup Guide

## Creating Your Real Shop

Follow these steps to set up METOFUN with your real shop:

### Step 1: Set Up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new Firebase project (e.g., "My Shop Game")
3. Enable **Firestore Database**:
   - Go to Firestore → Create Database
   - Start in **Production** mode
   - Choose a location near you
4. Enable **Authentication**:
   - Go to Authentication → Get Started
   - Enable "Email/Password" sign-in method
5. Get your Firebase config:
   - Go to Project Settings (gear icon)
   - Scroll to "Your apps" → Click web icon (`</>`)
   - Register app (name it "METOFUN")
   - Copy the `firebaseConfig` object

### Step 2: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
NEXT_PUBLIC_USE_EMULATORS=false
```

Replace the values with your Firebase config from Step 1.

### Step 3: Deploy and Log In

1. Deploy the app
2. Log in using **Demo Login (Super Admin)**
3. Go to the **Shops** tab
4. Click **+ Add Shop** to create your shop

### Step 4: Configure Your Shop

When creating your shop, you'll need:

| Field | Description | Example |
|-------|-------------|---------|
| Shop Name | Your business name | John's Supermarket |
| Shop Code | 4-6 character code for customers | JOHN1 |
| Location | City/Area | Nairobi |
| Qualifying Purchase | Minimum purchase to play (KSh) | 500 |
| Promo Message | Message shown to customers | "Buy KSh 500 & win exciting prizes!" |

### Step 5: Set Up Devices

Each shop device should:
1. Install the METOFUN APK
2. Be registered to the shop (device ID links to shop)

### Shop Admin Accounts

To create shop admin accounts:
1. Go to **Staff** tab
2. Click **+ Add Admin**
3. Set level to **shop_admin**
4. The admin can then manage their assigned shop

## Troubleshooting

**"No shop configured for this device"**
- This device hasn't been linked to a shop yet
- Ask your super admin to assign this device to a shop

**Firebase connection errors**
- Check your `.env.local` configuration
- Ensure Firestore and Authentication are enabled
- Check Firebase console for any security rules blocking access

**Can't see Shops tab**
- Only Super Admin and Agent Admin can manage shops
- Log in with the correct admin level
