import Phaser from 'phaser';
import { PALETTE, PLAYER_THEMES } from '../config/theme';
import { Button } from '../ui/Button';
import { audioManager } from '../audio/AudioManager';

export interface VictoryData {
  winnerIndex: number | null;
}

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory');
  }

  create(data: VictoryData): void {
    const { width, height } = this.scale;
    const theme = PLAYER_THEMES[data.winnerIndex ?? 0];
    this.cameras.main.setBackgroundColor(PALETTE.skyTop);
    this.add.image(width / 2, height / 2, 'board').setDisplaySize(width, height).setAlpha(0.45).setDepth(-20);

    audioManager.stopAmbientMusic();

    const emitter = this.add.particles(width / 2, -20, 'particle-petal', {
      x: { min: 0, max: width },
      y: -20,
      speedY: { min: 60, max: 160 },
      speedX: { min: -30, max: 30 },
      rotate: { min: 0, max: 360 },
      lifespan: 4000,
      quantity: 2,
      frequency: 80,
      tint: [PALETTE.gold, theme.base, 0xffffff],
    });
    this.time.delayedCall(6000, () => emitter.stop());

    const title = this.add
      .text(width / 2, height * 0.32, `PLAYER ${(data.winnerIndex ?? 0) + 1} WINS!`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: `${Math.min(48, width * 0.07)}px`,
        color: '#f4cf8a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: title, scale: { from: 0.6, to: 1 }, duration: 500, ease: 'Back.easeOut' });

    this.add
      .text(width / 2, height * 0.32 + 56, 'has reached Moksha with all four Kukri.', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '20px',
        color: '#fbf3e1',
      })
      .setOrigin(0.5);

    new Button(this, width / 2, height * 0.62, 'PLAY AGAIN', () => this.scene.start('ModeSelect'), { variant: 'primary', width: 260 });
    new Button(this, width / 2, height * 0.62 + 76, 'MAIN MENU', () => this.scene.start('MainMenu'), { variant: 'secondary', width: 260 });
  }
}
