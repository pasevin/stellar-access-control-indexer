import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scValToNative, xdr, Address, StrKey } from '@stellar/stellar-base';
import type { SorobanEvent } from '@subql/types-stellar';

/**
 * Unit tests for ScVal decoding in mapping handlers
 * 
 * These tests verify that:
 * 1. scValToNative correctly decodes all ScVal types
 * 2. Event data structures are properly extracted
 * 3. Addresses are decoded correctly
 */

describe('ScVal Decoding with scValToNative', () => {
  describe('Symbol decoding', () => {
    it('should decode symbol ScVal to string', () => {
      const symbolScVal = xdr.ScVal.scvSymbol('role_granted');
      const result = scValToNative(symbolScVal);
      expect(result).toBe('role_granted');
    });

    it('should decode role names correctly', () => {
      const roles = ['minter', 'burner', 'admin', 'pauser'];
      roles.forEach(role => {
        const symbolScVal = xdr.ScVal.scvSymbol(role);
        const result = scValToNative(symbolScVal);
        expect(result).toBe(role);
      });
    });
  });

  describe('String decoding', () => {
    it('should decode string ScVal to string', () => {
      const stringScVal = xdr.ScVal.scvString('test_string');
      const result = scValToNative(stringScVal);
      expect(result).toBe('test_string');
    });
  });

  describe('Address decoding', () => {
    it('should decode account address ScVal to string', () => {
      const accountAddress = 'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT';
      const address = Address.fromString(accountAddress);
      const addressScVal = address.toScVal();
      
      const result = scValToNative(addressScVal);
      expect(result).toBe(accountAddress);
    });

    it('should decode contract address ScVal to string', () => {
      const contractAddress = 'CANM3Y2GVGH6ACSHUORZ56ZFZ2FSFX6XEWPJYW7BNZVAXKSEQMBTDWD2';
      const address = Address.fromString(contractAddress);
      const addressScVal = address.toScVal();
      
      const result = scValToNative(addressScVal);
      expect(result).toBe(contractAddress);
    });

    it('should handle multiple addresses in sequence', () => {
      const addresses = [
        'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT',
        'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO',
        'CANM3Y2GVGH6ACSHUORZ56ZFZ2FSFX6XEWPJYW7BNZVAXKSEQMBTDWD2'
      ];

      addresses.forEach(addr => {
        const address = Address.fromString(addr);
        const addressScVal = address.toScVal();
        const result = scValToNative(addressScVal);
        expect(result).toBe(addr);
      });
    });
  });

  describe('Map/Struct decoding', () => {
    it('should decode map with new_owner field to JS object', () => {
      const ownerAddress = 'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT';
      const address = Address.fromString(ownerAddress);
      
      // Create a map with 'new_owner' key
      const keyScVal = xdr.ScVal.scvSymbol('new_owner');
      const valueScVal = address.toScVal();
      
      const mapEntry = new xdr.ScMapEntry({
        key: keyScVal,
        val: valueScVal,
      });
      
      const mapScVal = xdr.ScVal.scvMap([mapEntry]);
      const result = scValToNative(mapScVal) as Record<string, unknown>;
      
      expect(result).toHaveProperty('new_owner');
      expect(result.new_owner).toBe(ownerAddress);
    });

    it('should decode complex map structures', () => {
      const address1 = Address.fromString('GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT');
      const address2 = Address.fromString('GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO');
      
      const entries = [
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('new_owner'),
          val: address1.toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('previous_owner'),
          val: address2.toScVal(),
        }),
      ];
      
      const mapScVal = xdr.ScVal.scvMap(entries);
      const result = scValToNative(mapScVal) as Record<string, unknown>;
      
      expect(result.new_owner).toBe('GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT');
      expect(result.previous_owner).toBe('GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO');
    });
  });

  describe('Vec/Array decoding', () => {
    it('should decode vec of addresses to JS array', () => {
      const addresses = [
        'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT',
        'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO',
      ];
      
      const addressScVals = addresses.map(addr => 
        Address.fromString(addr).toScVal()
      );
      
      const vecScVal = xdr.ScVal.scvVec(addressScVals);
      const result = scValToNative(vecScVal) as unknown[];
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(addresses[0]);
      expect(result[1]).toBe(addresses[1]);
    });
  });

  describe('Number decoding', () => {
    it('should decode u32 correctly', () => {
      const u32ScVal = xdr.ScVal.scvU32(12345);
      const result = scValToNative(u32ScVal);
      expect(result).toBe(12345);
    });

    it('should decode i32 correctly', () => {
      const i32ScVal = xdr.ScVal.scvI32(-12345);
      const result = scValToNative(i32ScVal);
      expect(result).toBe(-12345);
    });

    it('should decode u64 correctly', () => {
      const u64ScVal = xdr.ScVal.scvU64(xdr.Uint64.fromString('9007199254740991'));
      const result = scValToNative(u64ScVal);
      expect(result).toBe(9007199254740991n);
    });
  });

  describe('Event structure decoding', () => {
    it('should decode role_granted event topics correctly', () => {
      // Simulate: role_granted(role: Symbol, account: Address, caller: Address)
      // Topics: [event_name, role, account]
      const roleScVal = xdr.ScVal.scvSymbol('minter');
      const accountScVal = Address.fromString(
        'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO'
      ).toScVal();

      const role = scValToNative(roleScVal) as string;
      const account = scValToNative(accountScVal) as string;

      expect(role).toBe('minter');
      expect(account).toBe('GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO');
    });

    it('should decode ownership_transfer_completed event data correctly', () => {
      // Event data: { new_owner: Address }
      const ownerAddress = 'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT';
      const address = Address.fromString(ownerAddress);
      
      const mapEntry = new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('new_owner'),
        val: address.toScVal(),
      });
      
      const eventDataScVal = xdr.ScVal.scvMap([mapEntry]);
      const eventData = scValToNative(eventDataScVal) as Record<string, unknown>;
      const newOwner = eventData.new_owner as string;

      expect(newOwner).toBe(ownerAddress);
    });

    it('should handle event with caller in data field', () => {
      // Simulate: caller in event.value (data)
      const callerAddress = 'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT';
      const callerScVal = Address.fromString(callerAddress).toScVal();
      
      const caller = scValToNative(callerScVal) as string;
      
      expect(caller).toBe(callerAddress);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty strings', () => {
      const emptyStringScVal = xdr.ScVal.scvString('');
      const result = scValToNative(emptyStringScVal);
      expect(result).toBe('');
    });

    it('should handle void type', () => {
      const voidScVal = xdr.ScVal.scvVoid();
      const result = scValToNative(voidScVal);
      expect(result).toBeNull();
    });

    it('should handle boolean values', () => {
      const trueScVal = xdr.ScVal.scvBool(true);
      const falseScVal = xdr.ScVal.scvBool(false);
      
      expect(scValToNative(trueScVal)).toBe(true);
      expect(scValToNative(falseScVal)).toBe(false);
    });

    it('should handle bytes', () => {
      const bytes = Buffer.from('hello', 'utf8');
      const bytesScVal = xdr.ScVal.scvBytes(bytes);
      const result = scValToNative(bytesScVal) as Buffer;
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString('utf8')).toBe('hello');
    });
  });

  describe('Real-world event simulation', () => {
    it('should process a complete role_granted event', () => {
      // Simulate the complete event structure
      // In reality, caller comes as { caller: Address } in event.value
      const eventName = xdr.ScVal.scvSymbol('role_granted');
      const role = xdr.ScVal.scvSymbol('minter');
      const account = Address.fromString(
        'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO'
      ).toScVal();
      
      // Caller is wrapped in a Map with 'caller' key
      const callerMapEntry = new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('caller'),
        val: Address.fromString('GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT').toScVal(),
      });
      const callerMap = xdr.ScVal.scvMap([callerMapEntry]);

      // Decode as the handler would
      const decodedEventName = scValToNative(eventName) as string;
      const decodedRole = scValToNative(role) as string;
      const decodedAccount = scValToNative(account) as string;
      const decodedCallerData = scValToNative(callerMap) as Record<string, unknown>;
      const decodedCaller = decodedCallerData.caller as string;

      expect(decodedEventName).toBe('role_granted');
      expect(decodedRole).toBe('minter');
      expect(decodedAccount).toBe('GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO');
      expect(decodedCaller).toBe('GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT');
    });

    it('should process a complete ownership_transfer_completed event', () => {
      // Simulate the complete event structure
      const eventName = xdr.ScVal.scvSymbol('ownership_transfer_completed');
      const newOwnerAddress = 'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT';
      
      const mapEntry = new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('new_owner'),
        val: Address.fromString(newOwnerAddress).toScVal(),
      });
      
      const eventData = xdr.ScVal.scvMap([mapEntry]);

      // Decode as the handler would
      const decodedEventName = scValToNative(eventName) as string;
      const decodedEventData = scValToNative(eventData) as Record<string, unknown>;
      const decodedNewOwner = decodedEventData.new_owner as string;

      expect(decodedEventName).toBe('ownership_transfer_completed');
      expect(decodedNewOwner).toBe(newOwnerAddress);
    });

    it('should process a complete ownership_renounced event', () => {
      // Simulate: ownership_renounced(old_owner: Address)
      // Topics: [event_name, old_owner]
      const eventName = xdr.ScVal.scvSymbol('ownership_renounced');
      const oldOwnerAddress = 'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT';
      const oldOwner = Address.fromString(oldOwnerAddress).toScVal();

      // Decode as the handler would
      const decodedEventName = scValToNative(eventName) as string;
      const decodedOldOwner = scValToNative(oldOwner) as string;

      expect(decodedEventName).toBe('ownership_renounced');
      expect(decodedOldOwner).toBe(oldOwnerAddress);
    });

    it('should process a complete admin_renounced event', () => {
      // Simulate: admin_renounced(admin: Address)
      // Topics: [event_name, admin]
      const eventName = xdr.ScVal.scvSymbol('admin_renounced');
      const adminAddress = 'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO';
      const admin = Address.fromString(adminAddress).toScVal();

      // Decode as the handler would
      const decodedEventName = scValToNative(eventName) as string;
      const decodedAdmin = scValToNative(admin) as string;

      expect(decodedEventName).toBe('admin_renounced');
      expect(decodedAdmin).toBe(adminAddress);
    });

    it('should process a complete role_admin_changed event', () => {
      // Simulate: role_admin_changed(role: Symbol, previous_admin_role: Symbol, new_admin_role: Symbol)
      // Topics: [event_name, role]
      // Data: { previous_admin_role: Symbol, new_admin_role: Symbol }
      const eventName = xdr.ScVal.scvSymbol('role_admin_changed');
      const role = xdr.ScVal.scvSymbol('minter');
      
      const entries = [
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('previous_admin_role'),
          val: xdr.ScVal.scvSymbol('admin'),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('new_admin_role'),
          val: xdr.ScVal.scvSymbol('super_admin'),
        }),
      ];
      
      const eventData = xdr.ScVal.scvMap(entries);

      // Decode as the handler would
      const decodedEventName = scValToNative(eventName) as string;
      const decodedRole = scValToNative(role) as string;
      const decodedEventData = scValToNative(eventData) as Record<string, unknown>;
      const previousAdminRole = decodedEventData.previous_admin_role as string;
      const newAdminRole = decodedEventData.new_admin_role as string;

      expect(decodedEventName).toBe('role_admin_changed');
      expect(decodedRole).toBe('minter');
      expect(previousAdminRole).toBe('admin');
      expect(newAdminRole).toBe('super_admin');
    });

    it('should process admin_transfer_initiated event', () => {
      // Simulate: admin_transfer_initiated(current_admin: Address)
      // Topics: [event_name, current_admin]
      // Data: { new_admin: Address, live_until_ledger: u32 }
      const eventName = xdr.ScVal.scvSymbol('admin_transfer_initiated');
      const currentAdminAddress = 'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT';
      const newAdminAddress = 'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO';
      
      const currentAdmin = Address.fromString(currentAdminAddress).toScVal();
      
      const entries = [
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('new_admin'),
          val: Address.fromString(newAdminAddress).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('live_until_ledger'),
          val: xdr.ScVal.scvU32(1000000),
        }),
      ];
      
      const eventData = xdr.ScVal.scvMap(entries);

      // Decode as the handler would
      const decodedEventName = scValToNative(eventName) as string;
      const decodedCurrentAdmin = scValToNative(currentAdmin) as string;
      const decodedEventData = scValToNative(eventData) as Record<string, unknown>;
      const decodedNewAdmin = decodedEventData.new_admin as string;
      const liveUntilLedger = decodedEventData.live_until_ledger as number;

      expect(decodedEventName).toBe('admin_transfer_initiated');
      expect(decodedCurrentAdmin).toBe(currentAdminAddress);
      expect(decodedNewAdmin).toBe(newAdminAddress);
      expect(liveUntilLedger).toBe(1000000);
    });

    it('should process ownership_transfer event with Map structure', () => {
      // Simulate: OwnershipTransfer { old_owner, new_owner, live_until_ledger }
      // This is the actual structure from OpenZeppelin contracts
      const oldOwnerAddress = 'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWMAUKTT';
      const newOwnerAddress = 'GDGI6UJHEWGBZ3XYADMI75DKM7EMGSL7M4JTX3S52CMVFUL4JXMNMKQO';
      
      const entries = [
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('old_owner'),
          val: Address.fromString(oldOwnerAddress).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('new_owner'),
          val: Address.fromString(newOwnerAddress).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('live_until_ledger'),
          val: xdr.ScVal.scvU32(1000000),
        }),
      ];
      
      const eventData = xdr.ScVal.scvMap(entries);

      // Decode as the handler would
      const decodedEventData = scValToNative(eventData) as Record<string, unknown>;
      const decodedOldOwner = decodedEventData.old_owner as string;
      const decodedNewOwner = decodedEventData.new_owner as string;
      const liveUntilLedger = decodedEventData.live_until_ledger as number;

      expect(decodedOldOwner).toBe(oldOwnerAddress);
      expect(decodedNewOwner).toBe(newOwnerAddress);
      expect(liveUntilLedger).toBe(1000000);
    });
  });
});

