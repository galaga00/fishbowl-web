# Game versions

After Create Game, the host can open Change in the Version panel. V2 — Improved is the default for new rooms. V1 — Original restores the presentation from `b3d9481`, with current safety and reliability fixes. Choosing a version preserves the room, code, custom setup entries, and Quick Start draft. Unsaved form drafts are not persisted across a page reload.

| Behavior | V1 | V2 |
| --- | --- | --- |
| Setup | Four-step wizard | Explicit Quick game / Custom game choice |
| Turn layout | Original card/timer arrangement and round details | Added player, round, and progress context |
| Extra host controls | Expanded | Collapsed under More host controls |
| Edit setup in lobby | Hidden | Available |
| Finished game | Reset to lobby with the same bowl | Same-bowl or fresh-bowl rematch |

Both use the same protected game engine: session authorization, private cards, authoritative deadlines, pause/recovery, capacity validation, inline errors/confirmations, and accurate results. These are presentation variations, not isolated historical runtimes. Git backup branches remain the full-code recovery path.

## V2 setup choices

During initial setup, the host chooses Quick game or Custom game beneath the version selector. Neither is selected initially. Quick game opens the existing Classic, Quick, and Family presets; Custom game opens the full wizard with written prompts, category prompts, deck drafting, teams, and timer settings. Both choices remain visible while configuring the room.

Switching paths or versions preserves each form's entries and the wizard step within the page. Inactive forms stay mounted but hidden from view and keyboard navigation. Choice controls are disabled during saves and starts. Reloading initial setup returns to the chooser; unsaved drafts keep their existing non-persistent behavior. Editing setup from the lobby opens the populated custom wizard directly. These choices are local UI state, not a new room setting.

## Written prompt counts

V2 Custom game suggests an equal contribution near a 40-card bowl: round `40 / playerCount`, bounded to 1–20 prompts per player. Six players get seven prompts each (42 cards). Everyone joins uses Expected players; Pass & Play uses its configured roster size. With no expected count, the existing three-prompt fallback remains and the UI explains how to get a suggestion. Very large groups can exceed 40 cards because everyone contributes at least one.

The suggestion follows player-count and phone-mode changes during initial V2 setup until the host manually edits Prompts per player. Manual choices survive path, mode, and version switches. V1 retains its original default; switching into V2 applies a suggestion only if the host has not edited the count. The prompt field shows the projected total and explains that the same bowl is used in all three rounds; Review also shows the total.

Creating the lobby saves the contribution count using the existing game setting. Joins, refresh, continuing a game, and rematches never recalculate it. Explicit Edit setup loads that saved count and disables automatic suggestions; saving edited setup retains the existing warning and clears prepared cards. Quick game presets, deck drafting, and built-in Pass & Play card counts are unchanged by this feature.

## Room contract

- `games.game_version` is an optional `"v1" | "v2"` field. New rooms store V2 explicitly. Room snapshots normalize a missing value to V2 without a database backfill. `access_version` continues to govern security; retired legacy rooms remain retired.
- `game:setGameVersion({ gameId, sessionToken, gameVersion })` requires the room's host session and `phase === "setup"`. Invalid versions, guests, cross-room sessions, and changes after setup are rejected. A repeated same-version request during setup is harmless.
- The selector disappears once setup creates the lobby, including Quick Start. A host label remains. Rematches retain the version and cannot unlock selection. Create a new room to change versions.
- Guest devices use the version in the room snapshot. Invite URLs, QR codes, join codes, and browser session keys do not change. Guests do not see the selector or host version label.
- Keep future presentation versions in the shared version registry and explicitly validate them server-side. Never reuse `access_version` for visual/gameplay variants.

## Release and compatibility

Deploy the additive Convex schema/functions first, then the frontend. No new backend, scheduled jobs, credentials, or persistent resources are needed. Older clients continue to operate; the new selector requires the new backend mutation. Test on development Convex and publish the production pair only after Austin approves the phone preview.

The `game-versions` tests run in Chromium and the WebKit phone project, covering permission/phase enforcement, missing-version compatibility, form preservation, failed-save recovery, link/code joins, refresh/continue, a complete V1 game and rematch, and responsive choices. The existing foundation suite covers V2 play/rematches and shared security/timer/recovery invariants.

## Category vote (V2)

Custom game → Everyone joins → Category vote lets the group choose a secret built-in bowl through one to three rounds of three random categories. The server builds the bowl automatically after voting; no private hand reveals the mix. See [CATEGORY_VOTING.md](CATEGORY_VOTING.md) for privacy, validation, late join, and rematch behavior. V1 and the existing written/draft/Quick paths are unchanged.
