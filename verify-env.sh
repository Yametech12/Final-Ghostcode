#!/bin/bash
# 🔍 ENVIRONMENT VERIFICATION SCRIPT
# Run this script to verify your environment variables are correctly set

echo "🔍 EPIMETHEUS ENVIRONMENT VERIFICATION"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "   Copy .env.example to .env and fill in your values"
    exit 1
fi

echo -e "${GREEN}✅ .env file found${NC}"

# Required variables to check
REQUIRED_VARS=(
    "APP_URL"
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
    "VITE_SUPABASE_SERVICE_ROLE_KEY"
    "OPENROUTER_API_KEY"
    "GMAIL_USER"
    "GMAIL_APP_PASSWORD"
)

# Check each required variable
MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=" .env; then
        value=$(grep "^${var}=" .env | cut -d'=' -f2-)
        if [ -z "$value" ] || [ "$value" = "your_*" ] || [ "$value" = "YOUR_*" ]; then
            echo -e "${RED}❌ ${var} is empty or placeholder${NC}"
            MISSING_VARS+=("$var")
        else
            echo -e "${GREEN}✅ ${var} is set${NC}"
        fi
    else
        echo -e "${RED}❌ ${var} is missing${NC}"
        MISSING_VARS+=("$var")
    fi
done

# Optional variables
OPTIONAL_VARS=(
    "GCP_PROJECT_ID"
    "OPENROUTER_REFERER"
    "OPENROUTER_TITLE"
)

echo ""
echo "📋 OPTIONAL VARIABLES:"
for var in "${OPTIONAL_VARS[@]}"; do
    if grep -q "^${var}=" .env; then
        echo -e "${GREEN}✅ ${var} is set${NC}"
    else
        echo -e "${YELLOW}⚠️  ${var} is not set (optional)${NC}"
    fi
done

# Security checks
echo ""
echo "🔐 SECURITY CHECKS:"

# Check for placeholder values
PLACEHOLDER_COUNT=$(grep -c "your_\|YOUR_\|your-.*\|YOUR-.*" .env || true)
if [ "$PLACEHOLDER_COUNT" -gt 0 ]; then
    echo -e "${RED}⚠️  Found ${PLACEHOLDER_COUNT} placeholder values that need to be replaced${NC}"
else
    echo -e "${GREEN}✅ No placeholder values found${NC}"
fi

# Check if service role key looks like a real key (should be long JWT)
SERVICE_KEY=$(grep "^VITE_SUPABASE_SERVICE_ROLE_KEY=" .env | cut -d'=' -f2-)
if [ ${#SERVICE_KEY} -lt 100 ]; then
    echo -e "${RED}⚠️  Service role key appears too short - verify it's correct${NC}"
else
    echo -e "${GREEN}✅ Service role key length looks correct${NC}"
fi

# Summary
echo ""
echo "📊 SUMMARY:"
if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo -e "${GREEN}🎉 All required environment variables are configured!${NC}"
    echo ""
    echo "🚀 Ready for deployment! Run:"
    echo "   npm run build"
    echo "   npm run preview  # Test locally"
    echo "   # Then deploy to Vercel/Netlify"
else
    echo -e "${RED}❌ Missing or incomplete required variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "   - ${RED}${var}${NC}"
    done
    echo ""
    echo "📝 Fill in the missing values in your .env file"
    echo "💡 Use .env.example as a template"
fi

echo ""
echo "🔗 Useful links:"
echo "   Supabase Dashboard: https://supabase.com/dashboard"
echo "   OpenRouter Keys: https://openrouter.ai/keys"
echo "   Gmail App Passwords: https://myaccount.google.com/apppasswords"