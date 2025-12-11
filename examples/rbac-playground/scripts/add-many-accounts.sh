#!/bin/bash
# =============================================================================
# Add Many Accounts with Roles
# =============================================================================
# This script creates many test accounts and grants them various roles.
# Useful for testing UI with long lists of role members.
#
# Usage:
#   ./add-many-accounts.sh <CONTRACT_ID> [NUM_ACCOUNTS] [ADMIN_SOURCE]
#
# NUM_ACCOUNTS defaults to 35 if not provided.
# ADMIN_SOURCE defaults to "default" if not provided.
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${RED}Error: Contract ID is required${NC}"
    echo ""
    echo "Usage: $0 <CONTRACT_ID> [NUM_ACCOUNTS] [ADMIN_SOURCE]"
    exit 1
fi

CONTRACT=$1
NUM_ACCOUNTS=${2:-35}
ADMIN_SOURCE=${3:-default}
ADMIN=$(soroban keys address "$ADMIN_SOURCE")
NETWORK="testnet"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  Adding $NUM_ACCOUNTS Accounts with Roles${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${GREEN}Contract:${NC} $CONTRACT"
echo -e "${GREEN}Admin:${NC}    $ADMIN (source: $ADMIN_SOURCE)"
echo -e "${GREEN}Accounts:${NC} $NUM_ACCOUNTS"
echo ""

# Define roles to distribute
ROLES=("minter" "burner" "pauser" "viewer" "transfer" "approver" "operator")

# Account name prefixes for variety
PREFIXES=("user" "account" "member" "addr" "wallet")

# Helper function to invoke contract
invoke() {
    local desc=$1
    shift
    echo -e "  ${BLUE}→${NC} $desc"
    soroban contract invoke --id $CONTRACT --source "$ADMIN_SOURCE" --network $NETWORK -- "$@" 2>&1 | head -1 || true
}

# Generate and grant roles to accounts
echo -e "${YELLOW}=== Generating Accounts and Granting Roles ===${NC}"

created_accounts=()

for i in $(seq 1 $NUM_ACCOUNTS); do
    # Create account name
    prefix_idx=$(( (i - 1) % ${#PREFIXES[@]} ))
    account_name="${PREFIXES[$prefix_idx]}$i"
    
    # Generate the account (ignore if exists)
    echo -e "${YELLOW}Creating account: $account_name${NC}"
    soroban keys generate "$account_name" 2>/dev/null || true
    
    # Get the address
    addr=$(soroban keys address "$account_name")
    created_accounts+=("$account_name:$addr")
    
    # Determine which role(s) to grant
    # Distribute roles somewhat evenly with some overlap
    role_idx=$(( (i - 1) % ${#ROLES[@]} ))
    primary_role="${ROLES[$role_idx]}"
    
    # Grant primary role
    invoke "Grant $primary_role to $account_name" grant_role --account "$addr" --role "$primary_role" --caller "$ADMIN"
    
    # Every 3rd account gets an additional role
    if [ $(( i % 3 )) -eq 0 ]; then
        secondary_role_idx=$(( (role_idx + 1) % ${#ROLES[@]} ))
        secondary_role="${ROLES[$secondary_role_idx]}"
        invoke "Grant $secondary_role to $account_name (secondary)" grant_role --account "$addr" --role "$secondary_role" --caller "$ADMIN"
    fi
    
    # Every 5th account gets a third role
    if [ $(( i % 5 )) -eq 0 ]; then
        tertiary_role_idx=$(( (role_idx + 2) % ${#ROLES[@]} ))
        tertiary_role="${ROLES[$tertiary_role_idx]}"
        invoke "Grant $tertiary_role to $account_name (tertiary)" grant_role --account "$addr" --role "$tertiary_role" --caller "$ADMIN"
    fi
    
    echo ""
done

# Summary
echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}              SUMMARY${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${GREEN}Created $NUM_ACCOUNTS accounts with roles${NC}"
echo ""
echo -e "${GREEN}Role distribution:${NC}"

for role in "${ROLES[@]}"; do
    echo "  • $role"
done

echo ""
echo -e "${GREEN}Accounts created:${NC}"
for entry in "${created_accounts[@]}"; do
    name="${entry%%:*}"
    addr="${entry#*:}"
    echo "  $name: $addr"
done

echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}✅ Done adding accounts!${NC}"
echo -e "${BLUE}=============================================${NC}"

