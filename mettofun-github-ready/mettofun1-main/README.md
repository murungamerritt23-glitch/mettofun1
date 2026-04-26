# METOFUN - Promotional Reward Game App

![METOFUN Logo](public/metofun-logo.png)

A comprehensive promotional reward game application built for shops and businesses to engage customers with interactive prize draws and loyalty programs.

## 🚀 Features

### Core Functionality
- **🎯 Interactive Prize Draw**: Customers select items and numbers for chance to win prizes
- **🏪 Multi-Shop Support**: Multiple shops can use the same app with separate inventories
- **👥 User Management**: Role-based access (Super Admin, Agent Admin, Shop Admin)
- **📱 Mobile-First Design**: Optimized for Android devices with Capacitor
- **🔄 Offline Support**: Works offline with automatic data synchronization

### Advanced Features
- **🎁 Item Management**: Dynamic prize inventory with categories and values
- **📊 Analytics Dashboard**: Real-time insights on customer engagement and prizes
- **🎮 Game Customization**: Configurable odds, thresholds, and game mechanics
- **📞 NPN Compliance**: National Promotional Programme compliant with audit trails
- **🔐 Secure Authentication**: Firebase Auth with session management
- **💾 Data Synchronization**: Real-time sync between devices and Firebase

### NPN Features
- **Grant Entry System**: Shop admins can grant free entries to customers
- **Compliance Tracking**: Full audit trail of all promotional activities
- **Entry Validation**: Automatic validation and limits per customer/shop
- **Real-time Sync**: NPN entries synchronized across all devices

## 🛠️ Tech Stack

- **Frontend**: Next.js 16.1.6, React 19.2.3, TypeScript
- **Styling**: Tailwind CSS 4.1.17, Framer Motion
- **Backend**: Firebase (Auth, Firestore, Realtime Database)
- **Database**: IndexedDB (local) + Firebase (cloud)
- **Mobile**: Capacitor 6.0.0 (Android)
- **State Management**: Zustand 5.0.0
- **Build Tool**: Bun

## 📦 Installation

### Prerequisites
- Node.js 18+ or Bun
- Firebase project with Authentication and Realtime Database enabled
- Android Studio (for mobile builds)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/metofun-game.git
   cd metofun-game
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Configure Firebase**
   - Copy `.env.example` to `.env.local`
   - Add your Firebase configuration
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
   ```

4. **Start development server**
   ```bash
   bun run dev
   ```

5. **Build for production**
   ```bash
   bun run build
   bun run start
   ```

## 📱 Mobile Build (VoltBuilder)

### Prerequisites
- Completed Firebase configuration
- Android build environment

### Build Steps

1. **Export static build**
   ```bash
   bun run build
   ```

2. **Upload to VoltBuilder**
   - Create account at [VoltBuilder](https://volt.build)
   - Upload the entire project directory
   - Select Android APK build
   - Download the generated APK

### Capacitor Configuration
The app includes pre-configured Capacitor settings:
- App ID: `com.metofun.app`
- App Name: `ETO FUN`
- Web Directory: `out/` (static export)

## 🔐 User Roles & Permissions

### Super Admin
- Full system access
- Create/manage shops and admins
- View global analytics
- Configure system settings

### Agent Admin
- Manage assigned shops
- Create shop admins
- View regional analytics

### Shop Admin
- Manage shop inventory
- Process customer entries
- Grant NPN entries
- View shop-specific analytics

## 🎮 Game Mechanics

### Customer Journey
1. **Enter Purchase Amount**: Customer provides receipt amount
2. **Select Item**: Choose from available prize inventory
3. **Pick Number**: Random number generation with configurable odds
4. **Result**: Win/lose determination with instant feedback
5. **Nomination**: Option to nominate items for future prizes

### Odds Configuration
- Configurable win thresholds
- Dynamic odds based on purchase amounts
- Fair random number generation
- Audit trail for all results

## 📊 Analytics & Reporting

### Real-time Metrics
- Total entries and wins
- Popular items and categories
- Customer engagement trends
- Shop performance analytics

### NPN Compliance
- Entry audit trails
- Grant history tracking
- Customer participation records
- Regulatory compliance reports

## 🔧 Development

### Available Scripts
```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Run ESLint
bun run typecheck    # Run TypeScript check
bun run test         # Run tests
bun run emulators    # Start Firebase emulators
```

### Project Structure
```
src/
├── app/                 # Next.js app directory
├── components/          # React components
│   ├── AdminDashboard.tsx
│   ├── GameMode.tsx
│   ├── LoginPage.tsx
│   └── ...
├── lib/                 # Utility functions
│   ├── firebase.ts      # Firebase configuration
│   ├── local-db.ts      # IndexedDB operations
│   ├── sync-service.ts  # Data synchronization
│   └── ...
├── store/               # Zustand state management
└── types/               # TypeScript definitions
```

### Key Components

#### AdminDashboard
- Complete admin interface
- Shop and item management
- Analytics and reporting
- NPN entry granting

#### GameMode
- Customer prize draw interface
- Item and number selection
- Game result display
- Nomination system

#### LoginPage
- Multi-role authentication
- Offline login support
- Shop assignment logic
- Session management

## 🔒 Security Features

- **Firebase Authentication**: Secure user authentication
- **Session Management**: Automatic logout on inactivity
- **Rate Limiting**: Protection against brute force attacks
- **Data Encryption**: Secure local data storage
- **Permission System**: Role-based access control

## 📈 Performance

- **Offline-First**: Works without internet connection
- **Lazy Loading**: Components loaded on demand
- **Optimized Builds**: Tree-shaken and minified bundles
- **Mobile Optimized**: Touch-friendly interface
- **Fast Sync**: Efficient data synchronization

## 🐛 Troubleshooting

### Common Issues

**Shops not loading after login**
- Check Firebase configuration
- Ensure user has proper permissions
- Verify shop assignment in database

**Build failures**
```bash
bun run typecheck  # Check for TypeScript errors
bun run lint       # Check for code quality issues
```

**Mobile build issues**
- Ensure Android Studio is installed
- Check Capacitor configuration
- Verify Firebase settings

### Debug Mode
Enable debug logging in browser console:
```javascript
localStorage.setItem('debug', 'true');
```

## 📄 License

This project is proprietary software. All rights reserved.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📞 Support

For support and questions:
- Create an issue in this repository
- Check the troubleshooting section
- Review the documentation

---

**Built with ❤️ for engaging customer experiences**</content>
<parameter name="filePath">/workspace/cc40c8ac-ef66-4875-9fbc-92916a54778a/sessions/agent_ac38867b-8ced-48fe-98d5-8f0aee22db33/metofun-github-ready/mettofun1-main/README.md