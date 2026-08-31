import Phaser from 'phaser';
import { GameEngine } from '../core/GameEngine';
import type { GatiName, Kukri, MoveOutcome } from '../core/types';
import { boardPositionFor, hubPoint, yardCenterFor, yardSlotOffset } from '../rendering/boardLayout';
import { dieGatiKey, dieNormalKey, kukriTextureKey, KUKRI_TOKEN_SIZE } from '../rendering/TextureFactory';
import { CANVAS, GATI_ORDER, PALETTE, PLAYER_THEMES } from '../config/theme';
import { decideMove, decideYardKukriToEnter } from '../bots/Bot';
import { audioManager } from '../audio/AudioManager';
import type { GameLaunchConfig } from './ModeSelectScene';
import { AmbientEnvironment } from '../rendering/AmbientEnvironment';

type SelectionMode = 'none' | 'entry' | 'move';

function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export class GameScene extends Phaser.Scene {
  private engine!: GameEngine;
  private kukriSprites = new Map<string, Phaser.GameObjects.Image>();
  private halos = new Map<string, Phaser.GameObjects.Arc>();
  private normalDie!: Phaser.GameObjects.Image;
  private gatiDie!: Phaser.GameObjects.Image;
  private turnBanner!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private playerBadges: { bg: Phaser.GameObjects.Arc; pips: Phaser.GameObjects.Arc[] }[] = [];
  private selectionMode: SelectionMode = 'none';
  private busy = false;

  constructor() {
    super('Game');
  }

  create(data: GameLaunchConfig): void {
    const { width, height } = this.scale;
    this.busy = false;
    this.selectionMode = 'none';
    this.kukriSprites.clear();
    this.halos.clear();
    this.playerBadges = [];

    this.engine = new GameEngine({ players: data.players, seed: Date.now() });

    this.cameras.main.setBackgroundColor(PALETTE.skyTop);
    const headerHeight = 150;
    const footerHeight = 150;
    const availableHeight = height - headerHeight - footerHeight;
    const scale = Math.min(width, availableHeight) / CANVAS.width;
    const boardImg = this.add.image(width / 2, headerHeight + availableHeight / 2, 'board').setScale(scale);
    new AmbientEnvironment(this, width, height, headerHeight);
    audioManager.ensureStarted();
    audioManager.startAmbientMusic();

    // A container that mirrors the board's scale/position so board-space math
    // (boardPositionFor etc, authored for a 1080x1080 canvas) maps directly.
    this.boardOffsetX = boardImg.x - (CANVAS.width / 2) * scale;
    this.boardOffsetY = boardImg.y - (CANVAS.height / 2) * scale;
    this.boardScale = scale;

    this.createHeaderPanel(headerHeight);
    this.createPlayerBadges(data.players.length);
    this.createKukriSprites();
    this.createDice();
    this.createHud();
    this.createPauseButton();

    this.beginTurnUI();
  }

  private boardOffsetX = 0;
  private boardOffsetY = 0;
  private boardScale = 1;

  private toScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.boardOffsetX + x * this.boardScale, y: this.boardOffsetY + y * this.boardScale };
  }

  // ---------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------

  private createHeaderPanel(headerHeight: number): void {
    const { width } = this.scale;
    const panel = this.add.graphics().setDepth(20);
    panel.fillStyle(PALETTE.plumDeep, 0.55);
    panel.fillRect(0, 0, width, headerHeight);
    panel.lineStyle(2, PALETTE.gold, 0.4);
    panel.lineBetween(0, headerHeight, width, headerHeight);
  }

  private createPlayerBadges(count: number): void {
    const { width } = this.scale;
    const gap = width / (count + 1);
    for (let p = 0; p < count; p++) {
      const theme = PLAYER_THEMES[p];
      const x = gap * (p + 1);
      const y = 34;
      const bg = this.add.circle(x, y, 22, theme.base).setStrokeStyle(3, theme.dark).setDepth(21);
      const pips: Phaser.GameObjects.Arc[] = [];
      for (let i = 0; i < 4; i++) {
        const pip = this.add.circle(x - 21 + i * 14, y + 30, 5, 0xffffff, 0.25).setStrokeStyle(1, theme.dark, 0.6).setDepth(21);
        pips.push(pip);
      }
      this.playerBadges.push({ bg, pips });
    }
    this.refreshBadges();
  }

  private refreshBadges(): void {
    const state = this.engine.getState();
    state.players.forEach((player, p) => {
      const badge = this.playerBadges[p];
      badge.bg.setStrokeStyle(p === state.currentPlayerIndex ? 5 : 3, PALETTE.gold, p === state.currentPlayerIndex ? 1 : 0.6);
      badge.pips.forEach((pip, i) => {
        pip.setFillStyle(i < player.finishedCount ? PALETTE.gold : 0xffffff, i < player.finishedCount ? 1 : 0.25);
      });
    });
  }

  private createKukriSprites(): void {
    const state = this.engine.getState();
    for (const player of state.players) {
      player.kukris.forEach((kukri, slotIndex) => {
        const pos = this.yardScreenPosition(player.index, slotIndex as 0 | 1 | 2 | 3);
        const img = this.add
          .image(pos.x, pos.y, kukriTextureKey(player.index, kukri.gati))
          .setScale(this.boardScale)
          .setDepth(10);
        img.on('pointerdown', () => this.onKukriClicked(kukri.id));
        this.kukriSprites.set(kukri.id, img);
      });
    }
  }

  private yardScreenPosition(playerIndex: number, slot: 0 | 1 | 2 | 3): { x: number; y: number } {
    const center = yardCenterFor(playerIndex);
    const off = yardSlotOffset(slot);
    return this.toScreen(center.x + off.x, center.y + off.y);
  }

  private kukriScreenPosition(kukri: Kukri): { x: number; y: number } {
    if (kukri.state === 'YARD') {
      const player = this.engine.getState().players[kukri.playerIndex];
      const slot = player.kukris.indexOf(kukri) as 0 | 1 | 2 | 3;
      return this.yardScreenPosition(kukri.playerIndex, slot);
    }
    const p = boardPositionFor(kukri.playerIndex, kukri.position);
    return this.toScreen(p.x, p.y);
  }

  private createDice(): void {
    const { width, height } = this.scale;
    const footerHeight = 150;
    const panel = this.add.graphics().setDepth(20);
    panel.fillStyle(PALETTE.plumDeep, 0.55);
    panel.fillRect(0, height - footerHeight, width, footerHeight);
    panel.lineStyle(2, PALETTE.gold, 0.4);
    panel.lineBetween(0, height - footerHeight, width, height - footerHeight);

    const dieY = height - footerHeight / 2 - 6;
    this.gatiDie = this.add
      .image(width / 2 - 90, dieY, dieGatiKey('Dev'))
      .setScale(0.55)
      .setDepth(21)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.onGatiDieClicked());
    this.normalDie = this.add
      .image(width / 2 + 90, dieY, dieNormalKey(1))
      .setScale(0.55)
      .setDepth(21)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.onNormalDieClicked());
  }

  private createHud(): void {
    const { width } = this.scale;
    this.turnBanner = this.add
      .text(width / 2, 108, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', color: '#fbf3e1', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(21);
    this.hintText = this.add
      .text(width / 2, 134, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: '#f4cf8a' })
      .setOrigin(0.5)
      .setDepth(21);
  }

  private createPauseButton(): void {
    const gear = this.add
      .text(this.scale.width - 32, 32, '⚙', { fontSize: '28px', color: '#fbf3e1' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        // Pause (not stop) so the in-progress match and its state are fully
        // preserved - Settings launches as an overlay on top and resumes us.
        this.scene.pause();
        this.scene.launch('Settings', { returnTo: 'Game' });
      });
    gear.setDepth(50);
  }

  private toast(message: string): void {
    const { width } = this.scale;
    const t = this.add
      .text(width / 2, 172, message, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: '#ffffff', backgroundColor: '#3a2150', padding: { x: 12, y: 6 } })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(60);
    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: 150,
      yoyo: true,
      hold: 900,
      onComplete: () => t.destroy(),
    });
  }

  // ---------------------------------------------------------------------
  // Turn orchestration
  // ---------------------------------------------------------------------

  private beginTurnUI(): void {
    this.clearHighlights();
    this.refreshBadges();
    if (this.engine.isGameOver()) {
      this.onGameOver();
      return;
    }
    const player = this.engine.getCurrentPlayer();
    const theme = PLAYER_THEMES[player.index];
    this.turnBanner.setText(`Player ${player.index + 1}'s Turn${player.isBot ? ` (Bot · ${player.botDifficulty})` : ''}`);
    this.turnBanner.setColor(intToHex(theme.base));
    audioManager.playSfx('turnChange');

    this.setDiceEnabled(false, false);
    this.busy = false;

    if (player.isBot) {
      this.time.delayedCall(650, () => this.runBotEntryStep());
      return;
    }

    if (this.engine.getState().phase === 'ENTRY') {
      this.hintText.setText('Roll the Gati Pasa - only Manushya brings a Kukri out.');
      this.setDiceEnabled(true, false);
    } else {
      this.hintText.setText('Roll the Normal Pasa to move.');
      this.setDiceEnabled(false, true);
    }
  }

  private setDiceEnabled(gati: boolean, normal: boolean): void {
    this.gatiDie.setAlpha(gati ? 1 : 0.4);
    this.normalDie.setAlpha(normal ? 1 : 0.4);
    if (gati) this.gatiDie.setInteractive(); else this.gatiDie.disableInteractive();
    if (normal) this.normalDie.setInteractive(); else this.normalDie.disableInteractive();
  }

  private clearHighlights(): void {
    this.selectionMode = 'none';
    this.halos.forEach((h) => h.destroy());
    this.halos.clear();
  }

  private highlightSelectable(kukriIds: string[], mode: SelectionMode): void {
    this.selectionMode = mode;
    for (const id of kukriIds) {
      const sprite = this.kukriSprites.get(id);
      if (!sprite) continue;
      const halo = this.add.circle(sprite.x, sprite.y, KUKRI_TOKEN_SIZE * 0.55 * this.boardScale, PALETTE.gold, 0.35).setDepth(9);
      this.tweens.add({ targets: halo, scale: 1.3, alpha: 0.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.halos.set(id, halo);
    }
  }

  private onGameOver(): void {
    const state = this.engine.getState();
    audioManager.playSfx('victory');
    this.time.delayedCall(1400, () => {
      this.scene.start('Victory', { winnerIndex: state.winnerIndex });
    });
  }

  // ---------------------------------------------------------------------
  // Human input handlers
  // ---------------------------------------------------------------------

  private onGatiDieClicked(): void {
    if (this.busy || this.engine.getCurrentPlayer().isBot) return;
    if (this.engine.getState().phase !== 'ENTRY' || this.engine.getState().gatiRolledThisInstance) return;
    this.busy = true;
    this.setDiceEnabled(false, false);
    const result = this.engine.rollGatiPasa();
    if (!result.ok) {
      this.busy = false;
      return;
    }
    this.animateGatiDie(result.result, () => {
      if (result.enteredAutoSkipped) {
        this.hintText.setText('No entry this time. Roll the Normal Pasa.');
        this.busy = false;
        this.setDiceEnabled(false, true);
      } else {
        const player = this.engine.getCurrentPlayer();
        const yardIds = player.kukris.filter((k) => k.state === 'YARD').map((k) => k.id);
        this.hintText.setText('Manushya! Choose a Kukri to bring out.');
        this.highlightSelectable(yardIds, 'entry');
        this.busy = false;
      }
    });
  }

  private onNormalDieClicked(): void {
    if (this.busy || this.engine.getCurrentPlayer().isBot) return;
    if (this.engine.getState().phase !== 'MOVEMENT' || this.engine.getState().entryChoicePending || this.engine.getState().normalRolledThisInstance) return;
    this.busy = true;
    this.setDiceEnabled(false, false);
    const result = this.engine.rollNormalPasa();
    if (!result.ok) {
      this.busy = false;
      return;
    }
    this.animateNormalDie(result.roll, () => {
      if (result.turnPassed) {
        this.toast(result.legalMoveKukriIds.length === 0 ? 'No legal move.' : 'Turn passed.');
        this.busy = false;
        this.time.delayedCall(500, () => this.beginTurnUI());
      } else {
        this.hintText.setText('Choose a Kukri to move.');
        this.highlightSelectable(result.legalMoveKukriIds, 'move');
        this.busy = false;
      }
    });
  }

  private onKukriClicked(kukriId: string): void {
    if (this.busy) return;
    if (this.selectionMode === 'entry') {
      if (!this.halos.has(kukriId)) return;
      this.busy = true;
      this.clearHighlights();
      const result = this.engine.chooseEntryKukri(kukriId);
      if (!result.ok) {
        this.busy = false;
        return;
      }
      this.animateKukriEnter(kukriId, () => {
        this.busy = false;
        this.hintText.setText('Roll the Normal Pasa.');
        this.setDiceEnabled(false, true);
      });
    } else if (this.selectionMode === 'move') {
      if (!this.halos.has(kukriId)) return;
      this.busy = true;
      this.clearHighlights();
      const result = this.engine.moveKukri(kukriId);
      if (!result.ok) {
        this.busy = false;
        return;
      }
      this.animateMove(result, () => {
        this.busy = false;
        if (result.gameOver) this.onGameOver();
        else this.beginTurnUI();
      });
    }
  }

  // ---------------------------------------------------------------------
  // Bot orchestration (mirrors human flow through the same animations)
  // ---------------------------------------------------------------------

  private runBotEntryStep(): void {
    const player = this.engine.getCurrentPlayer();
    if (this.engine.getState().phase === 'ENTRY') {
      const result = this.engine.rollGatiPasa();
      if (!result.ok) return;
      this.animateGatiDie(result.result, () => {
        if (result.enteredAutoSkipped) {
          this.time.delayedCall(300, () => this.runBotMovementStep());
        } else {
          const kukriId = decideYardKukriToEnter(player);
          const entry = this.engine.chooseEntryKukri(kukriId);
          if (entry.ok) {
            this.animateKukriEnter(kukriId, () => this.time.delayedCall(300, () => this.runBotMovementStep()));
          } else {
            this.runBotMovementStep();
          }
        }
      });
    } else {
      this.runBotMovementStep();
    }
  }

  private runBotMovementStep(): void {
    const player = this.engine.getCurrentPlayer();
    const difficulty = player.botDifficulty ?? 'medium';
    const result = this.engine.rollNormalPasa();
    if (!result.ok) return;
    this.animateNormalDie(result.roll, () => {
      if (result.turnPassed) {
        this.time.delayedCall(400, () => this.beginTurnUI());
        return;
      }
      const kukriId = decideMove(this.engine, player, result.legalMoveKukriIds, result.roll, difficulty);
      const move = this.engine.moveKukri(kukriId);
      if (!move.ok) {
        this.time.delayedCall(400, () => this.beginTurnUI());
        return;
      }
      this.animateMove(move, () => {
        if (move.gameOver) this.onGameOver();
        else this.beginTurnUI();
      });
    });
  }

  // ---------------------------------------------------------------------
  // Animation helpers
  // ---------------------------------------------------------------------

  private animateGatiDie(result: GatiName, onComplete: () => void): void {
    audioManager.playSfx('diceRollGati');
    let i = 0;
    const spin = this.time.addEvent({
      delay: 55,
      repeat: 8,
      callback: () => {
        this.gatiDie.setTexture(dieGatiKey(GATI_ORDER[i % GATI_ORDER.length]));
        i++;
      },
    });
    this.tweens.add({
      targets: this.gatiDie,
      angle: 360,
      duration: 55 * 9,
      onComplete: () => {
        spin.remove();
        this.gatiDie.setAngle(0);
        this.gatiDie.setTexture(dieGatiKey(result));
        this.tweens.add({ targets: this.gatiDie, scale: 0.68, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
        this.toast(`Gati Pasa: ${result}`);
        onComplete();
      },
    });
  }

  private animateNormalDie(roll: number, onComplete: () => void): void {
    audioManager.playSfx('diceRollNormal');
    let i = 1;
    const spin = this.time.addEvent({
      delay: 50,
      repeat: 9,
      callback: () => {
        this.normalDie.setTexture(dieNormalKey((i % 6) + 1));
        i++;
      },
    });
    this.tweens.add({
      targets: this.normalDie,
      angle: 360,
      y: this.normalDie.y - 16,
      duration: 50 * 10,
      yoyo: true,
      onComplete: () => {
        spin.remove();
        this.normalDie.setAngle(0);
        this.normalDie.setTexture(dieNormalKey(roll));
        audioManager.playSfx('diceLand');
        onComplete();
      },
    });
  }

  private animateKukriEnter(kukriId: string, onComplete: () => void): void {
    const kukri = this.findKukri(kukriId);
    const sprite = this.kukriSprites.get(kukriId)!;
    const dest = this.kukriScreenPosition(kukri);
    audioManager.playSfx('kukriEnter');
    this.tweens.add({
      targets: sprite,
      x: dest.x,
      y: dest.y,
      duration: 380,
      ease: 'Back.easeOut',
      onStart: () => this.tweens.add({ targets: sprite, scale: this.boardScale * 1.3, duration: 180, yoyo: true, ease: 'Sine.easeOut' }),
      onComplete: () => onComplete(),
    });
  }

  private animateMove(result: MoveOutcome, onComplete: () => void): void {
    const kukri = this.findKukri(result.kukriId);
    const sprite = this.kukriSprites.get(result.kukriId)!;
    const steps = result.to - result.from;
    const hopDuration = Math.max(90, 260 - steps * 20);
    let step = 0;

    const hop = () => {
      step++;
      const relPos = result.from + step;
      const pt = relPos >= 58 ? hubPoint() : boardPositionFor(kukri.playerIndex, relPos);
      const dest = this.toScreen(pt.x, pt.y);
      audioManager.playSfx('kukriMove');
      this.tweens.add({
        targets: sprite,
        x: dest.x,
        y: dest.y,
        duration: hopDuration,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: sprite,
        scaleY: this.boardScale * 0.8,
        duration: hopDuration / 2,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (step < steps) hop();
          else this.finishMoveEffects(result, onComplete);
        },
      });
    };
    hop();
  }

  private finishMoveEffects(result: MoveOutcome, onComplete: () => void): void {
    const doneSteps: Array<() => void> = [];

    if (result.captured) {
      for (const capturedId of result.capturedKukriIds) {
        doneSteps.push(() => this.animateCapture(capturedId));
      }
    }
    if (result.finished) {
      doneSteps.push(() => this.animateMoksha(result.kukriId));
    }
    if (result.bonusEarned) {
      doneSteps.push(() => this.toast('Extra turn!'));
    }

    let i = 0;
    const runNext = () => {
      if (i >= doneSteps.length) {
        onComplete();
        return;
      }
      doneSteps[i]();
      i++;
      this.time.delayedCall(350, runNext);
    };
    runNext();
  }

  private animateCapture(kukriId: string): void {
    const sprite = this.kukriSprites.get(kukriId);
    if (!sprite) return;
    audioManager.playSfx('capture');
    this.cameras.main.shake(150, 0.004);
    this.tweens.add({
      targets: sprite,
      alpha: 0,
      scale: 0,
      duration: 260,
      ease: 'Back.easeIn',
      onComplete: () => {
        const kukri = this.findKukri(kukriId);
        const yardPos = this.kukriScreenPosition(kukri);
        sprite.setPosition(yardPos.x, yardPos.y);
        this.tweens.add({ targets: sprite, alpha: 1, scale: this.boardScale, duration: 260, ease: 'Back.easeOut' });
      },
    });
  }

  private animateMoksha(kukriId: string): void {
    const sprite = this.kukriSprites.get(kukriId);
    if (!sprite) return;
    audioManager.playSfx('moksha');
    const emitter = this.add.particles(sprite.x, sprite.y, 'particle-spark', {
      speed: { min: 60, max: 160 },
      lifespan: 700,
      scale: { start: 0.9, end: 0 },
      quantity: 24,
      tint: [0xf4cf8a, 0xd8a34e, 0xffffff],
      emitting: false,
    });
    emitter.explode(24);
    this.time.delayedCall(750, () => emitter.destroy());

    const flash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xffffff, 0).setDepth(80);
    this.tweens.add({ targets: flash, alpha: 0.25, duration: 120, yoyo: true, onComplete: () => flash.destroy() });

    this.tweens.add({
      targets: sprite,
      scale: 0,
      alpha: 0,
      duration: 500,
      ease: 'Sine.easeIn',
    });
  }

  private findKukri(id: string): Kukri {
    for (const player of this.engine.getState().players) {
      const k = player.kukris.find((kk) => kk.id === id);
      if (k) return k;
    }
    throw new Error(`Kukri ${id} not found`);
  }
}
