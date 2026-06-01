#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sui-Index — Testnet Deploy Script
# Run this from WSL: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.local"
BACKEND_ENV="$ROOT_DIR/backend/.env"

echo "────────────────────────────────────────────────────────────"
echo " SUI-INDEX DEPLOY"
echo " Network: testnet"
echo "────────────────────────────────────────────────────────────"

# ── 1. Check active address ───────────────────────────────────────────────────
echo ""
echo "[1/5] Active Sui address:"
sui client active-address

# ── 2. Check balance ─────────────────────────────────────────────────────────
echo ""
echo "[2/5] Balance (need at least 1 SUI for gas):"
sui client balance

# ── 3. Build contracts ───────────────────────────────────────────────────────
echo ""
echo "[3/5] Building Move contracts..."
cd "$CONTRACTS_DIR"
sui move build

echo "Build successful ✓"

# ── 4. Deploy to testnet ─────────────────────────────────────────────────────
echo ""
echo "[4/5] Publishing to testnet..."
DEPLOY_OUTPUT=$(sui client publish --gas-budget 100000000 --json 2>&1)

echo "$DEPLOY_OUTPUT" | head -80

# Extract package ID
PACKAGE_ID=$(echo "$DEPLOY_OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
effects = data.get('effects', {})
created = effects.get('created', [])
for obj in created:
    otype = obj.get('owner', {})
    if otype == 'Immutable':
        print(obj['reference']['objectId'])
        break
" 2>/dev/null || echo "")

if [ -z "$PACKAGE_ID" ]; then
  # Fallback: try objectChanges
  PACKAGE_ID=$(echo "$DEPLOY_OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for change in data.get('objectChanges', []):
    if change.get('type') == 'published':
        print(change['packageId'])
        break
" 2>/dev/null || echo "")
fi

echo ""
echo "Package ID: $PACKAGE_ID"

if [ -z "$PACKAGE_ID" ]; then
  echo "ERROR: Could not extract package ID from deploy output."
  echo "Full output:"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

# ── 5. Extract shared object IDs ──────────────────────────────────────────────
echo ""
echo "[5/5] Extracting shared object IDs..."

# Registry (from index_registry::init)
REGISTRY_ID=$(echo "$DEPLOY_OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for change in data.get('objectChanges', []):
    if change.get('type') == 'created' and isinstance(change.get('owner'), dict):
        if 'Shared' in change['owner']:
            otype = change.get('objectType', '')
            if 'index_registry' in otype or 'Registry' in otype:
                print(change['objectId'])
                break
" 2>/dev/null || echo "")

# AdminCap (transferred to deployer)
ADMIN_CAP_ID=$(echo "$DEPLOY_OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for change in data.get('objectChanges', []):
    if change.get('type') == 'created':
        otype = change.get('objectType', '')
        if 'AdminCap' in otype:
            print(change['objectId'])
            break
" 2>/dev/null || echo "")

# DuelRegistry (from duel_factory::init)
DUEL_REGISTRY_ID=$(echo "$DEPLOY_OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for change in data.get('objectChanges', []):
    if change.get('type') == 'created' and isinstance(change.get('owner'), dict):
        if 'Shared' in change['owner']:
            otype = change.get('objectType', '')
            if 'duel_factory' in otype or 'DuelRegistry' in otype:
                print(change['objectId'])
                break
" 2>/dev/null || echo "")

echo "Package ID:       $PACKAGE_ID"
echo "Registry ID:      $REGISTRY_ID"
echo "AdminCap ID:      $ADMIN_CAP_ID"
echo "DuelRegistry ID:  $DUEL_REGISTRY_ID"

# ── Write env files ───────────────────────────────────────────────────────────
echo ""
echo "Writing .env files..."

# Frontend .env.local
cat > "$FRONTEND_ENV" << EOF
# Tatum RPC
NEXT_PUBLIC_TATUM_API_KEY=your_tatum_api_key_here
NEXT_PUBLIC_SUI_NETWORK=testnet

# Walrus
NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space

# Contract Addresses
NEXT_PUBLIC_PACKAGE_ID=$PACKAGE_ID
NEXT_PUBLIC_REGISTRY_ID=$REGISTRY_ID
NEXT_PUBLIC_ADMIN_CAP_ID=$ADMIN_CAP_ID
EOF

echo "Frontend .env.local updated ✓"

# Backend .env
if [ -f "$BACKEND_ENV" ]; then
  sed -i "s|^PACKAGE_ID=.*|PACKAGE_ID=$PACKAGE_ID|" "$BACKEND_ENV"
  sed -i "s|^ADMIN_CAP_ID=.*|ADMIN_CAP_ID=$ADMIN_CAP_ID|" "$BACKEND_ENV"
  sed -i "s|^REGISTRY_ID=.*|REGISTRY_ID=$REGISTRY_ID|" "$BACKEND_ENV"
  echo "Backend .env updated ✓"
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo " DEPLOY COMPLETE"
echo " Package:    $PACKAGE_ID"
echo " Explorer:   https://testnet.suivision.xyz/object/$PACKAGE_ID"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "Next steps:"
echo "  1. Add your TATUM_API_KEY to frontend/.env.local"
echo "  2. Run: cd frontend && npm run dev"
echo "  3. Seed the IndexRegistry with assets:"
echo "     sui client call --package $PACKAGE_ID \\"
echo "       --module index_registry --function add_asset \\"
echo "       --args $REGISTRY_ID BTC e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43 1 \\"
echo "       --gas-budget 10000000"
