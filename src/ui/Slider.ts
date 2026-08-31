import Phaser from 'phaser';
import { PALETTE } from '../config/theme';

/** A simple draggable 0-1 slider used throughout Settings. */
export class Slider extends Phaser.GameObjects.Container {
  private handle: Phaser.GameObjects.Arc;
  private fill: Phaser.GameObjects.Graphics;
  private trackWidth: number;
  private value: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    trackWidth: number,
    initialValue: number,
    onChange: (value: number) => void,
  ) {
    super(scene, x, y);
    this.trackWidth = trackWidth;
    this.value = Phaser.Math.Clamp(initialValue, 0, 1);

    const track = scene.add.graphics();
    track.fillStyle(0x000000, 0.25);
    track.fillRoundedRect(-trackWidth / 2, -5, trackWidth, 10, 5);
    this.add(track);

    this.fill = scene.add.graphics();
    this.add(this.fill);

    this.handle = scene.add.circle(0, 0, 14, PALETTE.gold).setStrokeStyle(2, PALETTE.plum);
    this.handle.setInteractive({ draggable: true, useHandCursor: true, hitArea: new Phaser.Geom.Circle(0, 0, 22), hitAreaCallback: Phaser.Geom.Circle.Contains });
    scene.input.setDraggable(this.handle);
    this.add(this.handle);

    this.redraw();

    this.handle.on('drag', (_p: unknown, dragX: number) => {
      const clamped = Phaser.Math.Clamp(dragX, -trackWidth / 2, trackWidth / 2);
      this.handle.x = clamped;
      this.value = (clamped + trackWidth / 2) / trackWidth;
      this.redraw();
      onChange(this.value);
    });

    scene.add.existing(this);
  }

  private redraw(): void {
    this.handle.x = this.value * this.trackWidth - this.trackWidth / 2;
    this.fill.clear();
    this.fill.fillStyle(PALETTE.gold, 0.9);
    const w = Math.max(10, (this.handle.x + this.trackWidth / 2));
    this.fill.fillRoundedRect(-this.trackWidth / 2, -5, w, 10, 5);
  }

  setValue(v: number): void {
    this.value = Phaser.Math.Clamp(v, 0, 1);
    this.redraw();
  }
}
