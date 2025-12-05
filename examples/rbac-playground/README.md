# RBAC Playground - OpenZeppelin Stellar Access Control Example

This example contract demonstrates the full capabilities of OpenZeppelin's Stellar Access Control library, generating events that can be indexed by the SubQuery indexer.

## Features

This contract implements:

- **AccessControl**: Role-based permissions with `RoleGranted` and `RoleRevoked` events
- **Ownable**: Ownership management with `OwnershipTransferred` events
- **8 Distinct Roles**: Owner, Operator, Minter, Burner, Pauser, Viewer, Transfer, Approver
- **Pausable Pattern**: Contract can be paused/unpaused
- **Multi-sig Approvals**: Pending transfers require multiple approver signatures
- **Role Enumeration**: List all members with any specific role
- **Batch Operations**: Operator role can perform bulk mints/burns

## Role Hierarchy

| Role         | Symbol          | Description                                             |
| ------------ | --------------- | ------------------------------------------------------- |
| **Owner**    | (Ownable)       | Top-level ownership, can emergency pause                |
| **Admin**    | (AccessControl) | Can grant/revoke roles, manage role admins              |
| **Operator** | `operator`      | Batch operations (batch mint, batch burn)               |
| **Minter**   | `minter`        | Can mint new tokens                                     |
| **Burner**   | `burner`        | Can burn existing tokens                                |
| **Pauser**   | `pauser`        | Can pause/unpause the contract                          |
| **Viewer**   | `viewer`        | Can access sensitive view functions                     |
| **Transfer** | `transfer`      | Can transfer tokens between accounts, propose transfers |
| **Approver** | `approver`      | Can approve pending multi-sig transfers                 |

## Prerequisites

1. **Rust and Soroban CLI**:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install Soroban CLI
cargo install --locked soroban-cli
```

2. **Configure Soroban for Testnet**:

```bash
# Add network configuration
soroban network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# Create or import an identity
soroban keys generate default
# OR import existing:
# soroban keys add default --secret-key YOUR_SECRET_KEY
```

## Building and Deploying

### 1. Build the Contract

```bash
cd examples/rbac-playground
make build
```

This creates an optimized WASM file ready for deployment.

### 2. Deploy to Testnet

```bash
make deploy
```

This will output a contract ID like: `CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX`

Save this contract ID for the next steps.

### 3. Initialize the Contract

```bash
# Replace with your contract ID and addresses
make init \
  CONTRACT=CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX \
  ADMIN=GABC... \
  OWNER=GDEF...
```

This sets up the admin and owner roles, and grants MINTER_ROLE and OPERATOR_ROLE to the admin.

## Role-Based Functions

### Operator Role (`operator`)

```bash
# Batch mint to multiple recipients
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  batch_mint \
  --recipients '["GABC...", "GDEF..."]' \
  --amounts '[1000, 2000]' \
  --caller OPERATOR_ADDRESS

# Batch burn from multiple accounts
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  batch_burn \
  --accounts '["GABC...", "GDEF..."]' \
  --amounts '[500, 1000]' \
  --caller OPERATOR_ADDRESS
```

### Minter Role (`minter`)

```bash
# Mint tokens to an address
make mint \
  CONTRACT=CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX \
  TO=GKLM... \
  AMOUNT=1000 \
  CALLER=MINTER_ADDRESS
```

### Burner Role (`burner`)

```bash
# Burn tokens from an address
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  burn \
  --from GHIJ... \
  --amount 500 \
  --caller BURNER_ADDRESS
```

### Pauser Role (`pauser`)

```bash
# Pause the contract
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  pause \
  --caller PAUSER_ADDRESS

# Unpause the contract
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  unpause \
  --caller PAUSER_ADDRESS
```

### Viewer Role (`viewer`)

```bash
# View sensitive statistics
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  view_sensitive_stats \
  --caller VIEWER_ADDRESS

# View pending transfer details
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  view_pending_transfer \
  --id 0 \
  --caller VIEWER_ADDRESS
```

### Transfer Role (`transfer`)

```bash
# Execute a direct transfer
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  execute_transfer \
  --from GABC... \
  --to GDEF... \
  --amount 1000 \
  --caller TRANSFER_ADDRESS

# Propose a multi-sig transfer
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  propose_transfer \
  --from GABC... \
  --to GDEF... \
  --amount 5000 \
  --required_approvals 2 \
  --proposer TRANSFER_ADDRESS
```

### Approver Role (`approver`)

```bash
# Approve a pending transfer
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  approve_transfer \
  --id 0 \
  --approver APPROVER_ADDRESS
```

## Testing Access Control Events

### Grant a Role (Emits `RoleGranted`)

```bash
make grant-role \
  CONTRACT=CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX \
  ACCOUNT=GHIJ... \
  ROLE=minter \
  CALLER=GABC...  # Must be admin
