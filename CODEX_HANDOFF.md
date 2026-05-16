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
- Supabase project: `fish-bowl`
- Supabase ref: `gmchqcpllgleyfjnxuit`
- Supabase dashboard: `https://supabase.com/dashboard/project/gmchqcpllgleyfjnxuit`

Keep Fish Bowl infrastructure separate from Deceit Street. Do not use Deceit Street Supabase for this app: `deceit-street / pmtkuxdktwzmeyinyola`.
Before running Supabase schema/admin commands from this repo, run `npm run supabase:verify` and confirm the target ref is `gmchqcpllgleyfjnxuit`.

## Config And Secrets

Safe-to-document env var names:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OWNER_ANALYTICS_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANALYTICS_IP_SALT`
- `RESEND_API_KEY`
- `OWNER_NOTIFY_EMAIL`
- `OWNER_NOTIFY_FROM`
- `ANALYTICS_NOTIFY_EVENTS`

Local ignored secret/config files:

- `.env.local`
- `.env.*.local`
- `.vercel/`

Secrets belong in local ignored env files, Vercel/Supabase dashboards, or a password manager. Never put real secret values in GitHub, Notion, README files, or this handoff file.

## Useful Commands

```bash
npm install
npm run dev -- --hostname 0.0.0.0
npm run lint
npm run supabase:verify
npm run test:e2e
npm run build
vercel --prod --yes
vercel alias set <deployment-url> fish-bowl-game.vercel.app
```

End-to-end testing uses Playwright with one headless Chromium worker by default. Run `npx playwright install chromium` once on a new machine, then `npm run test:e2e`. Use `npm run test:e2e:headed` or `npm run test:e2e:ui` only when you want to watch/debug the browser. Coverage includes host-only Pass & Play setup/gameplay, second-browser joining/realtime, refresh/rejoin identity, round transition, and clue-giver rotation for even and uneven teams. Test-created Supabase games are cleaned up when `.env.local` has Supabase env vars.

Card deck target-fill review artifacts live in `card-review/target-fill/`. After review Markdown is updated, run `npm run cards:apply-target-fill` to regenerate `lib/target-fill-deck.ts` from cards still marked Keep in `candidates.json`; the generated deck is wired into `STARTER_DECK`, and family-friendly additions are included in the family-friendly filter.

Private owner analytics lives at `/owner/analytics?key=<OWNER_ANALYTICS_KEY>`. It records Vercel geo headers and a salted IP hash. The dashboard has an "Ignore this device" browser-local opt-out for Austin's own devices and a confirmed "Purge data" control for clearing test data. Optional owner email notifications use Resend env vars. Keep keys only in ignored env files, Vercel env vars, or a password manager.

## Source Of Truth

- GitHub/repo files are source of truth for code.
- Notion's main Fish Bowl page is the project map and status log, not a secret vault.
- `CODEX_HANDOFF.md` is a short, stable onboarding map. Do not use it as a changelog.

## Thread Workflow

- Read this file first in every new Fish Bowl task thread.
- Check `git status --short --branch` before editing.
- Keep changes scoped to the requested task.
- Run `npm run lint` and `npm run build` before committing/deploying when code changes.
- Run `npm run test:e2e` when game flow, setup/lobby behavior, or user-facing controls change.
- Commit useful completed work to `main`, push to GitHub, deploy to Vercel when the user wants the live app updated.
- After deployment, keep `https://fish-bowl-game.vercel.app` pointed at the newest production deployment.

## When To Update Things

- Update GitHub for code, schema, docs, scripts, and handoff changes.
- Update the main Fish Bowl Notion page for task summaries, infrastructure changes, URL changes, and current project status.
- Update this file and Notion if local folder paths, live URLs, hosting project, Supabase project/ref, or secret-file locations change.
