import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import { entrySquareFor, isSafeSharedSquare, relativeToShared, sharedToRelative } from '../src/core/board';

function newEngine(seed = 1) {
  return new GameEngine({ players: [{ isBot: false }, { isBot: false }], seed });
}

function forceOutOfEntry(engine: GameEngine) {
  if (engine.getState().phase === 'ENTRY') engine.rollGatiPasa('Dev');
}

describe('Capturing (GAME_RULES.md §7)', () => {
  it('a legal capture sends the opponent Kukri home and grants an extra turn', () => {
    const engine = newEngine();
    const mover = engine.getCurrentPlayer();
    const moverKukri = mover.kukris[0];
    const opponent = engine.getState().players[1];
    const opponentKukri = opponent.kukris[0];

    // Place mover 3 steps behind an unsafe opponent square on the shared track.
    // Player 0 relative position 5 -> shared index 5 (entry offset 0), which is
    // not a safe square (safe squares are 0,8,13,21,26,34,39,47).
    engine.debugPlaceKukri(moverKukri.id, 2, 'ACTIVE');
    engine.debugPlaceKukri(opponentKukri.id, sharedToRelative(opponent.index, 5), 'ACTIVE');
    // Sanity: confirm target square is not safe.
    expect(isSafeSharedSquare(5)).toBe(false);

    forceOutOfEntry(engine);
    const roll = engine.rollNormalPasa(3);
    expect(roll.ok).toBe(true);
    if (roll.ok) expect(roll.legalMoveKukriIds).toContain(moverKukri.id);

    const move = engine.moveKukri(moverKukri.id);
    expect(move.ok).toBe(true);
    if (move.ok) {
      expect(move.captured).toBe(true);
      expect(move.capturedKukriIds).toContain(opponentKukri.id);
      expect(move.bonusEarned).toBe(true);
    }
    expect(opponentKukri.state).toBe('YARD');
    expect(opponentKukri.position).toBe(-1);
  });

  it('a safe square protects the opponent Kukri from capture', () => {
    const engine = newEngine();
    const mover = engine.getCurrentPlayer();
    const moverKukri = mover.kukris[0];
    const opponent = engine.getState().players[1];
    const opponentKukri = opponent.kukris[0];

    // Shared index 8 is a safe star square.
    expect(isSafeSharedSquare(8)).toBe(true);
    engine.debugPlaceKukri(moverKukri.id, 5, 'ACTIVE');
    engine.debugPlaceKukri(opponentKukri.id, sharedToRelative(opponent.index, 8), 'ACTIVE');

    forceOutOfEntry(engine);
    engine.rollNormalPasa(3);
    const move = engine.moveKukri(moverKukri.id);
    expect(move.ok).toBe(true);
    if (move.ok) {
      expect(move.captured).toBe(false);
      expect(move.capturedKukriIds).toHaveLength(0);
    }
    expect(opponentKukri.state).toBe('ACTIVE');
  });

  it('a square with 2+ opponent Kukri is blocked and cannot be landed on', () => {
    const engine = newEngine();
    const mover = engine.getCurrentPlayer();
    const moverKukri = mover.kukris[0];
    const opponent = engine.getState().players[1];
    const opponentKukriA = opponent.kukris[0];
    const opponentKukriB = opponent.kukris[1];

    engine.debugPlaceKukri(moverKukri.id, 2, 'ACTIVE');
    const targetRelativeForOpponent = sharedToRelative(opponent.index, 5);
    engine.debugPlaceKukri(opponentKukriA.id, targetRelativeForOpponent, 'ACTIVE');
    engine.debugPlaceKukri(opponentKukriB.id, targetRelativeForOpponent, 'ACTIVE');
    expect(isSafeSharedSquare(5)).toBe(false);

    forceOutOfEntry(engine);
    const roll = engine.rollNormalPasa(3);
    expect(roll.ok).toBe(true);
    if (roll.ok) expect(roll.legalMoveKukriIds).not.toContain(moverKukri.id);
  });

  it('own Kukri may freely stack on the same square without blocking each other', () => {
    const engine = newEngine();
    const mover = engine.getCurrentPlayer();
    const kukriA = mover.kukris[0];
    const kukriB = mover.kukris[1];
    engine.debugPlaceKukri(kukriA.id, 5, 'ACTIVE');
    engine.debugPlaceKukri(kukriB.id, 2, 'ACTIVE');

    forceOutOfEntry(engine);
    const roll = engine.rollNormalPasa(3);
    expect(roll.ok).toBe(true);
    if (roll.ok) expect(roll.legalMoveKukriIds).toContain(kukriB.id);
    const move = engine.moveKukri(kukriB.id);
    expect(move.ok).toBe(true);
    expect(kukriA.position).toBe(5);
    expect(kukriB.position).toBe(5);
  });

  it('landing on Moksha never triggers a capture (private, non-capturable)', () => {
    const engine = newEngine();
    const player = engine.getCurrentPlayer();
    const kukri = player.kukris[0];
    engine.debugPlaceKukri(kukri.id, 56, 'ACTIVE');
    forceOutOfEntry(engine);
    engine.rollNormalPasa(2);
    const move = engine.moveKukri(kukri.id);
    expect(move.ok).toBe(true);
    if (move.ok) {
      expect(move.finished).toBe(true);
      expect(move.captured).toBe(false);
    }
  });

  it('relativeToShared + entrySquareFor round-trip correctly for every player', () => {
    for (let p = 0; p < 4; p++) {
      for (let rel = 0; rel < 52; rel++) {
        const shared = relativeToShared(p, rel);
        expect(shared).toBe((entrySquareFor(p) + rel) % 52);
      }
    }
  });
});
