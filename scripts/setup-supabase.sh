#!/bin/bash

# Supabase Setup Automation Script
# This script helps set up your Supabase project automatically

set -e

echo "🚀 Epimetheus Supabase Setup Script"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if SUPABASE_ACCESS_TOKEN is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "Please set your Supabase Access Token:"
    echo "export SUPABASE_ACCESS_TOKEN=your_token_here"
    echo "Get it from: https://app.supabase.com/account/tokens"
    exit 1
fi

# Check for required tools
command -v supabase >/dev/null 2>&1 || { print_error "Supabase CLI not found. Installing..."; npm install -g supabase; }

PROJECT_REF="cuinkiyozecqkskmufgo"  # Your project reference

echo ""
echo "1️⃣  Applying database schema..."

# Check if schema file exists
if [ -f "supabase-schema-v2.sql" ]; then
    print_success "Schema file found"
    echo ""
    echo "Open this URL to apply the schema manually:"
    echo "https://app.supabase.com/project/${PROJECT_REF}/sql"
    echo ""
    echo "Copy and paste the contents of supabase-schema-v2.sql and click 'Run'"
else
    print_error "supabase-schema-v2.sql not found"
fi

echo ""
echo "2️⃣  Creating storage bucket..."

# Create the bucket
npx supabase storage bucket create user-uploads \
    --public \
    --project-ref ${PROJECT_REF} \
    || print_warning "Bucket may already exist or creation failed"

print_success "Bucket configuration sent"
echo ""
echo "Verify in dashboard: https://app.supabase.com/project/${PROJECT_REF}/storage/buckets"

echo ""
echo "3️⃣  Setting up environment..."

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
    print_success ".env file created"
else
    print_success ".env file already exists"
fi

echo ""
echo "4️⃣  Running diagnostics..."
npm run diagnose

echo ""
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Verify the database schema was applied"
echo "2. Check the user-uploads bucket exists"
echo "3. Restart your development server: npm run dev"