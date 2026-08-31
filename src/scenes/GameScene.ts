import Phaser from 'phaser';
import { GameEngine } from '../core/GameEngine';
import type { GatiName, Kukri, MoveOutcome } from '../core/types';
import { boardPositionFor, hubPoint, yardCenterFor, yardSlotOffset } from '../rendering/boardLayout';
import { dieGatiKey, dieNormalKey, kukriTextureKey, KUKRI_TOKEN_SIZE } from '../rendering/TextureFactory';
import { CANVAS, GATI_ORDER, PALETTE, PLAYER_THEMES } from '../config/theme';
import { drawGatiIcon } from '../rendering/icons';
import { decideMove, decideYardKukriToEnter } from '../bots/Bot';
import { audioManager } from '../audio/AudioManager';
import { Button } from '../ui/Button';
import type { GameLaunchConfig } from './ModeSelectScene';
import { AmbientEnvironment } from '../rendering/AmbientEnvironment';

type SelectionMode = 'none' | 'entry' | 'move';

function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Ornate double-gold-border rounded panel, used throughout the in-game
 * dashboard (sidebars, header/footer chips) for a premium framed look. */
function drawOrnatePanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r = 18): void {
  g.fillStyle(0x000000, 0.3);
  g.fillRoundedRect(x + 3, y + 5, w, h, r);
  g.fillStyle(PALETTE.plumDeep, 0.92);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(4, PALETTE.gold, 1);
  g.strokeRoundedRect(x, y, w, h, r);
  g.lineStyle(1.5, PALETTE.goldBright, 0.6);
  g.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 5));
}

interface PlayerRow {
  bg: Phaser.GameObjects.Graphics;
  avatar: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Arc[];
  rect: { x: number; y: number; w: number; h: number };
  theme: { base: number; dark: number; light: number };
}

export class GameScene extends Phaser.Scene {
  private engine!: GameEngine;
  private kukriSprites = new Map<string, Phaser.GameObjects.Image>();
  private halos = new Map<string, Phaser.GameObjects.Arc>();
  private normalDie!: Phaser.GameObjects.Image;
  private gatiDie!: Phaser.GameObjects.Image;
  private turnBanner!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private selectionMode: SelectionMode = 'none';
  private busy = false;

  // Dashboard (sidebar/footer) live elements
  private playerRows: PlayerRow[] = [];
  private lastResultText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  private extraTurnStar!: Phaser.GameObjects.Text;
  private gatiHighlight!: Phaser.GameObjects.Graphics;
  private gatiRowY: Partial<Record<GatiName, number>> = {};
  private gatiRowX = 0;
  private rollButton!: Button;
  private movesLeftLabel!: Phaser.GameObjects.Text;
  private surrenderArmed = false;
  private surrenderButton!: Button;
  /** Set synchronously the instant an overlay (Settings/How To Play) opens -
   * do not rely on Phaser's this.scene.isActive(), which only reflects a
   * pause() call after it is processed on a later step, not immediately.
   * See TEST_REPORT.md for the race this closes. */
  private overlayOpen = false;

  constructor() {
    super('Game');
  }

