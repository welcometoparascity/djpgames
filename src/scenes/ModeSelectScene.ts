import Phaser from 'phaser';
import { PALETTE, PLAYER_THEMES } from '../config/theme';
import { Button } from '../ui/Button';
import type { BotDifficulty } from '../core/types';
import type { PlayerSetup } from '../core/GameEngine';

type SeatOption = 'human' | 'easy' | 'medium' | 'hard';
const SEAT_CYCLE: SeatOption[] = ['human', 'easy', 'medium', 'hard'];
const SEAT_LABELS: Record<SeatOption, string> = {
  human: 'HUMAN',
  easy: 'BOT · EASY',
  medium: 'BOT · MEDIUM',
  hard: 'BOT · HARD',
};

export interface GameLaunchConfig {
  players: PlayerSetup[];
}

export class ModeSelectScene extends Phaser.Scene {
  private playerCount: 2 | 4 = 2;
  private seats: SeatOption[] = ['human', 'medium', 'human', 'medium'];
  private seatButtons: Button[] = [];
  private seatDecorations: Phaser.GameObjects.GameObject[] = [];
  private errorText?: Phaser.GameObjects.Text;

  constructor() {
    super('ModeSelect');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.skyTop);
    this.add.image(width / 2, height / 2, 'board').setDisplaySize(width, height).setAlpha(0.55).setDepth(-20);

    this.add
      .text(width / 2, 60, 'CHOOSE YOUR MATCH', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '32px',
        color: '#f4cf8a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const countY = 130;
    new Button(this, width / 2 - 90, countY, '2 PLAYERS', () => this.setPlayerCount(2), { variant: this.playerCount === 2 ? 'primary' : 'secondary', width: 170 });
    new Button(this, width / 2 + 90, countY, '4 PLAYERS', () => this.setPlayerCount(4), { variant: this.playerCount === 4 ? 'primary' : 'secondary', width: 170 });

    this.renderSeats();

    this.errorText = this.add
      .text(width / 2, height - 140, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: '#d6455a' })
      .setOrigin(0.5);

    new Button(this, width / 2, height - 80, 'START GAME', () => this.startGame(), { variant: 'primary', width: 260 });
    new Button(this, 90, height - 40, 'BACK', () => this.scene.start('MainMenu'), { variant: 'ghost', width: 140, height: 48, fontSize: 18 });
  }

  private setPlayerCount(count: 2 | 4): void {
    this.playerCount = count;
    this.scene.restart();
  }

  private renderSeats(): void {
    this.seatButtons.forEach((b) => b.destroy());
    this.seatButtons = [];
    this.seatDecorations.forEach((d) => d.destroy());
    this.seatDecorations = [];
    const { width } = this.scale;
    const activeSeats = this.playerCount;
    const startY = 210;
    const gap = 78;

    for (let i = 0; i < activeSeats; i++) {
      const theme = PLAYER_THEMES[i];
      const swatch = this.add.circle(width / 2 - 190, startY + i * gap, 16, theme.base).setStrokeStyle(2, theme.dark);
      this.seatDecorations.push(swatch);
      const label = this.add
        .text(width / 2 - 155, startY + i * gap, `Player ${i + 1}`, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '20px',
          color: '#fbf3e1',
        })
        .setOrigin(0, 0.5);
      this.seatDecorations.push(label);

      const btn = new Button(
        this,
        width / 2 + 100,
        startY + i * gap,
        SEAT_LABELS[this.seats[i]],
        () => this.cycleSeat(i),
        { width: 220, height: 52, fontSize: 18, variant: 'secondary' },
      );
      this.seatButtons.push(btn);
    }
  }

  private cycleSeat(index: number): void {
    const current = SEAT_CYCLE.indexOf(this.seats[index]);
    this.seats[index] = SEAT_CYCLE[(current + 1) % SEAT_CYCLE.length];
    this.renderSeats();
  }

  private startGame(): void {
    const activeSeats = this.seats.slice(0, this.playerCount);
    const hasHuman = activeSeats.some((s) => s === 'human');
    if (!hasHuman) {
      this.errorText?.setText('At least one seat must be Human.');
      return;
    }
    const players: PlayerSetup[] = activeSeats.map((s) =>
      s === 'human' ? { isBot: false } : { isBot: true, botDifficulty: s as BotDifficulty },
    );
    this.scene.start('Game', { players } as GameLaunchConfig);
  }
}
