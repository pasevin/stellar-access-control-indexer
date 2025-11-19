#![no_std]

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Symbol,
    Vec,
};

use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_macros::{default_impl, only_admin, only_owner, only_role};

const MINTER_ROLE: Symbol = symbol_short!("minter");

#[contracttype]
pub enum DataKey {
    Balance(Address),
}

/// Event emitted when tokens are minted.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contractevent]
pub struct Minted {
    pub to: Address,
    pub amount: i128,
    pub caller: Address,
}

/// Event emitted when tokens are burned.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contractevent]
pub struct Burned {
    pub from: Address,
    pub amount: i128,
    pub caller: Address,
}

#[contract]
pub struct RbacPlayground;

/// Core app logic
///
/// This contract is intentionally simple but rich in events and access control
/// activity so you can:
/// - Index `RoleGranted` / `RoleRevoked` / admin transfer / owner transfer
/// - Index custom `Minted` / `Burned` events
/// - Exercise enumeration helpers and trait-based entrypoints
#[contractimpl]
impl RbacPlayground {
    /// Initialization:
    /// - Sets the top-level AccessControl admin.
    /// - Sets the Ownable owner.
    /// - Grants MINTER_ROLE to the admin (so admin can also act as minter).
    ///
    /// Call this once at deployment time.
    pub fn __constructor(e: &Env, admin: Address, owner: Address) {
        // AccessControl admin (no auth in constructor)
        access_control::set_admin(e, &admin);

        // Ownable owner (no auth in constructor)
        ownable::set_owner(e, &owner);

        // Give the admin the MINTER_ROLE (bypasses auth, safe during init).
        access_control::grant_role_no_auth(e, &admin, &admin, &MINTER_ROLE);
    }

    /// Simple view helper to read a balance.
    pub fn get_balance(e: &Env, account: Address) -> i128 {
        let key = DataKey::Balance(account);
        e.storage().instance().get(&key).unwrap_or(0)
    }

    /// Enumerate all current members of MINTER_ROLE using the OZ enumeration
    /// helpers (`get_role_member_count` + `get_role_member`).
    /// This is useful for testing your indexer + the AccessControlService.
    pub fn list_minters(e: &Env) -> Vec<Address> {
        let mut result = Vec::new(e);
        let count = access_control::get_role_member_count(e, &MINTER_ROLE);
        let mut i: u32 = 0;

        while i < count {
            let member = access_control::get_role_member(e, &MINTER_ROLE, i);
            result.push_back(member);
            i += 1;
        }

        result
    }

    /// Mint tokens to `to`, restricted to accounts with MINTER_ROLE.
    ///
    /// This exercises:
    /// - `#[only_role]` macro
    /// - `Minted` custom event
    /// - state writes (balances)
    #[only_role(caller, "minter")]
    pub fn mint(e: &Env, to: Address, amount: i128, caller: Address) {
        caller.require_auth();

        let key = DataKey::Balance(to.clone());
        let mut balance: i128 = e.storage().instance().get(&key).unwrap_or(0);
        balance += amount;
        e.storage().instance().set(&key, &balance);

        Minted {
            to: to.clone(),
            amount,
            caller: caller.clone(),
        }
        .publish(e);
    }

    /// Burn tokens from `from`, also restricted to MINTER_ROLE.
    ///
    /// This gives you negative-side events and state changes to index.
    #[only_role(caller, "minter")]
    pub fn burn(e: &Env, from: Address, amount: i128, caller: Address) {
        caller.require_auth();

        let key = DataKey::Balance(from.clone());
        let mut balance: i128 = e.storage().instance().get(&key).unwrap_or(0);
        // In a real token you'd handle underflow, here we keep it simple.
        balance -= amount;
        e.storage().instance().set(&key, &balance);

        Burned {
            from: from.clone(),
            amount,
            caller: caller.clone(),
        }
        .publish(e);
    }

    /// Owner-only function just to exercise `Ownable` + `#[only_owner]`.
    #[only_owner]
    pub fn owner_ping(_e: &Env) -> Symbol {
        symbol_short!("owner_ok")
    }

    /// Admin-only function just to exercise `AccessControl` admin auth.
    #[only_admin]
    pub fn admin_ping(_e: &Env) -> Symbol {
        symbol_short!("admin_ok")
    }
}

/// Wire in the *default* implementations for:
/// - AccessControl trait methods:
///   - has_role, get_role_member_count, get_role_member
///   - get_role_admin, get_admin
///   - grant_role, revoke_role, renounce_role
///   - transfer_admin_role, accept_admin_transfer, set_role_admin, renounce_admin
///   (all of these emit the built-in events from the library)
///
/// - Ownable trait methods:
///   - get_owner, transfer_ownership, accept_ownership, renounce_ownership
///   (emitting ownership events)
///
/// These will be exposed as contract entrypoints and are perfect
/// for driving your SubQuery indexer.
#[default_impl]
#[contractimpl]
impl AccessControl for RbacPlayground {}

#[default_impl]
#[contractimpl]
impl Ownable for RbacPlayground {}