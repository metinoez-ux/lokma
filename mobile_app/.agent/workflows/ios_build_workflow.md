---
description: Build and run the LOKMA app on iOS (iPhone 17 Pro Metin) - Use wired connection
---

# iOS Build Workflow

**Primary Development Device:** iPhone 17 Pro Metin
**Device ID:** `00008150-000808603C52401C`
**iOS Version:** 26.2

## Steps

// turbo-all

1. Navigate to mobile_app directory:

```bash
cd /Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/mobile_app
```

1. Check device is connected:

```bash
flutter devices
```

1. Build and run in **release mode** (for production testing):

```bash
flutter run --release -d 00008150-000808603C52401C
```

1. Or build in **debug mode** (for debugging with logs):

```bash
flutter run -d 00008150-000808603C52401C
```

## Troubleshooting

If build fails with "Could not run" error:

1. Open Xcode: `open ios/Runner.xcworkspace`
2. Select iPhone 17 Pro Metin as target device
3. Run from Xcode: Product → Run (Cmd+R)

If device not found:

1. Reconnect USB cable
2. Trust the computer on iOS device
3. Ensure Developer Mode is enabled (Settings → Privacy & Security → Developer Mode)
