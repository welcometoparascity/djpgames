import Phaser from 'phaser';
import { PALETTE } from '../config/theme';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';
import { audioManager } from '../audio/AudioManager';
import { settingsStore } from '../storage/SettingsStore';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.skyTop);
    this.add.image(width / 2, height / 2, 'board').setDisplaySize(width, height).setAlpha(0.25).setDepth(-20);

    this.add
      .text(width / 2, 50, 'SETTINGS', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '32px', color: '#f4cf8a', fontStyle: 'bold' })
      .setOrigin(0.5);

    const settings = settingsStore.get();
    const labelX = width / 2 - 40;
    const sliderX = width / 2 + 130;
    const sliderTrackWidth = 180;
    let y = 140;
    const rowGap = 64;

    const rows: { label: string; key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'voiceVolume'; apply: (v: number) => void }[] = [
      { label: 'Master Volume', key: 'masterVolume', apply: (v) => audioManager.setVolumes({ master: v }) },
      { label: 'Music Volume', key: 'musicVolume', apply: (v) => audioManager.setVolumes({ music: v }) },
      { label: 'SFX Volume', key: 'sfxVolume', apply: (v) => audioManager.setVolumes({ sfx: v }) },
      { label: 'Voice Volume', key: 'voiceVolume', apply: (v) => audioManager.setVolumes({ voice: v }) },
    ];

    for (const row of rows) {
      this.add.text(labelX, y, row.label, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: '#fbf3e1' }).setOrigin(1, 0.5);
      new Slider(this, sliderX, y, sliderTrackWidth, settings[row.key], (v) => {
        row.apply(v);
        settingsStore.update({ [row.key]: v } as Partial<typeof settings>);
      });
      y += rowGap;
    }

    // Mute toggle
    let muted = settings.muted;
    const muteButton = new Button(
      this,
      width / 2,
      y + 10,
      muted ? 'UNMUTE' : 'MUTE ALL SOUND',
      () => {
        muted = !muted;
        audioManager.setMuted(muted);
        settingsStore.update({ muted });
        muteButton.setLabel(muted ? 'UNMUTE' : 'MUTE ALL SOUND');
      },
      { variant: 'secondary', width: 260 },
    );
    y += rowGap + 20;

    // Language selector (architecture-ready for future translated UI / voice - see VOICE_MANIFEST.md)
    this.add.text(labelX, y, 'Language (voice-ready)', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: '#fbf3e1' }).setOrigin(1, 0.5);
    const languages: Array<{ code: 'en' | 'hi' | 'gu'; label: string }> = [
      { code: 'en', label: 'EN' },
      { code: 'hi', label: 'HI' },
      { code: 'gu', label: 'GU' },
    ];
    languages.forEach((lang, i) => {
      new Button(
        this,
        sliderX - 40 + i * 90,
        y,
        lang.label,
        () => {
          settingsStore.update({ language: lang.code });
          this.scene.restart();
        },
        { width: 76, height: 44, fontSize: 16, variant: settings.language === lang.code ? 'primary' : 'secondary' },
      );
    });
    y += rowGap;

    new Button(
      this,
      width / 2,
      y + 6,
      this.scale.isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN',
      () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
      },
      { variant: 'secondary', width: 260 },
    );

    new Button(this, 90, height - 40, 'BACK', () => this.scene.start('MainMenu'), { variant: 'ghost', width: 140, height: 48, fontSize: 18 });
  }
}
