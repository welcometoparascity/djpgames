import { GameEngine } from '../core/GameEngine';
import { isOnSharedTrack, isSafeSharedSquare, MOKSHA_POSITION, relativeToShared } from '../core/board';
import type { BotDifficulty, Kukri, Player } from '../core/types';
import { Rng } from '../core/rng';

/**
 * Bot decision-making. Bots NEVER mutate GameEngine state directly — every
 * action is issued through the same public engine API used by human players
 * (rollGatiPasa / chooseEntryKukri / skipEntry / rollNormalPasa / moveKukri),
 * so bots can never bypass rule validation. See GAME_RULES.md §11.
 */

const rng = new Rng();

function wouldFinish(kukri: Kukri, roll: number): boolean {
  return kukri.position + roll === MOKSHA_POSITION;
}

function wouldCapture(engine: GameEngine, actor: Player, kukri: Kukri, roll: number): boolean {
  const to = kukri.position + roll;
  if (!isOnSharedTrack(to)) return false;
  const sharedIndex = relativeToShared(actor.index, to);
  if (isSafeSharedSquare(sharedIndex)) return false;
  for (const opponent of engine.getState().players) {
    if (opponent.index === actor.index) continue;
    for (const oKukri of opponent.kukris) {
      if (oKukri.state === 'ACTIVE' && isOnSharedTrack(oKukri.position)) {
        if (relativeToShared(opponent.index, oKukri.position) === sharedIndex) return true;
      }
    }
  }
  return false;
}

/** True if kukri sits on an unsafe shared square within striking distance (1-6) of an opponent. */
function isThreatened(engine: GameEngine, actor: Player, kukri: Kukri): boolean {
  if (!isOnSharedTrack(kukri.position)) return false;
  const sharedIndex = relativeToShared(actor.index, kukri.position);
  if (isSafeSharedSquare(sharedIndex)) return false;
  for (const opponent of engine.getState().players) {
    if (opponent.index === actor.index) continue;
    for (const oKukri of opponent.kukris) {
      if (oKukri.state !== 'ACTIVE' || !isOnSharedTrack(oKukri.position)) continue;
      for (let step = 1; step <= 6; step++) {
        const candidateShared = relativeToShared(opponent.index, oKukri.position + step);
        if (oKukri.position + step < 52 && candidateShared === sharedIndex) return true;
      }
    }
  }
  return false;
}

function chooseYardKukriToEnter(player: Player): string {
  const yardKukris = player.kukris.filter((k) => k.state === 'YARD');
  // Mechanically all yard Kukri are identical once entered (Gati is cosmetic
  // only — see GAME_RULES.md §3.2), so the choice has no strategic weight.
  return rng.pick(yardKukris).id;
}

function chooseMoveEasy(legalIds: string[]): string {
  return rng.pick(legalIds);
}

function chooseMoveMedium(engine: GameEngine, actor: Player, legalIds: string[], roll: number): string {
  const kukris = legalIds.map((id) => actor.kukris.find((k) => k.id === id)!);
  const finishing = kukris.find((k) => wouldFinish(k, roll));
  if (finishing) return finishing.id;
  const capturing = kukris.find((k) => wouldCapture(engine, actor, k, roll));
  if (capturing) return capturing.id;
  const mostAdvanced = [...kukris].sort((a, b) => b.position - a.position)[0];
  return mostAdvanced.id;
}

function chooseMoveHard(engine: GameEngine, actor: Player, legalIds: string[], roll: number): string {
  const kukris = legalIds.map((id) => actor.kukris.find((k) => k.id === id)!);
  let best = kukris[0];
  let bestScore = -Infinity;
  for (const kukri of kukris) {
    let score = 0;
    if (wouldFinish(kukri, roll)) score += 1000;
    if (wouldCapture(engine, actor, kukri, roll)) score += 500;
    if (isThreatened(engine, actor, kukri)) score += 150;
    score += kukri.position * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = kukri;
    }
  }
  return best.id;
}

function chooseMove(engine: GameEngine, actor: Player, legalIds: string[], roll: number, difficulty: BotDifficulty): string {
  if (legalIds.length === 1) return legalIds[0];
  switch (difficulty) {
    case 'easy':
      return chooseMoveEasy(legalIds);
    case 'medium':
      return chooseMoveMedium(engine, actor, legalIds, roll);
    case 'hard':
      return chooseMoveHard(engine, actor, legalIds, roll);
  }
}

export interface BotTurnLog {
  gatiResult?: string;
  enteredKukriId?: string;
  normalRoll?: number;
  movedKukriId?: string;
  turnPassed: boolean;
}

/**
 * Executes exactly one turn instance for the current bot player (one
 * entry-phase resolution, if applicable, plus one movement-phase resolution).
 * Callers should invoke this repeatedly while the current player remains a
 * bot and the game is not over (an extra turn keeps the same player active).
 */
export function takeBotTurn(engine: GameEngine): BotTurnLog {
  const player = engine.getCurrentPlayer();
  if (!player.isBot) throw new Error('takeBotTurn called for a non-bot player');
  const difficulty = player.botDifficulty ?? 'medium';
  const result: BotTurnLog = { turnPassed: false };

  if (engine.getState().phase === 'ENTRY') {
    const gati = engine.rollGatiPasa();
    if (gati.ok) {
      result.gatiResult = gati.result;
      if (!gati.enteredAutoSkipped) {
        const kukriId = chooseYardKukriToEnter(player);
        const entry = engine.chooseEntryKukri(kukriId);
        if (entry.ok) result.enteredKukriId = kukriId;
      }
    }
  }

  const normal = engine.rollNormalPasa();
  if (normal.ok) {
    result.normalRoll = normal.roll;
    result.turnPassed = normal.turnPassed;
    if (!normal.turnPassed && normal.legalMoveKukriIds.length > 0) {
      const chosenId = chooseMove(engine, player, normal.legalMoveKukriIds, normal.roll, difficulty);
      const move = engine.moveKukri(chosenId);
      if (move.ok) result.movedKukriId = chosenId;
    }
  }
  return result;
}
