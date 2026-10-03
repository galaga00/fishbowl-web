# Secret category voting

V2 Custom game → Everyone joins → Prompts → Category vote creates an automatically filled built-in bowl. The host does not curate the category pool. Everyone, including the host, joins on their own phone. The existing written prompts, category prompts, private deck draft, Quick presets, and V1 wizard remain available.

Default: **40 cards, three categories**. The host may choose 10–80 cards and one to three categories. Each category needs one voting round. Voting uses the full built-in library, not the Family Friendly filter; the setup explains where to choose an all-ages bowl instead. Pass & Play has an explicit “Use category voting” action that changes to Everyone joins, with explanatory copy.

## Flow

1. Create the lobby and let everyone join by its existing code, link, or QR.
2. The host starts the vote (at least two joined players). An inline confirmation handles fewer players than expected. This freezes the voting roster; existing sessions can reconnect during voting. New participants may join after voting completes.
3. Everyone sees the same three randomly chosen categories. One tap submits and locks a private vote. Only the viewer’s own selection and total participation are shown; there are no category tallies or winner announcements.
4. The server advances atomically when all eligible players vote. If someone is absent, the host may close the current round with an inline confirmation and at least one cast vote. Ties are random. Missing voters may participate in later rounds.
5. After the final vote, the server automatically fills the bowl evenly across winning categories (counts differ by at most one). The host starts gameplay when teams are ready. Cards are private until shown to the active clue giver.

Each round has three fresh categories, with no nominees repeated during that vote. Disjoint ballots prevent later nominations from revealing an earlier winner. Only categories with enough unique cards for their possible share are eligible. No host-selected pool, drafting step, or results reveal is added.

Setup is locked during active voting. Saved voting settings survive refresh and Edit setup. Unsaved initial forms retain the existing behavior: path/version switches preserve entries, a reload resets drafts. V1 ignores the local vote selection and cannot save a voting room.

## Server contract and privacy

Additive optional fields on the existing `games` table:

- `deck_selection`: `draft` (legacy/default behavior) or `vote` (V2 + multi_device + deck only).
- `vote_card_count`, `vote_category_count`: bounded settings.
- `category_vote`: **private** vote revision ID, status, round, full ballots, winners, frozen voter IDs, and current votes. `toGame` strips the entire object, including from create/join responses and anonymous snapshots.

Authenticated `loadSnapshot` exposes a separate `categoryVote`: status, current round/count, current choices only, total participation, vote revision ID, and the viewer’s own vote. Anonymous viewers receive no ballot. Completed votes expose no choices or selections. Winning categories never enter public `prompt_categories`, draft hands, or analytics; hidden prompts retain redacted text/description/category.

Mutations:

- `startCategoryVoting`: host session, lobby, supported setup, current match; repeat starts do not reroll.
- `castCategoryVote`: room session, frozen voter membership, supported choice, current match/vote/round. Repeated submissions within the same ballot do not add votes or change a locked choice.
- `closeCategoryVoteRound`: host session, same revision checks, at least one vote. Late requests cannot close the next ballot.

All transitions and bowl writes are transactional Convex mutations. No timer, polling loop, scheduled job, new table/deployment, credential, or paid resource is introduced. Existing old rooms/clients retain their default behavior; use the new preview URL for every participant testing a voting room.

## Rematches and recovery

- Same bowl retains the private chosen mix and already prepared cards; no repeat voting.
- Fresh bowl removes the vote state and cards, increments the existing match revision, and allows a new vote. Unseen cards from the prior match are preferred within each winning category before repeats.
- Refresh/rejoin preserves the current ballot and submitted selection. Old ballot and old match requests are rejected. Host close-round control handles absent phones without exposing votes.
- Editing setup outside active voting clears the prepared bowl/vote, as disclosed by the existing setup warning.

## Verification and release

Tests cover privacy for host/guests/anonymous viewers and join replies, unauthorized/cross-room requests, duplicate and concurrent votes, stale round/match actions, random ties, missing-player closure, capacity/balance, 2/3/6/12-player groups, three full gameplay rounds with accurate totals, and same/fresh rematches. Browser coverage includes link/code joins, failed-save retry, refresh, keyboard voting, path/version switching, populated lobby editing, 320/390/820/1440 widths and 100/200% text in Chromium and WebKit.

The phone checks also cover the shared lobby join link and roster wrapping. Hosted testing exposed a pre-hydration first-tap race on the home menu; Create/Join/How to Play now remain disabled until the client is ready, with a delayed-bundle regression test. Voting temporarily hides the host’s invite panel and focuses each new ballot heading so the current action stays reachable on phones.

Deploy additive schema/functions to development first, then the combined Vercel preview with development Convex. Commit/push `codex/category-voting` on top of `codex/prompt-count-defaults`; keep the original backup branches and stacked PRs. Production remains at the foundation release until Austin approves the phone preview. After approval, deploy the corresponding additive backend to production and rebuild the frontend with the production Convex URL; do not promote a development-backend preview directly.
