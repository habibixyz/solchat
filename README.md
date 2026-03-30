# SOLCHAT ⟁
### The Social Trading Layer for Solana

> *Crypto does not need another social app. It needs a social layer.*

**Live → [solchat.fun](https://solchat.fun)**

---

## What is Solchat?

Solchat is where wallets talk. Every signal costs 0.001 SOL — no bots, no spam, no algorithmic feed manipulation. Just skin in the game, on-chain identity, and real-time alpha.

It is not a chat app. It is a social trading terminal built natively on Solana.

---

## Core Features

**⟁ Global Signal Feed**
Pay-to-post public feed. 0.001 SOL per message confirmed on-chain. No wallet, no voice.

**⚡ Signal Reactions**
React to messages with on-chain micro-transactions (0.0001 SOL). Bullish signals surface to the Trending feed in real time.

**◈ Trending Signals**
The most-reacted messages of the last 24h ranked and surfaced automatically. The market decides what matters.

**🔒 Direct Messages**
Private encrypted threads between wallets. First message opens the thread (0.001 SOL, one-time). All subsequent messages are free.

**◈ Native Jupiter Trading**
Swap any Solana token without leaving the feed. Click any contract address or `$TICKER` in chat to open a swap directly. Jupiter DEX aggregator is embedded natively — Solchat is a trading terminal, not just a chat app.

**📊 Trade Page**
Dedicated trading interface powered by Jupiter. Search tokens, view live price data, and execute swaps from one unified page.

**🤖 AI Oracle**
Tag `@ai` in the feed. Solchat AI responds publicly for everyone to see — Solana-focused, context-aware, rate-limited to prevent spam.

**◉ @Mention Notifications**
Real-time alerts when someone tags you. On-chain identity meets social signaling.

**◉ Profiles + Ethos Reputation**
Every wallet gets a profile. Link your Twitter to pull your Ethos credibility score. Signal history, reaction count, and on-chain reputation — all in one place.

**✎ Username System**
Claim a unique username linked to your wallet. Your on-chain identity, human-readable.

**📝 Blog + Manifesto**
Solchat publishes long-form thinking on Solana, social finance, and the future of crypto-native communication. The Manifesto lays out the vision. The Blog builds on it.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Inline styles + Tailwind |
| Blockchain | Solana (mainnet) |
| Wallet | @solana/wallet-adapter |
| Database | Supabase (Postgres + Realtime) |
| AI Oracle | Groq (Llama 3.3 70B) via Supabase Edge Functions |
| Trading | Jupiter DEX Aggregator (native embed) |
| Wallet Data | Helius API |
| Deployment | Vercel |

---

## Project Structure

```
solchat/
├── src/
│   ├── components/
│   │   ├── ChatLayout.tsx        # Global feed, sidebar, panels
│   │   ├── SwapDrawer.tsx        # Jupiter swap widget (inline)
│   │   └── Navbar.jsx            # Navigation
│   ├── pages/
│   │   ├── DiscoverPage.jsx      # Token discovery + wallet analyzer
│   │   ├── TradePage.tsx         # Native Jupiter trading terminal
│   │   ├── ProfilePage.tsx       # Wallet profiles + Ethos reputation
│   │   ├── DMPage.tsx            # Private encrypted DMs
│   │   ├── ManifestoPage.tsx     # The vision
│   │   ├── Blog.tsx              # Solchat blog index
│   │   └── BlogPost.tsx          # Individual blog posts
│   ├── services/
│   │   ├── sendMessage.ts        # Payment + message + AI trigger
│   │   ├── dmService.ts          # DM thread management
│   │   ├── reactionService.ts    # On-chain signal reactions
│   │   └── notificationService.ts # @mention notifications
│   ├── wallet/
│   │   └── WalletContext.tsx     # Wallet adapter setup
│   └── lib/
│       └── supabase.ts           # Supabase client
├── supabase/
│   └── functions/
│       ├── ai-respond/           # @ai oracle edge function
│       └── wallet-analyze/       # Helius wallet analyzer
└── assets/
```

---

## Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SOLANA_RPC_URL=your_helius_rpc_url
VITE_HELIUS_API_KEY=your_helius_api_key
VITE_CREATOR_WALLET=your_wallet_address
```

---

## Database Schema

```sql
-- Messages (global feed)
create table messages (
  id           uuid primary key default gen_random_uuid(),
  username     text not null,
  text         text not null,
  tx_signature text,
  reply_to_id  uuid references messages(id) on delete set null,
  reply_preview jsonb,
  created_at   timestamp default now()
);

-- Usernames (wallet-linked identity)
create table usernames (
  wallet_address text primary key,
  username       text unique not null,
  twitter_handle text,
  created_at     timestamp default now()
);

-- Signal reactions (on-chain)
create table message_reactions (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid references messages(id) on delete cascade,
  reactor       text not null,
  reaction_type text not null,
  tx_signature  text not null,
  created_at    timestamptz default now(),
  unique(message_id, reactor, reaction_type)
);

-- DM threads (private, paid to open)
create table dm_threads (
  id            uuid primary key default gen_random_uuid(),
  participant_a text not null,
  participant_b text not null,
  open_tx       text not null,
  created_at    timestamptz default now(),
  unique(participant_a, participant_b)
);

-- DM messages (private)
create table dm_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid references dm_threads(id) on delete cascade,
  sender     text not null,
  text       text not null,
  created_at timestamptz default now()
);

