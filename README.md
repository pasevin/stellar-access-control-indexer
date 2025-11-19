# Stellar Access Control Indexer

A SubQuery indexer for OpenZeppelin Stellar Access Control and Ownable contracts, enabling server-side filtering, pagination, and historical queries.

## Features

- Indexes `RoleGranted`, `RoleRevoked`, and `OwnershipTransferred` events
- Maintains current state of role memberships and contract ownership
- Provides server-side filtering and pagination
- Tracks complete event history with timestamps and block heights
- TypeScript client for easy integration

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

## Deployment to SubQuery Managed Service

### 1. Create Project

1. Go to [managed.subquery.network](https://managed.subquery.network)
2. Login with GitHub
3. Click "Create Project"
4. Select this repository

### 2. Deploy

```bash
# Option 1: Deploy via CLI
subql publish

# Option 2: Deploy via GitHub Actions (on push to main)
```

### 3. Get Endpoint

After deployment, you'll receive a production GraphQL endpoint:

```
https://api.subquery.network/sq/{your-org}/{project-name}
```

## Configuration

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

| Handler                            | Event                      | Description                                                   |
| ---------------------------------- | -------------------------- | ------------------------------------------------------------- |
| `handleRoleGranted`                | RoleGranted                | Processes role grant events                                   |
| `handleRoleRevoked`                | RoleRevoked                | Processes role revocation events                              |
| `handleOwnershipTransferCompleted` | OwnershipTransferCompleted | Processes ownership transfers                                 |
| `handleContractDeployment`         | Contract Creation          | Tracks new contract deployments via host function invocations |

## Troubleshooting

### Common Issues

1. **Rate Limiting**: If indexing is slow, you may be hitting rate limits. Adjust batch size:

   ```yaml
   # docker-compose.yml
   command:
     - --batch-size=5
     - --workers=1
     - --unsafe
   ```

2. **Memory Issues**: Increase Node.js memory:

   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" yarn start:docker
   ```

3. **Module Resolution Errors**: If you see `Cannot find module 'http'` or similar errors:

   - Ensure the `--unsafe` flag is present in the docker-compose.yml command
   - This disables SubQuery's sandbox to allow Node.js built-in modules required by dependencies

4. **Rate Limiting (HTTP 429)**: If you encounter rate limit errors from Horizon API:

   - Reduce `--batch-size` to 2 or 3 in docker-compose.yml
   - Add longer timeout: `--timeout=60000`
   - Consider using a private Horizon node or API key for production
   - The default public endpoint has strict rate limits for intensive indexing operations

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
