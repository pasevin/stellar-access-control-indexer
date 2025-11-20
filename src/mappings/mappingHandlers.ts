/**
 * Lightweight polyfills for browser APIs required by Stellar SDK
 * These are safe for SubQuery's sandbox environment
 */
if (typeof TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = class TextEncoder {
    encode(input: string): Uint8Array {
      const utf8 = unescape(encodeURIComponent(input));
      const result = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i++) {
        result[i] = utf8.charCodeAt(i);
      }
      return result;
    }
  };
}

if (typeof TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = class TextDecoder {
    decode(input: Uint8Array): string {
      let result = '';
      for (let i = 0; i < input.length; i++) {
        result += String.fromCharCode(input[i]);
      }
      return decodeURIComponent(escape(result));
    }
  };
}

import {
  AccessControlEvent,
  RoleMembership,
  ContractOwnership,
  Contract,
  EventType,
  ContractType,
} from '../types';
import { StellarOperation, SorobanEvent } from '@subql/types-stellar';
import { scValToNative } from '@stellar/stellar-base';

/**
 * Handler for RoleGranted events from Access Control contracts
 * Event signature: role_granted(role: Symbol, account: Address, caller: Address)
 * Topics: ["role_granted", role, account]
 * Data: { caller: Address } (wrapped in a Map structure)
 */
export async function handleRoleGranted(event: SorobanEvent): Promise<void> {
  logger.info(
    `Processing RoleGranted event at ledger ${event.ledger!.sequence}`
  );

  // Extract and decode event data using scValToNative
  const contractAddress = event.contractId?.contractId().toString()!;
  const role = scValToNative(event.topic[1]) as string;
  const account = scValToNative(event.topic[2]) as string;

  // The event.value can be either a direct Address or a Map/Struct with 'caller' field
  let sender: string | undefined;
  if (event.value) {
    const decodedValue = scValToNative(event.value);
    // Check if it's an object with 'caller' field or a direct string
    if (
      typeof decodedValue === 'object' &&
      decodedValue !== null &&
      'caller' in decodedValue
    ) {
      sender = (decodedValue as { caller: string }).caller;
    } else if (typeof decodedValue === 'string') {
      sender = decodedValue;
    }
  }

  // Create event record
  const eventId = `${event.id}-granted`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: role,
    account: account,
    admin: sender,
    type: EventType.ROLE_GRANTED,
    blockHeight: BigInt(event.ledger!.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger!.sequence,
  });

  // Update or create role membership
  const membershipId = `${contractAddress}-${role}-${account}`;
  const membership = RoleMembership.create({
    id: membershipId,
    contract: contractAddress,
    role: role,
    account: account,
    grantedAt: new Date(event.ledgerClosedAt),
    grantedBy: sender,
    txHash: event.transaction?.hash || 'unknown',
  });

  // Update contract metadata
  await updateContractMetadata(
    contractAddress,
    ContractType.ACCESS_CONTROL,
    new Date(event.ledgerClosedAt)
  );

  await Promise.all([accessEvent.save(), membership.save()]);
}

/**
 * Handler for RoleRevoked events from Access Control contracts
 * Event signature: role_revoked(role: Symbol, account: Address, caller: Address)
 * Topics: ["role_revoked", role, account]
 * Data: { caller: Address } (wrapped in a Map structure)
 */
export async function handleRoleRevoked(event: SorobanEvent): Promise<void> {
  logger.info(
    `Processing RoleRevoked event at ledger ${event.ledger!.sequence}`
  );

  // Extract and decode event data using scValToNative
  const contractAddress = event.contractId?.contractId().toString()!;
  const role = scValToNative(event.topic[1]) as string;
  const account = scValToNative(event.topic[2]) as string;

  // The event.value can be either a direct Address or a Map/Struct with 'caller' field
  let sender: string | undefined;
  if (event.value) {
    const decodedValue = scValToNative(event.value);
    // Check if it's an object with 'caller' field or a direct string
    if (
      typeof decodedValue === 'object' &&
      decodedValue !== null &&
      'caller' in decodedValue
    ) {
      sender = (decodedValue as { caller: string }).caller;
    } else if (typeof decodedValue === 'string') {
      sender = decodedValue;
    }
  }

  // Create event record
  const eventId = `${event.id}-revoked`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: role,
    account: account,
    admin: sender,
    type: EventType.ROLE_REVOKED,
    blockHeight: BigInt(event.ledger!.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger!.sequence,
  });

  // Remove role membership
  const membershipId = `${contractAddress}-${role}-${account}`;
  await store.remove('RoleMembership', membershipId);

  // Update contract metadata
  await updateContractMetadata(
    contractAddress,
    ContractType.ACCESS_CONTROL,
    new Date(event.ledgerClosedAt)
  );

  await accessEvent.save();
}