-- Notifications (@mentions)
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  recipient       text not null,
  sender_name     text not null,
  message_id      uuid references messages(id) on delete cascade,
  message_preview text,
  read            boolean default false,
  created_at      timestamptz default now()
);
```

---

## How the AI Oracle Works

```
User tags @ai in a message
→ Pays 0.001 SOL (confirmed on-chain)
→ Message saved to Supabase
→ sendMessage.ts calls ai-respond edge function
→ Edge function fetches last 20 messages for context
→ Calls Groq (Llama 3.3 70B)
→ Saves AI response to messages table
→ Supabase realtime broadcasts to all clients
→ Everyone sees the response instantly
Rate limit: 5 @ai messages per wallet per hour
```

---

## How Native Trading Works

```
User sees $TOKEN or contract address in chat
→ Clicks token chip
→ SwapDrawer opens with Jupiter embedded
→ Live price data loads via Helius
→ User swaps without leaving Solchat
→ Trade confirmed on-chain

Trade Page:
→ Search any Solana token
→ View chart + live data
→ Execute swap via Jupiter aggregator
→ Best route found automatically across all Solana DEXs
```

---

## How DMs Work

```
User visits any profile → clicks "Direct Message"
→ First message costs 0.001 SOL (opens thread)
→ Thread is free forever after
→ Messages stored in Supabase with RLS
→ Only participants can read their thread
→ Real-time via Supabase channels
```

---

## Getting Started

```bash
npm install
npm run dev
npm run build

# Deploy edge functions
npx supabase functions deploy ai-respond
npx supabase functions deploy wallet-analyze
```

---

## Revenue Model

| Stream | Amount |
|---|---|
| Global feed messages | 0.001 SOL each |
| DM thread opens | 0.001 SOL one-time |
| Signal reactions | 0.0001 SOL each |
| Featured token listings | coming soon |
| Trade page volume | coming soon |

---

## Roadmap

- [x] Pay-to-post global feed
- [x] AI Oracle (@ai)
- [x] Profiles + Ethos reputation
- [x] Direct Messages (private, paid-to-open)
- [x] Signal reactions (on-chain)
- [x] Trending feed
- [x] @mention notifications
- [x] Native Jupiter swap (inline)
- [x] Blog + Manifesto
- [ ] Trade Page (Jupiter native terminal)
- [ ] Token-gated chat rooms
- [ ] Wallet PnL on profiles (Helius)
- [ ] Mobile app

---

## Built by

[@ritmir11](https://twitter.com/ritmir11) — solo, no VC, no team.

⟁ [solchat.fun](https://solchat.fun)
