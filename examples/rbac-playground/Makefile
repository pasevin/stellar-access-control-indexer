.PHONY: build deploy test clean

# Build the contract for deployment
build:
	stellar contract build --package rbac-playground --out-dir target/wasm32-unknown-unknown/release

# Deploy to testnet
deploy: build
	@echo "Deploying RBAC Playground contract to testnet..."
	soroban contract deploy \
		--wasm target/wasm32-unknown-unknown/release/rbac_playground.wasm \
		--source default \
		--network testnet

# Initialize the contract after deployment
init:
	@echo "Initializing contract with admin and owner..."
	@echo "Usage: make init CONTRACT=<contract_id> ADMIN=<admin_address> OWNER=<owner_address>"
	soroban contract invoke \
		--id $(CONTRACT) \
		--source default \
		--network testnet \
		-- \
		__constructor \
		--admin $(ADMIN) \
		--owner $(OWNER)

# Test role granting
grant-role:
	@echo "Granting minter role..."
	@echo "Usage: make grant-role CONTRACT=<contract_id> ACCOUNT=<account_to_grant> CALLER=<admin_address>"
	soroban contract invoke \
		--id $(CONTRACT) \
		--source default \
		--network testnet \
		-- \
		grant_role \
		--account $(ACCOUNT) \
		--role minter \
		--caller $(CALLER)

# Test minting (requires minter role)
mint:
	@echo "Minting tokens..."
	@echo "Usage: make mint CONTRACT=<contract_id> TO=<recipient> AMOUNT=<amount> CALLER=<minter_address>"
	soroban contract invoke \
		--id $(CONTRACT) \
		--source default \
		--network testnet \
		-- \
		mint \
		--to $(TO) \
		--amount $(AMOUNT) \
		--caller $(CALLER)

# Check balance
balance:
	@echo "Checking balance..."
	@echo "Usage: make balance CONTRACT=<contract_id> ACCOUNT=<account>"
	soroban contract invoke \
		--id $(CONTRACT) \
		--source default \
		--network testnet \
		-- \
		get_balance \
		--account $(ACCOUNT)

# List all minters
list-minters:
	@echo "Listing all accounts with minter role..."
	@echo "Usage: make list-minters CONTRACT=<contract_id>"
	soroban contract invoke \
		--id $(CONTRACT) \
		--source default \
		--network testnet \
		-- \
		list_minters

# Clean build artifacts
clean:
	cargo clean
	rm -f *.wasm *.optimized.wasm