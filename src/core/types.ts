/**
 * Core type definitions for the Jain Ludo rules engine.
 * This module has zero dependency on Phaser or any rendering concern —
 * see GAME_RULES.md for the authoritative rule definitions these types encode.
 */

export type GatiName = 'Dev' | 'Manushya' | 'Tiryanch' | 'Narak';

export const GATI_NAMES: readonly GatiName[] = ['Dev', 'Manushya', 'Tiryanch', 'Narak'];

export type KukriState = 'YARD' | 'ACTIVE' | 'FINISHED';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface Kukri {
  readonly id: string;
  readonly playerIndex: number;
  readonly gati: GatiName;
  state: KukriState;
  /** Position relative to this player's own path: 0..51 shared loop offset from
   * their entry square, 52..57 home column, 58 = Moksha. Meaningless (kept at -1)
   * while state is YARD. */
  position: number;
}

export interface Player {
  readonly index: number;
  readonly isBot: boolean;
  readonly botDifficulty?: BotDifficulty;
  readonly kukris: [Kukri, Kukri, Kukri, Kukri];
  finishedCount: number;
}

export type TurnPhase = 'ENTRY' | 'MOVEMENT' | 'GAME_OVER';

export interface GameState {
  readonly playerCount: 2 | 4;
  readonly players: Player[];
  currentPlayerIndex: number;
  phase: TurnPhase;
  /** Monotonically increasing id, bumped every time a fresh turn instance begins. */
  turnInstanceId: number;
  gatiRoll: GatiName | null;
  gatiRolledThisInstance: boolean;
  /** True only right after a Manushya roll, until chooseEntryKukri/skipEntry resolves it. */
  entryChoicePending: boolean;
  normalRoll: number | null;
  normalRolledThisInstance: boolean;
  legalMoveKukriIds: string[];
  bonusEarnedThisInstance: boolean;
  winnerIndex: number | null;
  /** History log of human-readable events, newest last. Useful for UI + debugging. */
  log: string[];
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type ActionResult<T extends object = {}> = ({ ok: true } & T) | { ok: false; error: string };

export interface MoveOutcome {
  kukriId: string;
  from: number;
  to: number;
  captured: boolean;
  capturedKukriIds: string[];
  finished: boolean;
  bonusEarned: boolean;
  gameOver: boolean;
  winnerIndex: number | null;
}
