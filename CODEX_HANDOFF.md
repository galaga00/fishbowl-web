# Fish Bowl Codex Handoff

Start new task threads with:

> This thread is dedicated to <task>. Please read CODEX_HANDOFF.md in this repo before doing anything.

## Project Map

- Project name: Fish Bowl
- Local repo path: `/Volumes/2TB_RED/_MY_PROJECTS_/codex/Fish Bowl/local`
- Source artwork path: `/Volumes/2TB_RED/_MY_PROJECTS_/codex/Fish Bowl/source`
- GitHub repo: `https://github.com/galaga00/fishbowl-web`
- Notion project page and task log: `https://www.notion.so/3541b2ce282781669d76f43df062d2de`
- Live app: `https://fish-bowl-game.vercel.app`
- Hosting: Vercel project `fish-bowl`
- Vercel Codex connector team id: `galaga00` (personal account; CLI/project file may show `galaga00s-projects` or `team_hFZ3gCQdUOng9qLj5zSbjZVQ`)
- Active backend: Convex project `austin-hill:fish-bowl`
- Convex production deployment: `quaint-mink-705`
- Convex production URL: `https://quaint-mink-705.convex.cloud`
- Convex dev deployment: `ardent-lemming-605`
- Convex dev URL: `https://ardent-lemming-605.convex.cloud`
- Convex prod dashboard: `https://dashboard.convex.dev/t/austin-hill/fish-bowl/quaint-mink-705`
- Convex dev dashboard: `https://dashboard.convex.dev/t/austin-hill/fish-bowl/ardent-lemming-605`
Keep Fish Bowl infrastructure separate from Deceit Street and ElectricSkill. Do not reuse another app's Convex deployment.

## Config And Secrets

Safe-to-document env var names:

- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `OWNER_ANALYTICS_KEY`
- `E2E_TEST_SECRET` (development only)
- `FISH_BOWL_E2E_ENABLED` (development only)
- `ANALYTICS_IP_SALT`
- `RESEND_API_KEY`
- `OWNER_NOTIFY_EMAIL`
- `OWNER_NOTIFY_FROM`
- `ANALYTICS_NOTIFY_EVENTS`

Local ignored secret/config files:

- `.env.local`
- `.env.*.local`
- `.vercel/`

Secrets belong in local ignored env files, Vercel/Convex dashboards, or a password manager. Never put real secret values in GitHub, Notion, README files, or this handoff file.

## Useful Commands

```bash
npm install
npm run dev -- --hostname 0.0.0.0
npx convex dev --once --typecheck enable
npm run lint
npm run test:e2e
npm run build
npx convex deploy --typecheck enable
vercel --prod --yes
vercel alias set <deployment-url> fish-bowl-game.vercel.app
```

End-to-end testing uses Playwright with one headless worker. Run `npx playwright install chromium webkit` once on a new machine, then `npm run test:e2e`. Chromium covers the game suite; a focused WebKit iPhone project checks setup layout. Use `npm run test:e2e:headed` or `npm run test:e2e:ui` only when you want to watch/debug the browser. Coverage includes host-only Pass & Play setup/gameplay, second-browser joining/realtime, refresh/rejoin identity, round transition, and clue-giver rotation for even and uneven teams. Test-created Convex games are cleaned up through guarded E2E helpers on the named dev deployment only. Both `E2E_TEST_SECRET` and `FISH_BOWL_E2E_ENABLED=true` must be set in development Convex; keep both unset in production. The suite also covers access protection, private cards, capacity, quick start, a complete three-round game, timer races, recovery, undo, rematches and responsive controls. Setup regression checks sweep 320–1440px and 125–200% text sizes, checking text containment rather than only page overflow.

Card deck target-fill review artifacts live in `card-review/target-fill/`. After review Markdown is updated, run `npm run cards:apply-target-fill` to regenerate `lib/target-fill-deck.ts` from cards still marked Keep in `candidates.json`; the generated deck is wired into `STARTER_DECK`, and family-friendly additions are included in the family-friendly filter.

The matching Vercel and Convex deployments must share `OWNER_ANALYTICS_KEY`; owner functions and analytics writes fail closed without it. Room sessions use private browser-held recovery codes and hashed backend credentials. Rooms predating `access_version: 2` are retired and require a new game; do not restore public-ID seat claiming. See [Foundation behavior and deployment](docs/FOUNDATION.md).

Private owner analytics lives at `/owner/analytics?key=<OWNER_ANALYTICS_KEY>`. It records Vercel geo headers and a salted IP hash. The dashboard has an "Ignore this device" browser-local opt-out for Austin's own devices and a confirmed "Purge data" control for clearing all game and analytics data. Purge requires typing `DELETE ALL DATA`; it is not limited to test games. Optional owner email notifications use Resend env vars. Keep keys only in ignored env files, Vercel env vars, or a password manager.

## Source Of Truth

- Host setup offers V1 — Original and V2 — Improved; V2 is the default for every new room. V2 first asks the host to choose Quick game or Custom game; the full prompt-writing and team wizard is under Custom game. `game_version` is stored per room and is independent of security's `access_version`. Missing versions resolve to V2, and the choice locks when setup ends. Both presentations share the protected engine. See [Game versions](docs/GAME_VERSIONS.md) for differences and deployment compatibility.

- GitHub/repo files are source of truth for code.
- V2 Custom game's written prompts suggest a contribution near 40 total cards from the selected player count (six players: seven each). A manual prompt-count edit stops automatic changes; lobby creation saves the count, which joins, refresh, and rematches retain. Quick presets and deck drafting keep their existing counts. See `docs/GAME_VERSIONS.md`.
- Notion's main Fish Bowl page is the project map and status log, not a secret vault.
- `CODEX_HANDOFF.md` is a short, stable onboarding map. Do not use it as a changelog.

## Thread Workflow

- Read this file first in every new Fish Bowl task thread.
- Check `git status --short --branch` before editing.
- Keep changes scoped to the requested task.
- Run `npm run lint` and `npm run build` before committing/deploying when code changes.
- Run `npx convex dev --once --typecheck enable` when Convex functions/schema change.
- Run `npm run test:e2e` when game flow, setup/lobby behavior, or user-facing controls change.
- Keep substantial changes and follow-up fixes on a `codex/` branch, commit and push there, and provide a tested preview before merging or deploying production. Austin requested this review stage after the foundation rollout. Use development Convex for preview testing. Merge to `main` and update the live app after Austin approves that rollout.
- After deployment, keep `https://fish-bowl-game.vercel.app` pointed at the newest production deployment.

## When To Update Things

- Update GitHub for code, schema, docs, scripts, and handoff changes.
- Update the main Fish Bowl Notion page for task summaries, infrastructure changes, URL changes, and current project status.
- Update this file and Notion if local folder paths, live URLs, hosting project, backend project/deployment, or secret-file locations change.
