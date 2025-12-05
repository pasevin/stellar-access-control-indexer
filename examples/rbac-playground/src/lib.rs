#![no_std]

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Symbol,
    Vec,
};

use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_macros::{default_impl, only_admin, only_owner, only_role};

// ============================================================================
// Role Definitions
// ============================================================================
// This contract demonstrates a rich set of roles for comprehensive RBAC testing.
// Each role controls access to specific contract functions.

/// Operator: Can perform batch operations and general contract operations
const OPERATOR_ROLE: Symbol = symbol_short!("operator");

/// Minter: Can create new tokens
const MINTER_ROLE: Symbol = symbol_short!("minter");

/// Burner: Can destroy tokens
const BURNER_ROLE: Symbol = symbol_short!("burner");

/// Pauser: Can pause and unpause the contract
const PAUSER_ROLE: Symbol = symbol_short!("pauser");

/// Viewer: Can access sensitive view functions and internal state
const VIEWER_ROLE: Symbol = symbol_short!("viewer");

/// Transfer: Can transfer tokens on behalf of users (e.g., for escrow)
const TRANSFER_ROLE: Symbol = symbol_short!("transfer");

/// Approver: Can approve or reject pending operations
const APPROVER_ROLE: Symbol = symbol_short!("approver");

// ============================================================================
// Storage Keys
// ============================================================================

