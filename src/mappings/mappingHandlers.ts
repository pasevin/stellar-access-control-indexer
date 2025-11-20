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
import { xdr, StrKey } from '@stellar/stellar-base';

/**
 * Handler for RoleGranted events
 * Definition: fn emit_role_granted(e: &Env, role: &Symbol, account: &Address, caller: &Address)
 * Topics: ["RoleGranted", role, account]
 * Data: [caller]
 */
export async function handleRoleGranted(event: SorobanEvent): Promise<void> {
  logger.info(
    `Processing RoleGranted event at ledger ${event.ledger!.sequence}`
  );

  // Extract event topics (EventName, Role, Account)
  // Note: topic[0] is the event name
  const roleScVal = event.topic[1];
  const accountScVal = event.topic[2];

  // Extract caller from data (event value)
  // Based on OZ implementation: RoleGranted { ... }.publish(e) emits a struct.
  // Structs in events:
  // - Topics are the fields marked #[topic]
  // - Data is a Vec containing the non-topic fields in order
  const senderScVal = event.value;

  const contractAddress = event.contractId?.contractId().toString()!;
  const role = scValToString(roleScVal);
  const account = decodeAddress(accountScVal);

  // Decode sender from the data struct/vec
  let sender: string | undefined;
  if (senderScVal) {
    sender = decodeAddress(senderScVal);
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
 * Handler for RoleRevoked events
 * Definition: fn emit_role_revoked(e: &Env, role: &Symbol, account: &Address, caller: &Address)
 * Topics: ["RoleRevoked", role, account]
 * Data: [caller]
 */
export async function handleRoleRevoked(event: SorobanEvent): Promise<void> {
  logger.info(
    `Processing RoleRevoked event at ledger ${event.ledger!.sequence}`
  );

  // Extract event topics (EventName, Role, Account)
  const roleScVal = event.topic[1];
  const accountScVal = event.topic[2];
  const senderScVal = event.value;

  const contractAddress = event.contractId?.contractId().toString()!;
  const role = scValToString(roleScVal);
  const account = decodeAddress(accountScVal);

  let sender: string | undefined;
  if (senderScVal) {
    sender = decodeAddress(senderScVal);
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
  // In the OZ implementation, the struct fields are in the data
  const eventData = event.value;
  
  // The data should be a Vec with [new_admin, previous_admin]
  let newAdmin: string | undefined;
  let previousAdmin: string | undefined;
  
  if (eventData && eventData.vec) {
    const vecElements = eventData.vec();
    if (vecElements && vecElements.length >= 2) {
      newAdmin = decodeAddress(vecElements[0]);
      previousAdmin = decodeAddress(vecElements[1]);
    }
  }

  // Create event record
  const eventId = `${event.id}-admin-init`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: newAdmin || 'unknown',
    admin: previousAdmin,
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
 * Definition: fn emit_admin_transfer_completed(e: &Env, new_admin: &Address, previous_admin: &Address)
 * Topics: ["AdminTransferCompleted"]
 * Data: struct { new_admin: Address, previous_admin: Address }
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
  // In the OZ implementation, the struct fields are in the data
  const eventData = event.value;
  
  // The data should be a Vec with [new_admin, previous_admin]
  let newAdmin: string | undefined;
  let previousAdmin: string | undefined;
  
  if (eventData && eventData.vec) {
    const vecElements = eventData.vec();
    if (vecElements && vecElements.length >= 2) {
      newAdmin = decodeAddress(vecElements[0]);
      previousAdmin = decodeAddress(vecElements[1]);
    }
  }

  // Create event record
  const eventId = `${event.id}-admin-complete`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: newAdmin || 'unknown',
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
 * Definition: fn emit_ownership_transfer_started(e: &Env, new_owner: &Address, previous_owner: &Address)
 * Topics: ["OwnershipTransferStarted"]
 * Data: struct { new_owner: Address, previous_owner: Address }
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
  // In the OZ implementation, the struct fields are in the data
  const eventData = event.value;
  
  // The data should be a Vec with [new_owner, previous_owner]
  let newOwner: string | undefined;
  let previousOwner: string | undefined;
  
  if (eventData && eventData.vec) {
    const vecElements = eventData.vec();
    if (vecElements && vecElements.length >= 2) {
      newOwner = decodeAddress(vecElements[0]);
      previousOwner = decodeAddress(vecElements[1]);
    }
  }

  // Create event record
  const eventId = `${event.id}-ownership-start`;
  const accessEvent = AccessControlEvent.create({
    id: eventId,
    contract: contractAddress,
    role: undefined,
    account: newOwner || 'unknown',
    admin: previousOwner,
    type: EventType.OWNERSHIP_TRANSFER_STARTED,
    blockHeight: BigInt(event.ledger!.sequence),
    timestamp: new Date(event.ledgerClosedAt),
    txHash: event.transaction?.hash || 'unknown',
    ledger: event.ledger!.sequence,
  });

  await accessEvent.save();
}

/**
 * Handler for OwnershipTransferCompleted events
 * Definition: fn emit_ownership_transfer_completed(e: &Env, new_owner: &Address)
 * Topics: ["OwnershipTransferCompleted"]
 * Data: [new_owner]
 */
export async function handleOwnershipTransferCompleted(
  event: SorobanEvent
): Promise<void> {
  logger.info(
    `Processing OwnershipTransferCompleted event at ledger ${
      event.ledger!.sequence
    }`
  );

  // Topics: ["OwnershipTransferCompleted"]
  // Data: struct { new_owner: Address }
  // Actually, in `emit_ownership_transfer_completed`:
  // OwnershipTransferCompleted { new_owner: ... }.publish(e)
  // No #[topic] on new_owner means it's in data.

  const contractAddress = event.contractId?.contractId().toString()!;
  const newOwnerScVal = event.value;
  const newOwner = decodeAddress(newOwnerScVal);

  // We don't have previous owner in this event
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

/**
 * Helper function to decode Stellar addresses from ScVal
 */
function decodeAddress(scVal: xdr.ScVal): string {
  try {
    const addressObj = scVal.address();

    switch (addressObj.switch()) {
      case xdr.ScAddressType.scAddressTypeAccount():
        // Decode account address
        const accountId = addressObj.accountId();
        return StrKey.encodeEd25519PublicKey(accountId.ed25519());

      case xdr.ScAddressType.scAddressTypeContract():
        // Decode contract address
        const contractId = addressObj.contractId();
        // Convert Hash (which is an array) to Buffer
        return StrKey.encodeContract(Buffer.from(contractId as any));

      default:
        logger.error(`Unknown address type: ${addressObj.switch()}`);
        return 'unknown';
    }
  } catch (e) {
    logger.error(`Failed to decode address: ${e}`);
    return 'unknown';
  }
}

/**
 * Helper function to convert ScVal to string
 */
function scValToString(scVal: xdr.ScVal): string {
  try {
    // Handle different ScVal types
    switch (scVal.switch()) {
      case xdr.ScValType.scvSymbol():
        return scVal.sym().toString();
      case xdr.ScValType.scvString():
        return scVal.str().toString();
      case xdr.ScValType.scvBytes():
        return scVal.bytes().toString('hex');
      default:
        // For other types, convert to string representation
        return scVal.toString();
    }
  } catch (e) {
    logger.error(`Failed to convert ScVal to string: ${e}`);
    return 'unknown';
  }
}
