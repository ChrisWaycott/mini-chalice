import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    /* Raider 1 (128 × 128 per frame) */
    this.load.spritesheet('raider-idle', 'assets/characters/Raider_1/Idle.png',
      { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('raider-walk', 'assets/characters/Raider_1/Walk.png',
      { frameWidth: 128, frameHeight: 128 });

    /* Zombie Man */
    this.load.spritesheet('zombie-walk', 'assets/characters/Zombie_Man/Walk.png',
      { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('zombie-dead', 'assets/characters/Zombie_Man/Dead.png',
      { frameWidth: 128, frameHeight: 128 });

    /* 64 × 64 tiles */
    this.load.image('stone_clean',   'assets/tiles/stone_clean.png');
    this.load.image('stone_cracked', 'assets/tiles/stone_cracked.png');
    this.load.image('stone_corrupt', 'assets/tiles/stone_corrupt.png');
  }

  create() {
    /* Animations */
    this.anims.create({ key: 'raider-idle', frames: 'raider-idle', frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'raider-walk', frames: 'raider-walk', frameRate: 8, repeat: -1 });

    const dead = this.anims.generateFrameNumbers('zombie-dead');
    this.anims.create({ key: 'zombie-walk', frames: 'zombie-walk', frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'zombie-dead', frames: dead,            frameRate: 10 });
    this.anims.create({ key: 'zombie-rise', frames: dead.reverse(),  frameRate: 10 });

    this.scene.start('Game');
  }
}
