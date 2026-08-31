/**
 * localStorage-backed persistence for settings, tutorial completion, and
 * basic player-configuration/statistics (GAME_RULES.md is silent on this;
 * see spec §24). Every read is defensive - a corrupted or absent value must
 * never crash the game, only fall back to defaults.
 */

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  muted: boolean;
  language: 'en' | 'hi' | 'gu';
  hasSeenHowToPlay: boolean;
  lastPlayerConfig: { playerCount: 2 | 4; bots: boolean[]; difficulties: ('easy' | 'medium' | 'hard')[] } | null;
}

const STORAGE_KEY = 'jain-ludo:settings:v1';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.9,
  voiceVolume: 0.9,
  muted: false,
  language: 'en',
  hasSeenHowToPlay: false,
  lastPlayerConfig: null,
};

function isStorageAvailable(): boolean {
  try {
    const testKey = '__jain_ludo_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export class SettingsStore {
  private cache: GameSettings;
  private readonly available: boolean;

  constructor() {
    this.available = isStorageAvailable();
    this.cache = this.load();
  }

  private load(): GameSettings {
    if (!this.available) return { ...DEFAULT_SETTINGS };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private persist(): void {
    if (!this.available) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // Storage full/blocked - settings simply won't persist this session.
    }
  }

  get(): GameSettings {
    return { ...this.cache };
  }

  update(patch: Partial<GameSettings>): GameSettings {
    this.cache = { ...this.cache, ...patch };
    this.persist();
    return this.get();
  }
}

export const settingsStore = new SettingsStore();
