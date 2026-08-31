import Phaser from 'phaser';

/** Subtle, non-cluttered ambient motion (drifting clouds, a wandering
 * butterfly) used behind menus and gameplay so the world feels alive. */
export class AmbientEnvironment {
  /** @param minY Top boundary (px) below which clouds/butterflies are allowed
   * to spawn - keeps them clear of any fixed HUD header band. */
  constructor(scene: Phaser.Scene, width: number, height: number, minY = 0) {
    const cloudTop = minY + 20;
    const cloudBottom = Math.max(cloudTop + 10, height * 0.3);
    for (let i = 0; i < 4; i++) {
      const cloud = scene.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(cloudTop, cloudBottom), 'env-cloud')
        .setAlpha(0.5 + Math.random() * 0.3)
        .setScale(0.7 + Math.random() * 0.8)
        .setDepth(-10);
      const duration = 30000 + Math.random() * 25000;
      scene.tweens.add({
        targets: cloud,
        x: cloud.x + width + 200,
        duration,
        repeat: -1,
        onRepeat: () => {
          cloud.x = -150;
          cloud.y = Phaser.Math.Between(cloudTop, cloudBottom);
        },
      });
    }

    for (let i = 0; i < 2; i++) {
      const butterfly = scene.add.image(Phaser.Math.Between(0, width), Phaser.Math.Between(Math.max(minY, height * 0.5), height * 0.9), 'env-butterfly').setDepth(-5);
      scene.tweens.add({
        targets: butterfly,
        x: `+=${Phaser.Math.Between(-120, 120)}`,
        y: `+=${Phaser.Math.Between(-60, 60)}`,
        duration: 3000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      scene.tweens.add({
        targets: butterfly,
        scaleX: 0.7,
        duration: 260,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
}
