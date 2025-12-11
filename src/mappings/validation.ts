/**
 * Validation utilities for OpenZeppelin Stellar Access Control indexer.
 *
 * These functions validate event data to ensure we only process genuine
 * OpenZeppelin contract events and filter out non-OZ events that happen
 * to have similar topic names.
 */

import { scValToNative, StrKey } from '@stellar/stellar-base';
import type { SorobanEvent } from '@subql/types-stellar';

/**
 * Validates that a string is a valid Stellar address using the official
 * Stellar SDK's StrKey validation methods with proper checksum verification.
 *
 * @see https://stellar.github.io/js-stellar-sdk/StrKey.html
 *
 * Accepts:
 * - G... (Ed25519 public keys) - validated via StrKey.isValidEd25519PublicKey
 * - C... (contract addresses) - validated via StrKey.isValidContract
 *
 * This helps filter out non-OZ events that happen to have the same topic structure.
 */
export function isValidStellarAddress(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    // Check for valid Ed25519 public key (G...)
    if (value.startsWith('G')) {
      return StrKey.isValidEd25519PublicKey(value);
    }
    // Check for valid contract address (C...)
    if (value.startsWith('C')) {
      return StrKey.isValidContract(value);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Validates that a value is a valid Soroban Symbol.
 *
 * Per official Soroban SDK documentation:
 * @see https://docs.rs/soroban-sdk/latest/soroban_sdk/struct.Symbol.html
 *
 * Constraints:
 * - Max 32 characters
 * - Valid characters: a-z, A-Z, 0-9, _
 * - No restriction on starting character (can start with digit)
 */
export function isValidRoleSymbol(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 32) {
    return false;
  }
  // Soroban symbols: letters (a-z, A-Z), digits (0-9), underscore only
  return /^[a-zA-Z0-9_]+$/.test(value);
}

/**
 * Safely decodes an ScVal, returning undefined if decoding fails.
 */
export function safeScValToNative<T>(scVal: unknown): T | undefined {
  try {
    return scValToNative(scVal as any) as T;
  } catch {
    return undefined;
  }
}

/**
 * Safely extracts contract address from event.
 * Returns undefined if the contract ID cannot be extracted.
 */
export function getContractAddress(event: SorobanEvent): string | undefined {
  try {
    const address = event.contractId?.contractId().toString();
    if (address && isValidStellarAddress(address)) {
      return address;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validates that an event has required ledger information.
 */
export function hasValidLedgerInfo(
  event: SorobanEvent
): event is SorobanEvent & { ledger: NonNullable<SorobanEvent['ledger']> } {
  return (
    event.ledger !== null &&
    event.ledger !== undefined &&
    typeof event.ledger.sequence === 'number'
  );
}
