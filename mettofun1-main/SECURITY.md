# METOFUN Security Guide

This document outlines security best practices for your METOFUN promotional reward game app.

---

## 🔒 Current Security Measures

### 1. Firebase Firestore Rules
Your app has role-based access control (RBAC) with three admin levels:
- **Super Admin**: Full system access
- **Agent Admin**: Manage assigned shops
- **Shop Admin**: Manage their own shop only

### 2. Device Authorization
Shop admins can lock their account to specific devices using `deviceId` and `deviceLocked` fields.

### 3. Game Validation API
Server-side validation with HMAC-SHA256 for anti-cheat.

---

## ⚠️ Security Vulnerabilities Found

### Critical
1. **Game Attempts Open Write** - `allow create: if true` allows anyone to write game results
2. **Hardcoded Validation Secret** - Default secret in production code

### Medium
3. **No Rate Limiting** - API endpoints can be spammed
4. **Demo Mode in Production** - Bypasses authentication

### Low
5. **No Input Validation** - API accepts any data format
6. **No HTTPS Enforcement** - Should redirect to HTTPS

---

## ✅ Recommended Fixes

### 1. Fix Firestore Rules
```javascript
// Game attempts - add shop validation
match /shops/{shopId}/attempts/{attemptId} {
  allow read: if isAdmin();
  // Only allow creating if shop exists and is active
  allow create: if isAuthenticated() && get(/databases/$(database)/documents/shops/$(shopId)).data.isActive == true;
  allow write: if isSuperAdmin() || isAgentAdmin() || isShopOwner(shopId);
}
```

### 2. Set Environment Variables
Create `.env.local` with:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
GAME_VALIDATION_SECRET=your-secure-random-secret-min-32-chars
```

### 3. Add Rate Limiting
Implement rate limiting for the validation API.

### 4. Disable Demo Mode in Production
Add environment check to disable demo logins.

---

## 📋 Security Checklist

- [ ] Configure real Firebase credentials (not demo)
- [ ] Set strong `GAME_VALIDATION_SECRET` (32+ random characters)
- [ ] Enable Firebase Authentication (Email/Password)
- [ ] Configure Firestore security rules properly
- [ ] Enable HTTPS in production (Vercel/Netlify does this automatically)
- [ ] Add rate limiting to API endpoints
- [ ] Remove demo accounts from production
- [ ] Enable Firebase App Check for extra security
- [ ] Regular security audits of Firestore rules

---

## 🔐 Admin Security Best Practices

1. **Strong Passwords**: Use unique passwords for each admin
2. **Device Locking**: Enable device locking for shop admins
3. **Least Privilege**: Only grant necessary permissions
4. **Monitor Activity**: Check Firebase Console for suspicious activity
5. **Regular Backups**: Enable backup in shop settings

---

## 📞 Need Help?

If you notice any security issues, contact your development team immediately.
