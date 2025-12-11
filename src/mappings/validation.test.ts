import { describe, it, expect } from 'vitest';
import { xdr, Address } from '@stellar/stellar-base';
import {
  isValidStellarAddress,
  isValidRoleSymbol,
  safeScValToNative,
} from './validation';

/**
 * Unit tests for validation utilities
 *
 * These tests verify that our validation functions correctly:
 * 1. Accept valid Stellar addresses and reject invalid ones
 * 2. Accept valid Soroban symbols and reject invalid ones
 * 3. Safely decode ScVal values without throwing
 */

describe('isValidStellarAddress', () => {
  describe('valid Ed25519 public keys (G...)', () => {
    it('should accept valid G... addresses', () => {
      const validAddresses = [
        'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT',
        'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO',
        'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI',
      ];

      validAddresses.forEach((addr) => {
        expect(isValidStellarAddress(addr)).toBe(true);
      });
    });

    it('should reject G... addresses with invalid checksum', () => {
      // Modified last character to break checksum
      const invalidAddresses = [
        'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTA',
        'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQP',
      ];

      invalidAddresses.forEach((addr) => {
        expect(isValidStellarAddress(addr)).toBe(false);
      });
    });

    it('should reject G... addresses with wrong length', () => {
      expect(
        isValidStellarAddress('GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4Y')
      ).toBe(false);
      expect(
        isValidStellarAddress(
          'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTTEXTRA'
        )
      ).toBe(false);
    });
  });

  describe('valid contract addresses (C...)', () => {
    it('should accept valid C... addresses', () => {
      const validAddresses = [
        'CANM3Y2GVGH6ACSHUORZ56ZFZ2FSFX6XEWPJYW7BNZVAXKSEQMBTDWD2',
        'CBFFASZY2OIHUBSKYPFYVEQKL46GIZ4KDJUZBTEC3IJSB3USQVZEZFVC',
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      ];

      validAddresses.forEach((addr) => {
        expect(isValidStellarAddress(addr)).toBe(true);
      });
    });

    it('should reject C... addresses with invalid checksum', () => {
      // Modified last character to break checksum
      const invalidAddresses = [
        'CANM3Y2GVGH6ACSHUORZ56ZFZ2FSFX6XEWPJYW7BNZVAXKSEQMBTDWD3',
        'CBFFASZY2OIHUBSKYPFYVEQKL46GIZ4KDJUZBTEC3IJSB3USQVZEZFVA',
      ];

      invalidAddresses.forEach((addr) => {
        expect(isValidStellarAddress(addr)).toBe(false);
      });
    });
  });

  describe('invalid inputs', () => {
    it('should reject non-string values', () => {
      expect(isValidStellarAddress(null)).toBe(false);
      expect(isValidStellarAddress(undefined)).toBe(false);
      expect(isValidStellarAddress(123)).toBe(false);
      expect(isValidStellarAddress({})).toBe(false);
      expect(isValidStellarAddress([])).toBe(false);
      expect(isValidStellarAddress(true)).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isValidStellarAddress('')).toBe(false);
    });

    it('should reject addresses with wrong prefix', () => {
      expect(
        isValidStellarAddress(
          'AATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT'
        )
      ).toBe(false);
      expect(
        isValidStellarAddress(
          'XATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT'
        )
      ).toBe(false);
    });

    it('should reject random strings', () => {
      expect(isValidStellarAddress('hello_world')).toBe(false);
      expect(isValidStellarAddress('admin_role')).toBe(false);
      expect(isValidStellarAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe(false);
    });

    it('should reject strings that look like addresses but are fake', () => {
      // 56 character strings starting with G but invalid base32/checksum
      expect(
        isValidStellarAddress(
          'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
        )
      ).toBe(false);
      expect(
        isValidStellarAddress(
          'G123456789012345678901234567890123456789012345678901234'
        )
      ).toBe(false);
    });

    it('should reject malicious injection attempts', () => {
      // Strings that could be used for injection
      expect(isValidStellarAddress("G'; DROP TABLE users; --")).toBe(false);
      expect(isValidStellarAddress('<script>alert("xss")</script>')).toBe(
        false
      );
      expect(isValidStellarAddress('G' + 'A'.repeat(100))).toBe(false);
    });
  });
});

