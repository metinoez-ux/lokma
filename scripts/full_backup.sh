#!/bin/bash
set -e

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M")
BACKUP_FILE="LOKMA_BACKUP_${TIMESTAMP}.zip"
PROJECT_ROOT=$(pwd)

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Full Backup...${NC}"

# Ensure backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
  mkdir -p "$BACKUP_DIR"
  echo "Created directory: $BACKUP_DIR"
fi

# Define exclusion list to avoid bulky generated files
# Excluding: node_modules, build caches, git history (optional, but requested full, keeping git might be huge if history is long, usually safer to strictly code. 
# actually, keeping .git is good for full backup, but user asked for "backup" usually implying source + state.
# I will exclude heavy build artifacts.
EXCLUDES=(
  "*/node_modules/*"
  "*/.next/*"
  "*/build/*"
  "*/.dart_tool/*"
  "*/ios/Pods/*"
  "*/macos/Pods/*"
  "*/android/.gradle/*"
  "*.DS_Store"
)

# Construct zip command
echo -e "${BLUE}Zipping project files (excluding build artifacts)...${NC}"
zip -r "$BACKUP_DIR/$BACKUP_FILE" \
  admin_portal \
  mobile_app \
  landing_page \
  scripts \
  docs \
  .secrets \
  .gitignore \
  README.md \
  -x "${EXCLUDES[@]}"

echo -e "${GREEN}Backup Successful!${NC}"
echo -e "Archive location: ${GREEN}$PROJECT_ROOT/$BACKUP_DIR/$BACKUP_FILE${NC}"
ls -lh "$BACKUP_DIR/$BACKUP_FILE"
