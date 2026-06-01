#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sui-Index — Seed IndexRegistry with supported assets
# Run AFTER deploy: bash seed-registry.sh <PACKAGE_ID> <REGISTRY_ID>
# ─────────────────────────────────────────────────────────────────────────────

set -e

SUI=/home/rohit/.local/bin/sui
PACKAGE_ID="${1:-$NEXT_PUBLIC_PACKAGE_ID}"
REGISTRY_ID="${2:-$NEXT_PUBLIC_REGISTRY_ID}"

if [ -z "$PACKAGE_ID" ] || [ "$PACKAGE_ID" = "0x0" ]; then
  echo "Usage: bash seed-registry.sh <PACKAGE_ID> <REGISTRY_ID>"
  exit 1
fi

echo "Seeding IndexRegistry: $REGISTRY_ID"
echo "Package: $PACKAGE_ID"
echo ""

add_asset() {
  local SYMBOL=$1
  local FEED_ID=$2
  local TIER=$3
  echo "Adding $SYMBOL (tier $TIER)..."
  $SUI client call \
    --package "$PACKAGE_ID" \
    --module index_registry \
    --function add_asset \
    --args "$REGISTRY_ID" "$SYMBOL" "$FEED_ID" "$TIER" \
    --gas-budget 10000000 \
    --json 2>&1 | grep -E '"status"|"error"' | head -2
  echo "$SYMBOL done"
}

# Tier 1 — Large Cap
add_asset "BTC"  "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" 1
add_asset "ETH"  "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" 1
add_asset "SOL"  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" 1
add_asset "SUI"  "23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744" 1

# Tier 2 — Mid Cap
add_asset "AVAX" "93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7" 2
add_asset "LINK" "8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221" 2
add_asset "DOT"  "ca3eed9b267293f6595a7585b0a1a023f20d8b0e03e9c3e4dcda60e0a3c891b6" 2
add_asset "UNI"  "78d185a741d07edb3164e547cfb35e943adb254cceda2e000b92394fea5eb058" 2
add_asset "ATOM" "b00b60f88b03a6a625a8d1c048c3f66653edf217439cb7a404f8f137c76de06b" 2

# Tier 3 — Small Cap / Meme
add_asset "DOGE"  "dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c" 3
add_asset "MATIC" "5de33440f6c8ee339a2c22138a48e37e0290e4d1b3d3e2e0b14e5c8ee3e46290" 3
add_asset "ADA"   "2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d" 3

echo ""
echo "────────────────────────────────────────────────────────────"
echo " Registry seeded with 12 assets"
echo "────────────────────────────────────────────────────────────"
