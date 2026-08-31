/**
 * Small deterministic PRNG (mulberry32) so games can be seeded for
 * reproducible automated tests, while defaulting to real randomness in play.
 */
export class Rng {
  private state: number;

  constructor(seed?: number) {
    this.state = (seed ?? Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}
