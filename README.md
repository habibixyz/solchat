# SOLCHAT ⟁

> A social layer built for crypto. Native to Solana.

**Live at [solchat.fun](https://solchat.fun)**

---

## What is Solchat?

Solchat is a pay-to-talk global chat feed built on Solana. Every message costs 0.001 SOL — no bots, no spam, no algorithmic manipulation. Just wallets, signals, and skin in the game.

Tag `@ai` in the feed and the public AI oracle responds for everyone to see.

---

## Features

- **Pay-to-post** — 0.001 SOL per message, confirmed on-chain
- **Global realtime feed** — powered by Supabase realtime
- **AI Oracle** — tag `@ai` and get a public response from the SolChat AI
- **Username system** — claim your unique username, linked to your wallet
- **Token detection** — click `$SOL`, `$JUP` or any contract address in chat to open a swap
- **Multi-wallet support** — Phantom, Solflare, Backpack, Ledger and more
- **NULL SIGIL NFT** — holders chat free forever
- **Wallet Analyzer** — deep on-chain analysis powered by Helius + AI
- **Manifesto** — the vision behind the surface

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
| NFT | Metaplex Candy Machine v3 + Sugar |
| Wallet Data | Helius API |
| Deployment | Vercel |

---

## Project Structure

```
solchat/
├── src/
│   ├── components/
│   │   ├── ChatLayout.tsx      # Global feed + send message
│   │   ├── ChatWindow.tsx      # Message rendering
│   │   ├── MessageInput.tsx    # Input + payment trigger
│   │   ├── Navbar.jsx          # Navigation
│   │   └── SwapDrawer.tsx      # Jupiter swap widget
│   ├── pages/
│   │   ├── DiscoverPage.jsx    # Wallet analyzer
│   │   ├── ManifestoPage.tsx   # The vision
│   │   └── TokenPage.jsx       # Token details
│   ├── ritual/
│   │   └── GenesisPage.tsx     # NULL SIGIL mint page
│   ├── services/
│   │   └── sendMessage.ts      # Payment + message + AI trigger
│   ├── wallet/
│   │   └── WalletContext.tsx   # Wallet adapter setup
│   └── lib/
│       └── supabase.ts         # Supabase client
├── supabase/
│   └── functions/
│       ├── ai-respond/         # @ai oracle edge function
│       └── wallet-analyze/     # Wallet analyzer edge function
└── assets/                     # NULL SIGIL NFT assets (1000)
```

---

## Environment Variables

Create a `.env` file in the root:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SOLANA_RPC_URL=your_helius_rpc_url
VITE_HELIUS_API_KEY=your_helius_api_key
```

---

## Supabase Edge Function Secrets

```bash
npx supabase secrets set ANTHROPIC_API_KEY=your_key
npx supabase secrets set GROQ_API_KEY=your_key
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Build for production
npm run build

# Deploy edge functions
npx supabase functions deploy ai-respond
npx supabase functions deploy wallet-analyze
```

---

## Database Schema

```sql
-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  text text not null,
  tx_signature text,
  created_at timestamp default now()
);

-- Usernames (wallet-linked)
create table usernames (
  wallet_address text primary key,
  username text unique not null,
  created_at timestamp default now()
);
```

---

## NULL SIGIL NFT

- **Supply:** 1000
- **Public mint:** 899
- **Price:** FREE
- **Max per wallet:** 1
- **Utility:** Holders chat on solchat.fun for free forever
- **Standard:** Metaplex NFT (Candy Machine v3)

---

## How the AI Oracle Works

```
User tags @ai in a message
→ Pays 0.001 SOL (tx confirmed)
→ Message saved to Supabase
→ sendMessage.ts calls ai-respond edge function
→ Edge function fetches last 20 messages for context
→ Calls Groq (Llama 3.3 70B)
→ Saves AI response to messages table
→ Supabase realtime broadcasts to all clients
→ Everyone sees the response instantly
```

Rate limit: 5 `@ai` messages per user per hour.

---

## Deployment

Deployed on Vercel. Push to `main` branch triggers auto-deploy.

```json
// vercel.json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## Revenue Model

- 0.001 SOL per message → creator wallet
- 0.05 SOL per wallet analysis → creator wallet
- NULL SIGIL NFT mint (coming soon)
- Featured token listings (coming soon)

---

## Built by

[@ritmir11](https://twitter.com/ritmir11) — built solo, no VC, no team.

> *"Crypto does not need another social app. It needs a social layer."*

---

⟁ solchat.fun