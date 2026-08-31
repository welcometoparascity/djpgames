import Phaser from 'phaser';
import { PALETTE } from '../config/theme';
import { audioManager } from '../audio/AudioManager';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

/** A reusable, animated, accessible-sized button used across every menu/UI screen. */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private opts: Required<ButtonOptions>;
  private _disabled: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, options: ButtonOptions = {}) {
    super(scene, x, y);
    this.opts = {
      width: options.width ?? 260,
      height: options.height ?? 64,
      fontSize: options.fontSize ?? 26,
      variant: options.variant ?? 'primary',
      disabled: options.disabled ?? false,
    };
    this._disabled = this.opts.disabled;

    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.label = scene.add
      .text(0, 0, text, {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: `${this.opts.fontSize}px`,
        color: this.opts.variant === 'ghost' ? '#fbf3e1' : '#2a1b3d',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    if (this.opts.variant === 'ghost') this.label.setShadow(0, 2, '#000000', 4, false, true);
    this.add(this.label);

    this.draw();
    this.setSize(this.opts.width, this.opts.height);
    this.setInteractive({ useHandCursor: true });

    this.on('pointerover', () => {
      if (this._disabled) return;
      scene.tweens.add({ targets: this, scale: 1.05, duration: 120, ease: 'Sine.easeOut' });
    });
    this.on('pointerout', () => {
      if (this._disabled) return;
      scene.tweens.add({ targets: this, scale: 1, duration: 120, ease: 'Sine.easeOut' });
    });
    this.on('pointerdown', () => {
      if (this._disabled) return;
      scene.tweens.add({ targets: this, scale: 0.94, duration: 70, yoyo: true, ease: 'Sine.easeOut' });
    });
    this.on('pointerup', () => {
      if (this._disabled) return;
      audioManager.playSfx('buttonClick');
      onClick();
    });

    scene.add.existing(this);
  }

  setDisabled(disabled: boolean): this {
    this._disabled = disabled;
    this.setAlpha(disabled ? 0.5 : 1);
    this.input!.enabled = !disabled;
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  private draw(): void {
    const { width: w, height: h, variant } = this.opts;
    const g = this.bg;
    g.clear();
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, h / 2);

    if (variant === 'primary') {
      g.fillStyle(PALETTE.gold, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      g.fillStyle(PALETTE.goldBright, 0.5);
      g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.42, h / 2);
      g.lineStyle(2, PALETTE.plum, 0.5);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    } else if (variant === 'secondary') {
      g.fillStyle(PALETTE.parchment, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      g.lineStyle(3, PALETTE.gold, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    } else {
      g.fillStyle(PALETTE.parchment, 0.0);
      g.lineStyle(2, PALETTE.parchmentShadow, 0.9);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    }
  }
}
