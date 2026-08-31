import type Phaser from 'phaser';
import type { GatiName } from '../config/theme';

/**
 * Original, abstract, child-friendly glyphs for the four Gati - deliberately
 * symbolic rather than literal religious iconography (GAME_RULES.md / spec
 * §15, §16: distinct, cute, never frightening even for Narak).
 */

type G = Phaser.GameObjects.Graphics;

function sparkle(g: G, cx: number, cy: number, size: number, color: number): void {
  // A 4-point sparkle: two elongated diamonds crossed, plus a small core circle.
  g.fillStyle(color, 1);
  const long = size;
  const short = size * 0.28;
  g.fillPoints(
    [
      { x: cx, y: cy - long },
      { x: cx + short, y: cy },
      { x: cx, y: cy + long },
      { x: cx - short, y: cy },
    ],
    true,
  );
  g.fillPoints(
    [
      { x: cx - long, y: cy },
      { x: cx, y: cy - short },
      { x: cx + long, y: cy },
      { x: cx, y: cy + short },
    ],
    true,
  );
  g.fillCircle(cx, cy, size * 0.22);
}

function person(g: G, cx: number, cy: number, size: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(cx, cy - size * 0.55, size * 0.32); // head
  g.fillPoints(
    [
      { x: cx - size * 0.42, y: cy + size * 0.55 },
      { x: cx + size * 0.42, y: cy + size * 0.55 },
      { x: cx + size * 0.26, y: cy - size * 0.08 },
      { x: cx - size * 0.26, y: cy - size * 0.08 },
    ],
    true,
  );
}

function leaf(g: G, cx: number, cy: number, size: number, color: number): void {
  g.fillStyle(color, 1);
  g.save();
  g.translateCanvas(cx, cy);
  g.rotateCanvas(Math.PI / 4);
  g.fillEllipse(0, 0, size * 1.5, size * 0.85);
  g.restore();
  g.lineStyle(Math.max(1.5, size * 0.06), 0xffffff, 0.55);
  g.beginPath();
  g.moveTo(cx - size * 0.5, cy + size * 0.5);
  g.lineTo(cx + size * 0.5, cy - size * 0.5);
  g.strokePath();
}

function seedDrop(g: G, cx: number, cy: number, size: number, color: number): void {
  // A calm, rounded downward droplet/seed - deliberately gentle, not sinister.
  g.fillStyle(color, 1);
  g.fillCircle(cx, cy + size * 0.15, size * 0.55);
  g.fillTriangle(
    cx - size * 0.42,
    cy - size * 0.05,
    cx + size * 0.42,
    cy - size * 0.05,
    cx,
    cy - size * 0.75,
  );
}

export function drawGatiIcon(g: G, gati: GatiName, cx: number, cy: number, size: number, color: number): void {
  switch (gati) {
    case 'Dev':
      sparkle(g, cx, cy, size, color);
      break;
    case 'Manushya':
      person(g, cx, cy, size, color);
      break;
    case 'Tiryanch':
      leaf(g, cx, cy, size, color);
      break;
    case 'Narak':
      seedDrop(g, cx, cy, size, color);
      break;
  }
}
