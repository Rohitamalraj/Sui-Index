#!/usr/bin/env bash
ADDRESS="0x1533f739aceec60dedd34c88e4ec3330c05772c7be5c3751b045449c65e80525"
# Try multiple faucet endpoints
echo "Trying faucet.testnet.sui.io..."
RESULT=$(curl -sf -w "\nHTTP_CODE:%{http_code}" -X POST https://faucet.testnet.sui.io/v1/gas \
  -H "Content-Type: application/json" \
  -d "{\"FixedAmountRequest\":{\"recipient\":\"$ADDRESS\"}}" 2>&1)
echo "$RESULT"

echo ""
echo "Trying discord.sui.io fallback..."
RESULT2=$(curl -sf -w "\nHTTP_CODE:%{http_code}" -X POST https://faucet.testnet.sui.io/gas \
  -H "Content-Type: application/json" \
  -d "{\"recipient\":\"$ADDRESS\"}" 2>&1)
echo "$RESULT2"
