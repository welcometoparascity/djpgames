import Phaser from 'phaser';
import { BOARD, CANVAS, GATI_ORDER, GATI_ICON_COLOR, PALETTE, PLAYER_THEMES, type GatiName } from '../config/theme';
import { drawGatiIcon } from './icons';
import {
  boardOuterRectPx,
  gridRectPx,
  hubPoint,
  pointOnRing,
  pointOnSpoke,
  yardCenterFor,
  yardRectFor,
  yardSlotOffset,
} from './boardLayout';
import { isSafeSharedSquare, SHARED_TRACK_LENGTH, HOME_COLUMN_LENGTH } from '../core/board';

export const KUKRI_TOKEN_SIZE = 60;
export const DIE_NORMAL_SIZE = 120;
export const DIE_GATI_SIZE = 140;

export function kukriTextureKey(playerIndex: number, gati: GatiName): string {
  return `kukri-${playerIndex}-${gati}`;
}
export function dieNormalKey(n: number): string {
  return `die-normal-${n}`;
}
export function dieGatiKey(gati: GatiName): string {
  return `die-gati-${gati}`;
}

/** Generates every original vector texture the game needs, once, at Preload time. */
export class TextureFactory {
  static generateAll(scene: Phaser.Scene): void {
    this.generateKukriTokens(scene);
    this.generateNormalDiceFaces(scene);
    this.generateGatiDiceFaces(scene);
    this.generateParticles(scene);
    this.generateBoard(scene);
    this.generateUiChrome(scene);
    this.generateEnvironment(scene);
  }

  private static generateEnvironment(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    // Soft cloud
    g.clear();
    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(40, 30, 70, 34);
    g.fillEllipse(72, 22, 50, 30);
    g.fillEllipse(14, 24, 44, 26);
    g.generateTexture('env-cloud', 110, 60);

    // Butterfly (two simple wing ellipses + body line)
    g.clear();
    g.fillStyle(PALETTE.gold, 0.9);
    g.fillEllipse(10, 12, 16, 20);
    g.fillEllipse(30, 12, 16, 20);
    g.fillStyle(PALETTE.plum, 1);
    g.fillRect(19, 4, 2, 18);
    g.generateTexture('env-butterfly', 40, 24);

    g.destroy();
  }

  private static generateKukriTokens(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    const size = KUKRI_TOKEN_SIZE;
    const cx = size / 2;
    const cy = size / 2 + 4;

    for (let p = 0; p < 4; p++) {
      const theme = PLAYER_THEMES[p];
      for (const gati of GATI_ORDER) {
        g.clear();
        // Soft shadow
        g.fillStyle(0x000000, 0.22);
        g.fillEllipse(cx, cy + size * 0.32, size * 0.68, size * 0.22);
        // Outer ring (dark shade)
        g.fillStyle(theme.dark, 1);
        g.fillCircle(cx, cy, size * 0.42);
        // Gem body (base color)
        g.fillStyle(theme.base, 1);
        g.fillCircle(cx, cy, size * 0.36);
        // Inner highlight gradient approximation (layered lighter circle offset up-left)
        g.fillStyle(theme.light, 0.55);
        g.fillCircle(cx - size * 0.08, cy - size * 0.1, size * 0.22);
        // Thin gold accent ring
        g.lineStyle(2, PALETTE.gold, 0.9);
        g.strokeCircle(cx, cy, size * 0.4);
        // Gloss highlight
        g.fillStyle(0xffffff, 0.35);
        g.fillEllipse(cx - size * 0.12, cy - size * 0.16, size * 0.22, size * 0.12);
        // Gati icon badge
        drawGatiIcon(g, gati, cx, cy, size * 0.17, GATI_ICON_COLOR);

        g.generateTexture(kukriTextureKey(p, gati), size, size + 8);
      }
    }
    g.destroy();
  }

  private static generateNormalDiceFaces(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    const size = DIE_NORMAL_SIZE;
    const pipLayouts: Record<number, [number, number][]> = {
      1: [[0.5, 0.5]],
      2: [
        [0.28, 0.28],
        [0.72, 0.72],
      ],
      3: [
        [0.28, 0.28],
        [0.5, 0.5],
        [0.72, 0.72],
      ],
      4: [
        [0.28, 0.28],
        [0.72, 0.28],
        [0.28, 0.72],
        [0.72, 0.72],
      ],
      5: [
        [0.28, 0.28],
        [0.72, 0.28],
        [0.5, 0.5],
        [0.28, 0.72],
        [0.72, 0.72],
      ],
      6: [
        [0.28, 0.25],
        [0.72, 0.25],
        [0.28, 0.5],
        [0.72, 0.5],
        [0.28, 0.75],
        [0.72, 0.75],
      ],
    };

    for (let n = 1; n <= 6; n++) {
      g.clear();
      g.fillStyle(0x000000, 0.2);
      g.fillRoundedRect(6, 10, size - 12, size - 12, 18);
      g.fillStyle(PALETTE.cream, 1);
      g.fillRoundedRect(2, 2, size - 12, size - 12, 18);
      g.lineStyle(3, PALETTE.gold, 1);
      g.strokeRoundedRect(2, 2, size - 12, size - 12, 18);
      g.fillStyle(PALETTE.plum, 1);
      for (const [px, py] of pipLayouts[n]) {
        g.fillCircle(2 + (size - 12) * px, 2 + (size - 12) * py, size * 0.07);
      }
      g.generateTexture(dieNormalKey(n), size, size);
    }
    g.destroy();
  }

