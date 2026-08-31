/**
 * Board geometry and path math. See GAME_RULES.md §2.
 * All Kukri positions are stored relative to their own player's path;
 * these helpers convert between relative and shared-track coordinates.
 */

export const SHARED_TRACK_LENGTH = 52;
export const HOME_COLUMN_LENGTH = 6;
export const MOKSHA_POSITION = SHARED_TRACK_LENGTH + HOME_COLUMN_LENGTH; // 58
export const ENTRY_SPACING = SHARED_TRACK_LENGTH / 4; // 13

/** Shared-track entry index for a given player (0-3). */
export function entrySquareFor(playerIndex: number): number {
  return (playerIndex * ENTRY_SPACING) % SHARED_TRACK_LENGTH;
}

/** Safe squares on the shared track: every entry square, and the star square
 * 8 steps after each entry square. */
export function isSafeSharedSquare(sharedIndex: number): boolean {
  const normalized = ((sharedIndex % SHARED_TRACK_LENGTH) + SHARED_TRACK_LENGTH) % SHARED_TRACK_LENGTH;
  for (let p = 0; p < 4; p++) {
    const entry = entrySquareFor(p);
    if (normalized === entry) return true;
    if (normalized === (entry + 8) % SHARED_TRACK_LENGTH) return true;
  }
  return false;
}

/** True if a relative position is still on the shared loop (capturable / blockable zone). */
export function isOnSharedTrack(relativePosition: number): boolean {
  return relativePosition >= 0 && relativePosition < SHARED_TRACK_LENGTH;
}

/** True if a relative position is inside the player's private home column (not shared, not Moksha). */
export function isInHomeColumn(relativePosition: number): boolean {
  return relativePosition >= SHARED_TRACK_LENGTH && relativePosition < MOKSHA_POSITION;
}

/** Converts a player's relative position into a shared-track index. Only valid
 * while isOnSharedTrack(relativePosition) is true. */
export function relativeToShared(playerIndex: number, relativePosition: number): number {
  return (entrySquareFor(playerIndex) + relativePosition) % SHARED_TRACK_LENGTH;
}

/** Inverse of relativeToShared: converts a shared-track index into the
 * relative position it represents for a given player. Always non-negative. */
export function sharedToRelative(playerIndex: number, sharedIndex: number): number {
  return ((sharedIndex - entrySquareFor(playerIndex)) % SHARED_TRACK_LENGTH + SHARED_TRACK_LENGTH) % SHARED_TRACK_LENGTH;
}
