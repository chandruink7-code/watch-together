#!/usr/bin/env bash
# ==============================================================
# Watch Together — Vercel client deploy
# --------------------------------------------------------------
# Run this from inside the `watch-together` folder AFTER you've
# successfully run ./deploy-server.sh.
#
# What it does:
#   1. Installs Vercel CLI if missing
#   2. Logs you in (browser/email magic-link)
#   3. Reads the server URL from .server-url
#   4. Sets VITE_SERVER_URL env var on Vercel
#   5. Deploys ./client to production
#   6. Prints the final shareable URL
# ==============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}=== Watch Together — Vercel Client Deploy ===${NC}"
echo ""

# --- Sanity checks ---
if [ ! -d "client" ] || [ ! -f "client/package.json" ]; then
  echo -e "${RED}Error:${NC} Run this from the watch-together folder (the one with /client inside)."
  exit 1
fi

# Read the server URL
SERVER_URL=""
if [ -f ".server-url" ]; then
  SERVER_URL=$(cat .server-url | tr -d '[:space:]')
fi

if [ -z "$SERVER_URL" ]; then
  echo -e "${YELLOW}No .server-url file found.${NC}"
  echo -e "Either run ${GREEN}./deploy-server.sh${NC} first, OR paste your server URL now:"
  read -r -p "Server URL (https://...): " SERVER_URL
fi

if [[ ! "$SERVER_URL" =~ ^https?:// ]]; then
  echo -e "${RED}Invalid URL: $SERVER_URL${NC}"
  echo "Must start with http:// or https://"
  exit 1
fi

echo -e "${GREEN}✓ Server URL: $SERVER_URL${NC}"
echo ""

# --- Step 1: Install Vercel CLI if missing ---
if ! command -v vercel &> /dev/null; then
  echo -e "${YELLOW}Vercel CLI not found. Installing globally via npm...${NC}"
  npm install -g vercel
fi

echo -e "${GREEN}✓ Vercel CLI ready${NC} ($(vercel --version 2>&1 | head -1))"
echo ""

# --- Step 2: Login ---
if ! vercel whoami &> /dev/null; then
  echo -e "${YELLOW}Logging in to Vercel...${NC}"
  echo -e "${YELLOW}Choose 'Continue with Email'. Vercel will email you a confirmation link.${NC}"
  echo ""
  vercel login
else
  echo -e "${GREEN}✓ Already logged in as $(vercel whoami 2>&1)${NC}"
fi

echo ""

# --- Step 3: Move into client folder ---
cd client

# --- Step 4: First-time link the project (creates it on Vercel) ---
# We use --yes to accept defaults non-interactively.
if [ ! -d ".vercel" ]; then
  echo -e "${YELLOW}Linking project to Vercel...${NC}"
  vercel link --yes --project watch-together || vercel link --yes
fi

echo ""

# --- Step 5: Set the env var ---
# Remove any old value first so we don't get prompted to overwrite.
echo -e "${YELLOW}Setting VITE_SERVER_URL on Vercel...${NC}"
vercel env rm VITE_SERVER_URL production --yes 2>/dev/null || true
vercel env rm VITE_SERVER_URL preview --yes 2>/dev/null || true
vercel env rm VITE_SERVER_URL development --yes 2>/dev/null || true

# Pipe value into stdin for non-interactive add.
echo "$SERVER_URL" | vercel env add VITE_SERVER_URL production
echo "$SERVER_URL" | vercel env add VITE_SERVER_URL preview
echo "$SERVER_URL" | vercel env add VITE_SERVER_URL development

echo ""
echo -e "${GREEN}✓ Env var set${NC}"
echo ""

# --- Step 6: Deploy to production ---
echo -e "${YELLOW}Deploying to production (this takes ~1 minute)...${NC}"
DEPLOY_OUTPUT=$(vercel --prod --yes 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract production URL
PROD_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1)

cd ..

echo ""
echo -e "${BLUE}===============================================${NC}"
echo -e "${GREEN}🎉  Watch Together is live!${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

if [ -n "$PROD_URL" ]; then
  echo -e "  Share this link:"
  echo ""
  echo -e "    ${GREEN}$PROD_URL${NC}"
  echo ""
else
  echo -e "${YELLOW}Couldn't auto-detect the production URL.${NC}"
  echo "Check the deploy output above for a https://*.vercel.app URL."
  echo ""
fi

echo -e "Server URL:   $SERVER_URL"
echo ""
echo -e "${YELLOW}Test it:${NC}"
echo -e "  1. Open the link above"
echo -e "  2. Create a room"
echo -e "  3. Click 'Copy link' and send to a friend"
echo -e "  4. Both pick the same video file → click 'Join call' for voice"
echo ""
echo -e "${YELLOW}Note about Railway free tier:${NC}"
echo -e "  Server sleeps after ~10 min of inactivity. First request after"
echo -e "  a sleep takes ~30s to wake up. To wake it before sharing, just"
echo -e "  open the server URL ($SERVER_URL) in a browser."
echo ""