  private static generateGatiDiceFaces(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    const size = DIE_GATI_SIZE;
    const colors: Record<GatiName, number> = {
      Dev: PLAYER_THEMES[0].base,
      Manushya: PLAYER_THEMES[1].base,
      Tiryanch: PLAYER_THEMES[2].base,
      Narak: PLAYER_THEMES[3].base,
    };
    for (const gati of GATI_ORDER) {
      g.clear();
      g.fillStyle(0x000000, 0.2);
      g.fillRoundedRect(6, 10, size - 12, size - 12, 26);
      g.fillStyle(PALETTE.plumDeep, 1);
      g.fillRoundedRect(2, 2, size - 12, size - 12, 26);
      g.lineStyle(3, colors[gati], 1);
      g.strokeRoundedRect(2, 2, size - 12, size - 12, 26);
      g.fillStyle(colors[gati], 0.18);
      g.fillCircle(size / 2, size / 2, size * 0.4);
      drawGatiIcon(g, gati, size / 2, size * 0.42, size * 0.2, 0xffffff);
      g.generateTexture(dieGatiKey(gati), size, size);
    }
    g.destroy();
  }

  private static generateParticles(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture('particle-spark', 16, 16);

    g.clear();
    g.fillStyle(PALETTE.goldBright, 1);
    g.save();
    g.translateCanvas(8, 8);
    g.rotateCanvas(Math.PI / 4);
    g.fillEllipse(0, 0, 14, 7);
    g.restore();
    g.generateTexture('particle-petal', 16, 16);
    g.destroy();
  }

  private static generateUiChrome(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    // Reusable rounded panel background for menus/dialogs.
    g.clear();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(4, 6, 512 - 8, 256 - 8, 28);
    g.fillStyle(PALETTE.parchment, 0.97);
    g.fillRoundedRect(0, 0, 512 - 8, 256 - 8, 28);
    g.lineStyle(3, PALETTE.gold, 1);
    g.strokeRoundedRect(0, 0, 512 - 8, 256 - 8, 28);
    g.generateTexture('panel', 512, 256);
    g.destroy();
  }

  private static generateBoard(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    const { width, height } = CANVAS;
    g.clear();

    // Sky/backdrop gradient approximation via banded rects.
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(PALETTE.skyTop),
        Phaser.Display.Color.ValueToColor(PALETTE.skyBottom),
        bands,
        i,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      g.fillRect(0, (height / bands) * i, width, height / bands + 1);
      void t;
    }

    // Distant soft "mountains" (Jain-inspired layered hills), subtle and non-cluttered.
    g.fillStyle(0x50407a, 0.35);
    g.fillEllipse(width * 0.2, height * 0.12, 420, 140);
    g.fillEllipse(width * 0.82, height * 0.08, 480, 130);
    g.fillStyle(0x6a5596, 0.3);
    g.fillEllipse(width * 0.5, height * 0.05, 600, 110);

    // Parchment board square (classic cross-board silhouette)
    const outer = boardOuterRectPx();
    const pad = 16;
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(outer.x - pad + 6, outer.y - pad + 10, outer.width + pad * 2, outer.height + pad * 2, 28);
    g.fillStyle(PALETTE.parchment, 1);
    g.fillRoundedRect(outer.x - pad, outer.y - pad, outer.width + pad * 2, outer.height + pad * 2, 28);
    g.lineStyle(6, PALETTE.gold, 1);
    g.strokeRoundedRect(outer.x - pad, outer.y - pad, outer.width + pad * 2, outer.height + pad * 2, 28);

    // The plus-shaped track band (behind individual cells), classic cross topology.
    const vBand = gridRectPx(6, 0, 8, 14);
    const hBand = gridRectPx(0, 6, 14, 8);
    g.fillStyle(PALETTE.cream, 1);
    g.fillRect(vBand.x, vBand.y, vBand.width, vBand.height);
    g.fillRect(hBand.x, hBand.y, hBand.width, hBand.height);
    g.lineStyle(3, PALETTE.parchmentShadow, 1);
    g.strokeRect(vBand.x, vBand.y, vBand.width, vBand.height);
    g.strokeRect(hBand.x, hBand.y, hBand.width, hBand.height);

