# RBAC Playground - OpenZeppelin Stellar Access Control Example

This example contract demonstrates the full capabilities of OpenZeppelin's Stellar Access Control library, generating events that can be indexed by the SubQuery indexer.

## Features

This contract implements:
- **AccessControl**: Role-based permissions with `RoleGranted` and `RoleRevoked` events
- **Ownable**: Ownership management with `OwnershipTransferred` events
- **Custom Events**: `Minted` and `Burned` events for testing
- **Role Enumeration**: List all members with a specific role

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

This sets up the admin and owner roles.

## Testing Access Control Events

### Grant a Role (Emits `RoleGranted`)

```bash
make grant-role \
  CONTRACT=CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX \
  ACCOUNT=GHIJ... \
  CALLER=GABC...  # Must be admin
```

### Mint Tokens (Custom Event + Access Control)

```bash
make mint \
  CONTRACT=CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX \
  TO=GKLM... \
  AMOUNT=1000 \
  CALLER=GHIJ...  # Must have minter role
```

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
- **`Burned`**: When tokens are burned (requires minter role)

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

## View Functions

### Check Balance
```bash
make balance \
  CONTRACT=CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX \
  ACCOUNT=GHIJ...
```

### List All Minters
```bash
make list-minters \
  CONTRACT=CDLZFC2UYZTG6XZRROIBJQNSTPVJDQ7EUWHPW7MQTF7S7ZF3PDMMWQRX
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

2. **Test Edge Cases**: 
   - Grant and immediately revoke roles
   - Transfer ownership multiple times
   - Have multiple accounts with the same role

3. **Monitor Events**: Use Stellar Laboratory or Horizon API to verify events are being emitted correctly.

4. **Update Indexer Start Block**: After deploying, note the block number and update your indexer's `startBlock` in `project.ts` to start indexing from that point.

## Troubleshooting

- **"Not authorized"**: Make sure you're calling functions with the correct role/owner/admin
- **"Role not found"**: The role name must match exactly (e.g., "minter" not "MINTER") 
- **Build errors**: Ensure you have `rustup target add wasm32-unknown-unknown`
- **Network errors**: Check your Soroban network configuration with `soroban network ls`

## Next Steps

1. Deploy this contract to testnet
2. Generate some events using the commands above
3. Update your SubQuery indexer configuration to point to the deployed contract
4. Watch your indexer capture and process the events!

## License

MIT