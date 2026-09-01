# Translation export report — "הבהובי רעיונות: תעלומה בשכונה" (Flickering Lights)

**This is a refresh of a previous export.** Previous export was built from
commit `6ebb40b` (2026-08-24). Source has since moved to the current working
tree via commits `ee38447` … `3759fa7` (2026-08-26 through 2026-08-31),
made in a separate session outside this one. `git diff 6ebb40b HEAD --
index.html script.js assets/app/*.html` was read in full before rebuilding
this export — see "What changed since the previous export" below.

**Module type:** STEM lomda — **not** a 720-series module. Single `index.html` +
`script.js` + `styles.css`, no `{module-name}-{part}/` folder split, no
target/part numbering. Per the user's explicit instruction, the ID scheme
below was adapted for this shape rather than following the 720 `{target}-
{part}-{screen}-{string}` convention literally.

**ID scheme used:**
- Screen id: `FL-{screen}`, two digits. `FL-00` = module chrome (content
  outside every `.screen` section — here, the page `<title>` and one
  shared JS fallback string; there is no separate LMS-entry root page for
  this module, so no module-root-index chrome exists to fold in).
- Trans-unit id: `FL-{screen}-{string}`, three-digit sequential position
  **within that screen's own extraction order** (see "Document order across
  two files" below).

## Totals

- **Screens:** 30 (`FL-00` chrome + `FL-01`…`FL-29`, all 29 in-lomda screens,
  contiguous — `data-screen` still runs 1–29 with no gaps; **no screen was
  inserted, removed, or renumbered** since the previous export, confirmed by
  re-checking `TOTAL_SCREENS` and the full `data-screen` value set).