  create(data: GameLaunchConfig): void {
    const { width, height } = this.scale;
    this.busy = false;
    this.selectionMode = 'none';
    this.kukriSprites.clear();
    this.halos.clear();
    this.playerRows = [];
    this.gatiRowY = {};
    this.surrenderArmed = false;

    this.engine = new GameEngine({ players: data.players, seed: Date.now() });

    this.cameras.main.setBackgroundColor(PALETTE.skyTop);
    const headerHeight = 120;
    const footerHeight = 140;
    const availableHeight = height - headerHeight - footerHeight;
    const scale = Math.min(width / CANVAS.width, availableHeight / CANVAS.height);
    const boardImg = this.add.image(width / 2, headerHeight + availableHeight / 2, 'board').setScale(scale);
    const boardDisplayWidth = CANVAS.width * scale;
    const boardLeft = width / 2 - boardDisplayWidth / 2;
    const boardRight = width / 2 + boardDisplayWidth / 2;
    new AmbientEnvironment(this, width, height, headerHeight);
    audioManager.ensureStarted();
    audioManager.startAmbientMusic();

    // A container that mirrors the board's scale/position so board-space math
    // (boardPositionFor etc) maps directly onto screen pixels.
    this.boardOffsetX = boardImg.x - (CANVAS.width / 2) * scale;
    this.boardOffsetY = boardImg.y - (CANVAS.height / 2) * scale;
    this.boardScale = scale;

    this.createHeader(headerHeight);
    this.createSidebars(headerHeight, footerHeight, boardLeft, boardRight, data.players.length);
    this.createKukriSprites();
    this.createFooter(footerHeight, boardLeft, boardRight);
    this.createPauseButton();

    // If a bot's turn was interrupted mid-flight by an overlay opening (see
    // the overlayOpen guards in beginTurnUI/runBotEntryStep/runBotMovementStep),
    // nothing is left scheduled to continue it once we resume - pick it back
    // up here. Safe to call unconditionally: it just re-checks whose turn it
    // is and which phase they're in, and is a no-op for a human's turn.
    this.events.on('resume', () => {
      this.overlayOpen = false;
      const player = this.engine.getCurrentPlayer();
      if (player.isBot && !this.engine.isGameOver()) {
        this.time.delayedCall(400, () => this.runBotEntryStep());
      }
    });

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

  private createHeader(headerHeight: number): void {
    const { width } = this.scale;
    const panel = this.add.graphics().setDepth(20);
    drawOrnatePanel(panel, 8, 8, width - 16, headerHeight - 16, 20);

    this.turnBanner = this.add
      .text(width / 2, headerHeight * 0.36, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '26px', color: '#fbf3e1', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(21);
    this.hintText = this.add
      .text(width / 2, headerHeight * 0.68, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '17px', color: '#ffe28a' })
      .setOrigin(0.5)
      .setDepth(21);
  }

  private createSidebars(headerHeight: number, footerHeight: number, boardLeft: number, boardRight: number, playerCount: number): void {
    const { width, height } = this.scale;
    const top = headerHeight + 14;
    const bottom = height - footerHeight - 14;
    const leftX = 14;
    const leftW = Math.max(160, boardLeft - 28);
    const rightX = boardRight + 14;
    const rightW = Math.max(160, width - 14 - rightX);

    // ---- Left sidebar: Gati Dice preview + critical-rule reminder ----
    const leftPanel = this.add.graphics().setDepth(20);
    drawOrnatePanel(leftPanel, leftX, top, leftW, bottom - top, 22);
    this.add
      .text(leftX + leftW / 2, top + 28, 'GATI DICE', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '19px', color: '#ffe28a', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(21);
    this.add
      .text(leftX + leftW / 2, top + 52, 'Choose a Gati', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '13px', color: '#cbb8e6' })
      .setOrigin(0.5)
      .setDepth(21);

    this.gatiHighlight = this.add.graphics().setDepth(21);
    this.gatiRowX = leftX + leftW / 2;
    const rowStartY = top + 82;
    const rowH = 78;
    GATI_ORDER.forEach((gati, i) => {
      const rowY = rowStartY + i * rowH;
      this.gatiRowY[gati] = rowY;
      const rowBg = this.add.graphics().setDepth(21);
      rowBg.fillStyle(PALETTE.plum, 0.5);
      rowBg.fillRoundedRect(leftX + 10, rowY - rowH / 2 + 4, leftW - 20, rowH - 10, 12);
      const iconBg = this.add.circle(leftX + 34, rowY, 22, PLAYER_THEMES[i].base, 1).setStrokeStyle(2, PALETTE.gold, 0.9).setDepth(22);
      void iconBg;
      const iconGfx = this.add.graphics().setDepth(23);
      drawGatiIcon(iconGfx, gati, leftX + 34, rowY, 13, 0xffffff);
      this.add
        .text(leftX + 62, rowY, gati.toUpperCase(), { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: '#fbf3e1', fontStyle: 'bold' })
        .setOrigin(0, 0.5)
        .setDepth(22);
    });

    const ruleY = bottom - 92;
    const ruleBg = this.add.graphics().setDepth(21);
    ruleBg.fillStyle(0x000000, 0.25);
    ruleBg.fillRoundedRect(leftX + 10, ruleY, leftW - 20, 84, 12);
    ruleBg.lineStyle(2, PALETTE.gold, 0.6);
    ruleBg.strokeRoundedRect(leftX + 10, ruleY, leftW - 20, 84, 12);
    this.add
      .text(leftX + leftW / 2, ruleY + 14, 'RULE', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '13px', color: '#ffe28a', fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setDepth(22);
    this.add
      .text(leftX + leftW / 2, ruleY + 34, 'A Kukri can leave home\nonly when Manushya\nGati is rolled.', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12.5px',
        color: '#fbf3e1',
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(22);

    // ---- Right sidebar: Players, Last Result, Moves, Extra Turn ----
    const rightPanel = this.add.graphics().setDepth(20);
    drawOrnatePanel(rightPanel, rightX, top, rightW, bottom - top, 22);
    this.add
      .text(rightX + rightW / 2, top + 28, 'PLAYERS', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '19px', color: '#ffe28a', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(21);

    const players = this.engine.getState().players;
    const prowStartY = top + 66;
    const prowH = 58;
    players.forEach((player, i) => {
      const theme = PLAYER_THEMES[i];
      const rowY = prowStartY + i * prowH;
      const rowRect = { x: rightX + 10, y: rowY - prowH / 2 + 5, w: rightW - 20, h: prowH - 10 };
      const bg = this.add.graphics().setDepth(21);
      bg.fillStyle(theme.base, 0.16);
      bg.fillRoundedRect(rowRect.x, rowRect.y, rowRect.w, rowRect.h, 12);
      const avatar = this.add.circle(rightX + 34, rowY, 15, theme.base).setStrokeStyle(2, theme.dark).setDepth(22);
      const label = this.add
        .text(rightX + 58, rowY - 8, player.isBot ? `Bot ${i + 1} · ${player.botDifficulty}` : `Player ${i + 1}`, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '13px',
          color: '#fbf3e1',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
        .setDepth(22);
      const pips: Phaser.GameObjects.Arc[] = [];
      for (let k = 0; k < 4; k++) {
        const pip = this.add.circle(rightX + 60 + k * 13, rowY + 12, 4, 0xffffff, 0.25).setStrokeStyle(1, theme.dark, 0.6).setDepth(22);
        pips.push(pip);
      }
      this.playerRows.push({ bg, avatar, label, pips, rect: rowRect, theme });
    });
    void playerCount;

    const boxY = prowStartY + players.length * prowH + 14;
    const boxH = 56;
    const drawInfoBox = (y: number, heading: string): Phaser.GameObjects.Text => {
      const box = this.add.graphics().setDepth(21);
      box.fillStyle(0x000000, 0.25);
      box.fillRoundedRect(rightX + 10, y, rightW - 20, boxH, 12);
      box.lineStyle(2, PALETTE.gold, 0.5);
      box.strokeRoundedRect(rightX + 10, y, rightW - 20, boxH, 12);
      this.add
        .text(rightX + rightW / 2, y + 12, heading, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '12px', color: '#ffe28a', fontStyle: 'bold' })
        .setOrigin(0.5, 0)
        .setDepth(22);
      return this.add
        .text(rightX + rightW / 2, y + 34, '-', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: '#fbf3e1', fontStyle: 'bold' })
        .setOrigin(0.5, 0)
        .setDepth(22);
    };
    this.lastResultText = drawInfoBox(boxY, 'LAST RESULT');
    this.movesText = drawInfoBox(boxY + boxH + 10, 'MOVES');

    const starY = boxY + (boxH + 10) * 2 + 6;
    const starBox = this.add.graphics().setDepth(21);
    starBox.fillStyle(0x000000, 0.25);
    starBox.fillRoundedRect(rightX + 10, starY, rightW - 20, boxH, 12);
    starBox.lineStyle(2, PALETTE.gold, 0.5);
    starBox.strokeRoundedRect(rightX + 10, starY, rightW - 20, boxH, 12);
    this.add
      .text(rightX + rightW / 2, starY + 10, 'EXTRA TURN', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '12px', color: '#ffe28a', fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setDepth(22);
    this.extraTurnStar = this.add
      .text(rightX + rightW / 2, starY + 30, '★', { fontSize: '20px', color: '#6a5a86' })
      .setOrigin(0.5, 0)
      .setDepth(22);

    this.refreshSidebars();
  }

  private refreshSidebars(): void {
    const state = this.engine.getState();
    state.players.forEach((player, i) => {
      const row = this.playerRows[i];
      if (!row) return;
      const isCurrent = i === state.currentPlayerIndex;
      row.avatar.setStrokeStyle(isCurrent ? 4 : 2, PALETTE.gold, isCurrent ? 1 : 0.7);
      row.pips.forEach((pip, k) => pip.setFillStyle(k < player.finishedCount ? PALETTE.gold : 0xffffff, k < player.finishedCount ? 1 : 0.25));
      row.bg.clear();
      row.bg.fillStyle(row.theme.base, isCurrent ? 0.38 : 0.14);
      row.bg.fillRoundedRect(row.rect.x, row.rect.y, row.rect.w, row.rect.h, 12);
      if (isCurrent) {
        row.bg.lineStyle(2, PALETTE.goldBright, 0.9);
        row.bg.strokeRoundedRect(row.rect.x, row.rect.y, row.rect.w, row.rect.h, 12);
      }
    });
    this.updateGatiHighlight(undefined);
  }

  private updateGatiHighlight(active: GatiName | undefined): void {
    this.gatiHighlight.clear();
    if (!active) return;
    const y = this.gatiRowY[active];
    if (y === undefined) return;
    this.gatiHighlight.lineStyle(3, PALETTE.goldBright, 1);
    this.gatiHighlight.strokeRoundedRect(this.gatiRowX - 190 / 2 + 0, y - 34, 190, 68, 14);
  }

  private createKukriSprites(): void {
    const state = this.engine.getState();
    for (const player of state.players) {
      player.kukris.forEach((kukri, slotIndex) => {
        const pos = this.yardScreenPosition(player.index, slotIndex as 0 | 1 | 2 | 3);
        const img = this.add
          .image(pos.x, pos.y, kukriTextureKey(player.index, kukri.gati))
          .setScale(this.boardScale)
          .setDepth(10)
          .setInteractive({ useHandCursor: true });
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

  private createFooter(footerHeight: number, boardLeft: number, boardRight: number): void {
    const { width, height } = this.scale;
    const barY = height - footerHeight;
    const panel = this.add.graphics().setDepth(20);
    drawOrnatePanel(panel, 8, barY + 8, width - 16, footerHeight - 16, 20);

    const midY = barY + footerHeight / 2;

    // Dice display panel, center - purely visual; the ROLL button is the
    // single action trigger (matches a "press ROLL" flow, not tiny die taps).
    const diceBoxW = 260;
    const diceBox = this.add.graphics().setDepth(21);
    diceBox.fillStyle(PALETTE.plum, 0.5);
    diceBox.fillRoundedRect(width / 2 - diceBoxW / 2, barY + 10, diceBoxW, footerHeight - 20, 14);
    diceBox.lineStyle(2, PALETTE.gold, 0.7);
    diceBox.strokeRoundedRect(width / 2 - diceBoxW / 2, barY + 10, diceBoxW, footerHeight - 20, 14);

    this.gatiDie = this.add.image(width / 2 - 55, midY, dieGatiKey('Dev')).setScale(0.42).setDepth(22);
    this.normalDie = this.add.image(width / 2 + 55, midY, dieNormalKey(1)).setScale(0.42).setDepth(22);
    this.movesLeftLabel = this.add
      .text(width / 2, barY + footerHeight - 16, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '12px', color: '#cbb8e6' })
      .setOrigin(0.5, 1)
      .setDepth(22);

    this.rollButton = new Button(this, width / 2, barY - 34, 'ROLL', () => this.onRollClicked(), {
      variant: 'primary',
      width: 170,
      height: 56,
      fontSize: 24,
    });
    this.rollButton.setDepth(23);

    new Button(this, (boardLeft + 8) / 2 + 8, midY, 'HOW TO\nPLAY', () => this.openHowToPlay(), {
      variant: 'secondary',
      width: Math.max(120, boardLeft - 24),
      height: footerHeight - 24,
      fontSize: 16,
    }).setDepth(21);

    this.surrenderButton = new Button(
      this,
      boardRight + (width - boardRight) / 2 - 8,
      midY,
      'SURRENDER',
      () => this.onSurrenderClicked(),
      { variant: 'secondary', width: Math.max(120, width - boardRight - 24), height: footerHeight - 24, fontSize: 16 },
    );
    this.surrenderButton.setDepth(21);
  }

  private openHowToPlay(): void {
    this.overlayOpen = true;
    this.scene.pause();
    this.scene.launch('HowToPlay', { returnTo: 'Game' });
  }

  private onSurrenderClicked(): void {
    if (!this.surrenderArmed) {
      this.surrenderArmed = true;
      this.surrenderButton.setLabel('TAP AGAIN\nTO CONFIRM');
      this.time.delayedCall(3000, () => {
        if (this.surrenderArmed) {
          this.surrenderArmed = false;
          this.surrenderButton.setLabel('SURRENDER');
        }
      });
      return;
    }
    audioManager.stopAmbientMusic();
    this.scene.start('MainMenu');
  }

  private openSettings(): void {
    this.overlayOpen = true;
    // Pause (not stop) so the in-progress match and its state are fully
    // preserved - Settings launches as an overlay on top and resumes us.
    this.scene.pause();
    this.scene.launch('Settings', { returnTo: 'Game' });
  }

  private createPauseButton(): void {
    const gear = this.add
      .text(this.scale.width - 40, 30, '⚙', { fontSize: '30px', color: '#fbf3e1' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.openSettings());
    gear.setDepth(50);

    const hamburger = this.add
      .text(40, 30, '☰', { fontSize: '28px', color: '#fbf3e1' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.openSettings());
    hamburger.setDepth(50);
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
    if (this.overlayOpen) return;
    this.clearHighlights();
    this.refreshSidebars();
    this.surrenderArmed = false;
    this.surrenderButton.setLabel('SURRENDER');
    if (this.engine.isGameOver()) {
      this.onGameOver();
      return;
    }
    const player = this.engine.getCurrentPlayer();
    const theme = PLAYER_THEMES[player.index];
    this.turnBanner.setText(`Player ${player.index + 1}'s Turn${player.isBot ? ` (Bot · ${player.botDifficulty})` : ''}`);
    this.turnBanner.setColor(intToHex(theme.base));
    audioManager.playSfx('turnChange');

    this.setRollEnabled(false);
    this.movesLeftLabel.setText('');
    this.busy = false;

    if (player.isBot) {
      this.time.delayedCall(650, () => this.runBotEntryStep());
      return;
    }

    if (this.engine.getState().phase === 'ENTRY') {
      this.hintText.setText('Gati Dice: choose a Kukri only if Manushya is rolled');
      this.setRollEnabled(true, 'ROLL GATI');
    } else {
      this.hintText.setText('Roll to move a Kukri');
      this.setRollEnabled(true, 'ROLL');
    }
  }

  private setRollEnabled(enabled: boolean, label?: string): void {
    this.rollButton.setDisabled(!enabled);
    if (label) this.rollButton.setLabel(label);
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

  private onRollClicked(): void {
    if (this.busy || this.engine.getCurrentPlayer().isBot) return;
    const state = this.engine.getState();
    if (state.phase === 'ENTRY' && !state.gatiRolledThisInstance) {
      this.rollGati();
    } else if (state.phase === 'MOVEMENT' && !state.entryChoicePending && !state.normalRolledThisInstance) {
      this.rollNormal();
    }
  }

  private rollGati(): void {
    this.busy = true;
    this.setRollEnabled(false);
    const result = this.engine.rollGatiPasa();
    if (!result.ok) {
      this.busy = false;
      this.setRollEnabled(true);
      return;
    }
    this.lastResultText.setText(result.result);
    this.updateGatiHighlight(result.result);
    this.animateGatiDie(result.result, () => {
      if (result.enteredAutoSkipped) {
        this.hintText.setText('No entry this time - roll to move');
        this.busy = false;
        this.setRollEnabled(true, 'ROLL');
      } else {
        const player = this.engine.getCurrentPlayer();
        const yardIds = player.kukris.filter((k) => k.state === 'YARD').map((k) => k.id);
        this.hintText.setText('Manushya! Tap a Kukri in your home to bring it out.');
        this.highlightSelectable(yardIds, 'entry');
        this.busy = false;
      }
    });
  }

  private rollNormal(): void {
    this.busy = true;
    this.setRollEnabled(false);
    const result = this.engine.rollNormalPasa();
    if (!result.ok) {
      this.busy = false;
      this.setRollEnabled(true);
      return;
    }
    this.lastResultText.setText(`${result.roll}`);
    this.movesText.setText(`${result.roll}`);
    this.movesLeftLabel.setText(`Moves Left: ${result.roll}`);
    if (result.roll === 6) this.flashExtraTurn();
    this.animateNormalDie(result.roll, () => {
      if (result.turnPassed) {
        this.toast(result.legalMoveKukriIds.length === 0 ? 'No legal move.' : 'Turn passed.');
        this.busy = false;
        this.time.delayedCall(500, () => this.beginTurnUI());
      } else {
        this.hintText.setText('Tap a highlighted Kukri to move it');
        this.highlightSelectable(result.legalMoveKukriIds, 'move');
        this.busy = false;
      }
    });
  }

  private flashExtraTurn(): void {
    this.extraTurnStar.setColor('#ffe28a');
    this.tweens.add({
      targets: this.extraTurnStar,
      scale: { from: 1, to: 1.6 },
      duration: 300,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeOut',
      onComplete: () => this.extraTurnStar.setColor('#6a5a86'),
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
        this.hintText.setText('Roll to move a Kukri');
        this.setRollEnabled(true, 'ROLL');
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
      if (result.bonusEarned) this.flashExtraTurn();
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
    // Defensive guard: if Settings/How-To-Play is open, never let a bot's
    // already-scheduled step mutate engine state or animate behind the
    // overlay. See the overlayOpen field doc comment for why this checks a
    // manual flag rather than this.scene.isActive().
    if (this.overlayOpen) return;
    const player = this.engine.getCurrentPlayer();
    if (this.engine.getState().phase === 'ENTRY') {
      const result = this.engine.rollGatiPasa();
      if (!result.ok) return;
      this.lastResultText.setText(result.result);
      this.updateGatiHighlight(result.result);
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
    if (this.overlayOpen) return;
    const player = this.engine.getCurrentPlayer();
    const difficulty = player.botDifficulty ?? 'medium';
    const result = this.engine.rollNormalPasa();
    if (!result.ok) return;
    this.lastResultText.setText(`${result.roll}`);
    this.movesText.setText(`${result.roll}`);
    this.movesLeftLabel.setText(`Moves Left: ${result.roll}`);
    if (result.roll === 6) this.flashExtraTurn();
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
      if (move.bonusEarned) this.flashExtraTurn();
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
