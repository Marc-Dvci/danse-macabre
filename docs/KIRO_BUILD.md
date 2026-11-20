# How Kiro built the engine

The notation engine (`packages/core`), its tests, the MCP server (`packages/mcp`) and the Kiro power were built by
the Kiro CLI, driven headless (`kiro-cli chat --no-interactive --output-format stream-json`) with the custom agents in
`.kiro/agents`. Each run was given one spec; Kiro wrote the spec's design and tasks, then the code and tests, and
ended with a report (what was done, decisions, what is not true yet, questions). I answered its questions by
changing the requirements, never by asking it to weaken a test.

The table is computed from Kiro's own event stream for each run (session id, credits metered by Kiro, files written by
its file tools). The builder ran on Claude Haiku 5.5 in Kiro; the independent review ran on Qwen3 Coder Next.

| Run | Model | Minutes | Credits | Files written | Kiro session |
|---|---|---|---|---|---|
| 00-smoke | claude-haiku-5.5 | 0 | 0.04 | 1 | `sess_210e001b-eec9-4e68-bf16-65ddfbb127e5` |
| 01-laban-core | claude-haiku-5.5 | 12 | 6.00 | 28 | `sess_26562950-0eba-4070-bacb-268c6cd3dcd6` |
| 02-core-fixes | claude-haiku-5.5 | 12 | 6.83 | 17 | `sess_53c36940-86d6-4a43-b31f-da109e379b56` |
| 02b-core-moves | claude-haiku-5.5 | 11 | 5.35 | 14 | `sess_b1fce3eb-1b4e-4cbd-9454-a3ed31c0959e` |
| 02c-holds | claude-haiku-5.5 | 5 | 0.48 | 5 | `sess_83680fe4-9987-44ec-9def-81d208db431d` |
| 02d-hold-start | claude-haiku-5.5 | 4 | 0.50 | 6 | `sess_ddde46a5-ffa5-483a-9e9a-6d2cd675c3e8` |
| 02e-hold-end | claude-haiku-5.5 | 6 | 0.50 | 4 | `sess_6d00b847-6e4a-4b74-ba76-0ce4085c6c3d` |
| 03-supports | claude-haiku-5.5 | 22 | 17.29 | 24 | `sess_3844ddbc-ceb2-4349-8381-5d6c6cad1670` |
| 04-lesson-layout | claude-haiku-5.5 | 13 | 6.94 | 19 | `sess_efdc9f4d-f595-4a72-8378-7536c3292335` |
| 05-mcp | claude-haiku-5.5 | 10 | 4.96 | 28 | `sess_65564fe1-2cf4-4a25-8870-c7e1360fcd52` |
| 06-fidelity | claude-haiku-5.5 | 5 | 0.94 | 12 | `sess_e6e73550-0213-4253-92af-0a130552456d` |
| 07-turns-words | claude-haiku-5.5 | 10 | 5.63 | 16 | `sess_d65722db-5fe6-4842-9575-176ba6df4413` |
| 08-review | qwen3-coder-next | 3 | 1.38 | 0 | `sess_59ebe71b-2364-4d08-bc5e-c4e20a1bf3d4` |
| 09-choreographer, first take | claude-haiku-5.5 | 1 | 0.07 | 0 | `sess_80877fcc-f928-430b-a82a-fad981bee097` |
| 09-choreographer, recorded | claude-haiku-5.5 | 1 | 0.05 | 1 | `sess_37c4b357-be5c-4dd7-8042-ee59a73ef0fe` |
| **Total** | | | **56.95** | 108 distinct | |

The choreographer ran in a terminal, through the dance MCP server, for the film: it composed a two-bar phrase with
`compose_score`, checked it with `validate_score`, saved `examples/curtain-call.score.json` and read the lesson back with
`describe_score`; the `render-saved-score` hook then drew `curtain-call.svg` and wrote `curtain-call-lesson.txt`. Its
first take stopped at a tool approval, so the recorded take trusts the four dance tools by name. Its two rows are read
from Kiro's own session log (`~/.kiro/sessions`), in the same units.

Files in this repository that Kiro wrote or edited (105):

- `.kiro/specs`: 10 files
- `docs`: 1 file
- `examples`: 2 files
- `packages/core`: 67 files
- `packages/mcp`: 22 files
- `power`: 3 files

## Questions Kiro raised, and what changed

| Run | Kiro found | Decision |
|---|---|---|
| 01 | The round-trip property failed: the 60 deg/s movement rule could not see a slow move, and the leg-lift rule contradicted the property's own domain | Movement found from cell changes and speed minima; lift measured against the other ankle |
| 02 | A move sweeping through a neighbouring direction was written twice; sector boundaries were not mirror-symmetric; in the real Macarena the left arm moves first | One symbol per move, for the cell where the limb settles; a boundary goes to the sector farther from forward; the order is reported, not asserted |
| 02b | Real dancers sway while holding a position, so the Macarena gave only four arm symbols | Holds (8 degrees for 0.35 s) count as rests |
| 02c, 02d | Holds swallowed the slow start and end of eased moves | A hold starts and ends only below 5% of the neighbouring move's peak speed |
| 03 | Step levels drifted with the dance's own median height; steps read 45 degrees off during fast turns | Standing height from the body's proportions; step direction in the facing at the notated start |
| 06 | The fidelity measure showed real dances far from their scores | Rests at any real dip in speed (10% below both peaks, 0.1 s smoothing); leg gestures judged where the leg arrives; average replay error from 40.1 to 23.5 degrees |
| 07 | Phrase search dropped a valid match when a turn sat inside the phrase (found by its own property test) | Fixed in the same run |