- **Translation units:** 549 (was 527 in the previous export — **+22 net**)
- **By source file:**
  - `index.html`: 394 (was 381, +13)
  - `script.js`: 128 (was 119, +9)
  - `assets/app/LIGHT_BOLB.html` (screen 12's embedded simulation): 23 (unchanged)
  - `assets/app/LOOSE_CONNECTION.html` (screen 18's embedded simulation): 4 (unchanged)
- **By screen:** see `translation-screen-manifest.csv` (`unit_count` column).

## What changed since the previous export (read from the real diff, not memory)

`git diff 6ebb40b HEAD -- index.html script.js assets/app/LIGHT_BOLB.html
assets/app/LOOSE_CONNECTION.html` — 3 files, 257 insertions / 92 deletions.
`LIGHT_BOLB.html` had zero textual changes (not in the diff at all).
`LOOSE_CONNECTION.html` changed one CSS font-size only (no text). Everything
else is in `index.html`/`script.js`:

1. **New "simulation" → "experience" (סימולציה → התנסות) terminology rename,
   scoped only to the Q3-series screens (12–17) and their feedback text** —
   NOT applied to screens 18–20/22/26, which still say "סימולציה" as of
   this refresh. Concretely: screen 12's `<iframe>` title, its instructions
   list, its reopen-button label (screens 13–16's reopen buttons too), the
   Q3.א–ד question bodies, their `qInitConfig` retry titles/bodies, and
   `qInitConfig(16)`'s correct/wrong2 bodies. Screen 17's video caption's
   last line also picked up the new wording.
   - **Found a real, live inconsistency this rename introduced**: the
     reopen-popup iframe title in `script.js:1177` (`toggleSimPopup()`,
     used when screens 13–16 reopen the LIGHT_BOLB experience) still reads
     the OLD wording ("סימולציית נורה מתחממת") even though screen 12's own
     static `<iframe>` title and every reopen-button label around it were
     already renamed to "התנסות בנורה מתחממת". In the previous export this
     string was a true duplicate of screen 12's title and was folded into
     that one unit; **it is no longer a duplicate** now that the two have
     drifted apart. Added as its own unit (`FL-12-018`) and flagged
     `manual-review` — not corrected, per instructions.
2. **New partial-credit ("retryPartial") feedback states added to three
   multi-choice questions** (screens 19, 22, 26) — a new title shown on the
   *first* wrong attempt when the learner got some but not all correct
   answers, distinct from the existing terminal `partial` state shown after
   the final attempt. Screen 19's wording is unique ("זו תשובה נכונה חלקית,
   מה הוא הסימן הנוסף?"); screens 22 and 26 share identical wording ("זו
   תשובה נכונה חלקית, נסו שוב."). +3 new units.
3. **New partial-credit block added to screen 6's `Q1_FEEDBACK`** (the
   classification-table question) — previously only had `correct`/`wrong2`;
   now has a `partial` block with the same 3-sentence body and a new title
   ("זו תשובה חלקית"). +4 new units (1 title + 3 body sentences).
4. **A `<br>` line-break inserted into several existing sentences** across
   screens 1, 4, 9, 18, 20, 22, 27, and the closing screen 29 — these are
   the same sentences with a line-break added, not new content, but the
   stored `<source>` had to be re-verified against the new text each time
   (all confirmed literal matches or documented multi-line joins).
5. **Wording/content edits** (not renames, not new states) on screens 1
   (niqqud added to "הִבְהוּבֵי"), 3 ("רונית המורה" → "המורה רונית"), 6 (row
   `data-row` attrs added — not translatable), 9 (hypothesis sentences
   reworded from statements to "ייתכן ש…" hedged phrasing), 10 ("קבוצה ב'
   חקרה את ההשערה כי…" → "…האם…"), 12 (new audio-playback button + bolded
   instruction list items — bold markup only, same words), 13–20/22–23/26/28
   (many `q-body` strings gained `<strong>` wrapping around their question
   stem, splitting what was one sentence with an inline `<br>` into
   `<strong>stem</strong><br>rest` — same words, reordered emphasis
   markup), 18 (`s12-graph-title` changed from "תרשים לוח החשמל בסימולציה"
   to "הדמייה של לוח חשמל", twice), 24 ("תהליך החקר" → "תהליכי החקר"), 27
   (`ondragover`/`ondragleave`/`ondrop` handlers removed from the drag
   targets — not translatable, behavior-only), 29 (opening "בסיום השיעור…"
   → "בלילה…", full paragraph reworded with two new `<br>` breaks).
6. **`vc-btn` mute/fullscreen buttons gained `aria-pressed="false"`** — a
   state attribute, not translatable text, no unit impact.
7. **`sim-reopen-btn-icon-close-normal` sprite renamed** to a `-teal`
   variant — an asset filename change, not a translatable string.

**No screen was renumbered or had its `data-screen` value changed** — every
existing `FL-NN` screen id from the previous export still refers to the
exact same screen. Nothing in §7's "ID-change mapping" is therefore
required. Every trans-unit's **sequential position number** (the third
segment) was still recomputed from scratch per the policy stated in the
previous export ("if nothing is translated yet, renumbering is cheap") —
**no translations exist yet** (confirmed: every `<target>` in the previous
XLIFF was empty), so unit-id stability across this refresh was not a
constraint worth preserving at the cost of correctness.

## Document order across two (or three) files

Unchanged from the previous export's approach: `index.html` content first
in document order within the file, then `script.js`/app-file content
appended afterward in that file's own order, per screen.

## Screen-by-screen notes (carried over + new)

- **FL-00 (chrome):** unchanged — `<title>` (`index.html:6`) and the
  image-zoom fallback alt `'תצוגה מוגדלת'`, now at `script.js:346` (line
  shifted from 314).
- **FL-04 (RevealTilesGroup, 7 characters):** same tag-boundary parser
  defect as the previous export (a `data-content` attribute value
  containing raw `<span>`/`<br>` markup breaks any parser that assumes
  attribute values never contain `<`/`>`) — re-confirmed on this refresh
  (all 7 tiles shifted down by exactly 1 line since a `<br>` was added to
  the intro text above them; content itself unchanged, verified via
  `git diff` showing zero changes to the tile block). Re-extracted by hand
  exactly as before, at the new line numbers.
- **FL-06:** gained the new `Q1_FEEDBACK.partial` block (see above). Table
  rows gained `data-row="a"`…`"g"` attributes — not translatable, purely a
  hook presumably added for future per-row logic.
- **FL-09 / FL-10 duplication:** unchanged from before — the recap sentence
  still appears on both screen 9 (static) and screen 10 (JS-injected
  reminder popup, now at `script.js:1209`), kept as two separate units.
- **FL-12 / FL-18 (embedded simulations):** LIGHT_BOLB gained an audio
  playback button (`#s12-audio-btn`) with a static `aria-label`, captured
  automatically by the generic HTML scan — no manual mapping needed. The
  iframe-title reuse note from the previous export **no longer applies
  cleanly to LIGHT_BOLB** (see the drift finding above) but still applies
  to LOOSE_CONNECTION (`script.js:1179` still matches screen 18's own
  title verbatim, confirmed).
- **FL-19 / FL-22 / FL-26:** each gained the new `retryPartial` state (see
  above).

## Excluded strings, with reason

| String / location | Reason |
|---|---|
| `script.js:1121` — `'הסימולציה פועלת (ממתין לקובץ אמיתי) — החץ יופיע בעוד 15 שניות'` (inside `simLaunch()`, was line 1006) | **Still unreachable code** — `.sim-placeholder-label` still does not exist anywhere in current `index.html` (re-checked this refresh). |
| `script.js` comment (was lines 966-967, now ~1112-1113) — `"החץ יופיע 15 שנ' לאחר הפעלת הישומון"` | Source-code comment quoting the production script's spec line. Excluded per the comments rule. |
| All other Hebrew inside `//` and `/* */` comments | Same rule. |
| Decorative `alt=""` | Empty by design. |

No xAPI/analytics-only strings found (same conclusion as the previous
export — re-verified, `window.lomdaState`/`postMessage` still only carry
numeric scores/screen indices).

## Out of scope

None (unchanged — no YouTube-hosted video in this module).

## Logic-coupled / DOM-mirrored strings

None found (unchanged conclusion, re-verified: all correctness logic still
keys off `data-id`/`data-value`/`data-card`/`data-slot`, never displayed
text). The new `data-row="a"`…`"g"` attributes on screen 6's table are also
not read by any correctness logic (checked `q1Toggle`/`q1Enter` — they key
off the existing `data-row`/`data-val` on the `<button>` elements inside
each row, not the new `<tr>` attribute) — free to translate the row text
without touching this.

## Normalised (non-byte-matching) strings

10 units, same two documented categories as before:
- 6 units carry a `{n}` placeholder for `+ num +` concatenation (screen 27).
- 1 unit (`FL-27-030`) combines both effects below.
- 1 unit (`FL-10-014`, the reminder-popup recap) stores `'` where the JS
  source escapes it as `\'`.
- 2 units (screen-27 aria-labels) had both effects together.

## Manual-review items

**One item**, new on this refresh:

- **`FL-12-018`** — `script.js:1177`'s reopen-popup iframe title for the
  LIGHT_BOLB experience still reads the pre-rename wording ("סימולציית
  נורה מתחממת") while every other reference to this experience (screen
  12's own `<iframe>` title, the reopen-button labels on screens 12–16)
  was already updated to "התנסות בנורה מתחממת". This is a real,
  observable inconsistency a learner would see: reopening the experience
  from screen 13–16 shows the old name in the popup even though the button
  that opened it and the original screen both say the new name. Flagged,
  not corrected.

No other stale/mismatched aria-labels or dead-but-user-facing markup were
found on this pass.

## Validation results

- **XML well-formed:** yes.
- **Duplicate trans-unit ids:** 0 (549 unique ids for 549 units).
- **Every screen id in the manifest has ≥1 unit, and vice versa:** confirmed
  (30/30).
- **Every `<target>` is empty:** confirmed (0 of 549 non-empty).
- **Every `source-location` points to a real file and in-range line:**
  confirmed programmatically.
- **IDs match `FL-{screen}-{string}`:** confirmed via regex, 0 failures.
- **Placeholders/inline markup intact:** re-confirmed for the 7 `RTG_TILES`
  entries and all 8 `{n}`-placeholder units.

## Verification sweep 1 — every unit still matches its source

- **539 / 549 (98.2%) matched byte-for-byte.**
- **10 / 549 (1.8%) normalized** — the same two documented categories as
  the previous export (placeholder / JS-escape), individually confirmed.
- **0 / 549 unexplained mismatches** in the final pass.

This sweep caught two real hand-transcription errors while building this
refresh (not source-file problems): a dropped `ו` in "מכיוון" and a dropped
`י` in "סימולציית", both introduced while retyping unicode-escaped Hebrew
into the extraction script, both corrected before this report was written.
That is exactly what this sweep is for.

## Verification sweep 2 — no Hebrew in the source is uncovered

- `index.html`: 238 fragments found, **0 uncovered**.
- `LIGHT_BOLB.html`: 18 fragments found, **0 uncovered**.
- `LOOSE_CONNECTION.html`: 3 fragments found, **1 "uncovered"** — same
  regex-over-capture artifact as before (`מד זרם (אמפר)'))`; real content
  covered).
- `script.js`: 82 fragments found, **8 "uncovered"**, all individually
  reclassified by hand — same set as the previous export (6 regex
  over-capture artifacts, 1 source-comment quote, 1 dead-code placeholder
  string) — full list unchanged, see the previous export's sweep-2 section
  for the per-fragment breakdown; re-verified none are new genuine misses.
- **Net result: zero genuine misses**, same as the previous export.

## Structural check

Re-read the full text diff (not a string-set diff) before rebuilding, per
§7's explicit warning that a coverage check comparing string *sets* alone
can miss a structurally-new element whose label text happens to already
exist elsewhere. This is exactly how the new `retryPartial`/`Q1_FEEDBACK.
partial` blocks and the `FL-12-018` drift were caught — none of those would
show up as "new strings" under a naive set-diff against the old export,
since two of the three new titles ("זו תשובה חלקית") already existed
verbatim as the *terminal* `partial` title elsewhere.

## Production files — confirmed unmodified

`git status --short` in `learning-demo/` shows only the translation-export
deliverables themselves as modified (they are tracked in this repo as of
commit `ee38447`, made in the other session):
```
 M translation-export/flickering-lights.xlf
 M translation-export/translation-screen-manifest.csv
```
`translation-export-report.md` (this file) is also being updated. No
`index.html`, `script.js`, `styles.css`, embedded app file, or asset was
modified, added, or deleted by this refresh.
