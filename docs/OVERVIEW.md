# 🧠 Sui-Index — Project Overview

> **One-Line Pitch:** A social crypto prediction game on Sui where players build weighted indexes of their favorite tokens and compete in timed duels — turning market conviction into a skill-based, trustless game.

---

## 📌 Hackathon Context

| Detail | Info |
|---|---|
| **Hackathon** | Tatum × Build on Sui with Walrus |
| **Prize Pool** | $2,000 USD + $200 Best Walrus + $200 Best Tatum Tools |
| **Timeline** | May 23 → June 6, 17:00 UTC |
| **Team Size** | 1–3 |
| **Deliverables** | GitHub repo + 2–3 min demo video |
| **Network** | Sui Mainnet (preferred) or Testnet/Devnet |

### Judging Criteria

| Weight | Criterion |
|---|---|
| **30%** | Walrus + Tatum Integration — meaningful, creative use |
| **30%** | Technical Quality — clean code, successful Tatum Sui RPC integration |
| **20%** | Creativity |
| **20%** | Presentation — clear docs + working demo |
| **Bonus** | Share on X/LinkedIn tagging `@Tatum_io`, `@WalrusFoundation`, `@SuiNetwork` |

---

## 🎮 What Is Sui-Index?

An **onchain crypto index prediction game**. Players don't bet yes/no on events. Instead they:

1. **BUILD** — Pick 3–8 crypto assets and assign percentage weights (e.g. 40% BTC, 30% ETH, 20% SOL, 10% SUI)
2. **LOCK** — Index is stored immutably on Walrus and submitted to a Sui smart contract
3. **DUEL** — 1v1 matches, group rounds, or themed tournaments for a set time window
4. **SETTLE** — Oracle price feeds determine the best-performing index by weighted return
5. **EARN** — Winner takes the prize pool
6. **FLEX** — Share your result via on-chain index cards

```
BUILD → LOCK → DUEL → SETTLE → EARN → FLEX
```

### Key Design Choices

- **No house edge** — Pure peer-to-peer escrow. Smart contract settles.
- **Skill, not luck** — Your index composition reflects your market thesis.
- **Themed tournaments** — "AI coins only", "Layer 1 battle", "Stablecoin survival"
- **Public leaderboard** — Win rate + total return. All verifiable on Walrus.
- **Non-custodial** — Funds never leave the user's wallet except into the duel escrow contract.

---

## 💡 Why Sui-Index Beats Existing Protocols

### 🔒 Regulatory Moat

Polymarket is blocked in **33+ countries** (India, Indonesia, Brazil, Spain, France, Germany, etc.). Kalshi faces similar bans. The regulatory complaint is always the same: *unlicensed gambling on uncertain future events*.

**Sui-Index sidesteps this:**
- **Product framing** — Index performance duels = skill-based competition (closer to fantasy sports / trading simulation), not event-outcome gambling.
- **Censorship-resistant hosting** — Entire dApp on Walrus. No central domain to block, no server to seize, no hosting provider to pressure.

### 💡 Full Strategy Expression vs. 1-Bit Binary

Every incumbent (Polymarket, Kalshi, Augur) reduces strategy to a single **yes/no answer**. Sui-Index gives players **100 percentage points** to allocate across up to 8 assets — encoding conviction, risk appetite, diversification, and thesis in a single decision.

### 🤖 Bot Resistance

Bloomberg's April 2026 analysis: **100K+ Polymarket accounts each lost ≥$1,000** to systematic bots. Sui-Index is structurally resistant:
- Index composition is **locked at duel start** — no continuous order book for bots to exploit
- Resolution is on **aggregate weighted performance**, not micro-second price movements
- **Peer-to-peer format** — you compete against a known opponent, not an anonymous liquidity pool

### 🧩 Social Layer

Competitors have **zero** social identity. Sui-Index stores every index ever built on Walrus — permanently, verifiably, publicly:
- Player profiles with win rate, best-performing index, total return history
- Shareable **index cards** (designed for X/LinkedIn sharing)
- Rivalries, rematches, themed tournaments

### 📊 Advantages at a Glance

| Dimension | Existing Protocols | Sui-Index |
|---|---|---|
| Regulatory exposure | Banned in 33+ countries, active ISP blocks | Index game framing + Walrus-hosted frontend = no DNS target |
| Strategy depth | 1-bit yes/no decision | Full 100% weight allocation across 3–8 assets |
| Bot resistance | 100K+ retail accounts lost $1K+ to bots | Locked index at start, no live order book to exploit |
| Social identity | None — anonymous trades, no reputation | Walrus-stored player history, index cards, leaderboards |
| Storage model | Centralized servers or expensive on-chain | Walrus: decentralized, cheap blob storage native to Sui |
| Censorship resistance | ISP-blockable domains and centralized hosting | Full dApp on Walrus — no central server to block or seize |
| Replayability | One-time market participation | Duels, tournaments, themed rounds, rematches |
| Chain ecosystem | Polygon / Centralized / Ethereum | Sui — $2.5B TVL, 467TB Walrus storage, fastest growing L1 |

