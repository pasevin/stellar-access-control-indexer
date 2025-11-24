import {
  StellarDatasourceKind,
  StellarHandlerKind,
  StellarProject,
} from '@subql/types-stellar';
import { Horizon } from '@stellar/stellar-sdk';

/* Mainnet Project Configuration */
const project: StellarProject = {
  specVersion: '1.0.0',
  name: 'stellar-access-control-indexer-mainnet',
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
    'SubQuery indexer for OpenZeppelin Stellar Access Control and Ownable contracts on Mainnet, enabling server-side filtering and historical queries',
  repository: 'https://github.com/OpenZeppelin/stellar-access-control-indexer',
  schema: {
    file: './schema.graphql',
  },
  network: {
    /* The genesis hash of the Stellar mainnet */
    chainId: 'Public Global Stellar Network ; September 2015',
    /**
     * Mainnet endpoints - public non-pruned archive nodes
     * Public nodes may be rate limited, which can affect indexing speed
     * Consider using a private API key for production deployments
     */
    endpoint: ['https://horizon.stellar.org'],
    /* Soroban mainnet endpoint */
    sorobanEndpoint: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
  },
  dataSources: [
    {
      kind: StellarDatasourceKind.Runtime,
      // Start from approximately 2025-05-16 (when OZ Access Control was created)
      startBlock: 57243255,
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
