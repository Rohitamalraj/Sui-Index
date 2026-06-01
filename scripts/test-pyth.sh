#!/usr/bin/env bash
curl -sf "https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43&parsed=true" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
p = d['parsed'][0]
price = float(p['price']['price']) * (10 ** p['price']['expo'])
print('BTC price OK:', round(price, 2))
"
