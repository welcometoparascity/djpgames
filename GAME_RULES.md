# GAME_RULES.md — Jain Ludo: Path to Moksha

This document is the **absolute source of truth** for game rules. The rules
engine (`src/core`) is a direct implementation of this document. No other
part of the codebase (rendering, UI, bots) may alter or reinterpret these
rules — they may only call the engine's public API.

If a change to game behavior is ever needed, this document must be updated
first, then the engine, then tests.

## 1. Players and Kukri

- 2 or 4 players. Each player controls exactly **4 Kukri** (game pieces).
- The four Kukri per player represent the four Gati (states of existence
  in Jain cosmology), used here purely as a naming/visual theme:
  1. **Dev Gati**
  2. **Manushya Gati**
  3. **Tiryanch Gati**
  4. **Narak Gati**
- All four Kukri belong to the same player and move on the same board,
  tinted in that player's color. The Gati only determines the Kukri's
  visual identity (shape/icon), **not** any special movement ability —
  all four Kukri move identically once on the board.
- Each Kukri is always in exactly one of four states:
  - `YARD` — at home, not yet on the board.
  - `ACTIVE` — on the shared 52-square track or in the player's private
    6-square home column.
  - `FINISHED` — has reached Moksha (Siddhashila).

## 2. The Board

- A standard cross-shaped Ludo-style track with **52 shared squares**
  arranged in a loop (indices `0..51`).
- Each of the 4 player colors has a fixed **entry square** on the shared
  track, spaced 13 squares apart:
  - Player 0: shared index `0`
  - Player 1: shared index `13`
  - Player 2: shared index `26`
  - Player 3: shared index `39`
- Each player has a private **home column** of 6 squares
  (relative indices `52..57`) entered after completing the loop, followed
  by **Moksha / Siddhashila** (relative index `58`) — the finish.
- A Kukri's position is stored as a single integer **relative to its own
  player's path** (`0` = that player's entry square, `57` = last home
  column square, `58` = Moksha). Rendering converts this to shared-board
  coordinates.
- **Safe squares** (Kukri here cannot be captured):
  - The 4 entry squares (`0, 13, 26, 39` on the shared track).
  - The 4 "star" squares 8 steps after each entry square
    (`8, 21, 34, 47` on the shared track).
  - All squares inside any player's private home column.
- Moksha/Siddhashila itself is not capturable (Kukri there are `FINISHED`
  and off the shared track entirely).

## 3. Two Dice — Critical Rule

There are two separate, independent dice.

### 3.1 Normal Pasa

A standard 6-sided die (`1`–`6`). It controls **movement** of Kukri that
are already `ACTIVE` on the board. Rolling a `6` grants an extra turn
(see §5).

### 3.2 Gati Pasa

A 4-sided die with faces `Dev`, `Manushya`, `Tiryanch`, `Narak` (25% each).
The Gati Pasa is used **only** to attempt bringing a Kukri out of the
yard. It has no other function.

**CRITICAL RULE — do not reinterpret:**

- If the result is **Manushya**: the player may choose **any one** of
  their four Kukri that is currently in the `YARD` (regardless of its own
  Gati name) and move it onto their entry square, becoming `ACTIVE`.
  The Gati Pasa result does **not** determine which Kukri enters — the
  player chooses freely among their yard Kukri.
- If the result is **Dev**, **Tiryanch**, or **Narak**: no Kukri enters
  the board this turn. There is no effect.
- The Gati Pasa never automatically selects a "matching" Kukri. A
  Manushya roll does not specifically release the Manushya Gati Kukri —
  it is a generic unlock that the player applies to whichever Kukri they
  choose.

## 4. Turn Structure

Each player's turn proceeds as follows:

1. **Entry phase** (only if the player has at least one Kukri in `YARD`):
   - The player rolls the **Gati Pasa**.
   - If `Manushya`, the player picks one yard Kukri to enter (§3.2).
   - Otherwise, nothing happens.
   - If the player has zero Kukri in `YARD`, this phase is skipped
     entirely and only the Normal Pasa is rolled.
2. **Movement phase**:
   - The player rolls the **Normal Pasa**.
   - The engine computes the set of legal moves (which of the player's
     `ACTIVE` Kukri can legally move by the rolled amount — see §6).
   - If at least one legal move exists, the player (or bot) selects a
     Kukri to move.
   - If no legal move exists (no `ACTIVE` Kukri, or all moves are
     blocked/overshoot), the turn passes with no movement.
