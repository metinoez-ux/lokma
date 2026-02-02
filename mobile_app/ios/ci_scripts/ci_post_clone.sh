#!/bin/sh

# ci_post_clone.sh - Xcode Cloud Post Clone Script for Flutter
# This script runs after cloning the repository

set -e

echo "=== LOKMA iOS CI Post Clone Script ==="
echo "Current directory: $(pwd)"
echo "CI_PRIMARY_REPOSITORY_PATH: $CI_PRIMARY_REPOSITORY_PATH"

# Navigate to the Flutter project root
cd "$CI_PRIMARY_REPOSITORY_PATH/mobile_app"
echo "Changed to Flutter project: $(pwd)"

# Install Flutter SDK
FLUTTER_VERSION="3.27.4"
FLUTTER_HOME="$HOME/flutter"

if [ ! -d "$FLUTTER_HOME" ]; then
    echo "Installing Flutter SDK $FLUTTER_VERSION..."
    git clone https://github.com/flutter/flutter.git -b stable "$FLUTTER_HOME"
    cd "$FLUTTER_HOME"
    git checkout $FLUTTER_VERSION
    cd "$CI_PRIMARY_REPOSITORY_PATH/mobile_app"
else
    echo "Flutter SDK already exists at $FLUTTER_HOME"
fi

# Add Flutter to PATH
export PATH="$FLUTTER_HOME/bin:$PATH"

echo "Flutter version:"
flutter --version

# Accept licenses
flutter doctor --android-licenses 2>/dev/null || true

# Clean and get dependencies
echo "Running flutter clean..."
flutter clean

echo "Running flutter pub get..."
flutter pub get

echo "Precaching iOS artifacts..."
flutter precache --ios

# Create .xcode.env.local with absolute Flutter path
echo "Creating .xcode.env.local..."
cat > "$CI_PRIMARY_REPOSITORY_PATH/mobile_app/ios/.xcode.env.local" << EOF
export FLUTTER_ROOT=$FLUTTER_HOME
EOF

# Navigate to iOS folder
cd ios
echo "Now in iOS directory: $(pwd)"

# Install CocoaPods dependencies
echo "Installing CocoaPods dependencies..."
pod install --repo-update

echo "=== CI Post Clone Complete ==="
echo "FLUTTER_ROOT is set to: $FLUTTER_HOME"
