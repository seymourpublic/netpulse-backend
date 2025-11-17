#!/bin/bash
# quick-setup.sh - Automated setup script for database schema migration

echo "🚀 NETPULSE Database Schema Migration Setup"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "models" ]; then
    echo -e "${RED}❌ Error: models directory not found${NC}"
    echo "Please run this script from your NETPULSE-BACKEND directory"
    exit 1
fi

echo -e "${GREEN}✅ Found models directory${NC}"

# Step 1: Create backup
echo ""
echo "Step 1: Creating Backup"
echo "-----------------------"

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backup_${BACKUP_DATE}"

mkdir -p "$BACKUP_DIR"

if [ -f "models/isp.js" ]; then
    cp models/isp.js "$BACKUP_DIR/"
    echo -e "${GREEN}✅ Backed up isp.js${NC}"
fi

if [ -f "models/userSession.js" ]; then
    cp models/userSession.js "$BACKUP_DIR/"
    echo -e "${GREEN}✅ Backed up userSession.js${NC}"
fi

if [ -f "models/speedTest.js" ]; then
    cp models/speedTest.js "$BACKUP_DIR/"
    echo -e "${GREEN}✅ Backed up speedTest.js${NC}"
fi

echo -e "${GREEN}✅ Backup created in $BACKUP_DIR${NC}"

# Step 2: Copy new model files
echo ""
echo "Step 2: Installing New Model Files"
echo "-----------------------------------"

# Assuming the improved files are in the current directory
if [ -f "improved-isp.js" ]; then
    cp improved-isp.js models/isp.js
    echo -e "${GREEN}✅ Installed improved isp.js${NC}"
else
    echo -e "${RED}❌ improved-isp.js not found${NC}"
    exit 1
fi

if [ -f "improved-userSession.js" ]; then
    cp improved-userSession.js models/userSession.js
    echo -e "${GREEN}✅ Installed improved userSession.js${NC}"
else
    echo -e "${RED}❌ improved-userSession.js not found${NC}"
    exit 1
fi

if [ -f "improved-speedTest.js" ]; then
    cp improved-speedTest.js models/speedTest.js
    echo -e "${GREEN}✅ Installed improved speedTest.js${NC}"
else
    echo -e "${RED}❌ improved-speedTest.js not found${NC}"
    exit 1
fi

# Step 3: Copy migration script
echo ""
echo "Step 3: Setting Up Migration Script"
echo "------------------------------------"

if [ ! -d "scripts" ]; then
    mkdir scripts
    echo -e "${GREEN}✅ Created scripts directory${NC}"
fi

if [ -f "migrate-database-schema.js" ]; then
    cp migrate-database-schema.js scripts/
    echo -e "${GREEN}✅ Copied migration script${NC}"
else
    echo -e "${RED}❌ migrate-database-schema.js not found${NC}"
    exit 1
fi

if [ -f "verify-migration.js" ]; then
    cp verify-migration.js scripts/
    echo -e "${GREEN}✅ Copied verification script${NC}"
else
    echo -e "${YELLOW}⚠️  verify-migration.js not found (optional)${NC}"
fi

# Step 4: Check if .env exists
echo ""
echo "Step 4: Checking Configuration"
echo "-------------------------------"

if [ -f ".env" ]; then
    echo -e "${GREEN}✅ Found .env file${NC}"
else
    echo -e "${YELLOW}⚠️  No .env file found${NC}"
    echo "Please create a .env file with your MONGODB_URI before running migration"
fi

# Step 5: Summary and next steps
echo ""
echo "==========================================="
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "==========================================="
echo ""
echo "Next Steps:"
echo "-----------"
echo ""
echo "1. ${YELLOW}BACKUP YOUR DATABASE${NC} (if using Atlas/Production):"
echo "   mongodump --uri=\"your-mongodb-uri\" --out=./db-backup-${BACKUP_DATE}"
echo ""
echo "2. Stop your application servers"
echo ""
echo "3. Run the migration:"
echo "   ${GREEN}node scripts/migrate-database-schema.js${NC}"
echo ""
echo "4. Verify the migration:"
echo "   ${GREEN}node scripts/verify-migration.js${NC}"
echo ""
echo "5. Restart your application"
echo ""
echo "Backup Location: ${GREEN}$BACKUP_DIR${NC}"
echo ""
echo "⚠️  IMPORTANT: Make sure to backup your database before running migration!"
echo ""

# Ask user if they want to continue with migration
echo ""
read -p "Do you want to run the migration now? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔄 Starting Migration..."
    echo "======================="
    node scripts/migrate-database-schema.js
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Migration completed successfully!${NC}"
        echo ""
        read -p "Do you want to run verification tests? (y/N): " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo ""
            echo "🔍 Running Verification..."
            echo "========================="
            node scripts/verify-migration.js
        fi
    else
        echo ""
        echo -e "${RED}❌ Migration failed!${NC}"
        echo "To rollback, restore from: $BACKUP_DIR"
        exit 1
    fi
else
    echo ""
    echo "Migration skipped. Run manually when ready:"
    echo "  ${GREEN}node scripts/migrate-database-schema.js${NC}"
fi

echo ""
echo "Done! 🎉"