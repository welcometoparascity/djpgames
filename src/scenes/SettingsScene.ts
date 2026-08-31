import Phaser from 'phaser';
import { PALETTE } from '../config/theme';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';
import { audioManager } from '../audio/AudioManager';
import { settingsStore } from '../storage/SettingsStore';

export interface SettingsData {
  /** When set to 'Game', Settings opens as a pause overlay on top of the
   * paused Game scene and offers Resume instead of replacing it. */
  returnTo?: 'Game';
}

/** A proper modal overlay: launched on top of (and pausing) the caller,
 * never stops/restarts an in-progress game. See GameScene.createPauseButton
 * and TEST_REPORT.md for the bug this fixes. */
export class SettingsScene extends Phaser.Scene {
  private returnTo?: 'Game';

  constructor() {
    super('Settings');
  }

  create(data: SettingsData): void {
    this.returnTo = data?.returnTo;
    this.scene.bringToTop();

    const { width, height } = this.scale;

    // Full-screen dim scrim so whatever is behind (paused Game, or Main Menu
    // background) reads clearly as "underneath a modal", never hidden/reset.
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0714, 0.72).setDepth(0);

    const panelW = Math.min(640, width - 60);
    const panelH = Math.min(600, height - 60);
    const panelX = width / 2;
    const panelY = height / 2;
    // NOTE: fillGradientStyle is not reliably supported under the Canvas
    // renderer (this game deliberately uses Phaser.CANVAS - see main.ts), so
    // the panel's vertical gradient is faked with stacked bands, clipped to
    // the rounded-rect shape via a geometry mask.
    const r = 32;
    const shadow = this.add.graphics().setDepth(1);
    shadow.fillStyle(0x000000, 0.35);
    shadow.fillRoundedRect(panelX - panelW / 2 + 6, panelY - panelH / 2 + 10, panelW, panelH, r);

    const panel = this.add.graphics().setDepth(1);
    const bands = 20;
    for (let i = 0; i < bands; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x33205a),
        Phaser.Display.Color.ValueToColor(0x180d2c),
        bands,
        i,
      );
      panel.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      const bandTop = panelY - panelH / 2 + (panelH / bands) * i;
      panel.fillRect(panelX - panelW / 2, bandTop, panelW, panelH / bands + 1);
    }
    const maskShape = this.add.graphics().setVisible(false);
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, r);
    panel.setMask(maskShape.createGeometryMask());

    const border = this.add.graphics().setDepth(1);
    border.lineStyle(3, PALETTE.gold, 1);
    border.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, r);

    const top = panelY - panelH / 2;
    this.add
      .text(panelX, top + 44, 'SETTINGS', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '32px', color: '#f4cf8a', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(2);

    const settings = settingsStore.get();
    const labelX = panelX - 60;
    const sliderX = panelX + 110;
    const sliderTrackWidth = 160;
    let y = top + 108;
    const rowGap = 56;

    const rows: { label: string; key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'voiceVolume'; apply: (v: number) => void }[] = [
      { label: 'Master Volume', key: 'masterVolume', apply: (v) => audioManager.setVolumes({ master: v }) },
      { label: 'Music Volume', key: 'musicVolume', apply: (v) => audioManager.setVolumes({ music: v }) },
      { label: 'SFX Volume', key: 'sfxVolume', apply: (v) => audioManager.setVolumes({ sfx: v }) },
      { label: 'Voice Volume', key: 'voiceVolume', apply: (v) => audioManager.setVolumes({ voice: v }) },
    ];

    for (const row of rows) {
      this.add.text(labelX, y, row.label, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '17px', color: '#fbf3e1' }).setOrigin(1, 0.5).setDepth(2);
      new Slider(this, sliderX, y, sliderTrackWidth, settings[row.key], (v) => {
        row.apply(v);
        settingsStore.update({ [row.key]: v } as Partial<typeof settings>);
      }).setDepth(2);
      y += rowGap;
    }

    let muted = settings.muted;
    const muteButton = new Button(
      this,
      panelX,
      y + 4,
      muted ? 'UNMUTE' : 'MUTE ALL SOUND',
      () => {
        muted = !muted;
        audioManager.setMuted(muted);
        settingsStore.update({ muted });
        muteButton.setLabel(muted ? 'UNMUTE' : 'MUTE ALL SOUND');
      },
      { variant: 'secondary', width: 240, height: 48, fontSize: 18 },
    ).setDepth(2);
    y += rowGap + 12;

    this.add.text(labelX, y, 'Language', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '17px', color: '#fbf3e1' }).setOrigin(1, 0.5).setDepth(2);
    const languages: Array<{ code: 'en' | 'hi' | 'gu'; label: string }> = [
      { code: 'en', label: 'EN' },
      { code: 'hi', label: 'HI' },
      { code: 'gu', label: 'GU' },
    ];
    languages.forEach((lang, i) => {
      new Button(
        this,
        sliderX - 60 + i * 80,
        y,
        lang.label,
        () => {
          settingsStore.update({ language: lang.code });
          this.scene.restart(data);
        },
        { width: 68, height: 42, fontSize: 15, variant: settings.language === lang.code ? 'primary' : 'secondary' },
      ).setDepth(2);
    });
    y += rowGap;

    new Button(
      this,
      panelX,
      y + 2,
      this.scale.isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN',
      () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
      },
      { variant: 'secondary', width: 240, height: 44, fontSize: 16 },
    ).setDepth(2);

    const bottom = panelY + panelH / 2;
    if (this.returnTo === 'Game') {
      new Button(this, panelX, bottom - 78, 'RESUME', () => this.resumeGame(), { variant: 'primary', width: 240, height: 56, fontSize: 22 }).setDepth(2);
      new Button(
        this,
        panelX,
        bottom - 24,
        'QUIT TO MAIN MENU',
        () => {
          this.scene.stop('Game');
          this.scene.stop();
          this.scene.start('MainMenu');
        },
        { variant: 'ghost', width: 240, height: 40, fontSize: 15 },
      ).setDepth(2);
    } else {
      new Button(this, panelX, bottom - 40, 'BACK', () => this.scene.start('MainMenu'), { variant: 'primary', width: 200, height: 52, fontSize: 20 }).setDepth(2);
    }
  }

  private resumeGame(): void {
    this.scene.resume('Game');
    this.scene.stop();
  }
}
