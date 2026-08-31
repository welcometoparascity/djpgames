import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import { MOKSHA_POSITION } from '../src/core/board';

function newEngine(seed = 1) {
  return new GameEngine({ players: [{ isBot: false }, { isBot: false }], seed });
}

function forceOutOfEntry(engine: GameEngine) {
  // Rolls Gati Pasa with a non-Manushya result so the current turn instance
  // moves straight to the movement phase without bringing anything out.
  if (engine.getState().phase === 'ENTRY') {
    engine.rollGatiPasa('Dev');
  }
}

describe('Normal Pasa movement (GAME_RULES.md §6)', () => {
  it('supports all six roll values 1 through 6', () => {
    for (let roll = 1; roll <= 6; roll++) {
      const engine = newEngine();
      const player = engine.getCurrentPlayer();
      const kukri = player.kukris[0];
      engine.debugPlaceKukri(kukri.id, 0, 'ACTIVE');
      forceOutOfEntry(engine);
      const result = engine.rollNormalPasa(roll);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.roll).toBe(roll);
        expect(result.legalMoveKukriIds).toContain(kukri.id);
        const move = engine.moveKukri(kukri.id);
        expect(move.ok).toBe(true);
        if (move.ok) expect(move.to).toBe(roll);
      }
    }
  });

  it('rejects moving a Kukri that is not in the legal-move list', () => {
    const engine = newEngine();
    const player = engine.getCurrentPlayer();
    forceOutOfEntry(engine);
    engine.rollNormalPasa(3);
    // All Kukri are still in the yard (never entered), so nothing is legal.
    const result = engine.moveKukri(player.kukris[0].id);
    expect(result.ok).toBe(false);
  });

  it('rejects rolling the Normal Pasa twice in one turn instance', () => {
    const engine = newEngine();
    forceOutOfEntry(engine);
    const first = engine.rollNormalPasa(3);
    expect(first.ok).toBe(true);
    const second = engine.rollNormalPasa(4);
    expect(second.ok).toBe(false);
  });

  it('enforces the Moksha boundary: overshoot is illegal, exact landing is required', () => {
    const engine = newEngine();
    const player = engine.getCurrentPlayer();
    const kukri = player.kukris[0];
    engine.debugPlaceKukri(kukri.id, MOKSHA_POSITION - 2, 'ACTIVE'); // needs exactly 2
    forceOutOfEntry(engine);
    const overshoot = engine.rollNormalPasa(5);
    expect(overshoot.ok).toBe(true);
    if (overshoot.ok) {
      expect(overshoot.legalMoveKukriIds).not.toContain(kukri.id);
      expect(overshoot.turnPassed).toBe(true); // no other active kukri either
    }
  });

  it('allows exact landing on Moksha', () => {
    const engine = newEngine();
    const player = engine.getCurrentPlayer();
    const kukri = player.kukris[0];
    engine.debugPlaceKukri(kukri.id, MOKSHA_POSITION - 2, 'ACTIVE');
    forceOutOfEntry(engine);
    const roll = engine.rollNormalPasa(2);
    expect(roll.ok).toBe(true);
    if (roll.ok) {
      expect(roll.legalMoveKukriIds).toContain(kukri.id);
      const move = engine.moveKukri(kukri.id);
      expect(move.ok).toBe(true);
      if (move.ok) {
        expect(move.finished).toBe(true);
        expect(move.to).toBe(MOKSHA_POSITION);
      }
      expect(kukri.state).toBe('FINISHED');
    }
  });

  it('passes the turn with no action when there are no legal moves', () => {
    const engine = newEngine();
    forceOutOfEntry(engine);
    const startingPlayer = engine.getCurrentPlayer().index;
    const result = engine.rollNormalPasa(4); // nothing active, nothing in range
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.legalMoveKukriIds).toHaveLength(0);
      expect(result.turnPassed).toBe(true);
    }
    // Roll wasn't a 6, so turn should have passed to the next player.
    expect(engine.getCurrentPlayer().index).not.toBe(startingPlayer);
  });

  it('a player may only move their own Kukri, never an opponent\'s', () => {
    const engine = newEngine();
    const opponent = engine.getState().players[1];
    const opponentKukri = opponent.kukris[0];
    engine.debugPlaceKukri(opponentKukri.id, 5, 'ACTIVE');
    forceOutOfEntry(engine);
    engine.rollNormalPasa(3);
    const result = engine.moveKukri(opponentKukri.id);
    expect(result.ok).toBe(false);
  });
});
