import Phaser from 'phaser';
import { PALETTE } from '../config/theme';
import { Button } from '../ui/Button';
import { AmbientEnvironment } from '../rendering/AmbientEnvironment';
import { audioManager } from '../audio/AudioManager';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.skyTop);
    this.add.image(width / 2, height / 2, 'board').setDisplaySize(width, height).setAlpha(0.7).setDepth(-20);
    new AmbientEnvironment(this, width, height);

    audioManager.ensureStarted();
    audioManager.startAmbientMusic();

    const title = this.add
      .text(width / 2, height * 0.18, 'JAIN LUDO', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: `${Math.min(64, width * 0.09)}px`,
        color: '#f4cf8a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#241335', 8, false, true);
    this.add
      .text(width / 2, height * 0.18 + 52, 'PATH TO MOKSHA', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '20px',
        color: '#fbf3e1',
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: title,
      y: title.y - 6,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const centerX = width / 2;
    const startY = height * 0.46;
    const gap = 82;
    const buttons = [
      { text: 'PLAY', action: () => this.scene.start('ModeSelect') },
      { text: 'HOW TO PLAY', action: () => this.scene.start('HowToPlay') },
      { text: 'RULES', action: () => this.scene.start('Rules') },
      { text: 'SETTINGS', action: () => this.scene.start('Settings') },
    ];
    buttons.forEach((b, i) => {
      new Button(this, centerX, startY + i * gap, b.text, b.action, {
        variant: i === 0 ? 'primary' : 'secondary',
        width: 280,
      });
    });
  }
}
