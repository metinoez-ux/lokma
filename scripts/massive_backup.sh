#!/bin/bash
set -e

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M")
BACKUP_FILE="LOKMA_2026_FULL_WITH_MODULES_${TIMESTAMP}.zip"
PROJECT_ROOT=$(pwd)

echo "Starting MASSIVE Backup (Including node_modules & Pods)..."

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Exclusion list (Minimizing ONLY re-generatable build artifacts)
# We KEEP node_modules and Pods as requested
EXCLUDES=(
  "*/.next/*"
  "*/build/*"
  "*/.dart_tool/*"
  "*/android/.gradle/*"
  "*.DS_Store"
  "*.git/*"
)

# Recursive zip execution
# We zip the current directory content
zip -r "$BACKUP_DIR/$BACKUP_FILE" . -x "${EXCLUDES[@]}"

echo "Massive Backup Successful!"
echo "Archive location: $PROJECT_ROOT/$BACKUP_DIR/$BACKUP_FILE"