```

Available role names: `operator`, `minter`, `burner`, `pauser`, `viewer`, `transfer`, `approver`

### Transfer Ownership (Emits `OwnershipTransferred`)

```bash
soroban contract invoke \
  --id CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX \
  --source default \
  --network testnet \
  -- \
  transfer_ownership \
  --new_owner GNEW...
```

### Revoke a Role (Emits `RoleRevoked`)

```bash
soroban contract invoke \
  --id CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX \
  --source default \
  --network testnet \
  -- \
  revoke_role \
  --account GHIJ... \
  --role minter \
  --caller GABC...  # Must be admin
```

## Events Generated

The contract emits these events that your SubQuery indexer will capture:

### OpenZeppelin Events (Built-in)

- **`RoleGranted`**: When a role is assigned to an account
- **`RoleRevoked`**: When a role is removed from an account
- **`OwnershipTransferred`**: When contract ownership changes
- **`AdminTransferred`**: When admin role is transferred

### Custom Events

- **`Minted`**: When tokens are minted (requires minter role)
- **`Burned`**: When tokens are burned (requires burner role)
- **`Paused`**: When contract is paused (requires pauser role)
- **`Unpaused`**: When contract is unpaused (requires pauser role)
- **`TransferExecuted`**: When tokens are transferred by transfer agent
- **`BatchOperation`**: When batch mint/burn is performed (operator role)
- **`TransferProposed`**: When a multi-sig transfer is proposed
- **`TransferApproved`**: When an approver approves a pending transfer
- **`TransferFinalized`**: When a transfer receives enough approvals and executes
- **`SensitiveDataAccessed`**: When viewer accesses sensitive data

## View Functions

### Check Balance

```bash
make balance \
  CONTRACT=CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX \
  ACCOUNT=GHIJ...
```

### Check if Paused

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  is_paused
```

### Get Total Supply

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  get_total_supply
```

### List Role Members

```bash
# List all minters
make list-minters CONTRACT=CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX

# List all operators
soroban contract invoke --id CONTRACT_ID --network testnet -- list_operators

# List all burners
soroban contract invoke --id CONTRACT_ID --network testnet -- list_burners

# List all pausers
soroban contract invoke --id CONTRACT_ID --network testnet -- list_pausers

# List all viewers
soroban contract invoke --id CONTRACT_ID --network testnet -- list_viewers

# List all transferers
soroban contract invoke --id CONTRACT_ID --network testnet -- list_transferers

# List all approvers
soroban contract invoke --id CONTRACT_ID --network testnet -- list_approvers
```

### Check Role Membership

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source default \
  --network testnet \
  -- \
  has_role \
  --account GHIJ... \
  --role minter
```

## Updating the Indexer

After deploying this contract, update your indexer's `project.ts`:

```typescript
// Add your contract address to filter events
filter: {
  contractId: "CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX",
  topics: ["RoleGranted"],
}
```

Or leave `contractId` unspecified to index all contracts using OpenZeppelin Access Control.

## Contract Structure

```
rbac-playground/
├── Cargo.toml          # Dependencies and build config
├── src/
│   └── lib.rs         # Contract implementation
├── Makefile           # Build and deploy commands
└── README.md          # This file
```

## Tips for Testing

1. **Generate Multiple Events**: Deploy multiple instances of this contract to generate lots of events for your indexer.

2. **Test Role Combinations**:

   - Grant multiple roles to the same account
   - Test role-specific restrictions
   - Verify pause functionality blocks operations

3. **Test Multi-sig Flow**:

   - Propose a transfer with 2-3 required approvals
   - Have different approvers approve it
   - Watch it auto-execute when threshold is met

4. **Test Edge Cases**:

   - Grant and immediately revoke roles
   - Transfer ownership multiple times
   - Have multiple accounts with the same role
   - Try operations while paused

5. **Monitor Events**: Use Stellar Laboratory or Horizon API to verify events are being emitted correctly.

6. **Update Indexer Start Block**: After deploying, note the block number and update your indexer's `startBlock` in `project.ts` to start indexing from that point.

## Troubleshooting

- **"Not authorized"**: Make sure you're calling functions with the correct role/owner/admin
- **"Contract is paused"**: The contract is paused; use an account with PAUSER role to unpause
- **"Role not found"**: The role name must match exactly (e.g., "minter" not "MINTER")
- **"Already approved"**: An approver can only approve a transfer once
- **Build errors**: Ensure you have `rustup target add wasm32-unknown-unknown`
- **Network errors**: Check your Soroban network configuration with `soroban network ls`

## Next Steps

1. Deploy this contract to testnet
2. Grant various roles to different accounts
3. Generate events using the commands above
4. Test the multi-sig approval flow
5. Update your SubQuery indexer configuration to point to the deployed contract
6. Watch your indexer capture and process all the different events!

## License

MIT
