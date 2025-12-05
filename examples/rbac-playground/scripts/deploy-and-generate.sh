#!/bin/bash
# =============================================================================
# RBAC Playground - Deploy and Generate Test Data
# =============================================================================
# This script builds, deploys, and generates test data in one go.
#
# Usage:
#   ./deploy-and-generate.sh [NETWORK]
#
# NETWORK defaults to 'testnet' if not provided.
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

NETWORK=${1:-testnet}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  RBAC Playground - Deploy & Generate${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${GREEN}Network:${NC} $NETWORK"
echo ""

# =============================================================================
# Step 1: Build
# =============================================================================
echo -e "${YELLOW}=== Step 1: Building Contract ===${NC}"
cd "$PROJECT_DIR"
make build

echo ""

# =============================================================================
# Step 2: Get Admin Address
# =============================================================================
echo -e "${YELLOW}=== Step 2: Getting Admin Address ===${NC}"
ADMIN=$(soroban keys address default)
echo -e "Admin: ${GREEN}$ADMIN${NC}"
echo ""

# =============================================================================
# Step 3: Deploy
# =============================================================================
echo -e "${YELLOW}=== Step 3: Deploying Contract ===${NC}"
CONTRACT=$(soroban contract deploy \
    --wasm target/wasm32-unknown-unknown/release/rbac_playground.wasm \
    --source default \
    --network $NETWORK \
    -- \
    --admin $ADMIN \
    --owner $ADMIN)

echo -e "Contract ID: ${GREEN}$CONTRACT${NC}"
echo ""

# Save contract ID to a file for reference
echo "$CONTRACT" > "$SCRIPT_DIR/.last-deployed-contract"
echo -e "Contract ID saved to: ${BLUE}$SCRIPT_DIR/.last-deployed-contract${NC}"
echo ""

# =============================================================================
# Step 4: Generate Test Data
# =============================================================================
echo -e "${YELLOW}=== Step 4: Generating Test Data ===${NC}"
"$SCRIPT_DIR/generate-test-data.sh" "$CONTRACT" "$ADMIN"

echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}✅ Deployment and test data generation complete!${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${GREEN}Contract ID:${NC} $CONTRACT"
echo -e "${GREEN}Explorer:${NC}    https://stellar.expert/explorer/$NETWORK/contract/$CONTRACT"

