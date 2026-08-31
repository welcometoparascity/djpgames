import Phaser from 'phaser';
import { PALETTE } from '../config/theme';
import { Button } from '../ui/Button';

export interface InfoPage {
  title: string;
  lines: string[];
  render?: (scene: Phaser.Scene, centerX: number, y: number) => Phaser.GameObjects.GameObject[];
}

/** Shared paginated text+visual layout used by both How To Play and Rules. */
export abstract class PagedInfoScene extends Phaser.Scene {
  private pageIndex = 0;
  private pageContent: Phaser.GameObjects.GameObject[] = [];
  private dots: Phaser.GameObjects.Arc[] = [];
  protected abstract getPages(): InfoPage[];
  protected abstract getHeading(): string;

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.skyTop);
    this.add.image(width / 2, height / 2, 'board').setDisplaySize(width, height).setAlpha(0.4).setDepth(-20);

    this.add
      .text(width / 2, 46, this.getHeading(), {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '30px',
        color: '#f4cf8a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.pageIndex = 0;
    this.renderPage();

    new Button(this, 90, height - 40, 'BACK', () => this.scene.start('MainMenu'), { variant: 'ghost', width: 140, height: 48, fontSize: 18 });
    new Button(this, width - 130, height - 40, 'NEXT ›', () => this.changePage(1), { variant: 'secondary', width: 160, height: 48, fontSize: 18 });
    new Button(this, width - 300, height - 40, '‹ PREV', () => this.changePage(-1), { variant: 'secondary', width: 140, height: 48, fontSize: 18 });
  }

  private changePage(delta: number): void {
    const pages = this.getPages();
    this.pageIndex = Phaser.Math.Wrap(this.pageIndex + delta, 0, pages.length);
    this.renderPage();
  }

  private renderPage(): void {
    this.pageContent.forEach((o) => o.destroy());
    this.pageContent = [];
    this.dots.forEach((d) => d.destroy());
    this.dots = [];

    const { width, height } = this.scale;
    const pages = this.getPages();
    const page = pages[this.pageIndex];

    const title = this.add
      .text(width / 2, 100, `${this.pageIndex + 1}. ${page.title}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '24px',
        color: '#fbf3e1',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.pageContent.push(title);

    let y = 140;
    for (const line of page.lines) {
      const t = this.add
        .text(width / 2, y, line, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '18px',
          color: '#fbf3e1',
          align: 'center',
          wordWrap: { width: Math.min(680, width - 120) },
        })
        .setOrigin(0.5, 0);
      this.pageContent.push(t);
      y += t.height + 10;
    }

    if (page.render) {
      const extra = page.render(this, width / 2, Math.max(y + 20, height * 0.6));
      this.pageContent.push(...extra);
    }

    // Page dots
    const dotY = height - 92;
    const totalWidth = (pages.length - 1) * 22;
    for (let i = 0; i < pages.length; i++) {
      const dot = this.add.circle(width / 2 - totalWidth / 2 + i * 22, dotY, i === this.pageIndex ? 6 : 4, i === this.pageIndex ? PALETTE.gold : 0xffffff, i === this.pageIndex ? 1 : 0.4);
      this.dots.push(dot);
    }
  }
}
