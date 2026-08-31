# VOICE_MANIFEST.md

## Status: architecture-ready, no audio files shipped in this release

Per spec §20, the game must work completely without optional voice files,
and that is exactly the current state: `AudioManager.playVoiceLine(id)`
silently no-ops if a clip was never loaded (see the class doc comment in
`src/audio/AudioManager.ts`). Nothing in the game currently calls
`playVoiceLine`, so voice is fully inert - zero risk of it breaking anything.

## How to add real recorded voice later

1. Record/produce short (1-3 second) child-friendly lines per the scripts
   below, in English, Hindi, and Gujarati.
2. Encode as `.mp3` or `.ogg` and place under:
   ```
   assets/audio/voice/en/<id>.mp3
   assets/audio/voice/hi/<id>.mp3
   assets/audio/voice/gu/<id>.mp3
   ```
3. At startup (or lazily, on first need), call:
   ```ts
   await audioManager.loadExternalVoiceClip('manushya', `assets/audio/voice/${lang}/manushya.mp3`);
   ```
4. Call `audioManager.playVoiceLine('manushya')` at the moment described
   below. A failed fetch/decode is caught and ignored - the game keeps
   running silently.
5. Wire the language choice to `settingsStore.get().language` (already a
   persisted `'en' | 'hi' | 'gu'` setting exposed in the Settings screen).

## Script list (id -> line, one line per moment, all languages TBD)

| id | Moment | English line (placeholder script) |
|---|---|---|
| `manushya` | Gati Pasa rolls Manushya | "Manushya! Choose a Kukri." |
| `capture` | A Kukri is captured | "Sent home!" |
| `moksha` | A Kukri reaches Moksha | "Moksha reached!" |
| `victory` | Game over | "You win!" |
| `your_turn` | Turn changes to a human player | "Your turn." |

No Hindi/Gujarati translations are included in this release since no audio
was recorded; the id list and English scripts above are ready for
translation and recording whenever voice talent/generation is available.
