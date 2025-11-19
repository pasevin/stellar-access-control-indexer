/**
 * SubQuery Indexer Client for OpenZeppelin Stellar Access Control
 * This client provides methods to query the indexed Access Control data
 * from a SubQuery GraphQL endpoint.
 */

export interface AccessControlEventFilter {
  contract?: string;
  account?: string;
  role?: string;
  type?: 'ROLE_GRANTED' | 'ROLE_REVOKED' | 'OWNERSHIP_TRANSFERRED';
  fromTimestamp?: Date;
  toTimestamp?: Date;
}

export interface HistoryEntry {
  id: string;
  contract: string;
  role: string | null;
  account: string;
  admin: string | null;
  type: string;
  timestamp: Date;
  txHash: string;
  blockHeight: string;
}

export interface RoleMember {
  account: string;
  role: string;
  contract: string;
  grantedAt: Date;
  grantedBy: string | null;
}

export interface ContractOwner {
  contract: string;
  owner: string;
  previousOwner: string | null;
  transferredAt: Date;
}

export class SubQueryIndexerClient {
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  /**
   * Query access control events with server-side filtering
   */
  async queryAccessControlEvents(
    filter: AccessControlEventFilter,
    limit: number = 100,
    offset: number = 0
  ): Promise<HistoryEntry[]> {
    const query = this.buildHistoryQuery(filter, limit, offset);
    
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return this.mapToHistoryEntries(data.data.accessControlEvents.nodes);
  }

  /**
   * Get current role members for a specific contract and role
   */
  async getRoleMembers(
    contractAddress: string,
    role?: string
  ): Promise<RoleMember[]> {
    const roleFilter = role 
      ? `role: { equalTo: "${role}" }` 
      : '';
    
    const query = `
      query GetRoleMembers {
        roleMemberships(
          filter: {
            contract: { equalTo: "${contractAddress}" }
            ${roleFilter}
          }
        ) {
          nodes {
            account
            role
            contract
            grantedAt
            grantedBy
          }
        }
      }
    `;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data.roleMemberships.nodes.map((node: any) => ({
      account: node.account,
      role: node.role,
      contract: node.contract,
      grantedAt: new Date(node.grantedAt),
      grantedBy: node.grantedBy,
    }));
  }

  /**
   * Get current owner of a contract
   */
  async getContractOwner(contractAddress: string): Promise<ContractOwner | null> {
    const query = `
      query GetContractOwner {
        contractOwnership(id: "${contractAddress}") {
          contract
          owner
          previousOwner
          transferredAt
        }
      }
    `;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const ownership = data.data.contractOwnership;
    if (!ownership) {
      return null;
    }

    return {
      contract: ownership.contract,
      owner: ownership.owner,
      previousOwner: ownership.previousOwner,
      transferredAt: new Date(ownership.transferredAt),
    };
  }

  /**
   * Check if an account has a specific role
   */
  async hasRole(
    contractAddress: string,
    account: string,
    role: string
  ): Promise<boolean> {
    const membershipId = `${contractAddress}-${role}-${account}`;
    
    const query = `
      query CheckRole {
        roleMembership(id: "${membershipId}") {
          id
        }
      }
    `;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data.roleMembership !== null;
  }

  /**
   * Build GraphQL query for access control events with filters
   */
  private buildHistoryQuery(
    filter: AccessControlEventFilter,
    limit: number,
    offset: number
  ): string {
    const filters: string[] = [];

    if (filter.contract) {
      filters.push(`contract: { equalTo: "${filter.contract}" }`);
    }
    if (filter.account) {
      filters.push(`account: { equalTo: "${filter.account}" }`);
    }
    if (filter.role) {
      filters.push(`role: { equalTo: "${filter.role}" }`);
    }
    if (filter.type) {
      filters.push(`type: { equalTo: ${filter.type} }`);
    }
    if (filter.fromTimestamp) {
      filters.push(`timestamp: { greaterThanOrEqualTo: "${filter.fromTimestamp.toISOString()}" }`);
    }
    if (filter.toTimestamp) {
      filters.push(`timestamp: { lessThanOrEqualTo: "${filter.toTimestamp.toISOString()}" }`);
    }

    const filterClause = filters.length > 0 
      ? `filter: { ${filters.join(', ')} }`
      : '';

    return `
      query GetAccessControlEvents {
        accessControlEvents(
          ${filterClause}
          first: ${limit}
          offset: ${offset}
          orderBy: TIMESTAMP_DESC
        ) {
          nodes {
            id
            contract
            role
            account
            admin
            type
            timestamp
            txHash
            blockHeight
          }
          totalCount
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `;
  }

  /**
   * Map GraphQL response to HistoryEntry format
   */
  private mapToHistoryEntries(nodes: any[]): HistoryEntry[] {
    return nodes.map(node => ({
      id: node.id,
      contract: node.contract,
      role: node.role,
      account: node.account,
      admin: node.admin,
      type: node.type,
      timestamp: new Date(node.timestamp),
      txHash: node.txHash,
      blockHeight: node.blockHeight.toString(),
    }));
  }
}

// Export for use in adapter
export default SubQueryIndexerClient;