    // Home-column lanes (colored per player, leading from the track into the hub)
    for (let p = 0; p < 4; p++) {
      const theme = PLAYER_THEMES[p];
      for (let h = 0; h < HOME_COLUMN_LENGTH; h++) {
        const pt = pointOnSpoke(p, h);
        drawCell(g, pt.x, pt.y, theme.base, theme.dark, 0.85);
      }
    }

    // Shared track: 52 cells
    for (let i = 0; i < SHARED_TRACK_LENGTH; i++) {
      const pt = pointOnRing(i);
      const safe = isSafeSharedSquare(i);
      const entryOwner = i % 13 === 0 ? Math.floor(i / 13) : -1;
      if (entryOwner >= 0) {
        drawCell(g, pt.x, pt.y, PLAYER_THEMES[entryOwner].base, PLAYER_THEMES[entryOwner].dark, 0.92);
      } else {
        drawCell(g, pt.x, pt.y, PALETTE.cream, PALETTE.parchmentShadow, 0.92);
      }
      if (safe) {
        g.fillStyle(PALETTE.gold, 0.95);
        drawStar(g, pt.x, pt.y, BOARD.cellRadius * 0.5);
      }
    }

    // Center Moksha / Siddhashila mandala hub (fills the 3x3 center block)
    const hub = hubPoint();
    const hubRadius = BOARD.cellPx * 1.45;
    for (let r = hubRadius; r > 0; r -= 10) {
      const t = r / hubRadius;
      g.fillStyle(PALETTE.goldBright, 0.12 + (1 - t) * 0.35);
      g.fillCircle(hub.x, hub.y, r);
    }
    g.lineStyle(4, PALETTE.gold, 1);
    g.strokeCircle(hub.x, hub.y, hubRadius);
    const petals = 12;
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2;
      const px = hub.x + Math.cos(angle) * (hubRadius - 14);
      const py = hub.y + Math.sin(angle) * (hubRadius - 14);
      g.fillStyle(PALETTE.cream, 0.9);
      g.save();
      g.translateCanvas(px, py);
      g.rotateCanvas(angle);
      g.fillEllipse(0, 0, 30, 14);
      g.restore();
    }
    g.fillStyle(PALETTE.plum, 1);
    drawStar(g, hub.x, hub.y, 26);

    // Yards: classic 6x6 corner bases
    for (let p = 0; p < 4; p++) {
      const theme = PLAYER_THEMES[p];
      const rect = yardRectFor(p);
      g.fillStyle(0x000000, 0.18);
      g.fillRoundedRect(rect.x + 4, rect.y + 6, rect.width, rect.height, 24);
      g.fillStyle(theme.base, 0.24);
      g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 24);
      g.lineStyle(5, theme.dark, 0.9);
      g.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 24);
      // Inner white plaque holding the 4 kukri slots, classic Ludo yard look.
      const plaqueMargin = rect.width * 0.16;
      g.fillStyle(PALETTE.cream, 0.9);
      g.fillRoundedRect(rect.x + plaqueMargin, rect.y + plaqueMargin, rect.width - plaqueMargin * 2, rect.height - plaqueMargin * 2, 18);
      g.lineStyle(3, theme.dark, 0.6);
      g.strokeRoundedRect(rect.x + plaqueMargin, rect.y + plaqueMargin, rect.width - plaqueMargin * 2, rect.height - plaqueMargin * 2, 18);

      const yc = yardCenterFor(p);
      for (let slot = 0 as 0 | 1 | 2 | 3; slot < 4; slot++) {
        const off = yardSlotOffset(slot);
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(yc.x + off.x, yc.y + off.y, BOARD.yardTokenSpacing * 0.42);
        g.lineStyle(2, theme.dark, 0.7);
        g.strokeCircle(yc.x + off.x, yc.y + off.y, BOARD.yardTokenSpacing * 0.42);
      }
    }

    g.generateTexture('board', width, height);
    g.destroy();
  }
}

/** A single classic-Ludo-style track cell: a rounded square, not a circle. */
function drawCell(g: Phaser.GameObjects.Graphics, cx: number, cy: number, fill: number, stroke: number, alpha: number): void {
  const s = BOARD.cellRadius * 1.8;
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(cx - s / 2, cy - s / 2, s, s, 5);
  g.lineStyle(1.5, stroke, 1);
  g.strokeRoundedRect(cx - s / 2, cy - s / 2, s, s, 5);
}

function drawStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  const points: { x: number; y: number }[] = [];
  const spikes = 5;
  const inner = r * 0.45;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? r : inner;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  g.fillPoints(points, true);
}