/**
 * Handler for AdminTransferInitiated events
 * Definition: fn emit_admin_transfer_initiated(e: &Env, new_admin: &Address, previous_admin: &Address)
 * Topics: ["AdminTransferInitiated"]
 * Data: struct { new_admin: Address, previous_admin: Address }
 */
export async function handleAdminTransferInitiated(
  event: SorobanEvent
): Promise<void> {
  logger.info(
    `Processing AdminTransferInitiated event at ledger ${
      event.ledger!.sequence
    }`
  );

  const contractAddress = event.contractId?.contractId().toString()!;

  // current_admin is in topic[1]
  const currentAdmin = scValToNative(event.topic[1]) as string;

  // The event.value contains new_admin and live_until_ledger
  const eventData = scValToNative(event.value) as Record<string, unknown>;
  const newAdmin = eventData.new_admin as string;
  const liveUntilLedger = eventData.live_until_ledger as number;

  // Create event record
  const eventId = `${event.id}-admin-init`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: newAdmin, // The new admin receiving the role
    admin: currentAdmin, // The current admin initiating transfer
    type: EventType.ADMIN_TRANSFER_INITIATED,
    blockHeight: BigInt(event.ledger!.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger!.sequence,
  });

  await accessEvent.save();
}

/**
 * Handler for AdminTransferCompleted events
 * Event signature: AdminTransferCompleted { new_admin: Address (topic), previous_admin: Address }
 * Topics: ["admin_transfer_completed", new_admin]
 * Data: { previous_admin: Address }
 */
export async function handleAdminTransferCompleted(
  event: SorobanEvent
): Promise<void> {
  logger.info(
    `Processing AdminTransferCompleted event at ledger ${
      event.ledger!.sequence
    }`
  );

  const contractAddress = event.contractId?.contractId().toString()!;

  // new_admin is in topic[1]
  const newAdmin = scValToNative(event.topic[1]) as string;

  // The event.value contains previous_admin
  const eventData = scValToNative(event.value) as Record<string, unknown>;
  const previousAdmin = eventData.previous_admin as string;

  // Create event record
  const eventId = `${event.id}-admin-complete`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: newAdmin,
    admin: previousAdmin,
    type: EventType.ADMIN_TRANSFER_COMPLETED,
    blockHeight: BigInt(event.ledger!.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger!.sequence,
  });

  // Update contract metadata
  await updateContractMetadata(
    contractAddress,
    ContractType.ACCESS_CONTROL,
    new Date(event.ledgerClosedAt)
  );

  await accessEvent.save();
}

/**
 * Handler for OwnershipTransferStarted events
 * Event signature: OwnershipTransfer { old_owner: Address, new_owner: Address, live_until_ledger: u32 }
 * Topics: ["ownership_transfer"]
 * Data: struct/map with old_owner, new_owner, live_until_ledger fields
 */
export async function handleOwnershipTransferStarted(
  event: SorobanEvent
): Promise<void> {
  logger.info(
    `Processing OwnershipTransferStarted event at ledger ${
      event.ledger!.sequence
    }`
  );

  const contractAddress = event.contractId?.contractId().toString()!;

  // The event.value is a struct/map with old_owner, new_owner, live_until_ledger
  const eventData = scValToNative(event.value);
  logger.info(`OwnershipTransfer eventData: ${JSON.stringify(eventData)}`);

  let oldOwner: string;
  let newOwner: string;

  if (eventData && typeof eventData === 'object' && !Array.isArray(eventData)) {
    const dataObj = eventData as Record<string, unknown>;
    oldOwner = dataObj.old_owner as string;
    newOwner = dataObj.new_owner as string;
  } else {
    logger.error(
      `Unexpected eventData structure for OwnershipTransferStarted: ${JSON.stringify(
        eventData
      )}`
    );
    throw new Error(
      `Invalid event data structure at ledger ${event.ledger!.sequence}`
    );
  }

  // Create event record
  const eventId = `${event.id}-ownership-start`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: newOwner, // The new owner receiving ownership
    admin: oldOwner, // The current owner transferring ownership
    type: EventType.OWNERSHIP_TRANSFER_STARTED,
    blockHeight: BigInt(event.ledger!.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger!.sequence,
  });

  await accessEvent.save();
}

