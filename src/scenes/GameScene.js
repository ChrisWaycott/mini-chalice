import Phaser from 'phaser';
import { TILE_SIZE, MOVE_TWEEN_MS, TILE } from '../constants.js';
import { scaleToTile } from '../utils/scaleToTile.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  preload() { /* nothing */ }

  create() {
    /* ---------- map (10 × 10 floor) ---------- */
    this.grid      = [];
    this.tileLayer = this.add.layer();
    for (let y = 0; y < 10; y++) {
      this.grid[y] = [];
      for (let x = 0; x < 10; x++) {
        const key = Math.random() < 0.15 ? TILE.CRACKED : TILE.CLEAN;
        const tile = this.add.image(x * TILE_SIZE, y * TILE_SIZE, key).setOrigin(0);
        this.tileLayer.add(tile);
        this.grid[y][x] = { key, walkable: true };
      }
    }

    /* ---------- hero ---------- */
    this.player = this.add
      .sprite(TILE_SIZE / 2, TILE_SIZE / 2, 'raider-idle')
      .setOrigin(0.5, 1)
      .play('raider-idle');
    scaleToTile(this.player);
    this.player.setScale(this.player.scaleX * 1.30);
    this.player.gridX = 0;
    this.player.gridY = 0;
    this.player.alive = true;

    /* shadow */
    this.shadow = this.add.ellipse(this.player.x, this.player.y + 20, 36, 16, 0x000000, 0.3);

    /* ---------- fog-of-war ---------- */
    this.fogRT       = this.make.renderTexture({ width: 640, height: 640, add: true });
    this.fogGraphics = this.make.graphics();
    this.refreshFog();

    /* ---------- input ---------- */
    this.keys = this.input.keyboard.addKeys(
      'UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE'
    );

    /* zombies group */
    this.zombies = this.add.group();
  }

  update() {
    /* 1. Handle hero movement */
    if (!this.player.moving && this.player.alive) {
      const dir = this.getDir();
      if (dir) this.tryMove(dir.dx, dir.dy);
    }

    /* 2. NEW: listen for Space key anytime */
    if (this.player.alive && Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.killHero();                             // <<-- call directly
    }

    /* 3. Simple zombie AI */
    this.zombies.getChildren().forEach((z) => {
      if (z.moving) return;
      const dx = Math.sign(this.player.gridX - z.gridX);
      const dy = Math.sign(this.player.gridY - z.gridY);
      if (dx || dy) this.moveSprite(z, dx, dy);
    });
  }


  /* ---------- movement helpers ---------- */
  getDir() {
    const k = this.keys;
    if (k.LEFT.isDown || k.A.isDown)   return { dx: -1, dy: 0 };
    if (k.RIGHT.isDown || k.D.isDown)  return { dx:  1, dy: 0 };
    if (k.UP.isDown || k.W.isDown)     return { dx:  0, dy: -1 };
    if (k.DOWN.isDown || k.S.isDown)   return { dx:  0, dy: 1 };
    return null;
  }

  tryMove(dx, dy) {
    const nx = this.player.gridX + dx;
    const ny = this.player.gridY + dy;
    if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10) return;
    if (!this.grid[ny][nx].walkable) return;
    this.moveSprite(this.player, dx, dy, () => {
      
    });
  }

  moveSprite(sprite, dx, dy, cb = () => {}) {
    sprite.moving = true;
    sprite.gridX += dx;
    sprite.gridY += dy;
    sprite.play(sprite === this.player ? 'raider-walk' : 'zombie-walk');

    this.tweens.add({
      targets: sprite,
      x: sprite.gridX * TILE_SIZE + TILE_SIZE / 2,
      y: sprite.gridY * TILE_SIZE + TILE_SIZE / 2,
      duration: MOVE_TWEEN_MS,
      onUpdate: () => {
        if (sprite === this.player) this.shadow.setPosition(sprite.x, sprite.y + 20);
      },
      onComplete: () => {
        sprite.moving = false;
        sprite.play(sprite === this.player ? 'raider-idle' : 'zombie-walk');
        if (sprite === this.player) this.refreshFog();
        cb();
      },
    });
  }

  /* ---------- fog-of-war ---------- */
  refreshFog() {
    this.fogRT.clear();
    this.fogRT.fill(0x0f2f3f, 0.85);
    this.fogGraphics.clear();
    this.fogGraphics.fillStyle(0xffffff, 1);
    this.fogGraphics.fillCircle(this.player.x, this.player.y, TILE_SIZE * 3);
    this.fogRT.erase(this.fogGraphics, this.fogGraphics);
  }

  /* ---------- death → zombie ---------- */
  killHero() {
    this.player.alive = false;
    this.player.setTint(0x555555);

    /* corrupt tile */
    const t = this.grid[this.player.gridY][this.player.gridX];
    t.key = TILE.CORRUPT;
    t.walkable = false;
    this.add.image(this.player.gridX * TILE_SIZE, this.player.gridY * TILE_SIZE, TILE.CORRUPT).setOrigin(0);

    /* spawn zombie after 2 seconds */
    this.time.delayedCall(2000, () => this.spawnZombie());
  }

  spawnZombie() {
    const z = this.add
      .sprite(this.player.x, this.player.y, 'zombie-dead')
      .setOrigin(0.5, 1)
      .play('zombie-rise');
    scaleToTile(z);
    z.gridX = this.player.gridX;
    z.gridY = this.player.gridY;
    this.zombies.add(z);
  }
}