describe('isValidRoleSymbol', () => {
  /**
   * Tests based on official Soroban SDK Symbol documentation:
   * @see https://docs.rs/soroban-sdk/latest/soroban_sdk/struct.Symbol.html
   *
   * Valid characters: a-z, A-Z, 0-9, _
   * Max length: 32 characters
   * No restriction on starting character
   */
  describe('valid symbols', () => {
    it('should accept valid lowercase role names', () => {
      const validSymbols = [
        'admin',
        'minter',
        'burner',
        'pauser',
        'admin_role',
        'super_admin',
        'role_granted',
        'a',
      ];

      validSymbols.forEach((symbol) => {
        expect(isValidRoleSymbol(symbol)).toBe(true);
      });
    });

    it('should accept valid uppercase role names (per Soroban spec)', () => {
      const validSymbols = ['Admin', 'ADMIN', 'adminRole', 'ROLE_GRANTED'];

      validSymbols.forEach((symbol) => {
        expect(isValidRoleSymbol(symbol)).toBe(true);
      });
    });

    it('should accept symbols starting with underscore', () => {
      const validSymbols = ['_admin', '_private_role', '_123', '__internal'];

      validSymbols.forEach((symbol) => {
        expect(isValidRoleSymbol(symbol)).toBe(true);
      });
    });

    it('should accept symbols starting with digits (per Soroban spec)', () => {
      // Soroban allows symbols to start with digits
      const validSymbols = ['123abc', '1admin', '0_role', '9test', '42'];

      validSymbols.forEach((symbol) => {
        expect(isValidRoleSymbol(symbol)).toBe(true);
      });
    });

    it('should accept role names with mixed case and digits', () => {
      const validSymbols = [
        'role1',
        'Admin2',
        'MINTER_v2',
        'Role_123_Test',
        'ABC123xyz',
      ];

      validSymbols.forEach((symbol) => {
        expect(isValidRoleSymbol(symbol)).toBe(true);
      });
    });

    it('should accept maximum length symbols (32 chars)', () => {
      const maxLengthSymbol = 'a'.repeat(32);
      expect(isValidRoleSymbol(maxLengthSymbol)).toBe(true);

      const mixedMaxLength = 'Aa1_'.repeat(8); // 32 chars
      expect(isValidRoleSymbol(mixedMaxLength)).toBe(true);
    });
  });

  describe('invalid symbols - special characters', () => {
    it('should reject symbols with special characters', () => {
      const invalidSymbols = [
        'admin-role',
        'admin.role',
        'admin:role',
        'admin/role',
        'admin@role',
        'admin#role',
        'admin$role',
        'admin%role',
        'admin^role',
        'admin&role',
        'admin*role',
        'admin(role)',
        'admin[role]',
        'admin{role}',
        'admin role', // space
      ];

      invalidSymbols.forEach((symbol) => {
        expect(isValidRoleSymbol(symbol)).toBe(false);
      });
    });
  });

  describe('invalid symbols - length', () => {
    it('should reject empty strings', () => {
      expect(isValidRoleSymbol('')).toBe(false);
    });

    it('should reject symbols exceeding 32 characters', () => {
      const tooLongSymbol = 'a'.repeat(33);
      expect(isValidRoleSymbol(tooLongSymbol)).toBe(false);

      const wayTooLong = 'a'.repeat(100);
      expect(isValidRoleSymbol(wayTooLong)).toBe(false);
    });
  });

  describe('invalid symbols - type checks', () => {
    it('should reject non-string values', () => {
      expect(isValidRoleSymbol(null)).toBe(false);
      expect(isValidRoleSymbol(undefined)).toBe(false);
      expect(isValidRoleSymbol(123)).toBe(false);
      expect(isValidRoleSymbol({})).toBe(false);
      expect(isValidRoleSymbol([])).toBe(false);
      expect(isValidRoleSymbol(true)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle single underscore', () => {
      expect(isValidRoleSymbol('_')).toBe(true);
    });

    it('should handle only underscores', () => {
      expect(isValidRoleSymbol('___')).toBe(true);
    });

    it('should handle single digit', () => {
      expect(isValidRoleSymbol('1')).toBe(true);
    });

    it('should reject symbols that could be SQL injection', () => {
      expect(isValidRoleSymbol("admin'; DROP TABLE--")).toBe(false);
    });
  });
});

describe('safeScValToNative', () => {
  describe('successful decoding', () => {
    it('should decode symbol ScVal', () => {
      const symbolScVal = xdr.ScVal.scvSymbol('test_symbol');
      const result = safeScValToNative<string>(symbolScVal);
      expect(result).toBe('test_symbol');
    });

    it('should decode string ScVal', () => {
      const stringScVal = xdr.ScVal.scvString('hello world');
      const result = safeScValToNative<string>(stringScVal);
      expect(result).toBe('hello world');
    });

    it('should decode address ScVal', () => {
      const address = Address.fromString(
        'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT'
      );
      const addressScVal = address.toScVal();
      const result = safeScValToNative<string>(addressScVal);
      expect(result).toBe(
        'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT'
      );
    });

    it('should decode u32 ScVal', () => {
      const u32ScVal = xdr.ScVal.scvU32(12345);
      const result = safeScValToNative<number>(u32ScVal);
      expect(result).toBe(12345);
    });

    it('should decode boolean ScVal', () => {
      const trueScVal = xdr.ScVal.scvBool(true);
      const falseScVal = xdr.ScVal.scvBool(false);

      expect(safeScValToNative<boolean>(trueScVal)).toBe(true);
      expect(safeScValToNative<boolean>(falseScVal)).toBe(false);
    });

    it('should decode map ScVal to object', () => {
      const entries = [
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('key1'),
          val: xdr.ScVal.scvString('value1'),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('key2'),
          val: xdr.ScVal.scvU32(42),
        }),
      ];

      const mapScVal = xdr.ScVal.scvMap(entries);
      const result = safeScValToNative<Record<string, unknown>>(mapScVal);

      expect(result).toEqual({
        key1: 'value1',
        key2: 42,
      });
    });
  });

  describe('graceful failure', () => {
    it('should return undefined for null input', () => {
      const result = safeScValToNative<string>(null);
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined input', () => {
      const result = safeScValToNative<string>(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid object', () => {
      const result = safeScValToNative<string>({ invalid: 'object' });
      expect(result).toBeUndefined();
    });

    it('should return undefined for plain string (not ScVal)', () => {
      const result = safeScValToNative<string>('not an scval');
      expect(result).toBeUndefined();
    });

    it('should return undefined for number (not ScVal)', () => {
      const result = safeScValToNative<number>(12345);
      expect(result).toBeUndefined();
    });
  });
});

