# Stellar Access Control Indexer

A SubQuery indexer for OpenZeppelin Stellar Access Control and Ownable contracts, enabling server-side filtering, pagination, and historical queries.

## Features

### Complete OpenZeppelin Event Coverage

**AccessControl Events:**

- `role_granted` - When a role is assigned to an account
- `role_revoked` - When a role is removed from an account
- `role_admin_changed` - When the admin role for a role is changed
- `admin_transfer_initiated` - When admin transfer begins
- `admin_transfer_completed` - When admin transfer is accepted
- `admin_renounced` - When admin role is permanently renounced

**Ownable Events:**

- `ownership_transfer` - When ownership transfer begins
- `ownership_transfer_completed` - When ownership is accepted by new owner
- `ownership_renounced` - When ownership is permanently renounced

**Note:** Event names in Soroban are snake_case, not PascalCase.

### Implementation Notes

**Event Data Structures:**

The actual event structures from OpenZeppelin Stellar contracts differ slightly from the Rust type definitions:

- **role_granted/role_revoked**: The `caller` field is wrapped in a Map: `{ caller: Address }`
- **ownership_transfer**: Contains a Map with `{ old_owner: Address, new_owner: Address, live_until_ledger: u32 }`
- **admin_transfer_initiated**: `current_admin` is in topics, data contains `{ new_admin: Address, live_until_ledger: u32 }`
- **admin_transfer_completed**: `new_admin` is in topics, data contains `{ previous_admin: Address }`
- **ownership_renounced/admin_renounced**: The address may be in `topic[1]` or `event.value` depending on contract version

The indexer handlers include robust fallback logic to handle these variations.

### Additional Capabilities

- Maintains current state of role memberships and contract ownership
- Provides server-side filtering and pagination
- Tracks complete event history with timestamps and block heights
- TypeScript client for easy integration
- Support for contracts implementing AccessControl, Ownable, or both

## Important: Rate Limiting Notice

**⚠️ The public Stellar testnet Horizon endpoint (`horizon-testnet.stellar.org`) has very strict rate limits that make continuous indexing difficult or impossible without a private endpoint.**

For production use or continuous indexing, you **must** use one of the following:

- A private Horizon node
- An API key from a Horizon provider (BlockDaemon, QuickNode, etc.)
- Your own self-hosted Horizon instance

The default configuration is provided for testing and development only, and you will frequently encounter HTTP 429 (rate limit) errors during startup and operation.

## Quick Start

### Prerequisites

- Node.js v18 or higher
- Yarn or npm
- Docker and Docker Compose (for local testing)
- SubQuery CLI (`npm install -g @subql/cli`)

### Installation

```bash
# Install dependencies
yarn install

# Generate TypeScript types from GraphQL schema
yarn codegen

# Build the project
yarn build
```

## Local Development

### 1. Generate Types and Build

```bash
yarn dev
```

This runs:

- `subql codegen` - Generates TypeScript types from schema.graphql
- `subql build` - Compiles TypeScript to JavaScript

### 2. Run with Docker

```bash
yarn start:docker
```

This starts:

