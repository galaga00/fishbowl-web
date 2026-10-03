# Fish Bowl foundation

## Player access and privacy

New rooms use `access_version: 2`. Creating or joining a room generates a private 256-bit session token before the request. The browser saves it per room; Convex stores only its SHA-256 hash. Retrying a create/join request with the same token is idempotent. Player IDs and names are not credentials.

Refresh restores the same player automatically. The home page offers Continue my game. To move to another browser, use the private recovery code from the original browser's room details. Treat that code as a password: anyone with it can act as that player. A room code permits a new lobby join, not takeover of an existing player. Joins close when play begins.

Convex authorizes every gameplay mutation. Hosts manage setup, scores, resets, pause and undo; the current clue giver controls the live card. The host controls all turns in Pass & Play. Team/player targets must belong to the same room. Requests carry the expected match and turn identity, so a stale click cannot act on a later turn or rematch.

Room previews expose no player lists, hands or card text. A verified player sees their own lobby hand and submissions. During play, only the turn controller receives the active card text. Other cards remain redacted. Public undo metadata contains no historical card payload or session hash.

**Migration:** rooms created before version 2 cannot be securely claimed using the old public player IDs. They are retired in the UI and must be replaced with a new game. Existing records remain; this release does not purge production data.

## Setup and quick start

The custom wizard checks actual unique deck capacity before review/save. Impossible selections explain the available count and offer concrete fixes. Review advances to a separate final step; it does not submit the form. Lobby hosts can reopen setup, with a clear warning that saving resets submissions and draft hands. Changing play mode may require players to rejoin.

Quick Start offers Classic (40 cards, 60 seconds), Quick (20 cards, 30 seconds) and Family (30 cards, 60 seconds), with two teams sharing one phone. Custom setup remains available for names, multiple devices and the other options.

All game errors and confirmations appear inside the page. No native `alert` or `confirm` dialogs are used. Start readiness explains missing cards/players before a start attempt.

## Turns, timing and undo

The turn screen keeps the clue giver, team, round rule, current card, timer and primary controls together. Pausing hides the card and preserves the remaining time across refresh. Optional host controls are collapsed.

The server uses the stored turn start and duration to reject points at/after the deadline. Clients synchronize their clock through a one-shot authenticated mutation on entry, reconnect and return to the page. Query timestamps order snapshots; they are not used as clock samples because reactive queries may be cached.

Any verified room member can request an expired turn handoff. Early handoff still requires the controller. Expiry retries are bounded, and a visible retry action appears after failure. No scheduled worker or recurring server poll is required. If every browser is offline, the stored phase may remain playing until a client reconnects; this never permits late scoring.

Undo restores one paused turn, closes newer active turns, and preserves its recorded remaining time. Manual score corrections invalidate incompatible undo snapshots. Rematches clear undo history and increment the match number.

## Rematches

The finish screen distinguishes a completed game from one the host ended early and handles tied scores. Play again with the same bowl or request fresh cards. Fresh Pass & Play bowls and multiplayer draft hands prioritize cards outside the previous bowl; a small selected category may require repeats. Free/category prompt modes clear submissions for new contributions.

## Owner operations and deployment

Set the same `OWNER_ANALYTICS_KEY` in Vercel and the matching Convex deployment. Owner queries, analytics writes and purge fail closed without that key. Never print it or put it in tracked files. Owner purge requires typing `DELETE ALL DATA`; this deletes all room and analytics records, not just test data.

Game analytics requires a valid room session. Start events are checked against the actual game state and deduplicated per match. Only verified first start events may trigger the existing optional owner email notification.

Deploy Convex and Next.js together. Verify the production Convex URL is `https://quaint-mink-705.convex.cloud`, and keep development at `https://ardent-lemming-605.convex.cloud`. The schema additions are optional fields/indexes on existing tables. Do not roll back to the old unprotected API as a routine recovery measure.

E2E seeding and cleanup require both `FISH_BOWL_E2E_ENABLED=true` and `E2E_TEST_SECRET` in development Convex. Keep both unset in production. Local test clients and the debug seed script also reject any deployment other than the named development URL. Test cleanup only deletes its tracked games. Debug seed recovery credentials are written to a temporary file with mode 0600, not printed.

## Verification

On October 2, 2026, lint, Convex deployment/typecheck, Next.js production build, and all 32 headless Chromium E2E tests passed. Coverage includes backend access rejection, private hands/cards, cross-room requests, stale actions, capacity validation, review navigation, full three-round scoring, refresh/recovery, timer races, pause/undo, rematches and multiple browser contexts. Responsive checks cover 320, 390, 820 and 1440 pixel widths. Phone layout screenshots are captured by the foundation UI tests; this is browser emulation, not physical-device certification.

Run the complete game suite after future gameplay, setup, session or timing changes:

```bash
npm run lint
npx convex dev --once --typecheck enable
npm run build
npm run test:e2e
```
