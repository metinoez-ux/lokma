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

# Install Flutter SDK using stable channel
FLUTTER_HOME="$HOME/flutter"

if [ ! -d "$FLUTTER_HOME" ]; then
    echo "Installing Flutter SDK (stable channel)..."
    git clone https://github.com/flutter/flutter.git -b stable --depth 1 "$FLUTTER_HOME"
else
    echo "Flutter SDK already exists at $FLUTTER_HOME"
    cd "$FLUTTER_HOME"
    git fetch --depth 1
    git checkout stable
    git pull
    cd "$CI_PRIMARY_REPOSITORY_PATH/mobile_app"
fi

# Add Flutter to PATH
export PATH="$FLUTTER_HOME/bin:$PATH"

echo "Flutter version:"
flutter --version

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
