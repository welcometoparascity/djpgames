import type { GatiName } from '../core/types';
export type { GatiName };

/**
 * Central visual theme. All colors/sizes used by rendering code should come
 * from here so the game reads as one cohesive, original premium system.
 */

export interface PlayerTheme {
  name: string;
  base: number; // main token/yard color
  dark: number; // ring/shadow shade
  light: number; // highlight shade
}

// Bright, saturated, high-contrast palette (v2) - replaces an earlier,
// noticeably paler/muddier set of colors per direct visual-quality feedback.
export const PLAYER_THEMES: readonly PlayerTheme[] = [
  { name: 'Marigold', base: 0xffa312, dark: 0xd97a00, light: 0xffe08a },
  { name: 'Jade', base: 0x0fd68a, dark: 0x0a9660, light: 0x8bffce },
  { name: 'Indigo', base: 0x4d6bff, dark: 0x2438c9, light: 0xb9c6ff },
  { name: 'Blossom', base: 0xff3d8e, dark: 0xc7115f, light: 0xffb3d6 },
];

export const PALETTE = {
  parchment: 0xfff6e6,
  parchmentShadow: 0xf0d9a8,
  plum: 0x3a2150,
  plumDeep: 0x1c0f30,
  gold: 0xffc34d,
  goldBright: 0xffe28a,
  ink: 0x2a1b3d,
  cream: 0xffffff,
  skyTop: 0x2a1660,
  skyBottom: 0xb23a7a,
  danger: 0xff3b57,
  success: 0x0fd68a,
};

export const GATI_ICON_COLOR = 0x2a1b3d;

export const GATI_ORDER: readonly GatiName[] = ['Dev', 'Manushya', 'Tiryanch', 'Narak'];

export const CANVAS = {
  width: 1080,
  height: 1080,
};

/** Classic 15x15 Ludo-style cross grid. */
export const GRID_SIZE = 15;

export const BOARD = {
  cellPx: 64,
  get gridPx(): number {
    return GRID_SIZE * this.cellPx;
  },
  get originX(): number {
    return (CANVAS.width - this.gridPx) / 2;
  },
  get originY(): number {
    return (CANVAS.height - this.gridPx) / 2;
  },
  cellRadius: 26,
  yardTokenSpacing: 46,
};