describe('Integration: Validation in event processing context', () => {
  describe('Role event validation', () => {
    it('should validate a complete role_granted event structure', () => {
      // Simulate decoding topics from a role_granted event
      const roleScVal = xdr.ScVal.scvSymbol('minter');
      const accountAddress =
        'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO';
      const accountScVal = Address.fromString(accountAddress).toScVal();

      const role = safeScValToNative<string>(roleScVal);
      const account = safeScValToNative<string>(accountScVal);

      // Validate as the handler would
      expect(isValidRoleSymbol(role)).toBe(true);
      expect(isValidStellarAddress(account)).toBe(true);
    });

    it('should reject malformed role events', () => {
      // Simulate a non-OZ event with wrong data types
      // Use special characters which are NOT allowed in Soroban symbols
      const invalidRole = 'role-with-dashes';
      const invalidAccount = 'not_a_real_address';

      expect(isValidRoleSymbol(invalidRole)).toBe(false);
      expect(isValidStellarAddress(invalidAccount)).toBe(false);
    });
  });

  describe('Ownership event validation', () => {
    it('should validate ownership_transfer event data', () => {
      const oldOwnerAddress =
        'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT';
      const newOwnerAddress =
        'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO';

      const entries = [
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('old_owner'),
          val: Address.fromString(oldOwnerAddress).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('new_owner'),
          val: Address.fromString(newOwnerAddress).toScVal(),
        }),
      ];

      const eventData = xdr.ScVal.scvMap(entries);
      const decoded = safeScValToNative<Record<string, unknown>>(eventData);

      expect(decoded).toBeDefined();
      expect(isValidStellarAddress(decoded?.old_owner)).toBe(true);
      expect(isValidStellarAddress(decoded?.new_owner)).toBe(true);
    });
  });

  describe('Contract address validation', () => {
    it('should accept valid contract addresses in events', () => {
      const contractAddresses = [
        'CANM3Y2GVGH6ACSHUORZ56ZFZ2FSFX6XEWPJYW7BNZVAXKSEQMBTDWD2',
        'CBFFASZY2OIHUBSKYPFYVEQKL46GIZ4KDJUZBTEC3IJSB3USQVZEZFVC',
      ];

      contractAddresses.forEach((addr) => {
        expect(isValidStellarAddress(addr)).toBe(true);
      });
    });
  });
});
