# Sui-Index

> **Tatum × Build on Sui with Walrus — Hackathon Submission**

A social crypto prediction game on Sui where players build weighted indexes of their favorite tokens and compete in timed 1v1 duels — turning market conviction into a skill-based, trustless game instead of a boring yes/no bet.

## Repository structure

```
Sui-Index/
├── README.md
├── .gitignore
├── contracts/     # Sui Move smart contracts
├── backend/       # Express API — prices, Walrus cache, auto-settlement
├── frontend/      # Next.js dApp
├── scripts/       # deploy & dev helpers
└── docs/          # architecture notes
```

---

## Demo

> **Live dApp:** [Hosted on Walrus Sites — link after mainnet deploy]
> **Demo Video:** [Submission video link]
> **Testnet Package:** `0x...` *(updated after deploy)*

---

## What is Sui-Index?

Players don't bet yes/no on events. Instead they:

```
BUILD  → Pick 3–8 crypto assets and assign % weights (40% BTC, 30% ETH, 20% SOL, 10% SUI)
LOCK   → Index stored immutably on Walrus, blob ID committed to Sui smart contract
DUEL   → 1v1 match for a set time window. Both players' SUI locked in escrow
SETTLE → Pyth oracle prices determine best-performing index by weighted return
EARN   → Winner takes the prize pool (minus 2% fee)
FLEX   → Share your result card (stored on Walrus) on X / LinkedIn
```

---

## How Tatum is Used (30% judging weight + $200 bonus)

Every single user action flows through Tatum's Sui gateway:

| Feature | Tatum Usage |
|---|---|
| Sui RPC | **All** contract reads/writes — duel create, join, settle, payout |
| Smart RPC Routing | Auto geo-balanced, 99.99% uptime — duels never fail from RPC downtime |
| Wallet Balance API | Real-time SUI balance check before joining a duel |
| Price Data API | Fallback price source for dashboard display |
| Event Indexing | DuelCreated / DuelJoined / DuelSettled events queried via Tatum RPC |

```typescript
// frontend/src/lib/tatum.ts — ALL RPC calls route here
const provider = new SuiClient({
  url: `https://sui-testnet.gateway.tatum.io?x-api-key=${TATUM_API_KEY}`
});

// backend/src/index.ts — settlement service also uses Tatum
const client = new SuiClient({ url: TATUM_RPC[SUI_NETWORK] });
```

---

## How Walrus is Used (30% judging weight + $200 bonus)

Walrus is the **core storage layer** — not an add-on:

| Data | Stored on Walrus | Why |
|---|---|---|
| Index composition | JSON blob per player per duel | Immutable, verifiable before and after settlement |
| Start price snapshot | Prices at duel activation moment | Trustless starting point — no oracle manipulation possible |
| Duel result | Full settlement record with returns | Permanent proof of outcome |
| Leaderboard snapshots | Weekly all-time rankings | Decentralized — no central server to shut down |
| Social share cards | Index card metadata for X/LinkedIn sharing | Rich media blob — Walrus's primary use case |
| **Full dApp frontend** | Entire UI hosted as a Walrus Site | **Cannot be ISP-blocked** — the regulatory moat |

```typescript
// frontend/src/lib/walrus.ts

// Store index on duel creation
const blobId = await storeBlob(JSON.stringify({
  assets: weights,        // e.g. [{symbol:"BTC", weight:40}, ...]
  creator: walletAddress,
  timestamp: Date.now(),
}));

// Store price snapshot when opponent joins
const snapshotBlobId = await storePriceSnapshot(currentPrices);

// Both blob IDs committed to the Sui smart contract
await buildCreateDuelTx(entryAmount, durationHours, blobId);
```

---

## Tech Stack

```
Frontend:         Next.js 14 + Sui dApp Kit + Tailwind CSS
Smart Contracts:  Move (Sui) — 3 contracts
Oracle:           Pyth Network Hermes (real-time price feeds)
Storage:          Walrus (indexes, prices, results, leaderboard, full frontend)
RPC:              Tatum Sui Gateway (testnet + mainnet)
Backend:          Node.js + Express (settlement service, price cache)
```

---

## Smart Contracts

```
contracts/sources/
├── index_duel.move      — Core: escrow, portfolio submit, activation, settle, payout
├── index_registry.move  — Asset registry: maps symbols → Pyth feed IDs, tier classification
└── duel_factory.move    — Registry of all duels, on-chain pagination
```

### index_duel.move — Key functions

```move
// Create a duel — deposits SUI + commits Walrus blob ID
public entry fun create_duel(
  payment: Coin<SUI>, entry_amount: u64, duration_ms: u64,
  creator_blob_id: String, platform_fee_bps: u64, clock: &Clock, ctx: &mut TxContext
)

// Join — opponent deposits + commits their index + start price snapshot
public entry fun join_duel(
  duel: &mut Duel, payment: Coin<SUI>, opponent_blob_id: String,
  start_prices_blob_id: String, clock: &Clock, ctx: &mut TxContext
)

