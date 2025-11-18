# 📱 HavHabit Mobile App Setup Guide

## What You Now Have

Your habit tracker is now a **real mobile app** that can be installed on iOS and Android! 🎉

## Quick Start

### 1. Build and Sync
```bash
npm run sync
```

This copies your web files to the `www` folder and syncs with iOS/Android projects.

### 2. Open in Xcode (iOS)
```bash
npm run open:ios
```

**Requirements:**
- macOS with Xcode installed
- Apple Developer account ($99/year for App Store)

**In Xcode:**
1. Select your development team
2. Change bundle ID if needed: `com.havhabit.app`
3. Click ▶️ to run on simulator or device
4. For real device: Connect iPhone, select it, click Run

### 3. Open in Android Studio (Android)
```bash
npm run open:android
```

**Requirements:**
- Android Studio installed
- Android SDK configured

**In Android Studio:**
1. Wait for Gradle sync
2. Select device/emulator
3. Click ▶️ Run
4. For real device: Enable USB debugging, connect, run

## Native Features You Get

### ✅ Already Implemented

1. **📸 Native Camera**
   - Photo evidence uses device camera
   - No web fallback needed
   - Automatic permission handling

2. **🔔 Push Notifications**
   - Local notifications for habit reminders
   - Daily reminders at custom times
   - Background notifications

3. **📳 Haptic Feedback**
   - Vibration on habit completion
   - Success/error haptic patterns
   - Feels like a real app!

4. **🎨 Native UI**
   - Status bar styling (dark mode)
   - Splash screen
   - App icon
   - Full-screen mode

### 🚀 How to Use Native Features

#### Set Habit Reminder
```javascript
// In your app, add this to habit cards:
window.nativeApp.scheduleReminder(habit, '09:00'); // 9 AM daily
```

#### Take Photo Evidence
```javascript
// Already integrated in captureHabitEvidence()
// Just click 📸 button - native camera opens!
```

#### Haptic Feedback
```javascript
// Already integrated on toggleToday()
// Feel vibration when completing habits
```

## App Store Submission

### iOS App Store

1. **Create App in App Store Connect**
   - Go to https://appstoreconnect.apple.com
   - Create new app
   - Bundle ID: `com.havhabit.app`
   - Name: HavHabit

2. **Add App Icons**
   - Create icons: 1024x1024, 512x512, 256x256, etc.
   - Use tool: https://appicon.co
   - Place in `ios/App/Assets.xcassets/AppIcon.appiconset/`

3. **Build for Archive**
   - In Xcode: Product → Archive
   - Upload to App Store Connect
   - Submit for review (usually 1-3 days)

4. **Pricing**
   - Free with In-App Purchases
   - Premium: $9.99/month
   - Yearly: $59.99/year

### Google Play Store

1. **Create App in Play Console**
   - Go to https://play.google.com/console
   - Create new app
   - Package name: `com.havhabit.app`

2. **Add Assets**
   - App icon: 512x512
   - Feature graphic: 1024x500
   - Screenshots: Various sizes

3. **Build APK/AAB**
   ```bash
   cd android
   ./gradlew bundleRelease
   # Output: android/app/build/outputs/bundle/release/app-release.aab
   ```

4. **Upload and Submit**
   - Upload AAB to Play Console
   - Fill out store listing
   - Submit (review takes 1-7 days)

## App Icons Needed

Create icons at these sizes:
- **iOS:** 20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024
- **Android:** 48, 72, 96, 144, 192, 512

Use your app's colors:
- Background: `#0a0e1a` (dark)
- Icon: `#6ee7b7` (green accent)
- Design: Habit tracker checkmark or flame emoji

## Testing on Real Devices

### iOS (Real iPhone)
1. Connect iPhone via USB
2. In Xcode: Window → Devices and Simulators
3. Trust this computer on iPhone
4. Select iPhone as target
5. Click Run (⌘R)

### Android (Real Phone)
1. Enable Developer Options on phone
2. Enable USB Debugging
3. Connect via USB
4. In Android Studio, select device
5. Click Run

## Troubleshooting

### "Command not found: npx"
Install Node.js: https://nodejs.org

### iOS Build Fails
- Update Xcode to latest
- Run: `cd ios/App && pod install`
- Clean build folder: Shift+Cmd+K

### Android Gradle Error
- Open Android Studio
- File → Sync Project with Gradle Files
- Update Android SDK if prompted

### Capacitor Errors
```bash
npm install @capacitor/core @capacitor/cli --save
npx cap sync
```

## Development Workflow

1. **Make Changes**
   - Edit HTML/CSS/JS files in root
   
2. **Test in Browser**
   - `npm run dev` (Python server)
   - Open http://localhost:8080

3. **Sync to Mobile**
   ```bash
   npm run sync
   ```

4. **Test on Device**
   - Open in Xcode/Android Studio
   - Run on simulator/device

5. **Deploy Updates**
   - Rebuild app
   - Submit new version to stores

## Monetization (Already Built!)

Your app has these features ready:
- ✅ Free tier (3 habits max)
- ✅ Premium tier ($9.99/mo)
- ✅ Yearly plan ($59.99/yr)
- ⏳ Need to add: Stripe/RevenueCat for payments

### Add In-App Purchases
```bash
npm install @capacitor/purchases
```

Then integrate RevenueCat for cross-platform subscriptions.

## Next Steps

1. **Create App Icons**
   - Design 1024x1024 icon
   - Generate all sizes: https://appicon.co

2. **Add Splash Screen**
   - Create 2732x2732 splash image
   - Use: https://www.npmjs.com/package/capacitor-splash-screen

3. **Test Everything**
   - All features work on device?
   - Camera permissions?
   - Notifications working?

4. **Submit to Stores**
   - iOS: 1-3 days review
   - Android: 1-7 days review

5. **Marketing**
   - Use your landing.html page
   - Collect emails on waitlist
   - Launch on Product Hunt

## Support

- **Capacitor Docs:** https://capacitorjs.com
- **Ionic Forum:** https://forum.ionicframework.com
- **iOS Guidelines:** https://developer.apple.com/app-store/review/guidelines/
- **Android Guidelines:** https://support.google.com/googleplay/android-developer/answer/9859455

---

**Your app is ready for mobile! 🚀**

Run `npm run sync` and open in Xcode/Android Studio to see it live.