- PostgreSQL database
- SubQuery node (indexer)
- GraphQL query service (default: http://localhost:3000)

### 3. Test Queries

Open http://localhost:3000 and run test queries:

```graphql
# Get all role grants for a specific contract
query {
  accessControlEvents(
    filter: {
      contract: { equalTo: "CONTRACT_ADDRESS" }
      type: { equalTo: ROLE_GRANTED }
    }
    orderBy: TIMESTAMP_DESC
  ) {
    nodes {
      id
      role
      account
      admin
      timestamp
      txHash
    }
  }
}

# Track admin transfer events
query {
  accessControlEvents(
    filter: {
      contract: { equalTo: "CONTRACT_ADDRESS" }
      type: { in: [ADMIN_TRANSFER_INITIATED, ADMIN_TRANSFER_COMPLETED] }
    }
    orderBy: TIMESTAMP_DESC
  ) {
    nodes {
      type
      account # new admin
      admin # previous admin
      timestamp
      txHash
    }
  }
}

# Get current role members
query {
  roleMemberships(filter: { contract: { equalTo: "CONTRACT_ADDRESS" } }) {
    nodes {
      role
      account
      grantedAt
      grantedBy
    }
  }
}

# Get contract ownership
query {
  contractOwnership(id: "CONTRACT_ADDRESS") {
    owner
    previousOwner
    transferredAt
  }
}
```

## Using the TypeScript Client

```typescript
import SubQueryIndexerClient from './src/indexer-client';

// Initialize client with your SubQuery endpoint
const client = new SubQueryIndexerClient(
  'https://api.subquery.network/sq/your-project'
);

// Query access control events with filters
const events = await client.queryAccessControlEvents(
  {
    contract: '0x...',
    type: 'ROLE_GRANTED',
    account: 'GAXXX...',
  },
  100,
  0
);

// Check if account has role
const hasRole = await client.hasRole(
  'CONTRACT_ADDRESS',
  'ACCOUNT_ADDRESS',
  'ADMIN_ROLE'
);

// Get current role members
const members = await client.getRoleMembers('CONTRACT_ADDRESS', 'ADMIN_ROLE');

// Get contract owner
const owner = await client.getContractOwner('CONTRACT_ADDRESS');
```

## Deployment to SubQuery Network

### 1. Publish to IPFS

The SubQuery Network requires IPFS deployment. See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive instructions.

### 2. Deploy via CLI

```bash
# Build and publish to IPFS
subql build
subql publish

# Deploy to SubQuery Network
subql deployment:deploy
```

### 3. Access Your Indexer

After deployment, access via the SubQuery Network:

```
https://gateway.subquery.network/query/{deployment-id}
```

For detailed deployment instructions including multi-network support, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Example Contract: RBAC Playground

This repository includes a complete example contract (`examples/rbac-playground`) that demonstrates all OpenZeppelin Access Control features:

### Features

- Implements both AccessControl and Ownable traits
- Custom minter role with mint/burn functions
- Emits all 9 OpenZeppelin events (6 Access Control + 3 Ownable)
- Role enumeration capabilities
- Ready for testnet deployment

### Quick Deploy

```bash
cd examples/rbac-playground
make build    # Build the contract
make deploy   # Deploy to testnet
```

See [examples/rbac-playground/README.md](examples/rbac-playground/README.md) for detailed instructions.

## Configuration

### Multi-Network Support

This indexer supports both Stellar **Testnet** and **Mainnet** through separate project configurations:

#### Testnet Configuration (`project.ts`)

- **Project Name**: `stellar-access-control-indexer` (default - maintains existing deployments)
- **Network**: Test SDF Network
- **Start Block**: 1,685,700 (early testnet OZ contract activity)
- **Endpoints**:
  - Horizon: `https://horizon-testnet.stellar.org`
  - Soroban: `https://soroban-testnet.stellar.org`

#### Mainnet Configuration (`project-mainnet.ts`)

- **Project Name**: `stellar-access-control-indexer-mainnet` (separate deployment)
- **Network**: Public Global Stellar Network
- **Start Block**: 57,243,255 (~May 16, 2025 - when OZ Access Control was created)
- **Endpoints**:
  - Horizon: `https://horizon.stellar.org`
  - Soroban: `https://soroban-rpc.mainnet.stellar.gateway.fm`

**Note:** The testnet configuration maintains its original project name to preserve compatibility with existing SubQuery Network deployments. Mainnet uses a separate name to avoid conflicts.

#### Deploying to Specific Network

**For Testnet (default):**

```bash
yarn build           # Uses project.ts by default
subql publish
```

**For Mainnet:**

```bash
subql build project-mainnet.ts
subql publish project-mainnet.ts
```

**Docker deployment:**

```bash
# Testnet
docker-compose up -d

# Mainnet (specify config file)
docker-compose -f docker-compose-mainnet.yml up -d
```

### Network Settings

Edit `project.ts` to configure network settings:

```typescript
network: {
  // Testnet
  chainId: "Test SDF Network ; September 2015",
  endpoint: ["https://horizon-testnet.stellar.org"],
  sorobanEndpoint: "https://soroban-testnet.stellar.org",

  // Mainnet (uncomment for production)
  // chainId: "Public Global Stellar Network ; September 2015",
  // endpoint: ["https://horizon.stellar.org"],
  // sorobanEndpoint: "https://soroban.stellar.org",
}
```

**Using a private endpoint:**

```typescript
network: {
  chainId: "Test SDF Network ; September 2015",
  endpoint: [
    "https://your-private-horizon-node.com",
    "https://horizon-testnet.stellar.org"  // fallback
  ],
  sorobanEndpoint: "https://your-private-soroban-node.com",
}
```

### Start Block

The indexer starts from block 1,600,000. Adjust in `project.ts`:

```typescript
startBlock: 1600000, // Adjust based on your needs
```

**Important**: The `startBlock` must be within the available ledger range on the Stellar network. Stellar testnet typically has ledgers available from around block 1,000,000 onwards. Setting a `startBlock` that's too far in the future or beyond the current network height will cause initialization errors.

## Schema

The indexer tracks the following entities:

- **AccessControlEvent**: All role and ownership change events
- **RoleMembership**: Current role assignments
- **ContractOwnership**: Current contract owners
- **Contract**: Metadata about indexed contracts

See `schema.graphql` for complete entity definitions.

## Event Handlers

| Handler                            | Event                          | Description                             |
| ---------------------------------- | ------------------------------ | --------------------------------------- |
| `handleRoleGranted`                | `role_granted`                 | Processes role grant events             |
| `handleRoleRevoked`                | `role_revoked`                 | Processes role revocation events        |
| `handleRoleAdminChanged`           | `role_admin_changed`           | Processes role admin changes            |
| `handleAdminTransferInitiated`     | `admin_transfer_initiated`     | Processes admin transfer initiation     |
| `handleAdminTransferCompleted`     | `admin_transfer_completed`     | Processes admin transfer completion     |
| `handleAdminRenounced`             | `admin_renounced`              | Processes admin renunciation            |
| `handleOwnershipTransferStarted`   | `ownership_transfer`           | Processes ownership transfer initiation |
| `handleOwnershipTransferCompleted` | `ownership_transfer_completed` | Records completed ownership transfers   |
| `handleOwnershipRenounced`         | `ownership_renounced`          | Processes ownership renunciation        |
| `handleContractDeployment`         | Contract Creation              | Tracks contract deployments             |

**Implementation Notes:**

- Event names in Soroban are **snake_case** (e.g., `role_granted`), not PascalCase.
- All ScVal decoding uses `scValToNative` from `@stellar/stellar-sdk` for robust, automatic type conversion.
- Ownership event data is a Map structure; `scValToNative` converts it to a JS object for easy field access.

## Troubleshooting

### Common Issues

1. **Rate Limiting**: If indexing is slow, you may be hitting rate limits. Adjust batch size:

   ```yaml
   # docker-compose.yml
   command:
     - --batch-size=5
     - --workers=1
   ```

2. **Memory Issues**: Increase Node.js memory:

   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" yarn start:docker
   ```

3. **Polyfills**: The indexer includes lightweight, sandbox-safe polyfills for `TextEncoder` and `TextDecoder` required by the Stellar SDK. These are compatible with SubQuery's Managed Service and don't require the `--unsafe` flag.

4. **Rate Limiting (HTTP 429)**: If you encounter rate limit errors from Horizon API:

   - **Immediate fixes:**

     - Reduce `--batch-size` to 1 or 2 in docker-compose.yml
     - Increase timeout: `--timeout=90000` or higher
     - Wait 1-2 minutes before restarting to let rate limits reset

   - **Environment variables for retry logic:**

     ```yaml
     environment:
       STELLAR_ENDPOINT_RETRY_ATTEMPTS: 5
       STELLAR_ENDPOINT_RETRY_DELAY: 10000 # 10 seconds between retries
     ```

   - **Long-term solutions:**

     - Use a private Horizon node
     - Get an API key from a Horizon provider (e.g., BlockDaemon, QuickNode)
     - Run your own Horizon instance

   - **Note:** The public Horizon endpoint has strict rate limits (~200 requests/minute). Intensive indexing operations will frequently hit these limits.

5. **Container Health Check Failures**: If the subquery-node container is unhealthy:

   - Check logs: `docker compose logs subquery-node --tail 100`
   - Ensure `yarn build` completed successfully before starting containers
   - Verify all dependencies are installed: `yarn install`
   - Try rebuilding: `docker compose down && yarn build && docker compose up -d`

6. **Type Generation Errors**: Ensure schema.graphql is valid:
   ```bash
   yarn codegen
   ```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT - See LICENSE file for details

## Support

For issues and questions:

- GitHub Issues: [github.com/OpenZeppelin/stellar-access-control-indexer/issues](https://github.com/OpenZeppelin/stellar-access-control-indexer/issues)
- SubQuery Discord: [discord.gg/subquery](https://discord.gg/subquery)
