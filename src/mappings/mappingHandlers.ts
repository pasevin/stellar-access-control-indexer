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
import {
  isValidStellarAddress,
  isValidRoleSymbol,
  safeScValToNative,
  getContractAddress,
  hasValidLedgerInfo,
} from './validation';

/**
 * Handler for RoleGranted events from Access Control contracts
 * Event signature: role_granted(role: Symbol, account: Address, caller: Address)
 * Topics: ["role_granted", role, account]
 * Data: { caller: Address } (wrapped in a Map structure)
 *
 * OpenZeppelin event structure has exactly 3 topics.
 */
export async function handleRoleGranted(event: SorobanEvent): Promise<void> {
  // Validate event has required ledger info
  if (!hasValidLedgerInfo(event)) {
    logger.warn('Skipping role_granted event - missing ledger info');
    return;
  }

  logger.info(
    `Processing RoleGranted event at ledger ${event.ledger.sequence}`
  );

  // Validate OpenZeppelin event structure: exactly 3 topics (event_name, role, account)
  if (event.topic.length !== 3) {
    logger.debug(
      `Skipping non-OZ role_granted event at ledger ${event.ledger.sequence} - ` +
        `expected 3 topics, got ${event.topic.length}`
    );
    return;
  }

  // Extract and validate contract address
  const contractAddress = getContractAddress(event);
  if (!contractAddress) {
    logger.debug(
      `Skipping role_granted event at ledger ${event.ledger.sequence} - ` +
        `invalid contract address`
    );
    return;
  }

  const role = safeScValToNative<string>(event.topic[1]);
  const account = safeScValToNative<string>(event.topic[2]);

  // Validate decoded types match OZ expected format
  if (!isValidRoleSymbol(role) || !isValidStellarAddress(account)) {
    logger.debug(
      `Skipping non-OZ role_granted event at ledger ${event.ledger.sequence} - ` +
        `invalid role or account format`
    );
    return;
  }

  // The event.value contains { caller: Address }
  let sender: string | undefined;
  if (event.value) {
    const decodedValue = safeScValToNative<Record<string, unknown>>(
      event.value
    );
    if (
      decodedValue &&
      typeof decodedValue === 'object' &&
      'caller' in decodedValue &&
      isValidStellarAddress(decodedValue.caller)
    ) {
      sender = decodedValue.caller as string;
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
    blockHeight: BigInt(event.ledger.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger.sequence,
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
 *
 * OpenZeppelin event structure has exactly 3 topics.
 */
export async function handleRoleRevoked(event: SorobanEvent): Promise<void> {
  // Validate event has required ledger info
  if (!hasValidLedgerInfo(event)) {
    logger.warn('Skipping role_revoked event - missing ledger info');
    return;
  }

  logger.info(
    `Processing RoleRevoked event at ledger ${event.ledger.sequence}`
  );

  // Validate OpenZeppelin event structure: exactly 3 topics (event_name, role, account)
  if (event.topic.length !== 3) {
    logger.debug(
      `Skipping non-OZ role_revoked event at ledger ${event.ledger.sequence} - ` +
        `expected 3 topics, got ${event.topic.length}`
    );
    return;
  }

  // Extract and validate contract address
  const contractAddress = getContractAddress(event);
  if (!contractAddress) {
    logger.debug(
      `Skipping role_revoked event at ledger ${event.ledger.sequence} - ` +
        `invalid contract address`
    );
    return;
  }

  const role = safeScValToNative<string>(event.topic[1]);
  const account = safeScValToNative<string>(event.topic[2]);

  // Validate decoded types match OZ expected format
  if (!isValidRoleSymbol(role) || !isValidStellarAddress(account)) {
    logger.debug(
      `Skipping non-OZ role_revoked event at ledger ${event.ledger.sequence} - ` +
        `invalid role or account format`
    );
    return;
  }

  // The event.value contains { caller: Address }
  let sender: string | undefined;
  if (event.value) {
    const decodedValue = safeScValToNative<Record<string, unknown>>(
      event.value
    );
    if (
      decodedValue &&
      typeof decodedValue === 'object' &&
      'caller' in decodedValue &&
      isValidStellarAddress(decodedValue.caller)
    ) {
      sender = decodedValue.caller as string;
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
    blockHeight: BigInt(event.ledger.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger.sequence,
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
 * Definition: fn emit_admin_transfer_initiated(e: &Env, current_admin: &Address, new_admin: &Address, live_until_ledger: u32)
 * Topics: ["admin_transfer_initiated", current_admin]
 * Data: { new_admin: Address, live_until_ledger: u32 }
 *
 * OpenZeppelin event structure has exactly 2 topics.
 */
export async function handleAdminTransferInitiated(
  event: SorobanEvent
): Promise<void> {
  // Validate event has required ledger info
  if (!hasValidLedgerInfo(event)) {
    logger.warn(
      'Skipping admin_transfer_initiated event - missing ledger info'
    );
    return;
  }

  logger.info(
    `Processing AdminTransferInitiated event at ledger ${event.ledger.sequence}`
  );

  // Validate OpenZeppelin event structure: exactly 2 topics (event_name, current_admin)
  if (event.topic.length !== 2) {
    logger.debug(
      `Skipping non-OZ admin_transfer_initiated event at ledger ${event.ledger.sequence} - ` +
        `expected 2 topics, got ${event.topic.length}`
    );
    return;
  }

  // Extract and validate contract address
  const contractAddress = getContractAddress(event);
  if (!contractAddress) {
    logger.debug(
      `Skipping admin_transfer_initiated event at ledger ${event.ledger.sequence} - ` +
        `invalid contract address`
    );
    return;
  }

  // current_admin is in topic[1]
  const currentAdmin = safeScValToNative<string>(event.topic[1]);

  // Validate current_admin is a valid address
  if (!isValidStellarAddress(currentAdmin)) {
    logger.debug(
      `Skipping non-OZ admin_transfer_initiated event at ledger ${event.ledger.sequence} - ` +
        `invalid current_admin format`
    );
    return;
  }

  // The event.value contains new_admin and live_until_ledger
  const eventData = safeScValToNative<Record<string, unknown>>(event.value);

  // Validate OZ data structure has expected fields
  if (
    !eventData ||
    typeof eventData !== 'object' ||
    !('new_admin' in eventData) ||
    !('live_until_ledger' in eventData)
  ) {
    logger.debug(
      `Skipping non-OZ admin_transfer_initiated event at ledger ${event.ledger.sequence} - ` +
        `missing expected fields (new_admin, live_until_ledger)`
    );
    return;
  }

  const newAdmin = eventData.new_admin as string;
  const liveUntilLedger = eventData.live_until_ledger;

  // Validate new_admin is a valid address
  if (!isValidStellarAddress(newAdmin)) {
    logger.debug(
      `Skipping non-OZ admin_transfer_initiated event at ledger ${event.ledger.sequence} - ` +
        `invalid new_admin format`
    );
    return;
  }

  // Validate live_until_ledger is a number
  if (typeof liveUntilLedger !== 'number') {
    logger.debug(
      `Skipping non-OZ admin_transfer_initiated event at ledger ${event.ledger.sequence} - ` +
        `invalid live_until_ledger format`
    );
    return;
  }

  // Create event record
  const eventId = `${event.id}-admin-init`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: newAdmin, // The new admin receiving the role
    admin: currentAdmin, // The current admin initiating transfer
    type: EventType.ADMIN_TRANSFER_INITIATED,
    blockHeight: BigInt(event.ledger.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger.sequence,
  });

  await accessEvent.save();
}

/**
 * Handler for AdminTransferCompleted events
 * Event signature: AdminTransferCompleted { new_admin: Address (topic), previous_admin: Address }
 * Topics: ["admin_transfer_completed", new_admin]
 * Data: { previous_admin: Address }
 *
 * OpenZeppelin event structure has exactly 2 topics.
 */
export async function handleAdminTransferCompleted(
  event: SorobanEvent
): Promise<void> {
  // Validate event has required ledger info
  if (!hasValidLedgerInfo(event)) {
    logger.warn(
      'Skipping admin_transfer_completed event - missing ledger info'
    );
    return;
  }

  logger.info(
    `Processing AdminTransferCompleted event at ledger ${event.ledger.sequence}`
  );

  // Validate OpenZeppelin event structure: exactly 2 topics (event_name, new_admin)
  if (event.topic.length !== 2) {
    logger.debug(
      `Skipping non-OZ admin_transfer_completed event at ledger ${event.ledger.sequence} - ` +
        `expected 2 topics, got ${event.topic.length}`
    );
    return;
  }

  // Extract and validate contract address
  const contractAddress = getContractAddress(event);
  if (!contractAddress) {
    logger.debug(
      `Skipping admin_transfer_completed event at ledger ${event.ledger.sequence} - ` +
        `invalid contract address`
    );
    return;
  }

  // new_admin is in topic[1]
  const newAdmin = safeScValToNative<string>(event.topic[1]);

  // Validate new_admin is a valid address
  if (!isValidStellarAddress(newAdmin)) {
    logger.debug(
      `Skipping non-OZ admin_transfer_completed event at ledger ${event.ledger.sequence} - ` +
        `invalid new_admin format`
    );
    return;
  }

  // The event.value contains previous_admin
  const eventData = safeScValToNative<Record<string, unknown>>(event.value);

  // Validate OZ data structure has expected field
  if (
    !eventData ||
    typeof eventData !== 'object' ||
    !('previous_admin' in eventData)
  ) {
    logger.debug(
      `Skipping non-OZ admin_transfer_completed event at ledger ${event.ledger.sequence} - ` +
        `missing expected field (previous_admin)`
    );
    return;
  }

  const previousAdmin = eventData.previous_admin as string;

  // Validate previous_admin is a valid address
  if (!isValidStellarAddress(previousAdmin)) {
    logger.debug(
      `Skipping non-OZ admin_transfer_completed event at ledger ${event.ledger.sequence} - ` +
        `invalid previous_admin format`
    );
    return;
  }

  // Create event record
  const eventId = `${event.id}-admin-complete`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: newAdmin,
    admin: previousAdmin,
    type: EventType.ADMIN_TRANSFER_COMPLETED,
    blockHeight: BigInt(event.ledger.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger.sequence,
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
 *
 * OpenZeppelin event structure has exactly 1 topic (event name only).
 * Data validation is used to confirm OZ format.
 */
export async function handleOwnershipTransferStarted(
  event: SorobanEvent
): Promise<void> {
  // Validate event has required ledger info
  if (!hasValidLedgerInfo(event)) {
    logger.warn('Skipping ownership_transfer event - missing ledger info');
    return;
  }

  logger.info(
    `Processing OwnershipTransferStarted event at ledger ${event.ledger.sequence}`
  );

  // Validate OpenZeppelin event structure: exactly 1 topic (event_name)
  if (event.topic.length !== 1) {
    logger.debug(
      `Skipping non-OZ ownership_transfer event at ledger ${event.ledger.sequence} - ` +
        `expected 1 topic, got ${event.topic.length}`
    );
    return;
  }

  // Extract and validate contract address
  const contractAddress = getContractAddress(event);
  if (!contractAddress) {
    logger.debug(
      `Skipping ownership_transfer event at ledger ${event.ledger.sequence} - ` +
        `invalid contract address`
    );
    return;
  }

  // The event.value is a struct/map with old_owner, new_owner, live_until_ledger
  const eventData = safeScValToNative<Record<string, unknown>>(event.value);

  if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) {
    logger.debug(
      `Skipping non-OZ ownership_transfer event at ledger ${event.ledger.sequence} - ` +
        `unexpected data structure`
    );
    return;
  }

  // Validate OZ data structure has expected fields
  if (!('old_owner' in eventData) || !('new_owner' in eventData)) {
    logger.debug(
      `Skipping non-OZ ownership_transfer event at ledger ${event.ledger.sequence} - ` +
        `missing expected fields (old_owner, new_owner)`
    );
    return;
  }

  const oldOwner = eventData.old_owner as string;
  const newOwner = eventData.new_owner as string;

  // Validate addresses are in valid Stellar format
  if (!isValidStellarAddress(oldOwner) || !isValidStellarAddress(newOwner)) {
    logger.debug(
      `Skipping non-OZ ownership_transfer event at ledger ${event.ledger.sequence} - ` +
        `invalid owner address format`
    );
    return;
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
    blockHeight: BigInt(event.ledger.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger.sequence,
  });

  await accessEvent.save();
}

/**
 * Handler for OwnershipTransferCompleted events from Ownable contracts
 * Event signature: ownership_transfer_completed(new_owner: Address)
 * Topics: ["ownership_transfer_completed"]
 * Data: { new_owner: Address } (struct/map)
 *
 * OpenZeppelin event structure has exactly 1 topic (event name only).
 * Data validation is used to confirm OZ format.
 */
export async function handleOwnershipTransferCompleted(
  event: SorobanEvent
): Promise<void> {
  // Validate event has required ledger info
  if (!hasValidLedgerInfo(event)) {
    logger.warn(
      'Skipping ownership_transfer_completed event - missing ledger info'
    );
    return;
  }

  logger.info(
    `Processing OwnershipTransferCompleted event at ledger ${event.ledger.sequence}`
  );

  // Validate OpenZeppelin event structure: exactly 1 topic (event_name)
  if (event.topic.length !== 1) {
    logger.debug(
      `Skipping non-OZ ownership_transfer_completed event at ledger ${event.ledger.sequence} - ` +
        `expected 1 topic, got ${event.topic.length}`
    );
    return;
  }

  // Extract and validate contract address
  const contractAddress = getContractAddress(event);
  if (!contractAddress) {
    logger.debug(
      `Skipping ownership_transfer_completed event at ledger ${event.ledger.sequence} - ` +
        `invalid contract address`
    );
    return;
  }

  // The event.value is a struct (Map) containing { new_owner: Address }
  // scValToNative automatically converts Maps to JS objects
  const eventData = safeScValToNative<Record<string, unknown>>(event.value);

  // Validate OZ data structure has expected field
  if (
    !eventData ||
    typeof eventData !== 'object' ||
    !('new_owner' in eventData)
  ) {
    logger.debug(
      `Skipping non-OZ ownership_transfer_completed event at ledger ${event.ledger.sequence} - ` +
        `missing expected field (new_owner)`
    );
    return;
  }

  const newOwner = eventData.new_owner as string;

  // Validate new_owner is a valid address
  if (!isValidStellarAddress(newOwner)) {
    logger.debug(
      `Skipping non-OZ ownership_transfer_completed event at ledger ${event.ledger.sequence} - ` +
        `invalid new_owner format`
    );
    return;
  }

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
    blockHeight: BigInt(event.ledger.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger.sequence,
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
 * Event signature: OwnershipRenounced { old_owner: Address }
 * Topics: ["ownership_renounced"]
 * Data: { old_owner: Address }
 *
 * OpenZeppelin event structure has exactly 1 topic (event name only).
 * Data validation is used to confirm OZ format.
 */
export async function handleOwnershipRenounced(
  event: SorobanEvent
): Promise<void> {
  // Validate event has required ledger info
  if (!hasValidLedgerInfo(event)) {
    logger.warn('Skipping ownership_renounced event - missing ledger info');
    return;
  }

  logger.info(
    `Processing OwnershipRenounced event at ledger ${event.ledger.sequence}`
  );

  // Validate OpenZeppelin event structure: exactly 1 topic (event_name)
  if (event.topic.length !== 1) {
    logger.debug(
      `Skipping non-OZ ownership_renounced event at ledger ${event.ledger.sequence} - ` +
        `expected 1 topic, got ${event.topic.length}`
    );
    return;
  }

  // Extract and validate contract address
  const contractAddress = getContractAddress(event);
  if (!contractAddress) {
    logger.debug(
      `Skipping ownership_renounced event at ledger ${event.ledger.sequence} - ` +
        `invalid contract address`
    );
    return;
  }

  // old_owner is in the event.value as a struct
  const eventData = safeScValToNative<Record<string, unknown>>(event.value);

  if (
    !eventData ||
    typeof eventData !== 'object' ||
    !('old_owner' in eventData)
  ) {
    logger.debug(
      `Skipping non-OZ ownership_renounced event at ledger ${event.ledger.sequence} - ` +
        `missing expected field (old_owner)`
    );
    return;
  }

  const oldOwner = eventData.old_owner as string;

  // Validate old_owner is a valid address
  if (!isValidStellarAddress(oldOwner)) {
    logger.debug(
      `Skipping non-OZ ownership_renounced event at ledger ${event.ledger.sequence} - ` +
        `invalid old_owner format`
    );
    return;
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
    blockHeight: BigInt(event.ledger.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger.sequence,
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
 * Event signature: AdminRenounced { admin: Address (topic) }
 * Topics: ["admin_renounced", admin]
 * Data: empty
 *
 * OpenZeppelin event structure has exactly 2 topics.
 */
export async function handleAdminRenounced(event: SorobanEvent): Promise<void> {
  // Validate event has required ledger info
  if (!hasValidLedgerInfo(event)) {
    logger.warn('Skipping admin_renounced event - missing ledger info');
    return;
  }

  logger.info(
    `Processing AdminRenounced event at ledger ${event.ledger.sequence}`
  );

  // Validate OpenZeppelin event structure: exactly 2 topics (event_name, admin)
  if (event.topic.length !== 2) {
    logger.debug(
      `Skipping non-OZ admin_renounced event at ledger ${event.ledger.sequence} - ` +
        `expected 2 topics, got ${event.topic.length}`
    );
    return;
  }

  // Extract and validate contract address
  const contractAddress = getContractAddress(event);
  if (!contractAddress) {
    logger.debug(
      `Skipping admin_renounced event at ledger ${event.ledger.sequence} - ` +
        `invalid contract address`
    );
    return;
  }

  // admin is in topic[1]
  const admin = safeScValToNative<string>(event.topic[1]);

  // Validate admin is a valid address
  if (!isValidStellarAddress(admin)) {
    logger.debug(
      `Skipping non-OZ admin_renounced event at ledger ${event.ledger.sequence} - ` +
        `invalid admin format`
    );
    return;
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
    blockHeight: BigInt(event.ledger.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger.sequence,
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
 * Event signature: RoleAdminChanged { role: Symbol (topic), previous_admin_role: Symbol, new_admin_role: Symbol }
 * Topics: ["role_admin_changed", role: Symbol]
 * Data: { previous_admin_role: Symbol, new_admin_role: Symbol }
 *
 * Note: This event does NOT involve an account - it's about changing which role
 * administers another role. We store role names in admin fields for reference.
 *
 * OpenZeppelin event structure has exactly 2 topics.
 */
export async function handleRoleAdminChanged(
  event: SorobanEvent
): Promise<void> {
  // Validate event has required ledger info
  if (!hasValidLedgerInfo(event)) {
    logger.warn('Skipping role_admin_changed event - missing ledger info');
    return;
  }

  logger.info(
    `Processing RoleAdminChanged event at ledger ${event.ledger.sequence}`
  );

  // Validate OpenZeppelin event structure: exactly 2 topics (event_name, role)
  if (event.topic.length !== 2) {
    logger.debug(
      `Skipping non-OZ role_admin_changed event at ledger ${event.ledger.sequence} - ` +
        `expected 2 topics, got ${event.topic.length}`
    );
    return;
  }

  // Extract and validate contract address
  const contractAddress = getContractAddress(event);
  if (!contractAddress) {
    logger.debug(
      `Skipping role_admin_changed event at ledger ${event.ledger.sequence} - ` +
        `invalid contract address`
    );
    return;
  }

  // role is in topic[1]
  const role = safeScValToNative<string>(event.topic[1]);

  // Validate role is a valid symbol
  if (!isValidRoleSymbol(role)) {
    logger.debug(
      `Skipping non-OZ role_admin_changed event at ledger ${event.ledger.sequence} - ` +
        `invalid role format`
    );
    return;
  }

  // previous_admin_role and new_admin_role are in event.value (data)
  const eventData = safeScValToNative<Record<string, unknown>>(event.value);

  // Validate OZ data structure has expected fields
  if (
    !eventData ||
    typeof eventData !== 'object' ||
    !('previous_admin_role' in eventData) ||
    !('new_admin_role' in eventData)
  ) {
    logger.debug(
      `Skipping non-OZ role_admin_changed event at ledger ${event.ledger.sequence} - ` +
        `missing expected fields (previous_admin_role, new_admin_role)`
    );
    return;
  }

  const previousAdminRole = eventData.previous_admin_role as string;
  const newAdminRole = eventData.new_admin_role as string;

  // Validate admin roles are valid symbols (note: previous_admin_role can be empty string for first-time set)
  if (
    typeof previousAdminRole !== 'string' ||
    !isValidRoleSymbol(newAdminRole)
  ) {
    logger.debug(
      `Skipping non-OZ role_admin_changed event at ledger ${event.ledger.sequence} - ` +
        `invalid admin role format`
    );
    return;
  }

  // Create event record
  // Note: This event doesn't involve an account address - it's about role-to-role relationships
  // The role whose admin is being changed is stored in the 'role' field
  // Previous/new admin roles are stored in dedicated fields for audit purposes
  const eventId = `${event.id}-role-admin-changed`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: role,
    account: undefined as any, // No account involved - this is about role administration
    admin: undefined, // No address involved - admin field is reserved for addresses
    previousAdminRole: previousAdminRole, // Store for audit trail
    newAdminRole: newAdminRole, // Store for audit trail
    type: EventType.ROLE_ADMIN_CHANGED,
    blockHeight: BigInt(event.ledger.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger.sequence,
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
  // Validate operation has required ledger info
  if (!op.ledger || typeof op.ledger.sequence !== 'number') {
    logger.warn('Skipping contract deployment - missing ledger info');
    return;
  }

  logger.info(`Processing contract deployment at ledger ${op.ledger.sequence}`);

  // Extract contract address from the operation
  // This logic assumes a standard Soroban contract deployment.
  // In a real scenario, extraction depends on the specific invokeHostFunction structure
  // For MVP, we use the transaction source account or a placeholder if direct ID isn't easily available in this view
  const contractAddress = op.source_account;

  if (!contractAddress) {
    logger.warn(
      `Skipping contract deployment at ledger ${op.ledger.sequence} - missing source account`
    );
    return;
  }

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
