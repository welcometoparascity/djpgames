import Phaser from 'phaser';
import { PagedInfoScene, type InfoPage } from './PagedInfoScene';
import { GATI_ORDER, PLAYER_THEMES } from '../config/theme';
import { dieGatiKey, dieNormalKey, kukriTextureKey } from '../rendering/TextureFactory';

function demoWiggle(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject): void {
  (target as Phaser.GameObjects.Image).setInteractive({ useHandCursor: true });
  target.on('pointerdown', () => {
    scene.tweens.add({ targets: target, angle: { from: -12, to: 12 }, duration: 90, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
  });
}

export class HowToPlayScene extends PagedInfoScene {
  constructor() {
    super('HowToPlay');
  }

  protected getHeading(): string {
    return 'HOW TO PLAY';
  }

  protected getPages(): InfoPage[] {
    return [
      {
        title: 'The Objective',
        lines: [
          'Guide all four of your Kukri around the board and',
          'into the glowing Moksha hub at the center before your rivals do.',
          'The first player to bring all 4 Kukri home to Moksha wins.',
        ],
        render: (scene, cx, y) => {
          const hub = scene.add.circle(cx, y + 30, 44, 0xf4cf8a, 0.85).setStrokeStyle(3, 0xd8a34e);
          scene.tweens.add({ targets: hub, scale: 1.08, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          return [hub];
        },
      },
      {
        title: 'The Four Kukri',
        lines: [
          'Each player controls four Kukri: Dev, Manushya, Tiryanch and Narak.',
          'These names are visual identities only - tap one below to see it',
          'wiggle. All four move by exactly the same rules once on the board.',
        ],
        render: (scene, cx, y) => {
          const objs: Phaser.GameObjects.GameObject[] = [];
          GATI_ORDER.forEach((gati, i) => {
            const img = scene.add.image(cx - 150 + i * 100, y + 20, kukriTextureKey(0, gati)).setScale(1.1);
            demoWiggle(scene, img);
            const label = scene.add.text(cx - 150 + i * 100, y + 60, gati, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: '#fbf3e1' }).setOrigin(0.5);
            objs.push(img, label);
          });
          return objs;
        },
      },
      {
        title: 'The Gati Pasa (critical!)',
        lines: [
          'To bring a Kukri out of your yard, roll the Gati Pasa.',
          'Only a MANUSHYA result lets you enter - and you may then choose',
          'ANY ONE of your four Kukri to bring out, not just the "Manushya" one.',
          'Dev, Tiryanch or Narak results bring nothing out that turn.',
        ],
        render: (scene, cx, y) => {
          const objs: Phaser.GameObjects.GameObject[] = [];
          GATI_ORDER.forEach((gati, i) => {
            const img = scene.add.image(cx - 165 + i * 110, y + 20, dieGatiKey(gati)).setScale(0.55);
            demoWiggle(scene, img);
            objs.push(img);
          });
          return objs;
        },
      },
      {
        title: 'The Normal Pasa & Movement',
        lines: [
          'Once a Kukri is on the board, roll the Normal Pasa (1-6) to move it',
          'forward along the wheel. Rolling a 6 grants you an extra turn.',
          'You must land on Moksha with an exact count - overshooting is not allowed.',
        ],
        render: (scene, cx, y) => {
          const objs: Phaser.GameObjects.GameObject[] = [];
          [1, 2, 3, 4, 5, 6].forEach((n, i) => {
            const img = scene.add.image(cx - 165 + i * 66, y + 10, dieNormalKey(n)).setScale(0.42);
            demoWiggle(scene, img);
            objs.push(img);
          });
          return objs;
        },
      },
      {
        title: 'Safe Positions & Capturing',
        lines: [
          'Squares marked with a gold star are safe - Kukri there cannot be',
          'captured. Landing exactly on an opponent elsewhere sends their',
          'Kukri back to their yard, and grants you an extra turn.',
          'Two or more Kukri of one color on a square form a block - it',
          'cannot be landed on by anyone else.',
        ],
      },
      {
        title: 'Moksha / Siddhashila & Extra Turns',
        lines: [
          'Reaching the center Moksha hub is a moment of celebration - light,',
          'sound and particles mark it, and it grants an extra turn.',
          'You also get an extra turn for rolling a 6 or capturing a Kukri,',
          'though only one bonus turn is ever granted per move.',
        ],
      },
      {
        title: 'Human & Computer Players',
        lines: [
          'Play with 2 or 4 seats, any mix of humans and computer bots.',
          'Bots come in Easy, Medium and Hard difficulty and always follow',
          'the exact same rules as a human player - no exceptions.',
        ],
        render: (scene, cx, y) => {
          const objs: Phaser.GameObjects.GameObject[] = [];
          PLAYER_THEMES.forEach((t, i) => {
            const c = scene.add.circle(cx - 135 + i * 90, y + 10, 22, t.base).setStrokeStyle(3, t.dark);
            objs.push(c);
          });
          return objs;
        },
      },
    ];
  }
}
