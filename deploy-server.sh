#!/usr/bin/env bash
# ==============================================================
# Watch Together — Railway server deploy
# --------------------------------------------------------------
# Run this from inside the `watch-together` folder (the one that
# contains both /server and /client).
#
# What it does:
#   1. Installs Railway CLI if missing
#   2. Logs you in (browser opens once)
#   3. Creates an empty Railway project
#   4. Deploys ./server
#   5. Generates a public URL
#   6. Prints the URL clearly so you can copy it
# ==============================================================

set -e  # exit on any error

# Colors for readable output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}=== Watch Together — Railway Server Deploy ===${NC}"
echo ""

# --- Sanity check: are we in the right folder? ---
if [ ! -d "server" ] || [ ! -f "server/package.json" ]; then
  echo -e "${RED}Error:${NC} Run this from the watch-together folder (the one with /server inside)."
  exit 1
fi

# --- Step 1: Install Railway CLI if missing ---
if ! command -v railway &> /dev/null; then
  echo -e "${YELLOW}Railway CLI not found. Installing...${NC}"

  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &> /dev/null; then
      brew install railway
    else
      echo -e "${RED}Homebrew not found.${NC} Install from https://brew.sh, or download Railway manually:"
      echo "  https://docs.railway.com/guides/cli"
      exit 1
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -fsSL https://railway.com/install.sh | sh
    export PATH="$HOME/.railway/bin:$PATH"
  else
    echo -e "${RED}Unsupported OS for auto-install.${NC} Install Railway manually:"
    echo "  https://docs.railway.com/guides/cli"
    exit 1
  fi
fi

echo -e "${GREEN}✓ Railway CLI ready${NC} ($(railway --version 2>&1 | head -1))"
echo ""

# --- Step 2: Login (browser opens) ---
# Check if already logged in by trying to get whoami
if ! railway whoami &> /dev/null; then
  echo -e "${YELLOW}Opening browser to log you in to Railway...${NC}"
  echo -e "${YELLOW}Sign up with email/Google if you don't have an account yet.${NC}"
  echo ""
  railway login
else
  echo -e "${GREEN}✓ Already logged in as $(railway whoami 2>&1)${NC}"
fi

echo ""

# --- Step 3: Move into server folder and init project ---
cd server

# If a project is already linked, skip init
if [ -f ".railway" ] || [ -f "railway.json" ] || railway status &> /dev/null; then
  echo -e "${GREEN}✓ Project already linked${NC}"
else
  echo -e "${YELLOW}Creating Railway project...${NC}"
  # --name flag avoids the interactive prompt
  railway init --name "watch-together-server" || railway init
fi

echo ""

# --- Step 4: Deploy ---
echo -e "${YELLOW}Deploying server (this takes 1-2 minutes)...${NC}"
railway up --detach

echo ""
echo -e "${GREEN}✓ Deploy started${NC}"
echo ""

# --- Step 5: Generate a public domain ---
# `railway domain` is idempotent — running it twice just returns the existing URL.
echo -e "${YELLOW}Generating public URL...${NC}"
DOMAIN_OUTPUT=$(railway domain 2>&1 || true)
echo "$DOMAIN_OUTPUT"

# Extract the URL from the output (looks for *.up.railway.app)
SERVER_URL=$(echo "$DOMAIN_OUTPUT" | grep -oE 'https?://[a-zA-Z0-9.-]+\.up\.railway\.app' | head -1)

if [ -z "$SERVER_URL" ]; then
  # Try variant — sometimes it just prints the domain without https://
  DOMAIN=$(echo "$DOMAIN_OUTPUT" | grep -oE '[a-zA-Z0-9.-]+\.up\.railway\.app' | head -1)
  if [ -n "$DOMAIN" ]; then
    SERVER_URL="https://$DOMAIN"
  fi
fi

cd ..

echo ""
echo -e "${BLUE}===============================================${NC}"

if [ -n "$SERVER_URL" ]; then
  echo -e "${GREEN}✓ Server is being deployed to:${NC}"
  echo ""
  echo -e "    ${GREEN}$SERVER_URL${NC}"
  echo ""
  echo -e "${YELLOW}Wait ~30-60 seconds, then test it by opening that URL in your browser.${NC}"
  echo -e "${YELLOW}You should see: {\"ok\":true,\"service\":\"watch-together-server\"}${NC}"
  echo ""
  # Save it to a file the client deploy script can read.
  echo "$SERVER_URL" > .server-url
  echo -e "${GREEN}URL saved to .server-url for the next step.${NC}"
else
  echo -e "${RED}Couldn't auto-detect the URL.${NC}"
  echo "Run this manually inside server/:"
  echo "  railway domain"
  echo "Then save the output to a file called .server-url at the project root."
fi

echo -e "${BLUE}===============================================${NC}"
echo ""
echo -e "Next: run ${GREEN}./deploy-client.sh${NC} to deploy the frontend."
echo ""