/**
 * Handler for OwnershipTransferCompleted events from Ownable contracts
 * Event signature: ownership_transfer_completed(new_owner: Address)
 * Topics: ["ownership_transfer_completed"]
 * Data: { new_owner: Address } (struct/map)
 */
export async function handleOwnershipTransferCompleted(
  event: SorobanEvent
): Promise<void> {
  logger.info(
    `Processing OwnershipTransferCompleted event at ledger ${
      event.ledger!.sequence
    }`
  );

  const contractAddress = event.contractId?.contractId().toString()!;

  // The event.value is a struct (Map) containing { new_owner: Address }
  // scValToNative automatically converts Maps to JS objects
  const eventData = scValToNative(event.value) as Record<string, unknown>;
  const newOwner = eventData.new_owner as string;

  // Previous owner is not available in this event
  const previousOwner = undefined;

  // Create event record
  const eventId = `${event.id}-ownership`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: newOwner,
    admin: previousOwner,
    type: EventType.OWNERSHIP_TRANSFER_COMPLETED,
    blockHeight: BigInt(event.ledger!.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger!.sequence,
  });

  // Update or create ownership record
  const ownership = ContractOwnership.create({
    id: contractAddress,
    contract: contractAddress,
    owner: newOwner,
    previousOwner: previousOwner,
    transferredAt: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
  });

  // Update contract metadata
  await updateContractMetadata(
    contractAddress,
    ContractType.OWNABLE,
    new Date(event.ledgerClosedAt)
  );

  await Promise.all([accessEvent.save(), ownership.save()]);
}

/**
 * Handler for OwnershipRenounced events from Ownable contracts
 * Event signature: ownership_renounced(old_owner: Address)
 * Topics: ["ownership_renounced"] (old_owner may be in topic[1] or event.value depending on contract version)
 * Data: old_owner (Address) or empty
 */
export async function handleOwnershipRenounced(
  event: SorobanEvent
): Promise<void> {
  logger.info(
    `Processing OwnershipRenounced event at ledger ${event.ledger!.sequence}`
  );

  const contractAddress = event.contractId?.contractId().toString()!;

  // old_owner should be in topic[1], but check event.value as fallback
  let oldOwner: string;
  if (event.topic[1]) {
    oldOwner = scValToNative(event.topic[1]) as string;
  } else if (event.value) {
    const eventData = scValToNative(event.value);
    if (typeof eventData === 'string') {
      oldOwner = eventData;
    } else if (eventData && typeof eventData === 'object') {
      oldOwner = (eventData as Record<string, unknown>).old_owner as string;
    } else {
      logger.error(
        `Cannot extract old_owner from OwnershipRenounced event at ledger ${
          event.ledger!.sequence
        }`
      );
      throw new Error(`Invalid event structure`);
    }
  } else {
    logger.error(
      `No topic[1] or value in OwnershipRenounced event at ledger ${
        event.ledger!.sequence
      }`
    );
    throw new Error(`Invalid event structure`);
  }

  // Create event record
  const eventId = `${event.id}-ownership-renounced`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: oldOwner,
    admin: undefined,
    type: EventType.OWNERSHIP_RENOUNCED,
    blockHeight: BigInt(event.ledger!.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger!.sequence,
  });

  // Remove ownership record
  await ContractOwnership.remove(contractAddress);

  // Update contract metadata
  await updateContractMetadata(
    contractAddress,
    ContractType.OWNABLE,
    new Date(event.ledgerClosedAt)
  );

  await accessEvent.save();
}

/**
 * Handler for AdminRenounced events from Access Control contracts
 * Event signature: admin_renounced(admin: Address)
 * Topics: ["admin_renounced"] (admin may be in topic[1] or event.value depending on contract version)
 * Data: admin (Address) or empty
 */
