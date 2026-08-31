import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import { takeBotTurn } from '../src/bots/Bot';

describe('Player modes (GAME_RULES.md §10)', () => {
  it('supports 2-player mode (2 humans)', () => {
    const engine = new GameEngine({ players: [{ isBot: false }, { isBot: false }] });
    expect(engine.getState().players).toHaveLength(2);
    expect(engine.getState().playerCount).toBe(2);
  });

  it('supports 4-player mode (4 humans)', () => {
    const engine = new GameEngine({
      players: [{ isBot: false }, { isBot: false }, { isBot: false }, { isBot: false }],
    });
    expect(engine.getState().players).toHaveLength(4);
    expect(engine.getState().playerCount).toBe(4);
  });

  it('supports 1 human + 1 bot (2-player)', () => {
    const engine = new GameEngine({
      players: [{ isBot: false }, { isBot: true, botDifficulty: 'medium' }],
    });
    expect(engine.getState().players[0].isBot).toBe(false);
    expect(engine.getState().players[1].isBot).toBe(true);
  });

  it('supports 1 human + 3 bots (4-player)', () => {
    const engine = new GameEngine({
      players: [
        { isBot: false },
        { isBot: true, botDifficulty: 'easy' },
        { isBot: true, botDifficulty: 'medium' },
        { isBot: true, botDifficulty: 'hard' },
      ],
    });
    expect(engine.getState().players.filter((p) => p.isBot)).toHaveLength(3);
  });

  it('rejects invalid player counts (3 players not yet supported)', () => {
    expect(() => new GameEngine({ players: [{ isBot: false }, { isBot: false }, { isBot: false }] })).toThrow();
  });

  it('turn order proceeds through all seats in order, skipping no one', () => {
    const engine = new GameEngine({
      players: [{ isBot: true }, { isBot: true }, { isBot: true }, { isBot: true }],
      seed: 5,
    });
    const seen = new Set<number>();
    for (let i = 0; i < 4 && !engine.isGameOver(); i++) {
      seen.add(engine.getCurrentPlayer().index);
      // Drive exactly one non-bonus turn instance forward using forced rolls
      // so we can deterministically observe seat rotation.
      if (engine.getState().phase === 'ENTRY') engine.rollGatiPasa('Dev');
      engine.rollNormalPasa(2); // no kukri active yet, so this always passes the turn
    }
    expect(seen.size).toBe(4);
  });

  it('4-player human+bot mix can be fully driven by mixing manual and bot turns', () => {
    const engine = new GameEngine({
      players: [
        { isBot: false },
        { isBot: true, botDifficulty: 'medium' },
        { isBot: false },
        { isBot: true, botDifficulty: 'hard' },
      ],
      seed: 21,
    });
    let iterations = 0;
    while (!engine.isGameOver() && iterations < 20000) {
      iterations++;
      const player = engine.getCurrentPlayer();
      if (player.isBot) {
        takeBotTurn(engine);
      } else {
        if (engine.getState().phase === 'ENTRY') {
          const roll = engine.rollGatiPasa();
          if (roll.ok && !roll.enteredAutoSkipped) {
            const yardKukri = player.kukris.find((k) => k.state === 'YARD');
            if (yardKukri) engine.chooseEntryKukri(yardKukri.id);
            else engine.skipEntry();
          }
        }
        if (engine.getState().phase === 'MOVEMENT') {
          const roll = engine.rollNormalPasa();
          if (roll.ok && !roll.turnPassed) engine.moveKukri(roll.legalMoveKukriIds[0]);
        }
      }
    }
    expect(iterations).toBeLessThan(20000);
    expect(engine.isGameOver()).toBe(true);
  });
});
