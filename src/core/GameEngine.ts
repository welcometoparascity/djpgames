import { Rng } from './rng';
import {
  entrySquareFor,
  isInHomeColumn,
  isOnSharedTrack,
  isSafeSharedSquare,
  MOKSHA_POSITION,
  relativeToShared,
} from './board';
import { GATI_NAMES } from './types';
import type {
  ActionResult,
  BotDifficulty,
  GameState,
  GatiName,
  Kukri,
  MoveOutcome,
  Player,
} from './types';

export interface PlayerSetup {
  isBot: boolean;
  botDifficulty?: BotDifficulty;
}

export interface EngineConfig {
  players: PlayerSetup[]; // length 2 or 4
  seed?: number;
}

const GATI_ORDER: readonly [string, string, string, string] = ['Dev', 'Manushya', 'Tiryanch', 'Narak'];

function makeKukri(playerIndex: number, gatiIndex: number): Kukri {
  return {
    id: `p${playerIndex}-${GATI_ORDER[gatiIndex]}`,
    playerIndex,
    gati: GATI_ORDER[gatiIndex] as Kukri['gati'],
    state: 'YARD',
    position: -1,
  };
}

/**
 * The central, Phaser-independent rules engine. All game logic lives here.
 * Rendering and UI must only call this public API — see ARCHITECTURE.md.
 */
export class GameEngine {
  private rng: Rng;
  private state: GameState;

  constructor(config: EngineConfig) {
    if (config.players.length !== 2 && config.players.length !== 4) {
      throw new Error('GameEngine requires exactly 2 or 4 players');
    }
    this.rng = new Rng(config.seed);
    const players: Player[] = config.players.map((p, index) => ({
      index,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
      kukris: [makeKukri(index, 0), makeKukri(index, 1), makeKukri(index, 2), makeKukri(index, 3)],
      finishedCount: 0,
    }));

    this.state = {
      playerCount: config.players.length as 2 | 4,
      players,
      currentPlayerIndex: 0,
      phase: 'ENTRY',
      turnInstanceId: 0,
      gatiRoll: null,
      gatiRolledThisInstance: false,
      entryChoicePending: false,
      normalRoll: null,
      normalRolledThisInstance: false,
      legalMoveKukriIds: [],
      bonusEarnedThisInstance: false,
      winnerIndex: null,
      log: [],
    };
    this.beginTurnInstance(false);
  }

  /** Live state reference. Treat as read-only; mutate only through this class's methods. */
  getState(): GameState {
    return this.state;
  }

  getCurrentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex];
  }

  private log(msg: string): void {
    this.state.log.push(msg);
    if (this.state.log.length > 200) this.state.log.shift();
  }

  private hasYardKukri(player: Player): boolean {
    return player.kukris.some((k) => k.state === 'YARD');
  }

  private beginTurnInstance(advancePlayer: boolean): void {
    if (advancePlayer) {
      this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    }
    this.state.turnInstanceId += 1;
    this.state.gatiRoll = null;
    this.state.gatiRolledThisInstance = false;
    this.state.entryChoicePending = false;
    this.state.normalRoll = null;
    this.state.normalRolledThisInstance = false;
    this.state.legalMoveKukriIds = [];
    this.state.bonusEarnedThisInstance = false;

    const player = this.getCurrentPlayer();
    this.state.phase = this.hasYardKukri(player) ? 'ENTRY' : 'MOVEMENT';
    this.log(`Turn begins for player ${player.index} (phase=${this.state.phase})`);
  }

  private endTurnInstance(): void {
    if (this.state.bonusEarnedThisInstance) {
      this.log(`Player ${this.getCurrentPlayer().index} earned an extra turn.`);
      this.beginTurnInstance(false);
    } else {
      this.beginTurnInstance(true);
    }
  }

  // ---------------------------------------------------------------------
  // Entry phase: Gati Pasa
  // ---------------------------------------------------------------------

  /**
   * @param forcedResult Test-only hook to make a specific Gati result
   * deterministic. Never used by production UI/bot code — the same phase and
   * once-per-turn validation still applies regardless.
   */
  rollGatiPasa(forcedResult?: GatiName): ActionResult<{ result: GatiName; enteredAutoSkipped: boolean }> {
    if (this.state.phase !== 'ENTRY') {
      return { ok: false, error: 'Not in entry phase' };
    }
    if (this.state.gatiRolledThisInstance) {
      return { ok: false, error: 'Gati Pasa already rolled this turn' };
    }
    const result = forcedResult ?? this.rng.pick(GATI_NAMES);
    this.state.gatiRoll = result;
    this.state.gatiRolledThisInstance = true;
    this.log(`Player ${this.getCurrentPlayer().index} rolled Gati Pasa: ${result}`);

    if (result === 'Manushya') {
      this.state.entryChoicePending = true;
      return { ok: true, result, enteredAutoSkipped: false };
    }
    this.state.phase = 'MOVEMENT';
    return { ok: true, result, enteredAutoSkipped: true };
  }

  chooseEntryKukri(kukriId: string): ActionResult<{ kukri: Kukri }> {
    if (this.state.phase !== 'ENTRY' || !this.state.entryChoicePending) {
      return { ok: false, error: 'No pending entry choice' };
    }
    const player = this.getCurrentPlayer();
    const kukri = player.kukris.find((k) => k.id === kukriId);
    if (!kukri) return { ok: false, error: 'Kukri not found for current player' };
    if (kukri.state !== 'YARD') return { ok: false, error: 'Kukri is not in the yard' };

    kukri.state = 'ACTIVE';
    kukri.position = 0;
    this.state.entryChoicePending = false;
    this.state.phase = 'MOVEMENT';
    this.log(`Player ${player.index} brought ${kukri.gati} Kukri onto the board (Manushya).`);
    return { ok: true, kukri };
  }

  skipEntry(): ActionResult {
    if (!this.state.entryChoicePending) {
      return { ok: false, error: 'No pending entry choice to skip' };
    }
    this.state.entryChoicePending = false;
    this.state.phase = 'MOVEMENT';
    this.log(`Player ${this.getCurrentPlayer().index} declined to bring a Kukri out.`);
    return { ok: true };
  }

  // ---------------------------------------------------------------------
  // Movement phase: Normal Pasa
  // ---------------------------------------------------------------------

  private computeLegalMoves(player: Player, roll: number): string[] {
    const legal: string[] = [];
    for (const kukri of player.kukris) {
      if (kukri.state !== 'ACTIVE') continue;
      const destination = kukri.position + roll;
      if (destination > MOKSHA_POSITION) continue; // overshoot, illegal
      if (isOnSharedTrack(destination)) {
        const sharedIndex = relativeToShared(player.index, destination);
        if (this.isBlockedByOpponents(player.index, sharedIndex)) continue;
      }
      legal.push(kukri.id);
    }
    return legal;
  }

  /** True if 2+ Kukri belonging to a single *other* color occupy sharedIndex. */
  private isBlockedByOpponents(playerIndex: number, sharedIndex: number): boolean {
    const counts = new Map<number, number>();
    for (const player of this.state.players) {
      if (player.index === playerIndex) continue;
      for (const kukri of player.kukris) {
        if (kukri.state !== 'ACTIVE' || !isOnSharedTrack(kukri.position)) continue;
        if (relativeToShared(player.index, kukri.position) === sharedIndex) {
          counts.set(player.index, (counts.get(player.index) ?? 0) + 1);
        }
      }
    }
    for (const count of counts.values()) {
      if (count >= 2) return true;
    }
    return false;
  }

  /**
   * @param forcedRoll Test-only hook to make a specific roll (1-6)
   * deterministic. Never used by production UI/bot code.
   */
  rollNormalPasa(forcedRoll?: number): ActionResult<{ roll: number; legalMoveKukriIds: string[]; turnPassed: boolean }> {
    if (this.state.phase !== 'MOVEMENT' || this.state.entryChoicePending) {
      return { ok: false, error: 'Not ready to roll the Normal Pasa' };
    }
    if (this.state.normalRolledThisInstance) {
      return { ok: false, error: 'Normal Pasa already rolled this turn' };
    }
    if (forcedRoll !== undefined && (forcedRoll < 1 || forcedRoll > 6)) {
      return { ok: false, error: 'forcedRoll must be between 1 and 6' };
    }
    const roll = forcedRoll ?? this.rng.int(1, 6);
    this.state.normalRoll = roll;
    this.state.normalRolledThisInstance = true;
    if (roll === 6) this.state.bonusEarnedThisInstance = true;

    const player = this.getCurrentPlayer();
    const legalMoveKukriIds = this.computeLegalMoves(player, roll);
    this.state.legalMoveKukriIds = legalMoveKukriIds;
    this.log(`Player ${player.index} rolled Normal Pasa: ${roll} (${legalMoveKukriIds.length} legal move(s))`);

    if (legalMoveKukriIds.length === 0) {
      this.log(`Player ${player.index} has no legal move.`);
      this.endTurnInstance();
      return { ok: true, roll, legalMoveKukriIds, turnPassed: true };
    }
    return { ok: true, roll, legalMoveKukriIds, turnPassed: false };
  }

  moveKukri(kukriId: string): ActionResult<MoveOutcome> {
    if (this.state.phase !== 'MOVEMENT' || !this.state.normalRolledThisInstance) {
      return { ok: false, error: 'Not ready to move' };
    }
    if (!this.state.legalMoveKukriIds.includes(kukriId)) {
      return { ok: false, error: 'That Kukri does not have a legal move' };
    }
    const player = this.getCurrentPlayer();
    const kukri = player.kukris.find((k) => k.id === kukriId)!;
    const from = kukri.position;
    const to = from + this.state.normalRoll!;
    kukri.position = to;

    let captured = false;
    const capturedKukriIds: string[] = [];
    let finished = false;

    if (to === MOKSHA_POSITION) {
      kukri.state = 'FINISHED';
      finished = true;
      player.finishedCount += 1;
      this.log(`Player ${player.index}'s ${kukri.gati} Kukri reached Moksha!`);
    } else if (isOnSharedTrack(to)) {
      const sharedIndex = relativeToShared(player.index, to);
      if (!isSafeSharedSquare(sharedIndex)) {
        for (const opponent of this.state.players) {
          if (opponent.index === player.index) continue;
          for (const oKukri of opponent.kukris) {
            if (
              oKukri.state === 'ACTIVE' &&
              isOnSharedTrack(oKukri.position) &&
              relativeToShared(opponent.index, oKukri.position) === sharedIndex
            ) {
              oKukri.state = 'YARD';
              oKukri.position = -1;
              capturedKukriIds.push(oKukri.id);
            }
          }
        }
        if (capturedKukriIds.length > 0) {
          captured = true;
          this.log(`Player ${player.index} captured ${capturedKukriIds.length} Kukri!`);
        }
      }
    }
    // isInHomeColumn(to): private square, no capture/block possible — nothing to do.
    void isInHomeColumn;

    if (finished || captured) this.state.bonusEarnedThisInstance = true;
    const bonusEarned = this.state.bonusEarnedThisInstance;

    let gameOver = false;
    if (player.finishedCount === 4) {
      this.state.winnerIndex = player.index;
      this.state.phase = 'GAME_OVER';
      gameOver = true;
      this.log(`Player ${player.index} wins!`);
    } else {
      this.endTurnInstance();
    }

    return {
      ok: true,
      kukriId,
      from,
      to,
      captured,
      capturedKukriIds,
      finished,
      bonusEarned,
      gameOver,
      winnerIndex: this.state.winnerIndex,
    };
  }

  isGameOver(): boolean {
    return this.state.phase === 'GAME_OVER';
  }

  /**
   * Test/scenario-setup only: forcibly places a Kukri at an exact relative
   * position and state, bypassing normal turn flow. Never called by
   * production UI or bot code - used exclusively to construct deterministic
   * board scenarios (captures, blocking, Moksha) in automated tests.
   */
  debugPlaceKukri(kukriId: string, position: number, state: Kukri['state'] = 'ACTIVE'): void {
    for (const player of this.state.players) {
      const kukri = player.kukris.find((k) => k.id === kukriId);
      if (kukri) {
        kukri.position = position;
        kukri.state = state;
        return;
      }
    }
    throw new Error(`debugPlaceKukri: unknown kukri id ${kukriId}`);
  }
}

export { entrySquareFor };
