# Game versions

After Create Game, the host can open Change in the Version panel. V2 — Improved is the default for new rooms. V1 — Original restores the presentation from `b3d9481`, with current safety and reliability fixes. Choosing a version preserves the room, code, custom setup entries, and Quick Start draft. Unsaved form drafts are not persisted across a page reload.

| Behavior | V1 | V2 |
| --- | --- | --- |
| Setup | Four-step wizard | Wizard and Quick Start |
| Turn layout | Original card/timer arrangement and round details | Added player, round, and progress context |
| Extra host controls | Expanded | Collapsed under More host controls |
| Edit setup in lobby | Hidden | Available |
| Finished game | Reset to lobby with the same bowl | Same-bowl or fresh-bowl rematch |

Both use the same protected game engine: session authorization, private cards, authoritative deadlines, pause/recovery, capacity validation, inline errors/confirmations, and accurate results. These are presentation variations, not isolated historical runtimes. Git backup branches remain the full-code recovery path.

## Room contract

- `games.game_version` is an optional `"v1" | "v2"` field. New rooms store V2 explicitly. Room snapshots normalize a missing value to V2 without a database backfill. `access_version` continues to govern security; retired legacy rooms remain retired.
- `game:setGameVersion({ gameId, sessionToken, gameVersion })` requires the room's host session and `phase === "setup"`. Invalid versions, guests, cross-room sessions, and changes after setup are rejected. A repeated same-version request during setup is harmless.
- The selector disappears once setup creates the lobby, including Quick Start. A host label remains. Rematches retain the version and cannot unlock selection. Create a new room to change versions.
- Guest devices use the version in the room snapshot. Invite URLs, QR codes, join codes, and browser session keys do not change. Guests do not see the selector or host version label.
- Keep future presentation versions in the shared version registry and explicitly validate them server-side. Never reuse `access_version` for visual/gameplay variants.

## Release and compatibility

Deploy the additive Convex schema/functions first, then the frontend. No new backend, scheduled jobs, credentials, or persistent resources are needed. Older clients continue to operate; the new selector requires the new backend mutation. Test on development Convex and publish the production pair only after Austin approves the phone preview.

The `game-versions` tests run in Chromium and the WebKit phone project, covering permission/phase enforcement, missing-version compatibility, form preservation, failed-save recovery, link/code joins, refresh/continue, a complete V1 game and rematch, and responsive choices. The existing foundation suite covers V2 play/rematches and shared security/timer/recovery invariants.
