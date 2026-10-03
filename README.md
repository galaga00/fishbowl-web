# Fish Bowl

A mobile-first Next.js + TypeScript party guessing game. Players join a hosted room from phones, submit or draft prompts, and take turns marking prompts correct or skipped.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Sign in to Convex:

```bash
npx convex login
```

3. Create or connect a Convex deployment:

```bash
npx convex dev --once
```

4. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

5. Fill in `.env.local`:

```bash
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
OWNER_ANALYTICS_KEY=make-a-private-random-key
ANALYTICS_IP_SALT=make-another-private-random-key
```

6. Set the same `OWNER_ANALYTICS_KEY` in the matching Convex deployment using its dashboard or secure stdin to `npx convex env set OWNER_ANALYTICS_KEY`.

7. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Backend Notes

Fish Bowl's active backend is Convex. Game state, live updates, owner analytics, and E2E seeding/cleanup run through the Convex functions in `convex/`.

New rooms use private player sessions, with host/controller permissions enforced in Convex and card text visible only to the appropriate player. Read [Foundation behavior and deployment](docs/FOUNDATION.md) for recovery, legacy-room migration, timing and rematches.

The active Convex project is `austin-hill:fish-bowl`. Production uses deployment `quaint-mink-705` at `https://quaint-mink-705.convex.cloud`; local development uses dev deployment `ardent-lemming-605` at `https://ardent-lemming-605.convex.cloud`.

## LAN Testing

Run Next.js so other devices on the same Wi-Fi can reach your Mac:

```bash
npm run dev -- --hostname 0.0.0.0
```

Open the host browser on the Mac at `http://localhost:3000`. Find your Mac LAN IP with System Settings or `ipconfig getifaddr en0`, then open `http://YOUR_MAC_IP:3000` on phones and iPads.

Suggested test flow:

1. Mac browser creates the game as host.
2. Phone joins with the short code or QR link.
3. iPad or incognito windows join as extra players.
4. Each player submits one or more prompts.
5. Host watches lobby updates, then starts the game.
6. The active player uses Correct, Skip, and End turn.

## End-to-End Testing

This project uses Playwright for automated browser testing. The default E2E command runs one headless Chromium browser at a time, so you do not need to manually open a host tab, player tab, incognito window, and phone simulator just to check the game loop.

First-time setup:

```bash
npx playwright install chromium webkit
```

Run the E2E suite:

```bash
npm run test:e2e
```

The Playwright config starts `npm run dev` for you at `http://127.0.0.1:3000`, reuses an already-running local server when available, and stores screenshots/traces only when a test fails. The 32-test suite covers the full game loop, multiplayer realtime, private sessions/cards, recovery, setup capacity, quick start, server deadlines, pause/undo, fresh rematches and responsive turn controls. Foundation UI tests also save layout screenshots.

Useful variants:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
```

Use headed or UI mode only when you want to watch or debug the browser. Test-created games are deleted after each test on the named development Convex deployment. Set `E2E_TEST_SECRET` locally and in development Convex, and `FISH_BOWL_E2E_ENABLED=true` in development Convex. Never enable these helpers in production. Test and debug clients reject other deployment URLs.

## Vercel Deployment

1. Push this folder to a GitHub repo.
2. In Vercel, choose **Add New > Project**.
3. Import the GitHub repo.
4. Keep the default Next.js build settings:

```bash
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

5. Add these Vercel environment variables:

```bash
NEXT_PUBLIC_CONVEX_URL=...
CONVEX_DEPLOYMENT=...
OWNER_ANALYTICS_KEY=...
ANALYTICS_IP_SALT=...
```

6. Set the same `OWNER_ANALYTICS_KEY` in production Convex. Keep the E2E flag and secret unset there.
7. Deploy the matching Convex functions with `npx convex deploy --typecheck enable`, then deploy Next.js. For the existing project, use `vercel --prod --yes` and alias its URL to `fish-bowl-game.vercel.app`. The live frontend must use production Convex, not development.

