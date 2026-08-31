import Phaser from 'phaser';
import { TextureFactory } from '../rendering/TextureFactory';
import { PALETTE } from '../config/theme';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.skyTop);

    const title = this.add
      .text(width / 2, height / 2 - 60, 'Jain Ludo', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '48px',
        color: '#f4cf8a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    const subtitle = this.add
      .text(width / 2, height / 2 - 12, 'Path to Moksha', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '20px',
        color: '#fbf3e1',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const barBg = this.add.graphics();
    const barFg = this.add.graphics();
    const barWidth = Math.min(360, width * 0.7);
    const barX = width / 2 - barWidth / 2;
    const barY = height / 2 + 40;
    barBg.fillStyle(0xffffff, 0.15);
    barBg.fillRoundedRect(barX, barY, barWidth, 14, 7);

    this.tweens.add({ targets: [title, subtitle], alpha: 1, duration: 500, ease: 'Sine.easeOut' });

    // Generate every original texture (board, tokens, dice, particles, UI chrome).
    // This is synchronous and fast, but we animate a progress bar for polish
    // and to give the production build a real, readable startup moment.
    let progress = 0;
    const steps = [
      () => TextureFactory.generateAll(this),
    ];
    const tick = this.time.addEvent({
      delay: 90,
      repeat: 10,
      callback: () => {
        progress = Math.min(1, progress + 1 / 11);
        barFg.clear();
        barFg.fillStyle(0xd8a34e, 1);
        barFg.fillRoundedRect(barX, barY, barWidth * progress, 14, 7);
        if (progress >= 1) {
          for (const step of steps) step();
          this.time.delayedCall(200, () => this.scene.start('MainMenu'));
        }
      },
    });
    this.events.once('shutdown', () => tick.remove());
  }
}
