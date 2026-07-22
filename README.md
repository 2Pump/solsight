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


---

## What it does

SolSight watches new and trending Solana memecoins and turns raw on-chain +
market noise into a small number of things worth actually looking at:

- **Rug screener** — LP lock/burn status, mint & freeze authority, holder
  concentration, rolled up into a single 0–100 risk score.
- **AI chart reading** — Claude reads recent OHLCV structure plus on-chain
  context and produces a plain-language read: bias, a calibrated probability,
  key levels, and named risks. It never invents price data — only interprets
  what's fetched.
- **Wallet bubble maps** — a live network graph of fund flow between wallets,
  so coordinated buying/insider clusters are visible instead of buried in a
  block explorer.
- **Public signal feed** — every signal (breakout, momentum, whale move, rug
  warning, …) is scored for quality and voted on by the community.
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
| Social data        | X API v2 (ticker mention volume)                                    |
| Background jobs    | Inngest (durable functions) triggered by Vercel Cron                |

## Live demo

The app runs fully with sample data out of the box — no API keys required to
explore the UI. Live on-chain data, AI analysis, and auth need the keys
described below.

---

## Quickstart (local development)

**Prerequisites:** Node.js 20+, `pnpm` (or npm/yarn), a Postgres database
(local via Docker, or a free one from [Neon](https://neon.tech) /
[Supabase](https://supabase.com) / Vercel Postgres).

```bash
# 1. Clone and install
git clone https://github.com/solsight/solsight.git
cd solsight
pnpm install

# 2. Configure environment
cp .env.example .env.local
# fill in DATABASE_URL at minimum — see "Environment variables" below

# 3. Set up the database
pnpm db:push      # push the schema (or `pnpm db:migrate` for a tracked migration)
pnpm db:seed       # optional: populate sample tokens + signals

# 4. Run the app
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

To run background jobs locally (token sync, alerting), also run:

```bash
pnpm inngest:dev
```

### Minimal setup (UI only, no keys)

If you just want to explore the landing page, dashboard, and component
library without wiring up any external service, `pnpm dev` alone is enough —
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

1. Run `pnpm db:migrate deploy` (or connect Vercel's Postgres integration,
   which runs migrations automatically on build via the `postinstall` /
   `build` scripts in `package.json`).
2. Add your production URL to the Discord OAuth app's redirect URLs and to
   Privy's allowed origins.
3. Confirm `vercel.json`'s cron entry is enabled (Vercel → Project →
   Cron Jobs) so token data keeps refreshing.

### Self-hosting

SolSight is a standard Next.js app and runs anywhere Next.js does
(Docker, a VPS, Railway, Fly.io, etc.):

```bash
pnpm build
pnpm start
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
  market-data.ts              Birdeye/Dexscreener wrappers + rug score heuristic
  inngest.ts                  Inngest client
  utils.ts                    Formatting helpers (cn, formatUsd, shortenAddress, …)
inngest/functions.ts          Background job: refresh watched token data
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