---

## 🏗️ Tech Stack

```
Frontend:         Next.js 14 + Sui dApp Kit + Walrus SDK
Smart Contracts:  Move (Sui) — DuelFactory, IndexDuel, IndexRegistry
Oracle:           Pyth Network on Sui (asset price feeds)
Storage:          Walrus (blobs for index data, leaderboard, media)
RPC:              Tatum Sui Gateway (mainnet + testnet)
Data API:         Tatum Data API (wallet balance, token prices)
Backend:          Node.js + Express (off-chain settlement trigger, price caching)
```

---

## 🔗 Tatum Integration (Targets 30% Judging + Best Use of Tatum Tools Bonus)

Tatum provides the **entire Sui RPC and data infrastructure layer**.

### RPC Endpoints (Powered by Tatum)

| Network | Endpoint |
|---|---|
| Mainnet | `https://sui-mainnet.gateway.tatum.io` |
| Testnet | `https://sui-testnet.gateway.tatum.io` |
| Devnet  | `https://sui-devnet.gateway.tatum.io` |

**Auth:** Append `?x-api-key=YOUR_KEY` as query param, or send `x-api-key` header.  
**Free key:** [dashboard.tatum.io](https://dashboard.tatum.io)

### How Sui-Index Uses Tatum

| Tatum Feature | Usage in Sui-Index |
|---|---|
| Sui Mainnet RPC | All smart contract reads and writes — duel creation, joining, settlement, payout |
| Smart RPC Routing | Auto geo/load balancing + failover; 99.99% uptime SLA |
| RPC Accelerator | Cached blockchain data for faster leaderboard and duel state reads |
| Data API — Wallet Balances | Real-time SUI balance lookup for entry amount validation before joining a duel |
| Data API — Token Prices | Fetch current asset prices for real-time index performance on the dashboard |
| Webhooks / Transaction Alerts | Backend notifications when duel state changes (opponent joined, settlement ready, payout) |
| MCP Server *(optional bonus)* | AI-assisted index building — "suggest the best index for the next 24 hours" |

### Code-Level Integration

```javascript
// 1. All Sui RPC calls via Tatum gateway
const provider = new SuiClient({
  url: `https://sui-mainnet.gateway.tatum.io?x-api-key=${TATUM_API_KEY}`
});

// 2. Validate user balance before duel entry
const balance = await fetch(
  `https://api.tatum.io/v4/data/balances?chain=sui&addresses=${walletAddress}`,
  { headers: { 'x-api-key': TATUM_API_KEY } }
);

// 3. Webhook for duel state change notifications
// Tatum alerts backend when IndexDuel contract emits DuelSettled event
```

---

## 💾 Walrus Integration (Targets 30% Judging + Best Walrus Integration Bonus)

Walrus is a **decentralized blob storage and data availability protocol** built on Sui. It uses "Red Stuff" encoding — breaking blobs into shards across storage nodes — making it resilient to node failures while remaining cost-efficient.

### What Sui-Index Stores on Walrus

| Data Type | What Gets Stored | Why Walrus |
|---|---|---|
| **Index Composition** | Player's locked index (asset weights + timestamp) as JSON blob | Immutable, verifiable, directly readable by Sui smart contracts |
| **Duel Metadata** | Full duel history — participants, start/end prices, returns, winner | Permanent record; composable with Sui's object model |
| **Leaderboard Snapshots** | Weekly and all-time leaderboard states | Decentralized — no central server that can be shut down |
| **Social Index Cards** | Shareable image metadata for best-performing indexes | Rich media blobs — Walrus's primary use case |
| **Tournament Config** | Themed round definitions (allowed assets, time windows, prize structure) | Immutable — operators can't secretly change rules after players commit |
| **Full Frontend** | Entire dApp UI hosted as a Walrus Site | Zero centralized hosting dependency; app cannot be deplatformed |

### How Walrus Works (Key Concepts)

- **Blobs** — Data stored in a flat namespace (no folders). Each blob has a unique **Blob ID** (content-derived) and a **Sui Object ID** (for metadata modifications).
- **Storage duration** — Blobs are stored for N epochs. Testnet epoch = 1 day, Mainnet epoch = 2 weeks. Can be extended indefinitely.
- **Walrus HTTP API** — Store/retrieve blobs via HTTP endpoints (no CLI required for web apps).
- **SDKs** — TypeScript SDK available: `@walrus/sdk`

### Walrus Endpoints

| Operation | Testnet Endpoint |
|---|---|
| Store blob | `PUT https://publisher.walrus-testnet.walrus.space/v1/blobs` |
| Read blob | `GET https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blobId}` |

