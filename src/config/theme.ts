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

export const PLAYER_THEMES: readonly PlayerTheme[] = [
  { name: 'Marigold', base: 0xf2a93b, dark: 0xc07f1c, light: 0xffd98a },
  { name: 'Jade', base: 0x2fae7a, dark: 0x18734f, light: 0x8be0bd },
  { name: 'Indigo', base: 0x4c6fe7, dark: 0x2f47a8, light: 0xa9bcff },
  { name: 'Blossom', base: 0xe0578c, dark: 0xa83564, light: 0xffb0cf },
];

export const PALETTE = {
  parchment: 0xfbf3e1,
  parchmentShadow: 0xead9b8,
  plum: 0x3a2150,
  plumDeep: 0x241335,
  gold: 0xd8a34e,
  goldBright: 0xf4cf8a,
  ink: 0x2a1b3d,
  cream: 0xfffaf0,
  skyTop: 0x2a2359,
  skyBottom: 0x6a4a8f,
  danger: 0xd6455a,
  success: 0x2fae7a,
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