// Settle — AdminCap holder calls after duel expires with computed returns
public entry fun settle_duel(
  _admin: &AdminCap, duel: &mut Duel,
  creator_return_bps: u64, opponent_return_bps: u64,
  result_blob_id: String, clock: &Clock, ctx: &mut TxContext
)
```

---

## Project Structure

```
sui-index/
├── contracts/
│   ├── sources/
│   │   ├── index_duel.move
│   │   ├── index_registry.move
│   │   └── duel_factory.move
│   └── Move.toml
├── frontend/
│   ├── src/
│   │   ├── app/           — Next.js app router
│   │   ├── components/    — 20+ UI components
│   │   │   ├── CreateDuelModal.tsx   — Full duel creation with Walrus + on-chain
│   │   │   ├── JoinDuelModal.tsx     — Join flow with IndexBuilder
│   │   │   ├── DuelsList.tsx         — Live duels from Tatum RPC events
│   │   │   ├── IndexBuilder.tsx      — Token selector + weight allocator
│   │   │   ├── IndexCardShare.tsx    — Walrus-stored shareable result card
│   │   │   └── Leaderboard.tsx       — Player rankings
│   │   └── lib/
│   │       ├── tatum.ts   — Tatum RPC + Data API client
│   │       ├── walrus.ts  — Walrus blob storage client
│   │       ├── sui.ts     — Transaction builders + event queries
│   │       └── pyth.ts    — Pyth oracle + return calculation
│   └── package.json
├── backend/
│   └── src/index.ts       — Settlement service + price cache + leaderboard
├── deploy.sh              — One-command testnet deploy (WSL)
├── seed-registry.sh       — Seeds IndexRegistry with 12 assets
└── README.md
```

---

## Local Development

### Prerequisites

- Node.js 18+
- Sui CLI (tested with v1.64.2) — install via WSL
- A free [Tatum API key](https://dashboard.tatum.io)

### 1. Clone and install

```bash
git clone <repo-url>
cd sui-index

# Frontend
cd frontend && npm install

# Backend
cd ../backend && npm install
```

### 2. Configure environment

**`frontend/.env.local`**
```env
NEXT_PUBLIC_TATUM_API_KEY=your_tatum_api_key_here
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
NEXT_PUBLIC_PACKAGE_ID=0x0
NEXT_PUBLIC_REGISTRY_ID=0x0
NEXT_PUBLIC_ADMIN_CAP_ID=0x0
```

**`backend/.env`**
```env
TATUM_API_KEY=your_tatum_api_key_here
SUI_NETWORK=testnet
ADMIN_PRIVATE_KEY=suiprivkey...    # from: sui keytool export --key-identity default
PACKAGE_ID=0x0
ADMIN_CAP_ID=0x0
REGISTRY_ID=0x0
PORT=3001
WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
```

### 3. Deploy contracts (WSL)

```bash
# Fund your testnet wallet first
sui client faucet

# Deploy (auto-updates .env files)
bash deploy.sh

# Seed the asset registry
bash seed-registry.sh <PACKAGE_ID> <REGISTRY_ID>
```

### 4. Start everything

```bash
# Terminal 1 — Frontend
cd frontend && npm run dev          # http://localhost:3000

# Terminal 2 — Backend settlement service
cd backend && npm run dev           # http://localhost:3001
```

---

## Settlement Flow

When a duel expires:

```
1. Backend polls for expired ACTIVE duels (or endpoint called directly)
2. POST /api/settle/:duelId
   ├── Reads Duel object from chain via Tatum RPC
   ├── Reads start price snapshot from Walrus
   ├── Reads creator index from Walrus
   ├── Reads opponent index from Walrus
   ├── Fetches current prices from Pyth Hermes
   ├── Calculates weighted return for each index
   │     e.g. 40%*BTC_return + 30%*ETH_return + ...
   ├── Stores full result JSON on Walrus → resultBlobId
   └── Calls settle_duel on-chain (AdminCap) → pays winner, stores blobId
```

---

## Why Sui-Index Wins on Regulatory Risk

Polymarket is banned in **33+ countries**. The regulatory complaint is always the same: *unlicensed gambling on uncertain future events*.

Sui-Index sidesteps this on two levels:

1. **Product framing** — Index performance duels = skill-based competition, closer to fantasy sports than event-outcome gambling
2. **Censorship-resistant hosting** — The entire dApp frontend lives on **Walrus**. There is no central domain for a government to block, no hosting provider to pressure. Spain and India blocked Polymarket at the DNS/ISP level — that attack vector doesn't exist for Walrus-hosted sites.

---

## Supported Assets (12 tokens)

| Symbol | Tier | Pyth Feed |
|---|---|---|
| BTC | Large Cap | `e62df6c8...` |
| ETH | Large Cap | `ff61491a...` |
| SOL | Large Cap | `ef0d8b6f...` |
| SUI | Large Cap | `23d73151...` |
| AVAX | Mid Cap | `93da3352...` |
| LINK | Mid Cap | `8ac0c70f...` |
| DOT | Mid Cap | `ca3eed9b...` |
| UNI | Mid Cap | `78d185a7...` |
| ATOM | Mid Cap | `b00b60f8...` |
| DOGE | Small Cap | `dcef50dd...` |
| MATIC | Small Cap | `5de33440...` |
| ADA | Small Cap | `2a01deae...` |

---

## Development

```bash
# Backend (port 3001)
cd backend && cp .env.example .env && npm install && npm run dev

# Frontend (port 3000)
cd frontend && cp .env.example .env.local && npm install && npm run dev

# Both (WSL / bash)
bash scripts/start-all.sh
```

See [docs/OVERVIEW.md](docs/OVERVIEW.md) for architecture details.

## Links

| Resource | URL |
|---|---|
| Tatum Dashboard | https://dashboard.tatum.io |
| Tatum Sui RPC Docs | https://docs.tatum.io/reference/rpc-sui |
| Walrus Docs | https://docs.wal.app |
| Walrus HTTP API | https://docs.wal.app/docs/http-api/storing-blobs |
| Pyth Network | https://docs.pyth.network/price-feeds |
| Sui dApp Kit | https://sdk.mystenlabs.com/dapp-kit |
| SuiVision Explorer | https://suivision.xyz/testnet |

---

*Built for the Tatum × Build on Sui with Walrus Hackathon · May 23 – June 6, 2026*