### Code-Level Integration

```javascript
// 1. Store index on duel creation
const blobId = await walrusClient.store(
  JSON.stringify({ assets: weights, timestamp: Date.now(), creator: wallet })
);
await duelContract.createDuel({ blobId, entryAmount, duration });

// 2. Store duel result after settlement
const resultBlobId = await walrusClient.store(JSON.stringify(duelResult));

// 3. Read index for display
const indexData = await walrusClient.read(blobId);
```

---

## 📜 Move Smart Contracts

| Contract | Responsibility |
|---|---|
| **IndexDuel.move** | Core duel contract: escrow, portfolio submission, activation, settlement, payout |
| **DuelFactory.move** | Factory for spawning duel instances, managing platform fee, pagination |
| **IndexRegistry.move** | Asset registry mapping symbols to Pyth price feed IDs, tier classifications |
| **TournamentManager.move** | Themed tournament rounds, bracket management *(Phase 2)* |

### Oracle

- **Pyth Network on Sui** — Real-time price feeds for all supported crypto assets
- Settlement uses start/end prices from Pyth to calculate weighted returns for each player's index

---

## 📅 Development Timeline

| Days | Target | Status |
|---|---|---|
| **Days 1–3** (by Jun 2) | Move contracts deployed to testnet via Tatum RPC. Pyth oracle wired. Basic Walrus blob storage for index data. | 🔲 |
| **Days 4–5** (Jun 3–4) | Next.js frontend with Sui dApp Kit. Index builder UI. 1v1 duel flow end-to-end on testnet. | 🔲 |
| **Day 6** (Jun 5) | Leaderboard, Walrus-stored duel history, social share card generation, mainnet deploy. | 🔲 |
| **Day 7** (Jun 6) | Demo video, cleanup, README, submit by 17:00 UTC. | 🔲 |

---

## 🏆 Why This Wins

| Criterion | Our Angle |
|---|---|
| **Walrus (30%)** | Core, not optional — index composition, duel history, leaderboard, social cards, and the entire frontend on Walrus |
| **Tatum (30%)** | Every RPC call, every data query, every event webhook flows through Tatum's Sui infrastructure |
| **Creativity (20%)** | Index duels are a genuinely new product category — nothing like this exists on Sui today |
| **Presentation (20%)** | Working duel on mainnet with clean UI, shareable index cards, compelling regulatory narrative |
| **Bonus prizes** | Both Best Walrus Integration ($200) and Best Use of Tatum Tools ($200) directly targeted |

---

## 📚 Reference Links

| Resource | URL |
|---|---|
| Tatum Sui RPC Docs | https://docs.tatum.io/reference/rpc-sui |
| Tatum Dashboard (API Key) | https://dashboard.tatum.io |
| Tatum MCP Guide | https://docs.tatum.io/docs/mcp |
| Walrus Docs | https://docs.wal.app/docs/getting-started |
| Walrus HTTP API | https://docs.wal.app/docs/http-api/storing-blobs |
| Walrus TypeScript SDK | https://docs.wal.app/docs/typescript-sdk/sdks |
| Walrus Sites | https://docs.wal.app/docs/sites |
| Pyth Network (Sui) | https://docs.pyth.network/price-feeds/use-real-time-data/sui |
| Sui dApp Kit | https://sdk.mystenlabs.com/dapp-kit |
| SuiVision Explorer | https://suivision.xyz |
| SuiScan Explorer | https://suiscan.xyz |
| Tatum Discord | https://discord.gg/tatum |

---

## 🗂️ Project Structure (Planned)

```
sui-index/
├── contracts/               # Move smart contracts
│   ├── sources/
│   │   ├── index_duel.move
│   │   ├── duel_factory.move
│   │   └── index_registry.move
│   ├── tests/
│   └── Move.toml
├── frontend/                # Next.js 14 app
│   ├── app/
│   ├── components/
│   ├── lib/
│   │   ├── tatum.ts         # Tatum RPC + Data API client
│   │   ├── walrus.ts        # Walrus blob storage client
│   │   ├── sui.ts           # Sui client + dApp Kit config
│   │   └── pyth.ts          # Pyth oracle integration
│   ├── hooks/
│   └── package.json
├── backend/                 # Node.js + Express
│   ├── services/
│   │   ├── settlement.ts    # Off-chain settlement trigger
│   │   └── price-cache.ts   # Price caching from Tatum/Pyth
│   └── package.json
├── OVERVIEW.md              # ← You are here
└── README.md                # Hackathon submission README
```

---

*Ready to build. Let's go.* 🚀
