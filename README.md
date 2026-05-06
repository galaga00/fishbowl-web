# Fish Bowl

A mobile-first Next.js + TypeScript party guessing game. Players join a hosted room from phones, submit or draft prompts, and take turns marking prompts correct or skipped.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project at https://supabase.com.
3. In Supabase, open **SQL Editor**, create a new query, paste the full contents of `supabase/schema.sql`, and run it.
4. In Supabase, open **Project Settings > API** and copy the project URL and anon public key.
5. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

6. Fill in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OWNER_ANALYTICS_KEY=make-a-private-random-key
```

7. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase Notes

The MVP intentionally has no login. For local testing, `supabase/schema.sql` disables row level security so browsers can read and write game state with the anon key.

Before sharing the app publicly, add proper Row Level Security policies or move sensitive game mutations behind server routes. The current setup is meant for fast party-game prototyping.

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
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OWNER_ANALYTICS_KEY=...
```

6. Deploy.

## Owner Analytics

The app records lightweight analytics events such as page views, games created, players joined, setup saved, games started, turns, correct/skip actions, and finished games. It avoids login and does not collect player emails or accounts.

Set `OWNER_ANALYTICS_KEY` locally and in Vercel, then open:

```bash
/owner/analytics?key=YOUR_OWNER_ANALYTICS_KEY
```

For production, use `https://fish-bowl-game.vercel.app/owner/analytics?key=YOUR_OWNER_ANALYTICS_KEY`. Keep the real key in `.env.local`, Vercel env vars, or a password manager.

If you use the debug seed script locally, keep `SUPABASE_SERVICE_ROLE_KEY` out of browser-facing code. It is optional and should only be added to trusted local or server environments.

## Debug Seed

For fake players and prompts, add this to `.env.local`:

```bash
SUPABASE_SERVICE_ROLE_KEY=...
```

Then run:

```bash
npm run debug:seed
```

The script prints a join code and game URL. The seeded game starts in the lobby so you can test starting a round from the UI.

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
- Lobby, player list, and submission status update through Supabase Realtime.
- Players can edit names and submit prompts.
- Host can start once prompts exist.
- Prompts are shuffled into a shared deck.
- Active player sees one prompt and can mark Correct, Skip, or End turn.
- Score, turn state, and prompt state persist in Supabase.
- Phone refresh keeps player identity through local storage.

Not included yet:

- Login/auth, moderation, custom deck libraries, payments, native app, image/audio prompts, or a polished animation system.
