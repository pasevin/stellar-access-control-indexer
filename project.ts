import {
  StellarDatasourceKind,
  StellarHandlerKind,
  StellarProject,
} from '@subql/types-stellar';
import { Horizon } from '@stellar/stellar-sdk';

/* This is your project configuration */
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
    /* The genesis hash of the network (hash of block 1) */
    chainId: 'Test SDF Network ; September 2015',
    /**
     * These endpoint(s) should be public non-pruned archive node
     * Public nodes may be rate limited, which can affect indexing speed
     * When developing your project we suggest getting a private API key
     * You can get them from OnFinality for free https://app.onfinality.io
     */
    endpoint: ['https://horizon-testnet.stellar.org'],
    /* This is a specific Soroban endpoint
     * It is required for Soroban projects
     */
    sorobanEndpoint: 'https://soroban-testnet.stellar.org',
  },
  dataSources: [
    {
      kind: StellarDatasourceKind.Runtime,
      startBlock: 0,
      mapping: {
        file: './dist/index.js',
        handlers: [
          /* Access Control Events */
          {
            handler: 'handleRoleGranted',
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ['role_granted'],
            },
          },
          {
            handler: 'handleRoleRevoked',
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ['role_revoked'],
            },
          },
          {
            handler: 'handleAdminTransferInitiated',
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ['admin_transfer_initiated'],
            },
          },
          {
            handler: 'handleAdminTransferCompleted',
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ['admin_transfer_completed'],
            },
          },
          {
            handler: 'handleAdminRenounced',
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ['admin_renounced'],
            },
          },
          {
            handler: 'handleRoleAdminChanged',
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ['role_admin_changed'],
            },
          },
          /* Ownable Events */
          {
            handler: 'handleOwnershipTransferStarted',
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ['ownership_transfer'],
            },
          },
          {
            handler: 'handleOwnershipTransferCompleted',
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ['ownership_transfer_completed'],
            },
          },
          {
            handler: 'handleOwnershipRenounced',
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ['ownership_renounced'],
            },
          },
          /* Optional: Contract deployment tracking */
          {
            handler: 'handleContractDeployment',
            kind: StellarHandlerKind.Operation,
            filter: {
              type: 'invokeHostFunction' as any,
            },
          },
        ],
      },
    },
  ],
};

// Can expand the Datasource processor types via the generic param
export default project;
