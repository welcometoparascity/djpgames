import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import { takeBotTurn } from '../src/bots/Bot';
import type { BotDifficulty } from '../src/core/types';

function newEngine(difficulties: BotDifficulty[], seed = 1) {
  return new GameEngine({
    players: difficulties.map((d) => ({ isBot: true, botDifficulty: d })),
    seed,
  });
}

function driveFullGame(engine: GameEngine, maxIterations = 20000): number {
  let iterations = 0;
  while (!engine.isGameOver() && iterations < maxIterations) {
    iterations++;
    takeBotTurn(engine);
  }
  return iterations;
}

describe('Bots (GAME_RULES.md §11)', () => {
  it.each<BotDifficulty>(['easy', 'medium', 'hard'])(
    '%s bot only ever performs legal, validated actions and the game reaches completion',
    (difficulty) => {
      const engine = newEngine([difficulty, difficulty], 123);
      const iterations = driveFullGame(engine);
      expect(iterations).toBeLessThan(20000);
      expect(engine.isGameOver()).toBe(true);
      expect(engine.getState().winnerIndex).not.toBeNull();
    },
  );

  it('a bot with no legal move (fresh game, nothing active) passes its turn without throwing', () => {
    const engine = newEngine(['easy', 'easy']);
    expect(() => takeBotTurn(engine)).not.toThrow();
  });

  it('a bot never enters a Kukri on a non-Manushya Gati roll', () => {
    for (let seed = 0; seed < 50; seed++) {
      const engine = newEngine(['hard', 'hard'], seed);
      const log = takeBotTurn(engine);
      if (log.gatiResult && log.gatiResult !== 'Manushya') {
        expect(log.enteredKukriId).toBeUndefined();
      }
    }
  });

  it('4-bot game (1 human seat replaced by bot for this test) completes without runaway loops', () => {
    const engine = newEngine(['easy', 'medium', 'hard', 'medium'], 999);
    const iterations = driveFullGame(engine);
    expect(iterations).toBeLessThan(20000);
    expect(engine.isGameOver()).toBe(true);
  });

  it('bots across many random seeds never desync into an invalid state', () => {
    for (let seed = 0; seed < 15; seed++) {
      const engine = newEngine(['easy', 'hard'], seed);
      const iterations = driveFullGame(engine, 20000);
      expect(iterations).toBeLessThan(20000);
      const state = engine.getState();
      expect(state.winnerIndex).not.toBeNull();
      const winner = state.players[state.winnerIndex!];
      expect(winner.kukris.every((k) => k.state === 'FINISHED')).toBe(true);
    }
  });
});
