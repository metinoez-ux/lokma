#!/bin/bash
set -e

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M")
BACKUP_FILE="LOKMA_2026_FULL_UNIFIED_${TIMESTAMP}.zip"
ICLOUD_DIR="/Users/metinoz/Library/Mobile Documents/com~apple~CloudDocs/LOKMA_Backups"
PROJECT_ROOT=$(pwd)

# Email Config
RESEND_API_KEY="re_5652Y16U_4vAQyzKHKbgEV2Y5dSsUXzyC"
EMAIL_TO="metin.oez@gmail.com"
EMAIL_FROM="LOKMA Marketplace <noreply@lokma.shop>"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting UNIFIED 3-Tier Backup...${NC}"

# 1. Create Backup Directory
mkdir -p "$BACKUP_DIR"
mkdir -p "$ICLOUD_DIR"

# 2. Define Excludes (Massive Tier - Keeping node_modules/Pods but removing build caches)
EXCLUDES=(
  "*/.next/*"
  "*/build/*"
  "*/.dart_tool/*"
  "*/android/.gradle/*"
  "*.DS_Store"
  "*.git/*"
)

# 3. Create Local Archive
echo -e "${BLUE}[1/3] Creating Local Archive (Including node_modules)...${NC}"
zip -r "$BACKUP_DIR/$BACKUP_FILE" . -x "${EXCLUDES[@]}"
FILE_SIZE=$(ls -lh "$BACKUP_DIR/$BACKUP_FILE" | awk '{print $5}')
echo -e "${GREEN}Local Archive Created: $BACKUP_FILE ($FILE_SIZE)${NC}"

# 4. Google Drive Upload (rclone)
echo -e "${BLUE}[2/3] Uploading to Google Drive (rclone)...${NC}"
rclone copy "$BACKUP_DIR/$BACKUP_FILE" gdrive:LOKMA_Backups/ -P
echo -e "${GREEN}Google Drive Upload Complete.${NC}"

# 5. iCloud Drive Replication
echo -e "${BLUE}[3/3] Replicating to iCloud Drive...${NC}"
cp -v "$BACKUP_DIR/$BACKUP_FILE" "$ICLOUD_DIR/"
echo -e "${GREEN}iCloud Replication Initiated.${NC}"

# 6. Send Email Report
echo -e "${BLUE}[4/4] Sending Email Report...${NC}"

HTML_BODY="<div style='font-family: Arial; padding: 20px; background: #f0f0f0;'>
<div style='background: white; padding: 20px; border-radius: 8px; border-left: 5px solid #4CAF50;'>
  <h2 style='color: #2E7D32; margin-top:0;'>✅ Backup Successful</h2>
  <p><strong>Timestamp:</strong> $TIMESTAMP</p>
  <p><strong>File:</strong> $BACKUP_FILE</p>
  <p><strong>Size:</strong> $FILE_SIZE</p>
  <hr style='border: 0; border-top: 1px solid #eee;'>
  <h3>Targets Verified:</h3>
  <ul>
    <li>✅ <strong>Local Disk:</strong> $BACKUP_DIR</li>
    <li>✅ <strong>Google Drive:</strong> gdrive:LOKMA_Backups/</li>
    <li>✅ <strong>iCloud Drive:</strong> .../LOKMA_Backups/</li>
  </ul>
  <p style='color: #666; font-size: 12px; margin-top: 20px;'>LOKMA 2026 Automated Backup System</p>
</div>
</div>"

# Use jq for proper JSON encoding to avoid escaping issues
JSON_PAYLOAD=$(jq -n \
  --arg from "$EMAIL_FROM" \
  --arg to "$EMAIL_TO" \
  --arg subject "✅ Full Backup Report: $TIMESTAMP" \
  --arg html "$HTML_BODY" \
  '{from: $from, to: $to, subject: $subject, html: $html}')

curl -s -X POST 'https://api.resend.com/emails' \
     -H "Authorization: Bearer $RESEND_API_KEY" \
     -H 'Content-Type: application/json' \
     -d "$JSON_PAYLOAD"

echo -e "${GREEN}Email Report Sent to $EMAIL_TO${NC}"

# Final Report
echo -e "---------------------------------------------------"
echo -e "${GREEN}✅ TRIPLE BACKUP COMPLETE${NC}"
echo -e "📄 Source: $BACKUP_DIR/$BACKUP_FILE ($FILE_SIZE)"
echo -e "☁️  GDrive: gdrive:LOKMA_Backups/$BACKUP_FILE"
echo -e "🍏 iCloud: .../com~apple~CloudDocs/LOKMA_Backups/$BACKUP_FILE"
echo -e "📧 Report: Sent to $EMAIL_TO"
echo -e "---------------------------------------------------"
