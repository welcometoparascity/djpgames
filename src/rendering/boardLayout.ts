import { BOARD, GRID_SIZE } from '../config/theme';
import { relativeToShared, SHARED_TRACK_LENGTH, HOME_COLUMN_LENGTH } from '../core/board';

/**
 * Pixel geometry for the classic 15x15 square/cross Ludo-style board: four
 * corner yards, a plus-shaped 52-cell shared track, four private home-column
 * lanes leading into the center Moksha hub. Both the board texture artwork
 * and live Kukri sprite positions are derived from these same functions, so
 * pieces always align exactly with drawn cells.
 *
 * Grid cell (col, row), 0-indexed, 0..14. Center cell is (7,7) = Moksha.
 * Yards: player0=top-left, player1=top-right, player2=bottom-right, player3=bottom-left.
 */

export interface Point {
  x: number;
  y: number;
}
interface Cell {
  col: number;
  row: number;
}

function rotateCCW({ col, row }: Cell): Cell {
  return { col: (GRID_SIZE - 1) - row, row: col };
}

// Base quadrant (13 cells) for player 0: enters via the West arm's row-6
// lane (adjacent to the top-left yard), turns at the hub corner, then
// recedes up the North arm's col-6 lane to the outer edge.
const BASE_QUADRANT: Cell[] = [
  { col: 0, row: 6 },
  { col: 1, row: 6 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 6, row: 6 },
  { col: 6, row: 5 },
  { col: 6, row: 4 },
  { col: 6, row: 3 },
  { col: 6, row: 2 },
  { col: 6, row: 1 },
  { col: 6, row: 0 },
];

/** The 52 shared-track cells, in engine shared-index order (index 0 = player 0's entry square). */
export const LOOP_CELLS: readonly Cell[] = (() => {
  const cells: Cell[] = [];
  let quadrant = BASE_QUADRANT;
  for (let q = 0; q < 4; q++) {
    cells.push(...quadrant);
    quadrant = quadrant.map(rotateCCW);
  }
  return cells;
})();

// Player 0's home column: West arm's middle row (row 7), far edge (col 0) to
// the hub-adjacent cell (col 5). Rotated 90° CCW per player for the rest.
const BASE_HOME_COLUMN: Cell[] = [0, 1, 2, 3, 4, 5].map((col) => ({ col, row: 7 }));

const HOME_COLUMNS: readonly Cell[][] = [0, 1, 2, 3].map((p) => {
  let cells = BASE_HOME_COLUMN;
  for (let i = 0; i < p; i++) cells = cells.map(rotateCCW);
  return cells;
});

const YARD_CENTER_CELLS: readonly Cell[] = [
  { col: 2.5, row: 2.5 }, // player 0: top-left
  { col: 11.5, row: 2.5 }, // player 1: top-right
  { col: 11.5, row: 11.5 }, // player 2: bottom-right
  { col: 2.5, row: 11.5 }, // player 3: bottom-left
];

export const HUB_CELL: Cell = { col: 7, row: 7 };

function cellToPixel(cell: Cell): Point {
  return {
    x: BOARD.originX + cell.col * BOARD.cellPx + BOARD.cellPx / 2,
    y: BOARD.originY + cell.row * BOARD.cellPx + BOARD.cellPx / 2,
  };
}

export function pointOnRing(sharedIndex: number): Point {
  return cellToPixel(LOOP_CELLS[sharedIndex]);
}

export function pointOnSpoke(playerIndex: number, homeColumnIndex: number): Point {
  return cellToPixel(HOME_COLUMNS[playerIndex][homeColumnIndex]);
}

export function yardCenterFor(playerIndex: number): Point {
  return cellToPixel(YARD_CENTER_CELLS[playerIndex]);
}

/** Local slot offset (0-3) within a 2x2 yard arrangement, relative to yard center. */
export function yardSlotOffset(slot: 0 | 1 | 2 | 3): Point {
  const spacing = BOARD.yardTokenSpacing;
  const col = slot % 2 === 0 ? -1 : 1;
  const row = slot < 2 ? -1 : 1;
  return { x: (col * spacing) / 2, y: (row * spacing) / 2 };
}

export function hubPoint(): Point {
  return cellToPixel(HUB_CELL);
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pixel-space rect spanning grid cells [c0..c1] x [r0..r1] inclusive. */
export function gridRectPx(c0: number, r0: number, c1: number, r1: number): PixelRect {
  return {
    x: BOARD.originX + c0 * BOARD.cellPx,
    y: BOARD.originY + r0 * BOARD.cellPx,
    width: (c1 - c0 + 1) * BOARD.cellPx,
    height: (r1 - r0 + 1) * BOARD.cellPx,
  };
}

const YARD_RECT_CELLS: readonly [number, number, number, number][] = [
  [0, 0, 5, 5], // player 0: top-left
  [9, 0, 14, 5], // player 1: top-right
  [9, 9, 14, 14], // player 2: bottom-right
  [0, 9, 5, 14], // player 3: bottom-left
];

export function yardRectFor(playerIndex: number): PixelRect {
  const [c0, r0, c1, r1] = YARD_RECT_CELLS[playerIndex];
  return gridRectPx(c0, r0, c1, r1);
}

export function boardOuterRectPx(): PixelRect {
  return gridRectPx(0, 0, GRID_SIZE - 1, GRID_SIZE - 1);
}

/**
 * Converts a Kukri's engine-relative position (0..51 shared, 52..57 home
 * column, 58 Moksha) into an absolute board pixel position for a given player.
 */
export function boardPositionFor(playerIndex: number, relativePosition: number): Point {
  if (relativePosition >= SHARED_TRACK_LENGTH + HOME_COLUMN_LENGTH) {
    return hubPoint();
  }
  if (relativePosition >= SHARED_TRACK_LENGTH) {
    return pointOnSpoke(playerIndex, relativePosition - SHARED_TRACK_LENGTH);
  }
  const sharedIndex = relativeToShared(playerIndex, relativePosition);
  return pointOnRing(sharedIndex);
}