## Owner Analytics

The app records lightweight analytics events such as page views, games created, players joined, games started, turns, correct/skip actions, and finished games. It avoids login and does not collect player emails or accounts.

Game settings such as play mode, prompt mode, categories, player count, team count, and prompt/card count are only attached to analytics once the host actually starts a game. Setup-screen changes are treated as drafts, not played-game data.

On Vercel, analytics also stores approximate IP-derived location fields from request headers:

- `country`
- `region`
- `city`
- `ip_hash`

The IP hash uses `ANALYTICS_IP_SALT`, so you can spot repeat networks without storing raw IP addresses.

Set matching `OWNER_ANALYTICS_KEY` values in each frontend/backend environment (local with development Convex; Vercel production with production Convex), then open:

```bash
/owner/analytics?key=YOUR_OWNER_ANALYTICS_KEY
```

For production, use `https://fish-bowl-game.vercel.app/owner/analytics?key=YOUR_OWNER_ANALYTICS_KEY`. Keep the real key in `.env.local`, Vercel env vars, or a password manager.

Use the **Ignore this device** control on the owner dashboard from any browser or phone you do not want counted. It stores a local opt-out flag in that browser only. The dashboard also shows an opt-out link you can open once in Chrome, Safari, your phone, or any other browser to set that flag before testing.

Use the **Purge data** button on the owner dashboard to permanently clear test games, players, prompts, turns, draft cards, game events, and analytics. It requires typing `DELETE ALL DATA`. This clears all records, including real games, so do not use it as test-only cleanup.

Optional email notifications can be enabled with Resend:

```bash
RESEND_API_KEY=...
OWNER_NOTIFY_EMAIL=you@example.com
OWNER_NOTIFY_FROM=Fish Bowl <onboarding@resend.dev>
ANALYTICS_NOTIFY_EVENTS=game_started
```

`ANALYTICS_NOTIFY_EVENTS=game_started` enables notifications for verified, deduplicated starts. Anonymous page views and other unverified events never trigger an email.

## Debug Seed

For fake players and prompts, make sure `.env.local` has:

```bash
NEXT_PUBLIC_CONVEX_URL=...
E2E_TEST_SECRET=...
```

Then run:

```bash
npm run debug:seed
```

The script prints a join code and game path, and saves the private recovery code in a temporary `session.json` file with mode 0600. Use that code to recover the seeded host. The development E2E flag and secret described above must also be configured.

## Card Review Pipeline

To generate new category card candidates from Wikidata and Wikipedia:

```bash
npm run cards:review
```

This writes:

- `card-review/category-candidates.md` for human review.
- `card-review/category-candidates.json` for machine-readable backup.

Review the Markdown file directly. Leave `Status: KEEP` for cards you like, change it to `Status: DELETE` for cards you do not want, and edit `Title:`, `Description:`, or `Category:` as needed.

After review, apply the kept cards into the deck:

```bash
npm run cards:apply-reviewed
```

That writes `lib/category-expansion-deck.ts`, which is included in the starter deck.

## MVP Scope

Included:

- Host creates a game with a short join code.
- Players join by code or QR link.
- Lobby, player list, and submission status update through Convex realtime queries.
- Players can edit names and submit prompts.
- Host can start once prompts exist.
- Prompts are shuffled into a shared deck.
- Active player sees one prompt and can mark Correct, Skip, or End turn.
- Score, turn state, and prompt state persist in Convex.
- Phone refresh keeps the private player session; a recovery code can restore it on another browser.
- Quick Start presets, validated custom setup, three rounds, pause/undo, score correction, and same/fresh-bowl rematches.
- Convex enforces host and clue-giver permissions, private cards and turn deadlines.

Not included yet:

- User accounts, moderation, custom deck libraries, payments, native app, image/audio prompts, or a polished animation system.
