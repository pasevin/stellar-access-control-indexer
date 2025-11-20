# Deployment Guide

This guide covers deploying the Stellar Access Control Indexer to the **SubQuery Network** (decentralized) or other hosting platforms, following official SubQuery documentation.

## Overview

The SubQuery Network is a public, permission-less, decentralized data indexing network. Deploying to it ensures:

- **Unstoppable infrastructure** - ~100 decentralized, geographically isolated indexers
- **Superior performance** - Global indexers provide low latency to all users
- **Infinite scalability** - Scales automatically as demand grows
- **True decentralization** - Your dApp's infrastructure stack is fully decentralized

Reference: [Publishing to SubQuery Network](https://subquery.network/doc/subquery_network/architects/publish.html)

---

## Prerequisites

### 1. Update Dependencies

Critical for network compatibility. Update to latest versions:

```bash
# Update SubQuery CLI (REQUIRED)
yarn add -D @subql/cli@latest

# Update other dependencies to latest
yarn add @subql/common@latest @subql/types-stellar@latest
yarn add -D @subql/testing@latest @subql/types@latest typescript@latest
```

**Important**: Check [SubQuery Issue #926](https://github.com/subquery/subql/discussions/926) for any known dependency compatibility issues.

### 2. Update Build Command

Ensure `package.json` uses the correct build command:

```json
{
  "scripts": {
    "build": "subql build" // NOT "tsc -b"
  }
}
```

✅ **Our project is already correctly configured.**

### 3. Ensure Deterministic Indexing

The SubQuery Network requires deterministic proof-of-indexing results:

**❌ AVOID:**

- Random ordered DB operations (e.g., `Promise.all()` in mapping functions without ordering)
- Runtime-dependent data (e.g., `new Date()` without blockchain data)
- External API calls that may return different results

**✅ OUR PROJECT STATUS:**

- Uses sequential `await` operations ✓
- All timestamps from blockchain (`event.ledgerClosedAt`) ✓
- No external API calls in mappings ✓
- Deterministic address decoding ✓

### 4. Disable GraphQL Subscriptions

The SubQuery Network does **not** support GraphQL subscriptions:

**❌ DO NOT USE:**

- `--subscription` flag in command line arguments
- GraphQL subscription queries in your application

Reference: [GraphQL Subscriptions](https://subquery.network/doc/indexer/run_publish/query/subscription.html)

**✅ OUR PROJECT STATUS:** We don't use subscriptions. ✓

### 5. Multi-Network/Multi-Chain Support (Optional but Recommended)

SubQuery supports indexing multiple blockchain networks with shared business logic and a single codebase. This is useful for:

- **Different chains** (Stellar, Polkadot, Ethereum, Cosmos, etc.)
- **Same chain, different networks** (Stellar testnet vs mainnet)

Reference: [IPFS Publishing Guide - Multi-Network](https://subquery.network/doc/indexer/miscellaneous/ipfs.html#how-to-prepare-your-project)

#### Multi-Manifest Pattern

If you support multiple networks but share the same mapping and business logic, organize your project with multiple manifest files:

```
L projectRoot
 L src/                          # Shared mapping logic
 L package.json                  # Single package.json
 L stellar-testnet.yaml          # Manifest for Stellar testnet
 L stellar-mainnet.yaml          # Manifest for Stellar mainnet
 L polkadot.yaml                 # Manifest for Polkadot (if supporting multiple chains)
 L kusama.yaml                   # Manifest for Kusama (if supporting multiple chains)
 ...
```

#### Publishing Specific Networks

Publish each network separately with the appropriate manifest:

```bash
# Publish Stellar testnet version
subql publish -f ~/projectRoot/stellar-testnet.yaml

# Publish Stellar mainnet version
subql publish -f ~/projectRoot/stellar-mainnet.yaml

# Publish Polkadot version (if multi-chain)
subql publish -f ~/projectRoot/polkadot.yaml
```

Each manifest gets a unique IPFS CID and can be deployed independently to the SubQuery Network.

#### Our Current Setup

**Currently**: This indexer is Stellar-specific with a single `project.ts` manifest.

**For Stellar Testnet/Mainnet Support**: You can create:

- `stellar-testnet.yaml` - Points to testnet with appropriate chainId and startBlock
- `stellar-mainnet.yaml` - Points to mainnet with different chainId and startBlock
- Both share the same `src/` directory and mapping logic

**For Multi-Chain Support**: If you want to index access control on other chains (e.g., Polkadot, Ethereum), you would:

1. Keep shared business logic in `src/`
2. Create chain-specific manifest files
3. Adjust handlers for chain-specific event types
4. Publish each manifest separately

#### Stellar Network Configurations

When creating separate manifests for Stellar networks:

```typescript
// stellar-testnet.yaml
network: {
  chainId: 'Test SDF Network ; September 2015',
  endpoint: ['https://horizon-testnet.stellar.org'],
  sorobanEndpoint: 'https://soroban-testnet.stellar.org',
}
dataSources: [{
  startBlock: 1600000, // Testnet start block
  // ... shared handlers
}]
```

```typescript
// stellar-mainnet.yaml
network: {
  chainId: 'Public Global Stellar Network ; September 2015',
  endpoint: ['https://horizon.stellar.org'],
  sorobanEndpoint: 'https://soroban.stellar.org',
}
dataSources: [{
  startBlock: 50000000, // Mainnet start block (adjust to recent block)
  // ... same shared handlers
}]
```

**Future Network:**

```typescript
chainId: 'Test SDF Future Network ; October 2022';
```

This pattern ensures:

- Single codebase for all networks
- Network-specific configuration per manifest
- Independent IPFS publishing and deployment
- Consistent business logic across all networks

---

## Step 1: Prepare Your Project

### 1.1 Verify Build

```bash
# Generate types
yarn codegen

# Build the project
yarn build

# Verify dist/ directory contains compiled code
ls -la dist/
```

Expected output:

```
dist/
├── index.js
└── mappings/
    └── mappingHandlers.js
```

### 1.2 Test Locally (Recommended)

```bash
# Test with Docker
yarn start:docker

# Verify indexing works
# Check http://localhost:3000 GraphQL playground
```

### 1.3 Commit and Push to GitHub

```bash
git add .
git commit -m "chore: prepare for SubQuery Network deployment"
git push origin main
```

**Important**: Your repository must be **public** for deployment to SubQuery Network.

---

## Step 2: Publish to IPFS

SubQuery uses IPFS to package and distribute project code for decentralized deployment.

Reference: [Publishing to IPFS](https://subquery.network/doc/indexer/miscellaneous/ipfs.html)

### 2.1 Install Latest CLI (if not already done)

```bash
yarn add -D @subql/cli@latest
```

### 2.2 Publish to IPFS

```bash
# Build must be run first
yarn build

# Publish to SubQuery's IPFS
subql publish

# Or specify IPFS endpoint
subql publish --ipfs https://ipfs.subquery.network/ipfs/api/v0
```

**Output Example:**

```
Building and packing code... done
Uploading to IPFS... done
SubQuery deployment IPFS CID: QmZ4h7kJxFV4e9uM...
```

### 2.3 Verify IPFS Upload

Retrieve your published project:

```bash
# View deployment manifest
curl https://ipfs.subquery.network/ipfs/api/v0/cat?arg=<YOUR_PROJECT_CID>
```

You should see your project configuration with IPFS references:

```yaml
dataSources:
  - kind: stellar/Runtime
    mapping:
      file: ipfs://QmTTJKrMVzCZqmRCd5xKHbKymtQQnHZierBMHLtHHGyjLy
      handlers:
        - handler: handleRoleGranted
          kind: stellar/EventHandler
          filter:
            topics: ['role_granted']
schema:
  file: ipfs://QmTP5BjtxETVqvU4MkRxmgf8NbceB17WtydS6oQeHBCyjz
```

**Save your deployment CID** - you'll need it for the next step.

---

## Step 3: Deploy to SubQuery Network

### 3.1 Access SubQuery Explorer

1. Visit [SubQuery Explorer](https://app.subquery.network)
2. Connect your wallet or GitHub account
3. Navigate to the Explorer tab
4. Click **"Publish Your Own Project"**

**Note**: The publish workflow is done through the SubQuery Explorer web interface.

### 3.2 Enter Project Details

**Required Information:**

1. **Project CID** (from Step 2.2)

   ```
   Example: QmZ4h7kJxFV4e9uM...
   ```

2. **Project Name**

   ```
   stellar-access-control-indexer
   ```

3. **Project Description**
   ```
   SubQuery indexer for OpenZeppelin Stellar Access Control and Ownable contracts.
   Indexes all 9 events including role management (grants, revocations, admin changes),
   admin transfers, and ownership transfers with full event history.
   ```

### 3.3 Configure Deployment Metadata

Provide information that Node Operators and Consumers will find useful:

**Project Information:**

- **Logo/Image**: Upload OpenZeppelin logo or project icon
- **Categories**: `DeFi`, `Access Control`, `Security`
- **Website**: `https://openzeppelin.com` or your project URL
- **Source Code**: `https://github.com/OpenZeppelin/stellar-access-control-indexer`

**Deployment Details:**

- **Version**: `1.0.0` (follow [semantic versioning](https://semver.org/))
- **Deployment Description**:
  ```
  Initial production release. Indexes all 9 events from OpenZeppelin Stellar Access Control
  and Ownable contracts: RoleGranted, RoleRevoked, RoleAdminChanged, AdminTransferInitiated,
  AdminTransferCompleted, AdminRenounced, OwnershipTransferStarted, OwnershipTransferCompleted,
  and OwnershipRenounced. Optimized for SubQuery Network with deterministic indexing.
  ```

### 3.4 Network Configuration

During deployment, you'll configure:

- **Network**: Stellar Testnet (or Mainnet for production)
- **Start Block**: `1600000` (or adjust based on your needs)
- **Endpoint Priority**: SubQuery Network will use available Horizon endpoints

### 3.5 Publish

1. Review all information
2. Click **"Publish"**
3. Wait for deployment to propagate (typically 2-10 minutes)
4. Node Operators will begin indexing your project

---

## Step 4: Manage Your Deployment

### 4.1 Access Project Dashboard

After publishing, you'll be taken to your project management page:

- **Indexing Status**: View progress across Node Operators
- **Query Endpoint**: Your production GraphQL endpoint
- **Version Management**: Deploy new versions
- **Analytics**: Query volume, response times, errors

### 4.2 Deploy New Versions

When you update your indexer:

1. **Make Code Changes**

   ```bash
   # Update mappings, schema, etc.
   # Update version in package.json and project.ts
   ```

2. **Build and Publish to IPFS**

   ```bash
   yarn build
   subql publish
   # Save new CID
   ```

3. **Deploy New Version in SubQuery UI**

   - Click **"Deploy New Version"**
   - Enter new deployment CID
   - Enter version number (e.g., `1.1.0`)
   - Check **"Recommended"** if Node Operators should upgrade immediately
   - Add deployment description explaining changes:
     ```
     v1.1.0: Add support for new AdminTransferInitiated event.
     Node operators should update immediately. No breaking changes.
     ```

4. **Node Operators Update**
   - Recommended versions are deployed automatically by most operators
   - Non-breaking changes deploy smoothly
   - Breaking changes should be clearly documented

### 4.3 Best Practices for Version Management

**Version Numbering:**

- **Major (x.0.0)**: Breaking changes (schema changes, handler logic changes)
- **Minor (0.x.0)**: New features, new event handlers (backward compatible)
- **Patch (0.0.x)**: Bug fixes, optimizations

**Deployment Descriptions:**

- Explain what changed
- Note any migration steps for Node Operators
- Indicate if upgrade is urgent or optional
- List breaking changes explicitly

---

## Step 5: Get Your Production Endpoint

### 5.1 Network GraphQL Endpoint

Once deployed and indexed, your endpoint will be:

```
https://api.subquery.network/sq/openzeppelin/stellar-access-control-indexer
```

### 5.2 Using the Network Client

SubQuery provides SDKs for easy integration:

```typescript
// Install network client
yarn add @subql/network-clients

// Use in your application
import { SQNetworkClient } from '@subql/network-clients';

const client = new SQNetworkClient({
  project: 'openzeppelin/stellar-access-control-indexer',
});

// Query the network
const result = await client.query(gql`
  query {
    accessControlEvents(first: 10) {
      nodes {
        id
        role
        account
        type
      }
    }
  }
`);
```

### 5.3 Configure in Adapter

Update your Stellar adapter network configuration:

```typescript
// In contracts-ui-builder/packages/adapter-stellar/src/networks/
import { StellarNetworkConfig } from '@openzeppelin/ui-builder-types';

export const stellarTestnet: StellarNetworkConfig = {
  id: 'stellar-testnet',
  name: 'Stellar Testnet',
  chainId: 'Test SDF Network ; September 2015',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanUrl: 'https://soroban-testnet.stellar.org',
  // SubQuery Network endpoint
  indexerUri:
    'https://api.subquery.network/sq/openzeppelin/stellar-access-control-indexer',
  // ... other config
};
```

---

## Alternative Hosting Options

While SubQuery Network is recommended for true decentralization, other options exist:

### Option A: SubQuery Managed Service

**Note**: As of 2024/2025, SubQuery has transitioned to focus on the decentralized SubQuery Network. The Managed Service may be deprecated or limited. Check the [official SubQuery documentation](https://subquery.network/doc/) for current hosting options.

If still available:

1. Visit SubQuery's official website for managed service information
2. Connect GitHub
3. Select repository and branch
4. Configure and deploy

**Endpoint format:**

```
https://api.subquery.network/sq/YOUR_ORG/PROJECT_NAME
```

### Option B: OnFinality Infrastructure Services

**Note**: OnFinality provides blockchain infrastructure services. Check their [official website](https://onfinality.io) for current SubQuery-related offerings, as services may have evolved.

If available:

1. Visit [OnFinality](https://onfinality.io)
2. Explore SubQuery indexer hosting options
3. Configure network and resources as per their documentation

### Option C: Self-Hosted

For complete control, deploy on your infrastructure:

#### Docker Compose

```yaml
# docker-compose.prod.yml
services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: always

  subquery-node:
    image: subquerynetwork/subql-node-stellar:latest
    environment:
      DB_USER: postgres
      DB_PASS: ${DB_PASSWORD}
      DB_DATABASE: postgres
      DB_HOST: postgres
      DB_PORT: 5432
    volumes:
      - ./:/app
    command:
      - -f=/app
      - --db-schema=app
      - --workers=2
      - --batch-size=10
      - --timeout=90000
    restart: always

  graphql-engine:
    image: subquerynetwork/subql-query:latest
    environment:
      DB_USER: postgres
      DB_PASS: ${DB_PASSWORD}
      DB_DATABASE: postgres
      DB_HOST: postgres
      DB_PORT: 5432
    command:
      - --name=app
      - --playground
      - --indexer=http://subquery-node:3000
    restart: always
    ports:
      - '3000:3000'

volumes:
  postgres-data:
```

Deploy:

```bash
export DB_PASSWORD=your_secure_password
docker compose -f docker-compose.prod.yml up -d
```

---

## Production Configuration

### Private Horizon Endpoints

**Critical for Production**: Public Horizon endpoints have strict rate limits (~200 req/min). For production indexing, use:

- **Your Own Horizon Node** (best performance and reliability)
- **Horizon API Providers**:
  - [BlockDaemon](https://www.blockdaemon.com/) - Enterprise blockchain infrastructure
  - [QuickNode](https://www.quicknode.com/) - Fast blockchain RPC endpoints
  - [Alchemy](https://www.alchemy.com/) - Check for Stellar support

Configure in `project.ts`:

```typescript
network: {
  chainId: "Public Global Stellar Network ; September 2015",
  endpoint: [
    "https://your-private-horizon.example.com",
    "https://horizon.stellar.org"  // fallback
  ],
  sorobanEndpoint: "https://your-private-soroban.example.com",
}
```

### Performance Tuning

Adjust based on your endpoint capacity:

```bash
# For high-capacity private endpoints
--workers=4              # More parallel workers
--batch-size=20          # Larger batches
--timeout=60000          # Standard timeout

# For rate-limited public endpoints
--workers=1              # Single worker to minimize requests
--batch-size=1           # One block at a time
--timeout=120000         # Generous timeout
```

---

## Monitoring and Analytics

### SubQuery Network Dashboard

The SubQuery Network provides:

- **Real-time Indexing Metrics**: Block height, indexing speed
- **Query Analytics**: Request volume, latency, errors
- **Node Operator Status**: Which operators are serving your project
- **Health Checks**: Automatic monitoring and alerts

### Self-Hosted Monitoring

For self-hosted deployments:

1. **Prometheus + Grafana**

   - SubQuery exposes Prometheus metrics on `:3000/metrics`
   - Import SubQuery Grafana dashboards

2. **Logging**

   - Configure log level: `--log-level=info`
   - Stream logs to CloudWatch, DataDog, or Elasticsearch

3. **Health Endpoints**
   - Node health: `http://localhost:3000/health`
   - Ready status: `http://localhost:3000/ready`

---

## Deployment Checklist

### Pre-Deployment

- [ ] Updated `@subql/cli` to latest version
- [ ] Updated all SubQuery dependencies to latest
- [ ] Build command is `subql build` in package.json
- [ ] Project builds successfully (`yarn build`)
- [ ] No `Promise.all()` or non-deterministic operations in mappings
- [ ] No GraphQL subscriptions enabled
- [ ] Local Docker testing passes
- [ ] Code committed and pushed to **public** GitHub repository

### IPFS Publishing

- [ ] Ran `yarn build` before publishing
- [ ] Successfully published to IPFS (`subql publish`)
- [ ] Saved deployment CID
- [ ] Verified IPFS upload with curl command

### SubQuery Network Deployment

- [ ] Logged into SubQuery Explorer
- [ ] Created new project with correct CID
- [ ] Filled in project metadata (logo, description, categories)
- [ ] Configured deployment details (version, description)
- [ ] Published to network successfully
- [ ] Node Operators are indexing (check dashboard)

### Post-Deployment

- [ ] Obtained production GraphQL endpoint
- [ ] Updated adapter configuration with indexer URI
- [ ] Tested queries against production endpoint
- [ ] End-to-end integration testing complete
- [ ] Documented endpoint for team
- [ ] Monitoring/alerting configured (if self-hosted)

### For Production (Mainnet)

- [ ] Private Horizon endpoint configured
- [ ] Adjusted startBlock for mainnet (e.g., recent block)
- [ ] Updated chainId to mainnet passphrase
- [ ] Performance tuning based on endpoint capacity
- [ ] Load testing completed
- [ ] Backup and disaster recovery plan in place

---

## Troubleshooting

### IPFS Publishing Fails

**Error**: `Failed to upload to IPFS`

**Solutions**:

1. Ensure you ran `yarn build` first
2. Check internet connectivity
3. Try alternative IPFS endpoint:
   ```bash
   subql publish --ipfs https://ipfs.infura.io:5001
   ```
4. Verify `dist/` directory exists and contains compiled code

### Deployment Not Indexing

**Error**: Node Operators not picking up project

**Solutions**:

1. Verify IPFS CID is correct
2. Check `startBlock` is valid and not in the future
3. Ensure network `chainId` matches target network
4. Make project "Recommended" to encourage operator upgrades
5. Reach out in [SubQuery Discord](https://discord.gg/subquery)

### Deterministic Indexing Errors

**Error**: `Proof of Indexing mismatch between operators`

**Solutions**:

1. Remove any `Promise.all()` that doesn't guarantee order
2. Don't use `new Date()` - use `event.ledgerClosedAt`
3. Avoid external API calls in mapping handlers
4. Ensure database operations are sequential
5. Review [SubQuery Issue #926](https://github.com/subquery/subql/discussions/926)

### Rate Limiting Issues

**Error**: `Request failed with status code 429`

**Solutions**:

1. **Immediate**: Reduce `--batch-size` and `--workers`
2. **Short-term**: Wait for rate limits to reset (1-2 minutes)
3. **Long-term**: Use private Horizon endpoint (mandatory for production)
4. Configure retry logic with environment variables:
   ```yaml
   environment:
     STELLAR_ENDPOINT_RETRY_ATTEMPTS: 10
     STELLAR_ENDPOINT_RETRY_DELAY: 20000
   ```

---

## Multi-Network Deployment Strategy

SubQuery supports indexing multiple blockchain networks with shared business logic. This section covers both:

1. **Multi-chain support** (Stellar, Polkadot, Ethereum, etc.)
2. **Same chain, different networks** (Stellar testnet vs mainnet)

Reference: [Multi-Network Projects](https://subquery.network/doc/indexer/miscellaneous/ipfs.html#how-to-prepare-your-project)

### Strategy 1: Multiple Manifests (Recommended)

The best approach is using multiple manifest files with a single codebase:

```
projectRoot/
├── src/
│   └── mappings/
│       └── mappingHandlers.ts      # Shared logic
├── package.json                    # Single package.json
├── schema.graphql                  # Shared schema
├── stellar-testnet.yaml            # Stellar testnet manifest
├── stellar-mainnet.yaml            # Stellar mainnet manifest
├── polkadot.yaml                   # Polkadot manifest (if multi-chain)
└── kusama.yaml                     # Kusama manifest (if multi-chain)
```

#### Example: Stellar Testnet Manifest

```yaml
# stellar-testnet.yaml
specVersion: 1.0.0
name: stellar-access-control-indexer-testnet
version: 1.0.0
runner:
  node:
    name: '@subql/node-stellar'
    version: '*'
  query:
    name: '@subql/query'
    version: '*'
network:
  chainId: 'Test SDF Network ; September 2015'
  endpoint: ['https://horizon-testnet.stellar.org']
  sorobanEndpoint: 'https://soroban-testnet.stellar.org'
schema:
  file: ./schema.graphql
dataSources:
  - kind: stellar/Runtime
    startBlock: 1600000
    mapping:
      file: ./dist/index.js
      handlers:
        - handler: handleRoleGranted
          kind: stellar/EventHandler
          filter:
            topics: ['role_granted']
        # ... other handlers
```

#### Example: Stellar Mainnet Manifest

```yaml
# stellar-mainnet.yaml
specVersion: 1.0.0
name: stellar-access-control-indexer-mainnet # Different name
version: 1.0.0
runner:
  node:
    name: '@subql/node-stellar'
    version: '*'
  query:
    name: '@subql/query'
    version: '*'
network:
  chainId: 'Public Global Stellar Network ; September 2015' # Different chainId
  endpoint: ['https://horizon.stellar.org']
  sorobanEndpoint: 'https://soroban.stellar.org'
schema:
  file: ./schema.graphql # Same schema
dataSources:
  - kind: stellar/Runtime
    startBlock: 50000000 # Different startBlock for mainnet
    mapping:
      file: ./dist/index.js # Same compiled code
      handlers:
        - handler: handleRoleGranted
          kind: stellar/EventHandler
          filter:
            topics: ['role_granted']
        # ... same handlers
```

### Publishing Each Network

```bash
# Build once (shared code)
yarn build

# Publish testnet
subql publish -f ~/projectRoot/stellar-testnet.yaml
# Output: QmTestnetCID...

# Publish mainnet
subql publish -f ~/projectRoot/stellar-mainnet.yaml
# Output: QmMainnetCID...

# If supporting multiple chains, publish each:
subql publish -f ~/projectRoot/polkadot.yaml
subql publish -f ~/projectRoot/kusama.yaml
```

**Important**: Each manifest gets a unique IPFS CID and is deployed independently to SubQuery Network.

### Strategy 2: Single Manifest with Deployment Overrides

For simpler cases (same chain, different networks), you can use a single `project.ts` and override settings during deployment:

```typescript
// project.ts - Base configuration
const project: StellarProject = {
  specVersion: '1.0.0',
  name: 'stellar-access-control-indexer',
  // ... other config
  network: {
    chainId: 'Test SDF Network ; September 2015', // Default to testnet
  },
};
```

Then deploy twice with different configurations in SubQuery UI.

**Note**: The multi-manifest approach (Strategy 1) is more explicit and maintainable.

### Deployment Configuration Per Network

**Testnet Deployment:**

- **Name**: `stellar-access-control-indexer-testnet`
- **CID**: From `subql publish -f stellar-testnet.yaml`
- **Endpoint**: `https://api.subquery.network/sq/openzeppelin/stellar-access-control-indexer-testnet`

**Mainnet Deployment:**

- **Name**: `stellar-access-control-indexer-mainnet`
- **CID**: From `subql publish -f stellar-mainnet.yaml`
- **Endpoint**: `https://api.subquery.network/sq/openzeppelin/stellar-access-control-indexer-mainnet`

### Adapter Configuration

Update your adapter to support both networks:

```typescript
// contracts-ui-builder/packages/adapter-stellar/src/networks/

export const stellarTestnet: StellarNetworkConfig = {
  id: 'stellar-testnet',
  name: 'Stellar Testnet',
  chainId: 'Test SDF Network ; September 2015',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanUrl: 'https://soroban-testnet.stellar.org',
  indexerUri:
    'https://api.subquery.network/sq/openzeppelin/stellar-access-control-indexer-testnet',
  // ... other config
};

export const stellarMainnet: StellarNetworkConfig = {
  id: 'stellar-mainnet',
  name: 'Stellar Mainnet',
  chainId: 'Public Global Stellar Network ; September 2015',
  horizonUrl: 'https://horizon.stellar.org',
  sorobanUrl: 'https://soroban.stellar.org',
  indexerUri:
    'https://api.subquery.network/sq/openzeppelin/stellar-access-control-indexer-mainnet',
  // ... other config
};
```

### Version Synchronization

Keep versions synchronized across networks:

- Deploy v1.0.0 to both testnet and mainnet
- Test on testnet first
- Promote to mainnet after validation
- Use same version numbers for consistency
- Update both networks when fixing bugs or adding features

### Multi-Chain Considerations (Beyond Stellar)

If you want to support other blockchains (Polkadot, Ethereum, Cosmos) with similar access control patterns:

1. **Shared Logic**: Keep common access control logic in `src/`
2. **Chain-Specific Handlers**: Adjust event types per chain
3. **Separate Manifests**: Create manifest per chain
4. **Dependencies**: Add chain-specific packages:
   ```json
   {
     "dependencies": {
       "@subql/types-stellar": "latest",
       "@subql/types-ethereum": "latest", // If supporting Ethereum
       "@subql/types": "latest"
     }
   }
   ```
5. **Conditional Logic**: Use network detection in mappings if needed
6. **Independent Deployment**: Each chain is a separate SubQuery project

This approach maximizes code reuse while maintaining chain-specific optimizations.

---

## Security Considerations

1. **IPFS Security**: Code is public on IPFS - never include secrets
2. **GitHub Repository**: Must be public for SubQuery Network
3. **Environment Variables**: Use for sensitive configuration (self-hosted only)
4. **Query Rate Limiting**: SubQuery Network handles this automatically
5. **Authentication**: Not required for SubQuery Network (handled by network)
6. **Monitoring**: Watch for suspicious query patterns in analytics dashboard
7. **Dependencies**: Regularly update to patch security vulnerabilities

---

## Cost Considerations

### SubQuery Network (Decentralized)

- **Node Operators**: Paid by the network, not by you
- **Consumers**: May need to stake QUERY tokens for queries
- **Developers**: Free to publish and deploy
- **Scaling**: Automatic and included

### SubQuery Managed Service

**Note**: Pricing and availability may have changed. Verify current offerings on the [official SubQuery website](https://subquery.network).

Historical pricing (verify for current rates):

- **Free Tier**: Limited monthly requests, suitable for testing
- **Growth Tier**: From ~$49/month, higher request limits
- **Enterprise**: Custom pricing for high volume

### Self-Hosted

- **Infrastructure**: EC2, GCP, DigitalOcean costs
- **Database**: PostgreSQL hosting or RDS
- **Bandwidth**: Data transfer costs
- **Maintenance**: DevOps time and expertise

**Recommendation**: Start with SubQuery Network for true decentralization and cost-effectiveness.

---

## Support and Resources

### Documentation

- [SubQuery Network Documentation](https://subquery.network/doc/subquery_network/architects/publish.html)
- [IPFS Publishing Guide](https://subquery.network/doc/indexer/miscellaneous/ipfs.html)
- [SubQuery Documentation Portal](https://subquery.network/doc/)

### Community

- [SubQuery Discord](https://discord.gg/subquery) - Get help from the community
- [GitHub Discussions](https://github.com/subquery/subql/discussions)
- [SubQuery Forum](https://forum.subquery.network)

### Project-Specific

- [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts)
- [Indexer GitHub Issues](https://github.com/OpenZeppelin/stellar-access-control-indexer/issues)

---

## Next Steps

1. ✅ Verify prerequisites are met
2. ✅ Build and test locally with Docker
3. 📦 Publish to IPFS
4. 🚀 Deploy to SubQuery Network
5. 🔍 Monitor indexing progress
6. 🔗 Integrate endpoint into adapter
7. ✅ Test end-to-end functionality
8. 📈 Set up monitoring and alerts
9. 🌍 Deploy to mainnet (after testnet validation)
10. 📚 Document for your team

**Congratulations!** Your indexer is now part of the decentralized SubQuery Network, serving data to users worldwide with unstoppable, scalable infrastructure.
