# Morgan Mobile App

Flutter app for iOS and Android. Runs locally on simulators/emulators or physical devices.

## Prerequisites

| Platform | Requirement |
|----------|-------------|
| **Both** | Flutter **3.38.10** (last version supporting macOS 12 Monterey) |
| **iOS** | Xcode 14+ (you have Xcode 14.2), CocoaPods |
| **Android** | Android Studio + Android SDK (API 34+) |

### Install Flutter (macOS 12)

Latest Flutter requires macOS 14+. On this machine use **3.38.10**:

```bash
mkdir -p ~/development
git clone https://github.com/flutter/flutter.git -b 3.38.10 --depth 1 ~/development/flutter
export PATH="$HOME/development/flutter/bin:$PATH"
flutter --version
```

Add to `~/.zshrc`:

```bash
export PATH="$HOME/development/flutter/bin:$PATH"
```

### Install Android SDK (for Android only)

1. Install [Android Studio](https://developer.android.com/studio)
2. Open **SDK Manager** → install **Android SDK Platform 34** and **Android SDK Build-Tools**
3. Create a virtual device: **Device Manager** → Create Device → Pixel 7 → API 34
4. Verify:

```bash
flutter doctor --android-licenses
flutter doctor
```

## Run locally

From the **Morgan repo root**:

```bash
# List available simulators/emulators
pnpm mobile:devices

# iOS Simulator (default)
pnpm mobile:ios

# Android Emulator (start emulator first in Android Studio)
pnpm mobile:android
```

Or from `apps/mobile`:

```bash
cd apps/mobile
flutter pub get

# Pick a device
flutter devices

# iOS — example device id from `flutter devices`
flutter run -d "iPhone 14"

# Android emulator
flutter run -d emulator-5554
```

### Run on a specific device

```bash
bash scripts/run-mobile-ios.sh "iPhone 14"
bash scripts/run-mobile-android.sh emulator-5554
```

## App structure

```
lib/
├── main.dart
├── app.dart
├── core/
│   ├── config/app_config.dart   # API base URL per platform
│   └── theme/morgan_theme.dart
├── routing/app_router.dart      # go_router + bottom nav shell
├── features/
│   ├── onboarding/
│   ├── home/                    # Daily brief
│   ├── recommendations/
│   ├── chat/                    # Ask Morgan
│   ├── alerts/
│   └── settings/
└── shared/widgets/
```

## API URL in dev

| Target | Base URL |
|--------|----------|
| iOS Simulator | `http://localhost:8080` |
| Android Emulator | `http://10.0.2.2:8080` |
| Physical device | Your Mac's LAN IP, e.g. `http://192.168.1.10:8080` |

Override at run time:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8080
```

## Hot reload

While `flutter run` is active:

- `r` — hot reload
- `R` — hot restart
- `q` — quit

## Troubleshooting

### `VM initialization failed: macOS 12.0 is lower than 14.0`

You are on Flutter stable (too new). Pin **3.38.10** (see install above).

### CocoaPods issues (iOS)

```bash
cd apps/mobile/ios
pod install
cd ..
flutter run -d ios
```

### No Android SDK

Install Android Studio and run `flutter config --android-sdk ~/Library/Android/sdk`.

### Xcode version warning

Flutter recommends Xcode 15+. Xcode 14.2 works for local dev; upgrade when you can.

## Next steps

- Wire Shopify OAuth login
- Connect to `@morgan/api_server` briefing endpoints
- Add `flutter_secure_storage` auth token flow
- Add Firebase Cloud Messaging for push briefings
