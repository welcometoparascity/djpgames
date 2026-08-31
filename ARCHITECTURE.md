# ARCHITECTURE.md

## Principle

**The rules engine is independent of Phaser.** `src/core` has zero imports
from `phaser` or any scene/rendering code. Rendering and UI only ever call
the engine's public API (`rollGatiPasa`, `chooseEntryKukri`, `skipEntry`,
`rollNormalPasa`, `moveKukri`, `getState`, `getCurrentPlayer`, `isGameOver`).
Bots call the exact same API. This is verified directly by the automated
test suite, which exercises the engine with no Phaser dependency at all.

## Directory layout

```
src/
  core/        Rules engine - types, board math, GameEngine, RNG. No Phaser.
  bots/        Bot decision-making (pure functions) + turn-batch helper.
  rendering/   Board pixel geometry, procedural texture generation, ambient FX.
  scenes/      Phaser scenes (menu, mode select, how-to-play, rules, settings,
               game, victory).
  ui/          Reusable Phaser UI components (Button, Slider).
  audio/       AudioManager (Web Audio API, synthesized SFX/music).
  storage/     localStorage-backed settings persistence.
  config/      Theme/palette/board-size constants shared across rendering.
tests/         Vitest suite against src/core and src/bots only.
```

## Board topology

The board is a classic 15x15 Ludo-style square/cross grid (`src/rendering/boardLayout.ts`):

- Four 6x6 corner yards (player 0 = top-left, 1 = top-right, 2 = bottom-right,
  3 = bottom-left).
- A plus-shaped 52-cell shared track built from one 13-cell base quadrant,
  rotated 90° three times (`rotateCCW`) - this guarantees the four quadrants
  are geometrically consistent and each player's entry square lands exactly
  13 cells apart, matching `entrySquareFor()` in `src/core/board.ts`.
- Four private 6-cell home-column lanes (the arm's middle row/column) leading
  from the track into the center Moksha cell.

The **engine** (`src/core`) never deals in pixels - it only tracks each
Kukri's position as a single integer relative to its own player
(0-51 shared, 52-57 home column, 58 = Moksha). `boardPositionFor()` in
`src/rendering/boardLayout.ts` is the only place that turns an engine
position into a screen pixel, by indexing into the same rotated-quadrant
cell list the board texture itself is drawn from - so drawn cells and live
Kukri sprites can never drift out of alignment.

## Rendering approach

No external image, audio, or font assets are loaded from disk. Every visual
(board, all 16 Kukri token variants, both dice, particles, UI chrome) is
generated once at Preload time as a Phaser texture via `TextureFactory`,
built from `Phaser.GameObjects.Graphics` primitives (circles, rounded rects,
polygons). See `ASSET_SPECIFICATION.md` for the reasoning. The renderer is
`Phaser.CANVAS` (not WebGL/AUTO) specifically because `generateTexture()`
triggers a GPU->CPU pixel readback under WebGL, which is a measured, severe
stall on low-end/software-rendered GPUs; Canvas2D avoids it entirely.

## Turn orchestration

`GameScene` drives both human and bot turns through **one** code path:
roll Gati Pasa (if applicable) -> animate -> resolve entry choice -> roll
Normal Pasa -> animate -> resolve move -> animate outcome (capture/Moksha/
extra turn) -> next turn. For a human, each step waits for a click; for a
bot, `src/bots/Bot.ts`'s pure `decideYardKukriToEnter` / `decideMove`
functions pick the action and the scene calls the exact same engine methods
a human input handler would, then plays the exact same animations. This
means there is no separate, unaudited "bot code path" that could diverge
from validated rules - see GAME_RULES.md §11.

## Extensibility (not built, but not precluded)

- **3/5/6 players, online rooms**: `GameEngine`'s constructor already takes
  an arbitrary list of `PlayerSetup`; the 2/4-only restriction is a single
  guard clause in the constructor. Turn order, capture, and safe-square
  logic are already player-count-agnostic (they iterate `state.players`).
  Board geometry would need a 6-yard layout variant for player counts beyond
  4, which is out of scope for this release.
- **Networked play**: because the engine is a plain, serializable state
  machine with no Phaser/DOM dependency, it can run identically on a server;
  swapping local `moveKukri()` calls for calls proxied over a socket is the
  only integration point required.
- **Recorded voice**: `AudioManager.loadExternalVoiceClip(id, url)` already
  exists and is called nowhere yet - see `VOICE_MANIFEST.md`.
