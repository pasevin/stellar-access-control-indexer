import {
  StellarDatasourceKind,
  StellarHandlerKind,
  StellarProject,
} from '@subql/types-stellar';

/* OpenZeppelin Stellar Access Control Indexer Configuration */
const project: StellarProject = {
  specVersion: '1.0.0',
  name: 'stellar-access-control-indexer',
  version: '1.0.0',
  runner: {
    node: {
      name: '@subql/node-stellar',
      version: '*',
    },
    query: {
      name: '@subql/query',
      version: '*',
    },
  },
  description:
    'SubQuery indexer for OpenZeppelin Stellar Access Control and Ownable contracts, enabling server-side filtering and historical queries',
  repository: 'https://github.com/OpenZeppelin/stellar-access-control-indexer',
  schema: {
    file: './schema.graphql',
  },
  network: {
    /* Stellar and Soroban uses the network passphrase as the chainId
      'Test SDF Network ; September 2015' for testnet
      'Public Global Stellar Network ; September 2015' for mainnet
      'Test SDF Future Network ; October 2022' for Future Network */
    chainId: 'Test SDF Network ; September 2015',
    /**
     * Multiple endpoints for better reliability and rate limit handling
     * Public nodes may be rate limited, which can affect indexing speed
     * When developing your project we suggest getting a private API key
     * If you use a rate limited endpoint, adjust the --batch-size and --workers parameters
     * These settings can be found in your docker-compose.yaml
     */
    endpoint: ['https://horizon-testnet.stellar.org'],
    /* This is a specific Soroban endpoint
      It is only required when you are using a soroban/EventHandler */
    sorobanEndpoint: 'https://soroban-testnet.stellar.org',
  },
  dataSources: [
    {
      kind: StellarDatasourceKind.Runtime,
      /* Start from recent block - approximately 2 weeks ago to ensure data availability */
      startBlock: 1600000,
      mapping: {
        file: './dist/index.js',
        handlers: [
          /* Access Control Events */
          {
            handler: 'handleRoleGranted',
            kind: StellarHandlerKind.Event,
            filter: {
              /* RoleGranted(role: Symbol, account: Address, caller: Address)
                 Topics: ["RoleGranted", role, account] */
              topics: ['RoleGranted'],
            },
          },
          {
            handler: 'handleRoleRevoked',
            kind: StellarHandlerKind.Event,
            filter: {
              /* RoleRevoked(role: Symbol, account: Address, caller: Address)
                 Topics: ["RoleRevoked", role, account] */
              topics: ['RoleRevoked'],
            },
          },
          /* Ownable Events */
          {
            handler: 'handleOwnershipTransferCompleted',
            kind: StellarHandlerKind.Event,
            filter: {
              /* OwnershipTransferCompleted(new_owner: Address)
                 Topics: ["OwnershipTransferCompleted"] */
              topics: ['OwnershipTransferCompleted'],
            },
          },
          /* Optional: Contract deployment tracking */
          {
            handler: 'handleContractDeployment',
            kind: StellarHandlerKind.Operation,
            filter: {
              /* Track contract creation operations via Host Function Invocation
                 Using 'invokeHostFunction' (camelCase) as per Horizon API
                 Type assertion needed due to incomplete SubQuery type definitions */
              type: 'invokeHostFunction' as any,
            },
          },
        ],
      },
    },
  ],
};

// Must set default to the project instance
export default project;
