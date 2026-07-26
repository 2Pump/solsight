# Contributing to SolSight

Thanks for considering a contribution — SolSight is community-built, and
signal-tracking tools get better the more eyes and use-cases they see.

## Ground rules

- **Be kind and direct.** Code review is about the code, not the person.
- **No financial advice in code or copy.** SolSight describes patterns in
  public data; it never tells users to buy or sell. Please keep new copy,
  signal reasoning, and AI prompts consistent with that line.
- **Real data only.** Don't introduce mocked/simulated on-chain data into
  production code paths (sample data for landing/demo pages is fine and
  should be clearly commented as such, as in the existing codebase).

## Getting set up

1. Fork the repo and clone your fork.
2. Follow the **Local development** section of the [README](./README.md) to
   get the app running with a seeded database.
3. Create a branch off `main`: `git checkout -b feat/short-description`.

## Project structure

```
app/            Next.js App Router pages, layouts, and API routes
components/     UI components, grouped by feature area (landing, dashboard, charts, ui, shared)
lib/            Server-side utilities: Prisma client, Anthropic client, market data, auth
prisma/         Database schema and seed script
inngest/        Background job definitions
```

Read the inline comments in `lib/market-data.ts`, `lib/anthropic.ts`, and
`prisma/schema.prisma` first; they explain the data-flow assumptions the
rest of the app relies on.

## Making changes

- **Components** should be small and colocated by feature
  (`components/dashboard/*`, `components/landing/*`, etc.) rather than dumped
  into a single folder.
- **Server-only logic** (API keys, Prisma queries) belongs in `lib/` or
  `app/api/*/route.ts` — never in a `"use client"` component.
- **Styling** uses Tailwind utility classes plus the design tokens defined in
  `tailwind.config.ts` and `app/globals.css`. Please reuse existing tokens
  (`signal`, `pulse`, `risk`, `ink`, `.glass`, etc.) rather than introducing
  new one-off colors — the visual identity depends on that consistency.
- **Types**: run `pnpm typecheck` before opening a PR.
- **Formatting**: run `pnpm format` (Prettier + Tailwind class sorting) before
  committing.

## Commit style

We use short, imperative commit messages:

```
feat: add whale accumulation signal type
fix: correct rug score threshold for MEDIUM risk
docs: clarify Helius setup in README
```

## Pull requests

- Keep PRs focused — one feature or fix per PR is easier to review than a
  bundle of unrelated changes.
- Include a short description of **what** changed and **why**, and a
  screenshot or clip for any UI change.
- Link any related issue.
- Tests aren't required for every PR yet (the test suite is still young),
  but if you're touching scoring logic (`lib/market-data.ts`'s
  `heuristicRugScore`, signal quality scoring, etc.) please add or update a
  unit test alongside the change.

## Adding a new signal type

Signal types live in `prisma/schema.prisma` (`SignalType` enum) and are
rendered via `TYPE_ICON` maps in `components/dashboard/signal-card.tsx` and
`components/landing/feed-preview.tsx`. To add one:

1. Add the enum value in `schema.prisma` and run `pnpm db:migrate`.
2. Add an icon mapping in the two components above.
3. Add generation logic — either in a new Inngest function
   (`inngest/functions.ts`) or in the rules engine that produces signals.
4. Update the README's feature list if it's user-facing.

## Reporting bugs / requesting features

Please open a GitHub issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce (for bugs)
- Screenshots if it's visual

## Security

Found a security issue (an auth bypass, a way to forge signals, a leaked
key path, etc.)? Please **do not** open a public issue. Email the
maintainers listed in the repo's GitHub security policy instead.

## License

By contributing, you agree your contributions will be licensed under the
project's [MIT License](./LICENSE).
