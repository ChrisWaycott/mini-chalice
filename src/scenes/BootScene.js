import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    /* Raider 1 (128 × 128 per frame) */
    this.load.spritesheet('raider-idle', '/assets/characters/Raider_1/Idle.png',
      { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('raider-walk', '/assets/characters/Raider_1/Walk.png',
      { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('raider-attack', '/assets/characters/Raider_1/Attack_1.png',
      { frameWidth: 128, frameHeight: 128 });
    /* Raider 2 (128 × 128 per frame) */
    this.load.spritesheet('raider2-idle', '/assets/characters/Raider_2/Idle.png',
      { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('raider2-walk', '/assets/characters/Raider_2/Walk.png',
      { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('raider2-attack', '/assets/characters/Raider_2/Attack.png',
      { frameWidth: 128, frameHeight: 128 });

    /* Undead Man (96 × 96 per frame) */
    this.load.spritesheet('zombie-walk', '/assets/characters/Zombie_Man/Walk.png',
      { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('zombie-dead', '/assets/characters/Zombie_Man/Dead.png',
      { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('zombie-attack', '/assets/characters/Zombie_Man/Attack_1.png',
      { frameWidth: 96, frameHeight: 96 });

    /* 64 × 64 tiles */
    this.load.image('stone_clean',   '/assets/tiles/stone_clean.png');
    this.load.image('stone_cracked', '/assets/tiles/stone_cracked.png');
    this.load.image('stone_corrupt', '/assets/tiles/stone_corrupt.png');
    this.load.image('wall_straight', '/assets/tiles/wall_straight.png');
    this.load.image('wall_corner',  '/assets/tiles/wall_corner.png');
    this.load.image('spawn_glyph',  '/assets/tiles/spawn_glyph.png');
  }

  create() {
    /* Animations */
    this.anims.create({ key: 'raider-idle', frames: 'raider-idle', frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'raider-walk', frames: 'raider-walk', frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'raider-attack', frames: 'raider-attack', frameRate: 10, repeat: 0 });
    this.anims.create({ key: 'raider2-idle', frames: 'raider2-idle', frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'raider2-walk', frames: 'raider2-walk', frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'raider2-attack', frames: 'raider2-attack', frameRate: 10, repeat: 0 });

    this.anims.create({ key: 'zombie-attack', frames: 'zombie-attack', frameRate: 10, repeat: 0 });

    const dead = this.anims.generateFrameNumbers('zombie-dead');
    this.anims.create({ key: 'zombie-walk', frames: 'zombie-walk', frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'zombie-dead', frames: dead,            frameRate: 10 });
    this.anims.create({ key: 'zombie-rise', frames: dead.reverse(),  frameRate: 10 });

    this.scene.start('Game');
  }
}
