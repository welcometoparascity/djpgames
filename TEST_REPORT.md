# TEST_REPORT.md

## Build status

- `npm run build` (tsc --noEmit + vite build): **succeeds**, zero type errors.
- Bundle: `dist/assets/index-*.js` ~1.53 MB (~356 KB gzipped), single chunk;
  `dist/assets/index-*.css` 0.71 KB; `dist/index.html` 0.79 KB. No image or
  audio binaries (see ASSET_SPECIFICATION.md) - everything else is generated
  in-browser.

## Automated tests

- Framework: Vitest, targeting `src/core` and `src/bots` exclusively (pure
  logic, no Phaser/DOM).
- **52 tests across 7 files, all passing** on the current `main` engine code:
  - `tests/gatiPasa.test.ts` (9) - Manushya-only entry, free choice of any
    yard Kukri, no auto-selection by name, duplicate-roll rejection, entry
    phase skipped once yard is empty.
  - `tests/movement.test.ts` (7) - all 6 roll values, illegal-move
    rejection, Moksha exact-landing boundary, no-legal-move turn pass,
    can't move another player's Kukri.
  - `tests/capture.test.ts` (6) - legal capture, safe-square protection,
    2+-piece blocking, own-color stacking, Moksha is never a capture,
    board-math round-trip.
  - `tests/extraTurns.test.ts` (7) - 6 grants extra turn (with and without a
    legal move), capture grants extra turn, Moksha grants extra turn,
    combined 6+capture grants exactly one bonus (not two), a 5,000-iteration
    bounded loop proving no runaway/infinite turn state.
  - `tests/bots.test.ts` (7) - easy/medium/hard each complete a full game
    within a 20,000-action safety cap, bots never enter on a non-Manushya
    roll, 4-bot and mixed human/bot games complete, 15-seed randomized
    sweep for desync.
  - `tests/playerModes.test.ts` (7) - 2p, 4p, human+bot mixes, invalid
    3-player rejection, seat-order rotation, mixed manual/bot driving.
  - `tests/edgeCases.test.ts` (9) - empty/full yard, multiple legal Kukri,
    zero legal moves, rapid duplicate rolls, game-restart isolation,
    post-victory action rejection.
- Re-run command: `npm test` (`vitest run`).

## Bugs found and fixed during development

1. **Test-setup bug** (not an engine bug): several capture/extra-turn tests
   computed an opponent's relative position with raw subtraction, producing
   negative values under modulo - fixed by adding `sharedToRelative()` to
   `src/core/board.ts` and using it consistently. Caught immediately by the
   test suite itself (4 failing tests), diagnosed, fixed, verified green.
2. **`MoveOutcome.bonusEarned` reported stale value**: `moveKukri()` read
   `state.bonusEarnedThisInstance` *after* `endTurnInstance()` had already
   reset it for the next turn, so the returned outcome always showed
   `bonusEarned: false`. Fixed by snapshotting the flag before calling
   `endTurnInstance()`. Found via code review before it reached tests;
   `extraTurns.test.ts` would otherwise have caught it.
3. **Ghost-variant button text illegible**: `Button`'s `ghost` variant (used
   for every "BACK" button) rendered dark plum text on a transparent
   background over a dark scene backdrop - effectively invisible. Found via
   visual QA screenshot review, fixed by using a light color + text shadow.
4. **Settings sliders overlapped their labels**: label text and slider
   tracks were positioned close enough to visually collide at default font
   sizes. Found via screenshot review, fixed by right-aligning labels and
   widening the label/slider gap.
5. **HUD header clutter**: the turn banner/hint text and player badges
   overlapped, and ambient background clouds drifted behind them. Found via
   screenshot review, fixed by adding a solid header/footer panel band and
   constraining ambient elements to spawn below it.
6. **WebGL texture-generation stall**: with the default `Phaser.AUTO`
   (WebGL) renderer, the ~30 `generateTexture()` calls during Preload each
   trigger a GPU->CPU pixel readback; on the software-rendered GPU available
   in this sandboxed test environment this took 15+ seconds to reach the
   main menu. Switched to `Phaser.CANVAS`, which brought the same load down
   to ~2.4 seconds with zero visual regression, since every asset here is
   flat 2D vector art with no shader requirement.

## Manual / browser QA performed

Using a headless Chromium (Playwright) driving the actual **production
build** (`vite preview`, not the dev server):

- Full click-through: Main Menu -> Mode Select -> Game -> Gati Pasa roll
  (both Manushya-entry and non-entry outcomes observed) -> Normal Pasa roll
  -> Kukri move -> automated bot turn -> back to human turn. Verified via
  live engine-state introspection (`window.__game`), not screenshots alone.
  **Zero console errors or exceptions** at any point.
- Settings, How To Play (all 7 pages), Rules (all 4 pages), and Victory
  scenes individually loaded and screenshotted - zero console errors.
- Visual review of every screen above at 1200x900; issues found are listed
  above and were all fixed and re-verified.

## Known limitations (not fixed / out of scope this release)

- No human playtesting was performed - all gameplay verification is
  automated/scripted. Subtle "feel" issues (animation timing, difficulty
  balance) are unverified.
- No dedicated performance profiling (Lighthouse, memory-leak detection over
  a long session) was run; the one concrete performance fix made (Canvas
  renderer) was based on a measured, reproducible stall, not a full audit.
- Tested viewport sizes were limited to a 1200x900 desktop window; responsive
  behavior on real phones/tablets is architecturally supported (Phaser
  `Scale.FIT`, touch-enabled input) but not device-tested.
- Only one browser engine (Chromium) was exercised.
- The Playwright smoke-test scripts used during development were run from a
  scratch directory outside the repository and are not preserved as a
  checked-in QA harness.

This report reflects what was actually run and observed. No test results
are invented, and the game is not claimed to be bug-free - only that the 52
listed automated tests pass and the manual browser walkthrough above
produced no errors.