#[contracttype]
pub enum DataKey {
    Balance(Address),
    Paused,
    TotalSupply,
    PendingTransfer(u64),
    PendingTransferCounter,
    TransferApproval(u64, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingTransfer {
    pub id: u64,
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub approvals: u32,
    pub required_approvals: u32,
    pub executed: bool,
}

// ============================================================================
// Events
// ============================================================================

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

/// Event emitted when contract is paused.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contractevent]
pub struct Paused {
    pub caller: Address,
}

/// Event emitted when contract is unpaused.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contractevent]
pub struct Unpaused {
    pub caller: Address,
}

/// Event emitted when tokens are transferred by a transfer agent.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contractevent]
pub struct TransferExecuted {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub caller: Address,
}

/// Event emitted when a batch operation is performed.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contractevent]
pub struct BatchOperation {
    pub operation: Symbol,
    pub count: u32,
    pub caller: Address,
}

/// Event emitted when a pending transfer is created.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contractevent]
pub struct TransferProposed {
    pub id: u64,
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub proposer: Address,
}

/// Event emitted when a transfer is approved by an approver.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contractevent]
pub struct TransferApproved {
    pub id: u64,
    pub approver: Address,
    pub current_approvals: u32,
    pub required_approvals: u32,
}

/// Event emitted when a transfer is finalized after enough approvals.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contractevent]
pub struct TransferFinalized {
    pub id: u64,
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

/// Event emitted when sensitive data is viewed.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contractevent]
pub struct SensitiveDataAccessed {
    pub data_type: Symbol,
    pub viewer: Address,
}

// ============================================================================
// Contract Implementation
// ============================================================================

#[contract]
pub struct RbacPlayground;

/// Core app logic
///
/// This contract demonstrates a comprehensive RBAC system with 8 distinct roles:
/// - Owner: Top-level ownership (via Ownable trait)
/// - Admin: Access control management (via AccessControl trait)
/// - Operator: Batch operations and general operations
/// - Minter: Token creation
/// - Burner: Token destruction
/// - Pauser: Contract pause/unpause
/// - Viewer: Sensitive data access
/// - Transfer: Token transfers on behalf of users
/// - Approver: Multi-sig approval for pending operations
///
/// This is perfect for testing role-based indexing and access control patterns.
#[contractimpl]
impl RbacPlayground {
    // ========================================================================
    // Initialization
    // ========================================================================

    /// Initialize the contract with admin and owner.
    ///
    /// - Sets the top-level AccessControl admin.
    /// - Sets the Ownable owner.
    /// - Grants MINTER_ROLE and OPERATOR_ROLE to the admin.
    /// - Initializes contract state.
    ///
    /// Call this once at deployment time.
    pub fn __constructor(e: &Env, admin: Address, owner: Address) {
        // AccessControl admin (no auth in constructor)
        access_control::set_admin(e, &admin);

        // Ownable owner (no auth in constructor)
        ownable::set_owner(e, &owner);

        // Initialize state
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::TotalSupply, &0i128);
        e.storage().instance().set(&DataKey::PendingTransferCounter, &0u64);

        // Give the admin initial roles (bypasses auth, safe during init).
        access_control::grant_role_no_auth(e, &admin, &admin, &MINTER_ROLE);
        access_control::grant_role_no_auth(e, &admin, &admin, &OPERATOR_ROLE);
    }

    // ========================================================================
    // View Functions (Public)
    // ========================================================================

    /// Get the balance of an account (public).
    pub fn get_balance(e: &Env, account: Address) -> i128 {
        let key = DataKey::Balance(account);
        e.storage().instance().get(&key).unwrap_or(0)
    }

    /// Check if the contract is paused (public).
    pub fn is_paused(e: &Env) -> bool {
        e.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    /// Get total supply (public).
    pub fn get_total_supply(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    // ========================================================================
    // Role Enumeration
    // ========================================================================

    /// List all addresses with OPERATOR role.
    pub fn list_operators(e: &Env) -> Vec<Address> {
        Self::list_role_members(e, &OPERATOR_ROLE)
    }

    /// List all addresses with MINTER role.
    pub fn list_minters(e: &Env) -> Vec<Address> {
        Self::list_role_members(e, &MINTER_ROLE)
    }

    /// List all addresses with BURNER role.
    pub fn list_burners(e: &Env) -> Vec<Address> {
        Self::list_role_members(e, &BURNER_ROLE)
    }

    /// List all addresses with PAUSER role.
    pub fn list_pausers(e: &Env) -> Vec<Address> {
        Self::list_role_members(e, &PAUSER_ROLE)
    }

    /// List all addresses with VIEWER role.
    pub fn list_viewers(e: &Env) -> Vec<Address> {
        Self::list_role_members(e, &VIEWER_ROLE)
    }

    /// List all addresses with TRANSFER role.
    pub fn list_transferers(e: &Env) -> Vec<Address> {
        Self::list_role_members(e, &TRANSFER_ROLE)
    }

    /// List all addresses with APPROVER role.
    pub fn list_approvers(e: &Env) -> Vec<Address> {
        Self::list_role_members(e, &APPROVER_ROLE)
    }

    /// Generic helper to list all members of any role.
    fn list_role_members(e: &Env, role: &Symbol) -> Vec<Address> {
        let mut result = Vec::new(e);
        let count = access_control::get_role_member_count(e, role);
        let mut i: u32 = 0;

        while i < count {
            let member = access_control::get_role_member(e, role, i);
            result.push_back(member);
            i += 1;
        }

        result
    }

    // ========================================================================
    // MINTER Role Functions
    // ========================================================================

    /// Mint tokens to `to` (requires MINTER role).
    #[only_role(caller, "minter")]
    pub fn mint(e: &Env, to: Address, amount: i128, caller: Address) {
        caller.require_auth();
        Self::require_not_paused(e);

        // Update balance
        let key = DataKey::Balance(to.clone());
        let mut balance: i128 = e.storage().instance().get(&key).unwrap_or(0);
        balance += amount;
        e.storage().instance().set(&key, &balance);

        // Update total supply
        let mut total: i128 = e.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        total += amount;
        e.storage().instance().set(&DataKey::TotalSupply, &total);

        Minted {
            to,
            amount,
            caller,
        }
        .publish(e);
    }

    // ========================================================================
    // BURNER Role Functions
    // ========================================================================

    /// Burn tokens from `from` (requires BURNER role).
    #[only_role(caller, "burner")]
    pub fn burn(e: &Env, from: Address, amount: i128, caller: Address) {
        caller.require_auth();
        Self::require_not_paused(e);

        let key = DataKey::Balance(from.clone());
        let mut balance: i128 = e.storage().instance().get(&key).unwrap_or(0);
        balance -= amount;
        e.storage().instance().set(&key, &balance);

        // Update total supply
        let mut total: i128 = e.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        total -= amount;
        e.storage().instance().set(&DataKey::TotalSupply, &total);

        Burned {
            from,
            amount,
            caller,
        }
        .publish(e);
    }

    // ========================================================================
    // PAUSER Role Functions
    // ========================================================================

    /// Pause the contract (requires PAUSER role).
    #[only_role(caller, "pauser")]
    pub fn pause(e: &Env, caller: Address) {
        caller.require_auth();
        e.storage().instance().set(&DataKey::Paused, &true);
        Paused { caller }.publish(e);
    }

    /// Unpause the contract (requires PAUSER role).
    #[only_role(caller, "pauser")]
    pub fn unpause(e: &Env, caller: Address) {
        caller.require_auth();
        e.storage().instance().set(&DataKey::Paused, &false);
        Unpaused { caller }.publish(e);
    }

    // ========================================================================
    // VIEWER Role Functions
    // ========================================================================

    /// View sensitive contract statistics (requires VIEWER role).
    /// This demonstrates access-controlled view functions.
    #[only_role(caller, "viewer")]
    pub fn view_sensitive_stats(e: &Env, caller: Address) -> (i128, u64, bool) {
        caller.require_auth();

        let total_supply: i128 = e.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        let pending_count: u64 = e.storage().instance().get(&DataKey::PendingTransferCounter).unwrap_or(0);
        let is_paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap_or(false);

        SensitiveDataAccessed {
            data_type: symbol_short!("stats"),
            viewer: caller,
        }
        .publish(e);

        (total_supply, pending_count, is_paused)
    }

    /// View a pending transfer details (requires VIEWER role).
    #[only_role(caller, "viewer")]
    pub fn view_pending_transfer(e: &Env, id: u64, caller: Address) -> PendingTransfer {
        caller.require_auth();

        let key = DataKey::PendingTransfer(id);
        let transfer: PendingTransfer = e.storage().instance().get(&key).unwrap();

        SensitiveDataAccessed {
            data_type: symbol_short!("pending"),
            viewer: caller,
        }
        .publish(e);

        transfer
    }

    // ========================================================================
    // TRANSFER Role Functions
    // ========================================================================

    /// Execute a direct transfer between accounts (requires TRANSFER role).
    /// This is for escrow or administrative transfers.
    #[only_role(caller, "transfer")]
    pub fn execute_transfer(e: &Env, from: Address, to: Address, amount: i128, caller: Address) {
        caller.require_auth();
        Self::require_not_paused(e);

        // Debit from
        let from_key = DataKey::Balance(from.clone());
        let mut from_balance: i128 = e.storage().instance().get(&from_key).unwrap_or(0);
        from_balance -= amount;
        e.storage().instance().set(&from_key, &from_balance);

        // Credit to
        let to_key = DataKey::Balance(to.clone());
        let mut to_balance: i128 = e.storage().instance().get(&to_key).unwrap_or(0);
        to_balance += amount;
        e.storage().instance().set(&to_key, &to_balance);

        TransferExecuted {
            from,
            to,
            amount,
            caller,
        }
        .publish(e);
    }

    // ========================================================================
    // OPERATOR Role Functions
    // ========================================================================

    /// Batch mint to multiple addresses (requires OPERATOR role).
    #[only_role(caller, "operator")]
    pub fn batch_mint(e: &Env, recipients: Vec<Address>, amounts: Vec<i128>, caller: Address) {
        caller.require_auth();
        Self::require_not_paused(e);

        let count = recipients.len();
        if count != amounts.len() {
            panic!("recipients and amounts must have the same length");
        }
        let mut i: u32 = 0;

        while i < count {
            let to = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();

            let key = DataKey::Balance(to.clone());
            let mut balance: i128 = e.storage().instance().get(&key).unwrap_or(0);
            balance += amount;
            e.storage().instance().set(&key, &balance);

            // Update total supply
            let mut total: i128 = e.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
            total += amount;
            e.storage().instance().set(&DataKey::TotalSupply, &total);

            Minted {
                to,
                amount,
                caller: caller.clone(),
            }
            .publish(e);

            i += 1;
        }

        BatchOperation {
            operation: symbol_short!("mint"),
            count,
            caller,
        }
        .publish(e);
    }

    /// Batch burn from multiple addresses (requires OPERATOR role).
    #[only_role(caller, "operator")]
    pub fn batch_burn(e: &Env, accounts: Vec<Address>, amounts: Vec<i128>, caller: Address) {
        caller.require_auth();
        Self::require_not_paused(e);

        let count = accounts.len();
        if count != amounts.len() {
            panic!("accounts and amounts must have the same length");
        }
        let mut i: u32 = 0;

        while i < count {
            let from = accounts.get(i).unwrap();
            let amount = amounts.get(i).unwrap();

            let key = DataKey::Balance(from.clone());
            let mut balance: i128 = e.storage().instance().get(&key).unwrap_or(0);
            balance -= amount;
            e.storage().instance().set(&key, &balance);

            // Update total supply
            let mut total: i128 = e.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
            total -= amount;
            e.storage().instance().set(&DataKey::TotalSupply, &total);

            Burned {
                from,
            amount,
            caller: caller.clone(),
            }
            .publish(e);

            i += 1;
        }

        BatchOperation {
            operation: symbol_short!("burn"),
            count,
            caller,
        }
        .publish(e);
    }

    // ========================================================================
    // APPROVER Role Functions
    // ========================================================================

    /// Propose a transfer that requires multi-sig approval.
    /// Any TRANSFER role holder can propose, but requires APPROVER approval.
    #[only_role(proposer, "transfer")]
    pub fn propose_transfer(
        e: &Env,
        from: Address,
        to: Address,
        amount: i128,
        required_approvals: u32,
        proposer: Address,
    ) -> u64 {
        proposer.require_auth();
        Self::require_not_paused(e);

        let id: u64 = e.storage().instance().get(&DataKey::PendingTransferCounter).unwrap_or(0);
        let next_id = id + 1;
        e.storage().instance().set(&DataKey::PendingTransferCounter, &next_id);

        let pending = PendingTransfer {
            id,
            from: from.clone(),
            to: to.clone(),
            amount,
            approvals: 0,
            required_approvals,
            executed: false,
        };

        e.storage().instance().set(&DataKey::PendingTransfer(id), &pending);

        TransferProposed {
            id,
            from,
            to,
            amount,
            proposer,
        }
        .publish(e);

        id
    }

    /// Approve a pending transfer (requires APPROVER role).
    /// When enough approvals are reached, the transfer is automatically executed.
    #[only_role(approver, "approver")]
    pub fn approve_transfer(e: &Env, id: u64, approver: Address) {
        approver.require_auth();
        Self::require_not_paused(e);

        let key = DataKey::PendingTransfer(id);
        let mut transfer: PendingTransfer = e.storage().instance().get(&key).unwrap();

        // Check if already approved by this approver
        let approval_key = DataKey::TransferApproval(id, approver.clone());
        let already_approved: bool = e.storage().instance().get(&approval_key).unwrap_or(false);
        if already_approved {
            panic!("Already approved by this approver");
        }

        // Record this approval
        e.storage().instance().set(&approval_key, &true);
        transfer.approvals += 1;

        TransferApproved {
            id,
            approver: approver.clone(),
            current_approvals: transfer.approvals,
            required_approvals: transfer.required_approvals,
        }
        .publish(e);

        // Check if we have enough approvals to execute
        if transfer.approvals >= transfer.required_approvals && !transfer.executed {
            transfer.executed = true;

            // Execute the transfer
            let from_key = DataKey::Balance(transfer.from.clone());
            let mut from_balance: i128 = e.storage().instance().get(&from_key).unwrap_or(0);
            from_balance -= transfer.amount;
            e.storage().instance().set(&from_key, &from_balance);

            let to_key = DataKey::Balance(transfer.to.clone());
            let mut to_balance: i128 = e.storage().instance().get(&to_key).unwrap_or(0);
            to_balance += transfer.amount;
            e.storage().instance().set(&to_key, &to_balance);

            TransferFinalized {
                id,
                from: transfer.from.clone(),
                to: transfer.to.clone(),
                amount: transfer.amount,
            }
            .publish(e);
        }

        e.storage().instance().set(&key, &transfer);
    }

    // ========================================================================
    // Owner & Admin Functions
    // ========================================================================

    /// Owner-only function to exercise `Ownable` + `#[only_owner]`.
    #[only_owner]
    pub fn owner_ping(_e: &Env) -> Symbol {
        symbol_short!("owner_ok")
    }

    /// Admin-only function to exercise `AccessControl` admin auth.
    #[only_admin]
    pub fn admin_ping(_e: &Env) -> Symbol {
        symbol_short!("admin_ok")
    }

    /// Emergency pause by owner (bypasses PAUSER role).
    #[only_owner]
    pub fn emergency_pause(e: &Env) {
        e.storage().instance().set(&DataKey::Paused, &true);
        Paused {
            caller: ownable::get_owner(e).unwrap(),
        }
        .publish(e);
    }

    // ========================================================================
    // Internal Helpers
    // ========================================================================

    fn require_not_paused(e: &Env) {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            panic!("Contract is paused");
        }
    }
}

// ============================================================================
// Trait Implementations (Default)
// ============================================================================

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