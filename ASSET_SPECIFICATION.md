# ASSET_SPECIFICATION.md

## Policy: no external asset files

Every visual and audio asset in this game is **generated at runtime by code
already in this repository** - nothing is downloaded, sourced from a stock
library, or bundled as a binary image/audio file. This is a deliberate
choice, not a shortcut:

- **Zero licensing risk.** There is no third-party artwork or audio to
  attribute, license, or accidentally infringe.
- **Zero "missing asset" risk.** There are no files that can fail to load on
  Hostinger or any static host - if the JS bundle loads, every asset exists.
- **Tiny bundle.** No image/audio binaries to ship.

This satisfies the project brief's asset requirements (§25) by using the
explicitly preferred route: "self-created assets... generated original
assets."

## Visual assets (`src/rendering/TextureFactory.ts`)

All generated once at Preload time via `Phaser.GameObjects.Graphics` ->
`generateTexture()`:

| Texture key(s) | What | Source |
|---|---|---|
| `board` | Full 1080x1080 board: sky gradient, distant hills, classic 15x15 cross grid (4 yards, 52-cell track, 4 home lanes, center Moksha mandala) | `TextureFactory.generateBoard` |
| `kukri-{0-3}-{Dev,Manushya,Tiryanch,Narak}` (16 total) | Player-tinted gem-token pieces with a Gati glyph badge | `TextureFactory.generateKukriTokens`, glyphs in `src/rendering/icons.ts` |
| `die-normal-{1-6}` | Normal Pasa faces | `TextureFactory.generateNormalDiceFaces` |
| `die-gati-{Dev,Manushya,Tiryanch,Narak}` | Gati Pasa faces | `TextureFactory.generateGatiDiceFaces` |
| `particle-spark`, `particle-petal` | Moksha/victory particle textures | `TextureFactory.generateParticles` |
| `panel` | Reusable rounded UI panel | `TextureFactory.generateUiChrome` |
| `env-cloud`, `env-butterfly` | Ambient background motion | `TextureFactory.generateEnvironment` |

### Art direction notes

- The four Gati glyphs (`src/rendering/icons.ts`) are deliberately abstract
  and symbolic, not literal religious iconography: a 4-point sparkle (Dev), a
  simple rounded person silhouette (Manushya), a rotated leaf (Tiryanch), and
  a calm rounded seed/droplet (Narak) - chosen specifically so Narak reads as
  "dormant/potential," never frightening (spec §4, §15).
- Board topology is the classic Ludo cross/square layout (four corner yards,
  plus-shaped track, colored home lanes to center) - familiar and
  understandable at a glance - while every color, shape, and texture is
  original, matching the "original visual identity, do not copy Ludo King"
  requirement (spec §3).

## Audio assets (`src/audio/AudioManager.ts`)

All sound is synthesized live with the Web Audio API (oscillators, filtered
noise bursts, gain envelopes) - see the class doc comment in
`AudioManager.ts` for the full rationale. No `.mp3`/`.ogg`/`.wav` files ship.

| Name | Synthesis | Used for |
|---|---|---|
| `buttonClick` | short triangle-wave blip | any UI button |
| `diceRollNormal` | sequence of filtered noise bursts | Normal Pasa roll |
| `diceRollGati` | sequence of short square-wave blips | Gati Pasa roll |
| `diceLand` | descending sine thud | die settling |
| `kukriMove` | triangle-wave pop | each hop step |
| `kukriEnter` | two-note sine chime | Kukri leaving yard |
| `capture` | sawtooth sweep + noise thud | capture |
| `moksha` | 4-note ascending sine arpeggio | reaching Moksha |
| `turnChange` | single sine note | new turn banner |
| `victory` | 5-note fanfare | game over |
| `error` | low square blip | rejected/invalid action (available, currently unused in UI) |

**Ambient music** (`startAmbientMusic`/`stopAmbientMusic`) is a generative
3-oscillator drone (C3/E3/G3) with a slow LFO, not a composed/looped
recording - honestly documented as such rather than claimed to be full
production music (see `TEST_REPORT.md` limitations).

**Future recorded audio**: `AudioManager.loadExternalVoiceClip(id, url)` is
implemented and ready to accept real files without any calling-code changes;
none are loaded today. See `VOICE_MANIFEST.md`.

## Fonts

System font stack only (`Trebuchet MS, Segoe UI, sans-serif`) - no web font
files to fail to load.
