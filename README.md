# SolSight

**Signal intelligence for Solana memecoins.** Rug screening, AI chart reading,
wallet bubble maps, and a community-voted live signal feed — one radar
instead of a dozen tabs.

[![MIT License](https://img.shields.io/badge/license-MIT-7C5CFF.svg)](./LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-0E0D16.svg)](https://nextjs.org)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/solsight/solsight&env=DATABASE_URL,DIRECT_URL,NEXTAUTH_SECRET,DISCORD_CLIENT_ID,DISCORD_CLIENT_SECRET,NEXT_PUBLIC_PRIVY_APP_ID,PRIVY_APP_SECRET,ANTHROPIC_API_KEY,BIRDEYE_API_KEY,HELIUS_API_KEY,NEXT_PUBLIC_SOLANA_RPC_URL&envDescription=See%20.env.example%20for%20details%20on%20every%20variable&envLink=https://github.com/solsight/solsight/blob/main/.env.example&project-name=solsight&repository-name=solsight)

> Add a real screenshot or short clip of the landing page / dashboard here
> once you've deployed — `public/og/cover.png` is already wired up as the
> Open Graph image in `app/layout.tsx`.
>
> Suggested shots once you have real data flowing: the `/token/[address]`
> page (candlestick chart + AI analysis + rug screener), the `/wallet/[address]`
> fund-flow graph, and `/feed` with a few real discovered signals.


---

## Current status

SolSight follows one rule above all else: **if it's shown on screen, it's
either real data or it honestly says "Unknown."** Nothing is mocked or
faked to look more finished than it is. As of this update:

**Working end-to-end, on real data:**
- Token detail page — live price/volume/liquidity (Birdeye → Dexscreener
  fallback), real candlestick chart, real Claude chart analysis.
- Rug screener — mint authority, freeze authority, and top-10-holder
  concentration are read directly from the chain via Helius RPC. **LP
  lock/burn status is still "Unknown"** — see "Known limitations" below.
- Wallet deep-dive — real fund-flow graph and USD-valued holdings via
  Helius.
- Watchlist — tied to your signed-in account and backed by Postgres; add a
  token from any token page, it persists across sessions.
- Signal feed — auto-populated every 30 minutes by a background job that
  pulls Birdeye's real trending-tokens list and creates a signal for each
  genuinely new discovery (see "Tech stack" and `inngest/functions.ts`).
- Token/wallet search.

**Known limitations (intentionally not faked):**
- LP lock/burn detection isn't implemented. Determining it correctly means
  resolving which AMM pool (Raydium, Orca, Meteora, …) holds a token's
  liquidity and checking that specific pool's LP mint — each DEX stores this
  differently, so it's a dedicated feature rather than a quick heuristic.
  Shown as "Unknown" rather than guessed.
- Wallet fund-flow shows real transfer relationships but does **not** do
  insider-cluster or wash-trading detection — that needs its own
  heuristics/ML on top of this data and isn't built yet. Every wallet node
  is unflagged.
- Social mention tracking (`X_BEARER_TOKEN`) isn't wired up yet — the schema
  and env var exist, the fetch logic doesn't.

---

## What it does

SolSight watches new and trending Solana memecoins and turns raw on-chain +
market noise into a small number of things worth actually looking at:

- **Rug screener** — mint & freeze authority and holder concentration read
  directly from the chain, rolled up into a 0–100 risk score. LP lock/burn
  status is still shown as "Unknown" (see Current status above).
- **AI chart reading** — Claude reads recent OHLCV structure plus on-chain
  context and produces a plain-language read: bias, a calibrated probability,
  key levels, and named risks. It never invents price data — only interprets
  what's fetched.
- **Wallet fund-flow graphs** — a live network graph of real transfer
  relationships between wallets. It does not yet do insider-cluster or
  wash-trading detection (see Current status above) — every node is
  unflagged until that's built.
- **Public signal feed** — auto-populated from real trending-token
  discovery every 30 minutes, plus every signal is scored for quality and
  voted on by the community.
- **Watchlists & alerts** — follow tokens and wallets, get notified when
  their signal quality or risk crosses a threshold.

SolSight is a **research and screening tool**. It never executes trades, never
holds custody of funds, and nothing it shows is financial advice.

## Tech stack

| Layer            | Choice                                                              |
| ----------------- | -------------------------------------------------------------------- |
| Framework          | Next.js 15 (App Router) + TypeScript                                |
| Styling            | Tailwind CSS + shadcn/ui + Framer Motion                            |
| Database           | Prisma + Postgres (Vercel Postgres, Supabase, or any Postgres works)|
| Auth               | NextAuth v5 (Discord OAuth) + Privy (Solana wallet connect)         |
| Charts             | `lightweight-charts` with custom canvas/SVG overlays                |
| AI                 | Anthropic Claude API (chart reasoning, signal explanations)         |
| On-chain data      | `@solana/web3.js`, Birdeye, Dexscreener, Helius                     |
| Social data        | X API v2 — schema + env var in place, fetch logic not yet built |
| Background jobs    | Inngest (durable functions): token sync on Vercel Cron, trending-token discovery on Inngest's own 30-minute cron |

## Live demo

The app runs fully with sample data out of the box — no API keys required to
explore the UI. Live on-chain data, AI analysis, and auth need the keys
described below.

---

## Quickstart (local development)

**Prerequisites:** Node.js 20 LTS (not 24 — see note below), `npm`, a Postgres database
(local via Docker, or a free one from [Neon](https://neon.tech) /
[Supabase](https://supabase.com) / Vercel Postgres).

```bash
# 1. Clone and install
git clone https://github.com/solsight/solsight.git
cd solsight
npm install

# 2. Configure environment
cp .env.example .env.local
# fill in DATABASE_URL at minimum — see "Environment variables" below

# 3. Set up the database
npm run db:push   # push the schema (or `npm run db:migrate` for a tracked migration)
npm run db:seed    # optional: populate sample tokens + signals

# 4. Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Why Node 20, not 24?** Node 24 has caused two real problems on this
> project's stack: native-module compilation failures in sibling
> TypeScript/Solana tooling, and much louder `[DEP0169] url.parse()`
> deprecation warnings cluttering the dev console (harmless, but noisy). If
> you're on Windows, [nvm-windows](https://github.com/coreybutler/nvm-windows)
> makes switching painless: `nvm install 20 && nvm use 20`.

To run background jobs locally (token sync, alerting), also run:

```bash
npm run inngest:dev
```

### Minimal setup (UI only, no keys)

If you just want to explore the landing page, dashboard, and component
library without wiring up any external service, `npm run dev` alone is enough —
every page falls back to clearly-labeled sample data when a live source
isn't configured.

---

## Environment variables

All variables are documented in [`.env.example`](./.env.example). Summary:

| Variable | Required for | Where to get it |
| --- | --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Any persisted data (watchlists, signals, votes) | Your Postgres provider |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Auth sessions | `openssl rand -base64 32` |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord sign-in | [Discord Developer Portal](https://discord.com/developers/applications) |
| `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` | Wallet connect | [Privy Dashboard](https://dashboard.privy.io) |
| `ANTHROPIC_API_KEY` | AI chart analysis | [Anthropic Console](https://console.anthropic.com) |
| `BIRDEYE_API_KEY` | Candles, token overview, holder data | [Birdeye](https://birdeye.so) |
| `HELIUS_API_KEY`, `NEXT_PUBLIC_SOLANA_RPC_URL` | Wallet tracking, enhanced RPC | [Helius](https://www.helius.dev) |
| `X_BEARER_TOKEN` | Ticker mention volume | [X Developer Portal](https://developer.x.com) |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Background jobs in production | [Inngest](https://app.inngest.com) |
| `CRON_SECRET` | Securing the Vercel Cron endpoint | any random string |

`DEXSCREENER_BASE_URL` needs no key and is used as an automatic fallback
whenever `BIRDEYE_API_KEY` is missing or rate-limited.

---

## Deploying

### One-click (Vercel)

Click **Deploy with Vercel** above. Vercel will prompt for the environment
variables listed in `.env.example`; a Postgres database can be provisioned
directly from the Vercel dashboard (Storage → Postgres) or pointed at
Supabase/Neon.

After the first deploy:

1. Run `npx prisma migrate deploy` (or connect Vercel's Postgres integration,
   which runs migrations automatically on build via the `postinstall` /
   `build` scripts in `package.json`).
2. Add your production URL to the Discord OAuth app's redirect URLs and to
   Privy's allowed origins.
3. Confirm `vercel.json`'s cron entry is enabled (Vercel → Project →
   Cron Jobs) so watched-token data keeps refreshing.
4. Register the app with [Inngest Cloud](https://app.inngest.com) (point it
   at `/api/inngest`) — this also activates the trending-token discovery
   job, which runs on its own 30-minute schedule independent of Vercel Cron
   and needs no `vercel.json` entry.

### Self-hosting

SolSight is a standard Next.js app and runs anywhere Next.js does
(Docker, a VPS, Railway, Fly.io, etc.):

```bash
npm run build
npm run start
```

For self-hosted deployments:

- Replace Vercel Cron with any scheduler (cron, systemd timer, GitHub
  Actions on a schedule) that hits `GET /api/cron/sync-tokens` with the
  `Authorization: Bearer $CRON_SECRET` header.
- Run Inngest's [self-hosted dev server](https://www.inngest.com/docs/local-development)
  or point `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` at Inngest Cloud.
- Any Postgres instance works — SolSight doesn't rely on Vercel-specific
  Postgres features.

---

## Project structure

```
app/
  page.tsx                 Landing page
  dashboard/                Authenticated app shell (sidebar + watchlists)
  feed/                     Public live signal feed
  token/[address]/          Ticker detail: chart, AI analysis, rug risk
  wallet/[address]/         Wallet deep-dive: bubble map, connected wallets
  auth/                     Wallet connect + Discord sign-in
  api/
    signals/                 Public signal feed + voting
    analyze/                 AI chart analysis (Claude)
    watchlist/                Watchlist CRUD
    auth/[...nextauth]/       NextAuth handler
    cron/sync-tokens/         Vercel Cron target → fans out to Inngest
    inngest/                  Inngest handler
components/
  landing/                   Hero, features, feed preview, CTA, signal radar
  dashboard/                 Sidebar, token cards, signal cards, AI/risk panels
  charts/                    Price chart (lightweight-charts) + wallet network graph
  shared/                    Header, footer, providers, logo
  ui/                        shadcn-style primitives (button, card, input, skeleton)
lib/
  prisma.ts                  Prisma client singleton
  auth.ts                    NextAuth config (Discord + Solana wallet signature)
  anthropic.ts                Claude client + chart analysis prompt
  market-data.ts              Birdeye/Dexscreener wrappers, trending discovery, rug score heuristic
  helius.ts                   Fund-flow, wallet balances, real mint/freeze authority + holder concentration
  inngest.ts                  Inngest client
  utils.ts                    Formatting helpers (cn, formatUsd, formatSymbol, shortenAddress, …)
inngest/functions.ts          Background jobs: watched-token refresh + trending-token discovery
prisma/schema.prisma          Full data model
```

## Design system

The visual identity is intentionally not the standard dark-green/red trading
dashboard look. It's built around a **radar/signal** metaphor:

- **Palette** — near-black indigo base (`--void`), glass surfaces, an
  electric-violet + signal-teal duotone for brand and "positive" states, with
  coral reserved only for risk/danger.
- **Typography** — Space Grotesk (display), Inter (body), JetBrains Mono
  (addresses, prices, tickers).
- **Signature element** — an animated radar sweep with live token "blips"
  (`components/landing/signal-radar.tsx`), echoed in miniature as the logo
  mark and as the corner readout on cards.

All tokens live in `tailwind.config.ts` and `app/globals.css` — reuse them
rather than introducing new one-off colors (see `CONTRIBUTING.md`).

## Safety & responsible-use notes

- SolSight **never** executes trades or holds custody of user funds.
- AI analysis and rug scores are probabilistic interpretations of public
  data — they are explicitly not guarantees and are labeled as such
  everywhere they're shown.
- Please keep this framing intact in any fork or derivative deployment.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide — project
structure, coding conventions, and how to add a new signal type.

## License

[MIT](./LICENSE) — do whatever you'd like, attribution appreciated.
