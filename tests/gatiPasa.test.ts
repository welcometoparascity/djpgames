import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';

function newEngine(seed = 1) {
  return new GameEngine({ players: [{ isBot: false }, { isBot: false }], seed });
}

describe('Gati Pasa entry rule (GAME_RULES.md §3.2)', () => {
  it('starts every player with all 4 Kukri in the yard', () => {
    const engine = newEngine();
    const p0 = engine.getState().players[0];
    expect(p0.kukris.every((k) => k.state === 'YARD')).toBe(true);
    expect(p0.kukris).toHaveLength(4);
    const gatis = p0.kukris.map((k) => k.gati).sort();
    expect(gatis).toEqual(['Dev', 'Manushya', 'Narak', 'Tiryanch']);
  });

  it('DEV result does not allow entry', () => {
    // Search seeds until we find one whose first Gati roll is Dev.
    for (let seed = 0; seed < 500; seed++) {
      const engine = newEngine(seed);
      const roll = engine.rollGatiPasa();
      expect(roll.ok).toBe(true);
      if (roll.ok && roll.result === 'Dev') {
        expect(roll.enteredAutoSkipped).toBe(true);
        expect(engine.getState().phase).toBe('MOVEMENT');
        expect(engine.getState().players[0].kukris.every((k) => k.state === 'YARD')).toBe(true);
        return;
      }
    }
    throw new Error('Never rolled Dev in 500 seeds - Rng is broken');
  });

  it('TIRYANCH result does not allow entry', () => {
    for (let seed = 0; seed < 500; seed++) {
      const engine = newEngine(seed);
      const roll = engine.rollGatiPasa();
      if (roll.ok && roll.result === 'Tiryanch') {
        expect(roll.enteredAutoSkipped).toBe(true);
        expect(engine.getState().players[0].kukris.every((k) => k.state === 'YARD')).toBe(true);
        return;
      }
    }
    throw new Error('Never rolled Tiryanch in 500 seeds');
  });

  it('NARAK result does not allow entry', () => {
    for (let seed = 0; seed < 500; seed++) {
      const engine = newEngine(seed);
      const roll = engine.rollGatiPasa();
      if (roll.ok && roll.result === 'Narak') {
        expect(roll.enteredAutoSkipped).toBe(true);
        expect(engine.getState().players[0].kukris.every((k) => k.state === 'YARD')).toBe(true);
        return;
      }
    }
    throw new Error('Never rolled Narak in 500 seeds');
  });

  it('MANUSHYA allows the player to choose ANY ONE of their four Kukri (not just the Manushya-named one)', () => {
    for (let seed = 0; seed < 500; seed++) {
      const engine = newEngine(seed);
      const roll = engine.rollGatiPasa();
      if (roll.ok && roll.result === 'Manushya') {
        expect(roll.enteredAutoSkipped).toBe(false);
        expect(engine.getState().entryChoicePending).toBe(true);
        const player = engine.getCurrentPlayer();
        // Deliberately choose the DEV kukri, not the Manushya kukri, to prove
        // the Gati result is not tied to a specific matching Kukri.
        const devKukri = player.kukris.find((k) => k.gati === 'Dev')!;
        const chosen = engine.chooseEntryKukri(devKukri.id);
        expect(chosen.ok).toBe(true);
        expect(devKukri.state).toBe('ACTIVE');
        expect(devKukri.position).toBe(0);
        // The Manushya-named Kukri itself must still be in the yard.
        const manushyaKukri = player.kukris.find((k) => k.gati === 'Manushya')!;
        expect(manushyaKukri.state).toBe('YARD');
        return;
      }
    }
    throw new Error('Never rolled Manushya in 500 seeds');
  });

  it('a Manushya roll never auto-selects the matching Kukri by itself', () => {
    for (let seed = 0; seed < 500; seed++) {
      const engine = newEngine(seed);
      const roll = engine.rollGatiPasa();
      if (roll.ok && roll.result === 'Manushya') {
        // Immediately after the roll, before any choice is made, no Kukri should
        // have entered yet - proving there is no automatic entry.
        const player = engine.getCurrentPlayer();
        expect(player.kukris.every((k) => k.state === 'YARD')).toBe(true);
        return;
      }
    }
    throw new Error('Never rolled Manushya in 500 seeds');
  });

  it('rejects choosing a Kukri when no Manushya has been rolled', () => {
    const engine = newEngine();
    const player = engine.getCurrentPlayer();
    const result = engine.chooseEntryKukri(player.kukris[0].id);
    expect(result.ok).toBe(false);
  });

  it('rejects rolling the Gati Pasa twice in the same turn instance', () => {
    const engine = newEngine();
    const first = engine.rollGatiPasa();
    expect(first.ok).toBe(true);
    const second = engine.rollGatiPasa();
    expect(second.ok).toBe(false);
  });

  it('skips the entry phase entirely once a player has no Kukri left in the yard', () => {
    const engine = newEngine(42);
    const player = engine.getCurrentPlayer();
    // Force all 4 Kukri active directly via repeated Manushya-seeking rolls.
    let guard = 0;
    while (player.kukris.some((k) => k.state === 'YARD') && guard < 10000) {
      guard++;
      if (engine.getState().phase === 'ENTRY') {
        const roll = engine.rollGatiPasa();
        if (roll.ok && !roll.enteredAutoSkipped) {
          const yardKukri = player.kukris.find((k) => k.state === 'YARD')!;
          engine.chooseEntryKukri(yardKukri.id);
        }
      }
      if (engine.getState().phase === 'MOVEMENT' && engine.getCurrentPlayer().index === player.index) {
        const normal = engine.rollNormalPasa();
        if (normal.ok && !normal.turnPassed) {
          engine.moveKukri(normal.legalMoveKukriIds[0]);
        }
      }
      // Skip past the other player's turns quickly.
      if (engine.getCurrentPlayer().index !== player.index) {
        const other = engine.getCurrentPlayer();
        if (engine.getState().phase === 'ENTRY') {
          const roll = engine.rollGatiPasa();
          if (roll.ok && !roll.enteredAutoSkipped) {
            const yardKukri = other.kukris.find((k) => k.state === 'YARD')!;
            engine.chooseEntryKukri(yardKukri.id);
          }
        } else if (engine.getState().phase === 'MOVEMENT') {
          const normal = engine.rollNormalPasa();
          if (normal.ok && !normal.turnPassed) {
            engine.moveKukri(normal.legalMoveKukriIds[0]);
          }
        }
      }
    }
    expect(player.kukris.every((k) => k.state === 'ACTIVE' || k.state === 'FINISHED')).toBe(true);
    // Now that this player has no yard Kukri, their next turn instance must
    // start directly in MOVEMENT, never ENTRY.
    // Fast-forward until it's this player's turn again.
    guard = 0;
    while (engine.getCurrentPlayer().index !== player.index && guard < 10000) {
      guard++;
      const other = engine.getCurrentPlayer();
      if (engine.getState().phase === 'ENTRY') {
        const roll = engine.rollGatiPasa();
        if (roll.ok && !roll.enteredAutoSkipped) {
          const yardKukri = other.kukris.find((k) => k.state === 'YARD')!;
          engine.chooseEntryKukri(yardKukri.id);
        }
      } else if (engine.getState().phase === 'MOVEMENT') {
        const normal = engine.rollNormalPasa();
        if (normal.ok && !normal.turnPassed) {
          engine.moveKukri(normal.legalMoveKukriIds[0]);
        }
      }
    }
    expect(engine.getCurrentPlayer().index).toBe(player.index);
    expect(engine.getState().phase).toBe('MOVEMENT');
  });
});