3. **Bonus resolution**: if any bonus condition was earned this turn
   (§5), the same player takes another full turn (back to step 1).
   Otherwise, play passes to the next player in seat order.

Only one Gati Pasa roll and only one Normal Pasa roll occur per "turn
instance" (an extra turn is a brand-new turn instance). This keeps the
dice state and turn state centrally controlled and prevents duplicate
rolls from rapid clicking — the engine rejects a second roll of the same
die within the same phase.

## 5. Extra Turn Rules

An extra turn is granted (once per turn instance, non-stacking) when any
of the following occur during that turn:

1. The Normal Pasa result is `6`.
2. A Kukri move captures an opponent's Kukri (§7).
3. A Kukri move reaches Moksha/Siddhashila exactly (§8).

If more than one bonus condition fires within the same move (for example,
rolling a `6` **and** capturing in the same move), only **one** extra
turn is granted — bonuses do not stack within a single turn instance.
This is enforced by a single boolean `bonusEarned` flag per turn instance
rather than a counter, which structurally prevents duplicate or
runaway extra turns and infinite loops.

## 6. Movement Rules

- A Kukri can only move if it is `ACTIVE`.
- Moving forward by the Normal Pasa value `n`:
  - If the resulting relative position is `<= 58`, the move is legal
    *unless* the destination square is blocked (see below).
  - If the resulting relative position would exceed `58` (overshoot),
    the move is **illegal** for that Kukri (it must land on Moksha with
    an exact count).
- **Blocking**: a shared-track square (relative-track squares that map to
  indices `0..51`, i.e. not a private home column) occupied by **two or
  more** of a single opponent color's Kukri is blocked — no piece of any
  other color may move onto or through... (movement in this
  implementation is a direct jump, not square-by-square, so "through" is
  not applicable) ...move **onto** that square. This is the only
  condition that makes an otherwise-legal move illegal.
- A player's own Kukri may freely stack on the same square (no limit).
- If a player has active Kukri but none of them have a legal move for the
  rolled value, the turn's movement phase produces no action.

## 7. Capturing

- A Kukri capture occurs when a Kukri moves onto a **shared-track**
  square (not a private home column, not Moksha) that is occupied by
  **exactly one** opposing Kukri, and that square is **not** a safe
  square (§2).
- The captured Kukri is sent back to its owner's `YARD`.
- Landing on a safe square never captures, regardless of occupancy.
- Landing on a square with 2+ opposing Kukri is blocked and thus illegal
  (§6) — no capture is possible there.
- A successful capture grants an extra turn (§5).

## 8. Moksha / Siddhashila

- A Kukri that reaches relative position `58` exactly becomes `FINISHED`
  and is permanently removed from the shared track.
- Reaching Moksha grants an extra turn (§5).
- A player wins when all 4 of their Kukri are `FINISHED`.

## 9. Win Condition

- The game ends immediately, in both 2-player and 4-player modes, the
  instant any player's 4th Kukri reaches Moksha. That player wins
  outright. (Ranking/placement for 2nd/3rd place among remaining
  players is a possible future enhancement and is out of scope for this
  release — see ARCHITECTURE.md extensibility notes.)

## 10. Player Modes

- 2 players (human/human or human/bot).
- 4 players (any mix of human and bot, minimum 1 human).
- Seat order is fixed at game start; turns proceed clockwise through
  seats in order, skipping no one (all seats always get a turn, even
  bot seats).

## 11. Bots

- Easy, Medium, Hard difficulty.
- Bots call the exact same public engine API as human players
  (`rollGatiPasa`, `chooseEntryKukri`, `rollNormalPasa`, `moveKukri`) —
  they cannot bypass validation.
- Difficulty only affects the bot's **choice** among legal options:
  - **Easy**: picks uniformly at random among legal moves / legal yard
    Kukri.
  - **Medium**: prefers captures, then prefers finishing a Kukri, then
    prefers advancing the most-advanced eligible Kukri, else random.
  - **Hard**: full priority order — finish a Kukri > capture an opponent
    > move a Kukri out of danger (onto a safe square) if threatened >
    bring a new Kukri out when advantageous > advance the most-advanced
    Kukri > random fallback. Also strongly prefers entering a Kukri when
    3 or more are already in the yard.

## 12. Determinism & Fairness

- All dice rolls use a seedable RNG (`src/core/rng.ts`) so games are
  reproducible for testing, while defaulting to a real random seed in
  normal play.
- No hidden state affects legality other than what is described above.
