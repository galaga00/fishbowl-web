# Fish Bowl Codex Handoff

Start new task threads with:

> This thread is dedicated to <task>. Please read CODEX_HANDOFF.md in this repo before doing anything.

## Project Map

- Project name: Fish Bowl
- Local repo path: `/Volumes/2TB_RED/_MY_PROJECTS_/codex/fish-bowl`
- GitHub repo: `https://github.com/galaga00/fishbowl-web`
- Notion project page: `https://www.notion.so/3541b2ce282781669d76f43df062d2de`
- Live app: `https://fish-bowl-game.vercel.app`
- Hosting: Vercel project `fish-bowl`
- Supabase project: `monikers-web`
- Supabase ref: `gmchqcpllgleyfjnxuit`
- Supabase dashboard: `https://supabase.com/dashboard/project/gmchqcpllgleyfjnxuit`

Keep Fish Bowl infrastructure separate from Deceit Street. Do not use Deceit Street Supabase for this app: `deceit-street / pmtkuxdktwzmeyinyola`.

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
npm run build
vercel --prod --yes
vercel alias set <deployment-url> fish-bowl-game.vercel.app
```

Private owner analytics lives at `/owner/analytics?key=<OWNER_ANALYTICS_KEY>`. It records Vercel geo headers and a salted IP hash. Optional owner email notifications use Resend env vars. Keep keys only in ignored env files, Vercel env vars, or a password manager.

## Source Of Truth

- GitHub/repo files are source of truth for code.
- Notion is the project map and status log, not a secret vault.
- `CODEX_HANDOFF.md` is a short, stable onboarding map. Do not use it as a changelog.

## Thread Workflow

- Read this file first in every new Fish Bowl task thread.
- Check `git status --short --branch` before editing.
- Keep changes scoped to the requested task.
- Run `npm run lint` and `npm run build` before committing/deploying when code changes.
- Commit useful completed work to `main`, push to GitHub, deploy to Vercel when the user wants the live app updated.
- After deployment, keep `https://fish-bowl-game.vercel.app` pointed at the newest production deployment.

## When To Update Things

- Update GitHub for code, schema, docs, scripts, and handoff changes.
- Update Notion for task summaries, infrastructure changes, URL changes, and current project status.
- Update this file and Notion if local folder paths, live URLs, hosting project, Supabase project/ref, or secret-file locations change.