export async function handleAdminRenounced(event: SorobanEvent): Promise<void> {
  logger.info(
    `Processing AdminRenounced event at ledger ${event.ledger!.sequence}`
  );

  const contractAddress = event.contractId?.contractId().toString()!;

  // admin should be in topic[1], but check event.value as fallback
  let admin: string;
  if (event.topic[1]) {
    admin = scValToNative(event.topic[1]) as string;
  } else if (event.value) {
    const eventData = scValToNative(event.value);
    if (typeof eventData === 'string') {
      admin = eventData;
    } else if (eventData && typeof eventData === 'object') {
      admin = (eventData as Record<string, unknown>).admin as string;
    } else {
      logger.error(
        `Cannot extract admin from AdminRenounced event at ledger ${
          event.ledger!.sequence
        }`
      );
      throw new Error(`Invalid event structure`);
    }
  } else {
    logger.error(
      `No topic[1] or value in AdminRenounced event at ledger ${
        event.ledger!.sequence
      }`
    );
    throw new Error(`Invalid event structure`);
  }

  // Create event record
  const eventId = `${event.id}-admin-renounced`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: admin,
    admin: undefined,
    type: EventType.ADMIN_RENOUNCED,
    blockHeight: BigInt(event.ledger!.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger!.sequence,
  });

  // Update contract metadata
  await updateContractMetadata(
    contractAddress,
    ContractType.ACCESS_CONTROL,
    new Date(event.ledgerClosedAt)
  );

  await accessEvent.save();
}

/**
 * Handler for RoleAdminChanged events from Access Control contracts
 * Event signature: role_admin_changed(role: Symbol, previous_admin_role: Symbol, new_admin_role: Symbol)
 * Topics: ["role_admin_changed", role: Symbol]
 * Data: { previous_admin_role: Symbol, new_admin_role: Symbol }
 */
export async function handleRoleAdminChanged(
  event: SorobanEvent
): Promise<void> {
  logger.info(
    `Processing RoleAdminChanged event at ledger ${event.ledger!.sequence}`
  );

  const contractAddress = event.contractId?.contractId().toString()!;

  // role is in topic[1]
  const role = scValToNative(event.topic[1]) as string;

  // previous_admin_role and new_admin_role are in event.value (data)
  const eventData = scValToNative(event.value) as Record<string, unknown>;
  const previousAdminRole = eventData.previous_admin_role as string;
  const newAdminRole = eventData.new_admin_role as string;

  // Create event record
  const eventId = `${event.id}-role-admin-changed`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: role,
    account: newAdminRole, // Use new admin role as account for tracking
    admin: previousAdminRole, // Use previous admin role as admin for reference
    type: EventType.ROLE_ADMIN_CHANGED,
    blockHeight: BigInt(event.ledger!.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger!.sequence,
  });

  // Update contract metadata
  await updateContractMetadata(
    contractAddress,
    ContractType.ACCESS_CONTROL,
    new Date(event.ledgerClosedAt)
  );

  await accessEvent.save();
}

/**
 * Handler for contract deployment operations
 */
export async function handleContractDeployment(
  op: StellarOperation
): Promise<void> {
  logger.info(
    `Processing contract deployment at ledger ${op.ledger!.sequence}`
  );

  // Extract contract address from the operation
  // This logic assumes a standard Soroban contract deployment.
  // In a real scenario, extraction depends on the specific invokeHostFunction structure
  // For MVP, we use the transaction source account or a placeholder if direct ID isn't easily available in this view
  const contractAddress = op.source_account;

  const contract = Contract.create({
    id: contractAddress,
    address: contractAddress,
    type: ContractType.ACCESS_CONTROL_OWNABLE, // Default, would need detection logic
    deployedAt: new Date(op.created_at),
    deployTxHash: op.transaction_hash,
    lastActivityAt: new Date(op.created_at),
  });

  await contract.save();
}

/**
 * Helper function to update or create contract metadata
 */
async function updateContractMetadata(
  contractAddress: string,
  type: ContractType,
  lastActivity: Date
): Promise<void> {
  let contract = await Contract.get(contractAddress);

  if (!contract) {
    contract = Contract.create({
      id: contractAddress,
      address: contractAddress,
      type: type,
      lastActivityAt: lastActivity,
    });
  } else {
    contract.lastActivityAt = lastActivity;
    // Potentially update type if it's a combined contract
    if (
      type !== contract.type &&
      (type === ContractType.ACCESS_CONTROL || type === ContractType.OWNABLE)
    ) {
      contract.type = ContractType.ACCESS_CONTROL_OWNABLE;
    }
  }

  await contract.save();
}
