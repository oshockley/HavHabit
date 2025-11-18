# 🚀 Appflow Setup Guide for HavHabit

## What is Appflow?

Appflow is Ionic's cloud platform that:
- ✅ Builds iOS apps **without a Mac**
- ✅ Builds Android apps automatically
- ✅ Deploys live updates to users
- ✅ Integrates with GitHub for CI/CD
- ✅ Manages app signing certificates

**Cost:** Free tier available, Pro starts at $49/month

---

## Step 1: Sign Up for Appflow

1. Go to: https://ionic.io/appflow
2. Click **"Start for Free"**
3. Sign up with GitHub (easiest option)
4. Verify your email

---

## Step 2: Connect Your GitHub Repo

1. **Dashboard** → Click **"New App"**
2. **App Name:** HavHabit
3. **Connect Git Repository:**
   - Select **GitHub**
   - Authorize Ionic to access GitHub
   - Choose repository: `oshockley/HavHabit`
   - Branch: `main`
4. Click **"Connect"**

---

## Step 3: Configure App Settings

### Basic Settings
1. Go to **Settings** → **App Details**
2. Set:
   - **App ID:** `com.havhabit.app`
   - **App Name:** HavHabit
   - **Capacitor Version:** Auto-detect (or specify 7.x)

### iOS Settings
1. **Settings** → **iOS**
2. **Bundle ID:** `com.havhabit.app`
3. **Build Type:** Choose one:
   - **Development:** For testing
   - **App Store:** For production

### Android Settings
1. **Settings** → **Android**
2. **Package Name:** `com.havhabit.app`
3. **Build Type:** Debug or Release

---

## Step 4: Add iOS Certificates (Required for iOS)

### Option A: Let Appflow Generate Everything
1. **Settings** → **iOS Certificates**
2. Click **"Use Appflow to Create"**
3. Follow wizard (easiest option)
4. Appflow creates:
   - Development certificate
   - Distribution certificate
   - Provisioning profiles

### Option B: Upload Your Own
If you already have Apple Developer account:

1. **Generate on Mac:**
   ```bash
   # In Xcode:
   # 1. Open ios/App/App.xcworkspace
   # 2. Select target → Signing & Capabilities
   # 3. Select your team
   # 4. Export certificates and profiles
   ```

2. **Upload to Appflow:**
   - Settings → iOS Certificates
   - Upload .p12 certificate file
   - Upload provisioning profile

---

## Step 5: Add Android Signing (For Release Builds)

### Generate Keystore
```bash
# Run this command:
keytool -genkey -v -keystore havhabit-release.keystore \
  -alias havhabit -keyalg RSA -keysize 2048 -validity 10000

# You'll be asked for:
# - Keystore password (save this!)
# - Name, organization, etc.
```

### Upload to Appflow
1. **Settings** → **Android Certificates**
2. **Upload keystore file:** `havhabit-release.keystore`
3. Enter:
   - **Key alias:** havhabit
   - **Keystore password:** [what you entered]
   - **Key password:** [same password]

---

## Step 6: Trigger Your First Build

### iOS Build
1. Go to **Builds** tab
2. Click **"New Build"**
3. Select:
   - **Platform:** iOS
   - **Build Type:** Debug (for testing) or Release (for App Store)
   - **Commit:** Latest (main branch)
4. Click **"Build"**
5. Wait 5-15 minutes
6. Download `.ipa` file when complete

### Android Build
1. **Builds** → **"New Build"**
2. Select:
   - **Platform:** Android
   - **Build Type:** Debug or Release
3. Click **"Build"**
4. Wait 5-10 minutes
5. Download `.apk` or `.aab` file

---

## Step 7: Install on Device

### iOS (.ipa file)
**Option 1: TestFlight (Recommended)**
1. Upload .ipa to App Store Connect
2. Add to TestFlight
3. Invite yourself as tester
4. Install TestFlight app on iPhone
5. Install your app

**Option 2: Direct Install**
1. Use tool like **Diawi** or **AppCenter**
2. Upload .ipa
3. Open link on iPhone
4. Install (requires developer cert)

### Android (.apk file)
1. Download .apk to Android phone
2. Enable **"Install from Unknown Sources"**
3. Tap .apk file to install
4. App installs directly!

---

## Step 8: Set Up Live Updates (Optional but Powerful!)

Live Updates let you push HTML/CSS/JS changes without app store review!

1. **Deploy** tab → **"New Deploy"**
2. Select channel: **Production**
3. Select commit to deploy
4. Click **"Deploy"**
5. Users get updates automatically!

**What you can update:**
- ✅ Bug fixes
- ✅ UI changes
- ✅ New features (non-native)
- ❌ Native code changes (need full rebuild)

---

## Step 9: Automate Builds (CI/CD)

### Trigger Builds on Git Push
1. **Automations** tab
2. Click **"New Automation"**
3. Configure:
   - **Trigger:** Git Push to `main` branch
   - **Action:** Build iOS + Android
   - **Environment:** Production
4. Save

Now every time you push code, Appflow automatically builds!

---

## Step 10: Deploy to App Stores

### iOS App Store
1. Build **Release** iOS build in Appflow
2. Download .ipa file
3. Upload to App Store Connect:
   - Use **Transporter** app (Mac)
   - Or **Appflow → Distribute** (direct upload)
4. Submit for review

### Google Play Store
1. Build **Release** Android build in Appflow
2. Download .aab file
3. Upload to Google Play Console
4. Submit for review

---

## Alternative: Don't Use Appflow

If you prefer, you can build locally:

### iOS (Requires Mac)
```bash
cd ios/App
pod install
open App.xcworkspace
# Build in Xcode
```

### Android (Any OS)
```bash
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

---

## Cost Comparison

| Method | iOS | Android | Cost |
|--------|-----|---------|------|
| **Local Build** | Mac required | Free | Mac + $99/yr Apple |
| **Appflow Free** | 500 builds/mo | 500 builds/mo | Free |
| **Appflow Pro** | Unlimited | Unlimited | $49/mo |

---

## What I Recommend

### For Quick Testing
1. Use Appflow free tier
2. Build Debug versions
3. Install on your phone via TestFlight/APK

### For Production Launch
1. Build Release versions on Appflow
2. Download files
3. Submit to App Store/Play Store manually
4. Later: Set up automations

---

## Troubleshooting

### "Build Failed - Certificate Error"
- iOS: Upload valid provisioning profile
- Android: Check keystore password is correct

### "Capacitor Config Not Found"
- Ensure `capacitor.config.json` is in root
- Already committed ✅

### "iOS Build Stuck"
- Free tier has queue
- Upgrade to Pro for faster builds

---

## Next Steps

1. **Sign up:** https://ionic.io/appflow
2. **Connect GitHub:** Select oshockley/HavHabit repo
3. **Trigger build:** Click "New Build" → iOS or Android
4. **Download & test:** Install on your phone
5. **Submit:** Upload to App Store/Play Store

**Appflow makes it easy to build iOS without a Mac!** 🚀
