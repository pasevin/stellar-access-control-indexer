#!/bin/bash
# =============================================================================
# RBAC Playground - Test Data Generator
# =============================================================================
# This script generates comprehensive test data for the RBAC contract indexer.
# It executes multiple transactions to generate all possible event types.
#
# Usage:
#   ./generate-test-data.sh <CONTRACT_ID> [ADMIN_ADDRESS]
#
# If ADMIN_ADDRESS is not provided, it uses the 'default' soroban identity.
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Contract ID is required${NC}"
    echo ""
    echo "Usage: $0 <CONTRACT_ID> [ADMIN_ADDRESS]"
    echo ""
    echo "Example:"
    echo "  $0 CAHHWNLOHIGFHYG7VOXNVK5EKLL25RIGNGUFLTTUUWZSQW5GGIPGXDKT"
    echo ""
    exit 1
fi

CONTRACT=$1
ADMIN=${2:-$(soroban keys address default)}
NETWORK="testnet"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  RBAC Playground - Test Data Generator${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${GREEN}Contract:${NC} $CONTRACT"
echo -e "${GREEN}Admin:${NC}    $ADMIN"
echo -e "${GREEN}Network:${NC}  $NETWORK"
echo ""

# =============================================================================
# Generate Test Accounts
# =============================================================================
echo -e "${YELLOW}=== Generating Test Accounts ===${NC}"

# Generate test identities (ignore errors if they already exist)
soroban keys generate alice 2>/dev/null || true
soroban keys generate bob 2>/dev/null || true
soroban keys generate charlie 2>/dev/null || true
soroban keys generate dave 2>/dev/null || true
soroban keys generate eve 2>/dev/null || true

ALICE=$(soroban keys address alice)
BOB=$(soroban keys address bob)
CHARLIE=$(soroban keys address charlie)
DAVE=$(soroban keys address dave)
EVE=$(soroban keys address eve)

echo -e "  Alice:   ${GREEN}$ALICE${NC}"
echo -e "  Bob:     ${GREEN}$BOB${NC}"
echo -e "  Charlie: ${GREEN}$CHARLIE${NC}"
echo -e "  Dave:    ${GREEN}$DAVE${NC}"
echo -e "  Eve:     ${GREEN}$EVE${NC}"
echo ""

# Helper function to invoke contract
invoke() {
    local desc=$1
    shift
    echo -e "  ${BLUE}→${NC} $desc"
    soroban contract invoke --id $CONTRACT --source default --network $NETWORK -- "$@" 2>&1 | grep -E "(Success|Error)" || true
}

# =============================================================================
# Phase 1: Grant Roles (RoleGranted events)
# =============================================================================
echo -e "${YELLOW}=== Phase 1: Granting Roles (RoleGranted events) ===${NC}"

invoke "Grant MINTER to Alice" grant_role --account $ALICE --role minter --caller $ADMIN
invoke "Grant MINTER to Bob" grant_role --account $BOB --role minter --caller $ADMIN
invoke "Grant BURNER to Bob" grant_role --account $BOB --role burner --caller $ADMIN
invoke "Grant BURNER to Charlie" grant_role --account $CHARLIE --role burner --caller $ADMIN
invoke "Grant PAUSER to Charlie" grant_role --account $CHARLIE --role pauser --caller $ADMIN
invoke "Grant VIEWER to Dave" grant_role --account $DAVE --role viewer --caller $ADMIN
invoke "Grant VIEWER to Eve" grant_role --account $EVE --role viewer --caller $ADMIN
invoke "Grant TRANSFER to Eve" grant_role --account $EVE --role transfer --caller $ADMIN
invoke "Grant OPERATOR to Alice" grant_role --account $ALICE --role operator --caller $ADMIN
invoke "Grant APPROVER to Alice" grant_role --account $ALICE --role approver --caller $ADMIN
invoke "Grant APPROVER to Bob" grant_role --account $BOB --role approver --caller $ADMIN
invoke "Grant APPROVER to Charlie" grant_role --account $CHARLIE --role approver --caller $ADMIN

# Grant admin necessary roles for operations
invoke "Grant BURNER to Admin" grant_role --account $ADMIN --role burner --caller $ADMIN
invoke "Grant PAUSER to Admin" grant_role --account $ADMIN --role pauser --caller $ADMIN
invoke "Grant TRANSFER to Admin" grant_role --account $ADMIN --role transfer --caller $ADMIN
invoke "Grant APPROVER to Admin" grant_role --account $ADMIN --role approver --caller $ADMIN
invoke "Grant VIEWER to Admin" grant_role --account $ADMIN --role viewer --caller $ADMIN

echo ""

# =============================================================================
# Phase 2: Mint Tokens (Minted events)
# =============================================================================
echo -e "${YELLOW}=== Phase 2: Minting Tokens (Minted events) ===${NC}"

invoke "Mint 10000 to Alice" mint --to $ALICE --amount 10000 --caller $ADMIN
invoke "Mint 5000 to Bob" mint --to $BOB --amount 5000 --caller $ADMIN
invoke "Mint 3000 to Charlie" mint --to $CHARLIE --amount 3000 --caller $ADMIN
invoke "Mint 7500 to Dave" mint --to $DAVE --amount 7500 --caller $ADMIN
invoke "Mint 2500 to Eve" mint --to $EVE --amount 2500 --caller $ADMIN

echo ""

# =============================================================================
# Phase 3: Burn Tokens (Burned events)
# =============================================================================
echo -e "${YELLOW}=== Phase 3: Burning Tokens (Burned events) ===${NC}"

invoke "Burn 1000 from Alice" burn --from $ALICE --amount 1000 --caller $ADMIN
invoke "Burn 500 from Bob" burn --from $BOB --amount 500 --caller $ADMIN
invoke "Burn 200 from Charlie" burn --from $CHARLIE --amount 200 --caller $ADMIN

echo ""

# =============================================================================
# Phase 4: Batch Operations (BatchOperation + Minted events)
# =============================================================================
echo -e "${YELLOW}=== Phase 4: Batch Operations (BatchOperation events) ===${NC}"

invoke "Batch mint to Alice, Bob, Charlie" batch_mint \
    --recipients "[\"$ALICE\", \"$BOB\", \"$CHARLIE\"]" \
    --amounts "[\"2000\", \"1500\", \"1000\"]" \
    --caller $ADMIN

echo ""

# =============================================================================
# Phase 5: Pause/Unpause (Paused, Unpaused events)
# =============================================================================
echo -e "${YELLOW}=== Phase 5: Pause/Unpause (Paused, Unpaused events) ===${NC}"

invoke "Pause contract" pause --caller $ADMIN
invoke "Unpause contract" unpause --caller $ADMIN
invoke "Pause again" pause --caller $ADMIN
invoke "Unpause again" unpause --caller $ADMIN

echo ""

# =============================================================================
# Phase 6: Execute Transfers (TransferExecuted events)
# =============================================================================
echo -e "${YELLOW}=== Phase 6: Execute Transfers (TransferExecuted events) ===${NC}"

invoke "Transfer 500 from Alice to Bob" execute_transfer --from $ALICE --to $BOB --amount 500 --caller $ADMIN
invoke "Transfer 300 from Bob to Charlie" execute_transfer --from $BOB --to $CHARLIE --amount 300 --caller $ADMIN
invoke "Transfer 200 from Charlie to Dave" execute_transfer --from $CHARLIE --to $DAVE --amount 200 --caller $ADMIN

echo ""

# =============================================================================
# Phase 7: Revoke Roles (RoleRevoked events)
# =============================================================================
echo -e "${YELLOW}=== Phase 7: Revoking Roles (RoleRevoked events) ===${NC}"

invoke "Revoke MINTER from Bob" revoke_role --account $BOB --role minter --caller $ADMIN
invoke "Revoke BURNER from Charlie" revoke_role --account $CHARLIE --role burner --caller $ADMIN

echo ""

# =============================================================================
# Phase 8: More Role Changes
# =============================================================================
echo -e "${YELLOW}=== Phase 8: Additional Role Changes ===${NC}"

invoke "Re-grant MINTER to Bob" grant_role --account $BOB --role minter --caller $ADMIN
invoke "Grant VIEWER to Alice" grant_role --account $ALICE --role viewer --caller $ADMIN
invoke "Revoke VIEWER from Eve" revoke_role --account $EVE --role viewer --caller $ADMIN
invoke "Re-grant VIEWER to Eve" grant_role --account $EVE --role viewer --caller $ADMIN

echo ""

# =============================================================================
# Phase 9: Proposed Transfer Flow (Multi-sig)
# =============================================================================
echo -e "${YELLOW}=== Phase 9: Proposed Transfer Flow (TransferProposed, TransferApproved, TransferFinalized) ===${NC}"

invoke "Propose transfer (2 approvals needed)" propose_transfer \
    --from $ALICE --to $EVE --amount 1000 --required_approvals 2 --proposer $ADMIN

invoke "First approval" approve_transfer --id 0 --approver $ADMIN

invoke "Propose another transfer (1 approval)" propose_transfer \
    --from $BOB --to $CHARLIE --amount 500 --required_approvals 1 --proposer $ADMIN

invoke "Approve and finalize" approve_transfer --id 1 --approver $ADMIN

echo ""

# =============================================================================
# Phase 10: More Operations
# =============================================================================
echo -e "${YELLOW}=== Phase 10: Additional Operations ===${NC}"

invoke "Grant TRANSFER to Dave" grant_role --account $DAVE --role transfer --caller $ADMIN
invoke "Grant PAUSER to Eve" grant_role --account $EVE --role pauser --caller $ADMIN
invoke "Revoke APPROVER from Charlie" revoke_role --account $CHARLIE --role approver --caller $ADMIN
invoke "Revoke TRANSFER from Eve" revoke_role --account $EVE --role transfer --caller $ADMIN
invoke "Grant BURNER to Eve" grant_role --account $EVE --role burner --caller $ADMIN

echo ""

# =============================================================================
# Phase 11: Final Batch
# =============================================================================
echo -e "${YELLOW}=== Phase 11: Final Operations ===${NC}"

invoke "Batch burn" batch_burn \
    --accounts "[\"$ALICE\", \"$BOB\"]" \
    --amounts "[\"500\", \"300\"]" \
    --caller $ADMIN

invoke "Mint to Charlie" mint --to $CHARLIE --amount 1500 --caller $ADMIN
invoke "Burn from Dave" burn --from $DAVE --amount 400 --caller $ADMIN

echo ""

# =============================================================================
# Phase 12: View Functions (SensitiveDataAccessed events)
# =============================================================================
echo -e "${YELLOW}=== Phase 12: View Functions (SensitiveDataAccessed events) ===${NC}"

invoke "View sensitive stats" view_sensitive_stats --caller $ADMIN

echo ""

# =============================================================================
# Summary
# =============================================================================
echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}              SUMMARY${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${GREEN}Contract:${NC} $CONTRACT"
echo -e "${GREEN}Network:${NC}  $NETWORK"
echo ""
echo -e "${GREEN}Events Generated (approximately):${NC}"
echo "  • RoleGranted:           ~25 events"
echo "  • RoleRevoked:           ~5 events"
echo "  • Minted:                ~12 events"
echo "  • Burned:                ~8 events"
echo "  • Paused:                2 events"
echo "  • Unpaused:              2 events"
echo "  • TransferExecuted:      5 events"
echo "  • BatchOperation:        2 events"
echo "  • TransferProposed:      2 events"
echo "  • TransferApproved:      2 events"
echo "  • TransferFinalized:     1 event"
echo "  • SensitiveDataAccessed: 1 event"
echo ""
echo -e "${GREEN}Total: ~60+ events${NC}"
echo ""
echo -e "${GREEN}Test Accounts:${NC}"
echo "  Alice:   $ALICE"
echo "  Bob:     $BOB"
echo "  Charlie: $CHARLIE"
echo "  Dave:    $DAVE"
echo "  Eve:     $EVE"
echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}✅ Test data generation complete!${NC}"
echo -e "${BLUE}=============================================${NC}"

