import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { ModeSelectScene } from './scenes/ModeSelectScene';
import { HowToPlayScene } from './scenes/HowToPlayScene';
import { RulesScene } from './scenes/RulesScene';
import { SettingsScene } from './scenes/SettingsScene';
import { GameScene } from './scenes/GameScene';
import { VictoryScene } from './scenes/VictoryScene';

const config: Phaser.Types.Core.GameConfig = {
  // CANVAS rather than AUTO/WEBGL: every texture in this game is generated
  // procedurally via generateTexture() (see TextureFactory), which triggers a
  // GPU->CPU pixel readback on WebGL. That readback is a measured, severe
  // stall on software-rendered/low-end GPUs. Canvas2D avoids it entirely and
  // is plenty fast for this game's flat vector art - a deliberate
  // performance/compatibility choice (see TEST_REPORT.md).
  type: Phaser.CANVAS,
  parent: 'game-container',
  backgroundColor: '#0b1024',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1080,
    height: 1080,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, PreloadScene, MainMenuScene, ModeSelectScene, HowToPlayScene, RulesScene, SettingsScene, GameScene, VictoryScene],
};

const game = new Phaser.Game(config);

// Exposed for debugging/QA only (harmless for a client-side game with no
// secrets) - lets automated smoke tests and developers inspect live scenes.
(window as unknown as { __game: Phaser.Game }).__game = game;
