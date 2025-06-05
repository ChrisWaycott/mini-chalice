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
        let key;
if (x === 0 || x === 9 || y === 0 || y === 9) {
  key = (x === 0 && y === 0) || (x === 9 && y === 9) ||
        (x === 0 && y === 9) || (x === 9 && y === 0)
      ? 'wall_corner'          // four corners
      : 'wall_straight';       // top/bottom/left/right edges
} else {
  key = Math.random() < 0.15 ? TILE.CRACKED : TILE.CLEAN;
}
        const tile = this.add.image(x * TILE_SIZE, y * TILE_SIZE, key).setOrigin(0);
        this.tileLayer.add(tile);
        this.grid[y][x] = { key, walkable: !key.startsWith('wall_') };
      }
    }

    /* ---------- hero ---------- */
    this.player = this.add
      // feet start on bottom-edge of tile (y = TILE_SIZE)
      .sprite(TILE_SIZE / 2, TILE_SIZE, 'raider-idle')
      .setOrigin(0.5, 1)
      .play('raider-idle');

    scaleToTile(this.player);                    // width → 64 px
    this.player.setScale(this.player.scaleX * 1.6); // boost to compensate padding
    this.player.gridX = 0;
    this.player.gridY = 0;
    this.player.alive = true;

    /* shadow (slightly above feet) */
    const SHADOW_OFF = 4;        // lift ellipse 4 px so it peeks out
    this.shadow = this.add.ellipse(
      this.player.x,
      this.player.y - SHADOW_OFF,
      36, 16, 0x000000, 0.3
    );

    /* ---------- fog-of-war ---------- */
    this.fogRT       = this.make.renderTexture({ width: 640, height: 640, add: true });
    this.fogGraphics = this.make.graphics();
    this.refreshFog();

    /* ---------- input ---------- */
    this.keys = this.input.keyboard.addKeys(
      'UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE'
    );

    /* zombies */
    this.zombies = this.add.group();
  }

  update() {
    /* hero movement */
    if (!this.player.moving && this.player.alive) {
      const dir = this.getDir();
      if (dir) this.tryMove(dir.dx, dir.dy);
    }

    /* death test key */
    if (this.player.alive && Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.killHero();
    }

    /* zombie AI */
    this.zombies.getChildren().forEach((z) => {
      if (z.moving) return;
      const dx = Math.sign(this.player.gridX - z.gridX);
      const dy = Math.sign(this.player.gridY - z.gridY);
      if (dx || dy) this.moveSprite(z, dx, dy);
    });
  }

  /* ---------- helpers ---------- */
  getDir() {
    const k = this.keys;
    if (k.LEFT.isDown  || k.A.isDown) return { dx: -1, dy: 0 };
    if (k.RIGHT.isDown || k.D.isDown) return { dx:  1, dy: 0 };
    if (k.UP.isDown    || k.W.isDown) return { dx:  0, dy: -1 };
    if (k.DOWN.isDown  || k.S.isDown) return { dx:  0, dy: 1 };
    return null;
  }

  tryMove(dx, dy) {
    const nx = this.player.gridX + dx;
    const ny = this.player.gridY + dy;
    if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10) return;
    if (!this.grid[ny][nx].walkable) return;
    this.moveSprite(this.player, dx, dy);
  }

  moveSprite(sprite, dx, dy, cb = () => {}) {
    sprite.moving = true;
    sprite.gridX += dx;
    sprite.gridY += dy;
    sprite.play(sprite === this.player ? 'raider-walk' : 'zombie-walk');

    const SHADOW_OFF = 4;

    this.tweens.add({
      targets: sprite,
      x: sprite.gridX * TILE_SIZE + TILE_SIZE / 2,
      y: sprite.gridY * TILE_SIZE + TILE_SIZE,   // feet on tile
      duration: MOVE_TWEEN_MS,
      onUpdate: () => {
        if (sprite === this.player)
          this.shadow.setPosition(sprite.x, sprite.y - SHADOW_OFF);
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

  const radius = 3;                      // how far the hero can see
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const gx = this.player.gridX + dx;
      const gy = this.player.gridY + dy;
      if (gx < 0 || gx >= 10 || gy < 0 || gy >= 10) continue;
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;   // diamond LoS

      const tile = this.grid[gy][gx];
      if (tile.key.startsWith('wall_')) continue;           // wall blocks sight

      this.fogGraphics.fillRect(
        gx * TILE_SIZE,
        gy * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }

  /* reveal the visible tiles */
  this.fogRT.erase(this.fogGraphics, this.fogGraphics);
}

  /* ---------- death → zombie ---------- */
  killHero() {
    this.player.alive = false;
    this.player.setTint(0x555555);

    /* corrupt tile */
    const t = this.grid[this.player.gridY][this.player.gridX];
    t.key      = TILE.CORRUPT;
    t.walkable = false;
    this.add.image(
      this.player.gridX * TILE_SIZE,
      this.player.gridY * TILE_SIZE,
      TILE.CORRUPT
    ).setOrigin(0);

/* ── Cyan spawn-glyph pulse (2-turn warning) ───────────────── */
const glyph = this.add.image(
  this.player.gridX * TILE_SIZE + TILE_SIZE / 2,
  this.player.gridY * TILE_SIZE + TILE_SIZE / 2,
  'spawn_glyph'
).setDepth(10).setScale(0.8).setAlpha(0);

this.tweens.add({
  targets: glyph,
  alpha:   1,
  scale:   1,
  duration: 400,
  yoyo:     true,
  repeat:   2          // 3 flashes total
});

    /* spawn zombie in 2 s */
    this.time.delayedCall(2000, () => { glyph.destroy(); this.spawnZombie(); });
  }

  spawnZombie() {
    const z = this.add
      .sprite(this.player.x, this.player.y, 'zombie-dead')
      .setOrigin(0.5, 1)
      .play('zombie-rise');

    scaleToTile(z);                         // width → 64 px
    z.setScale(z.scaleX * 1.2);             // slight boost to match Raider
    z.gridX = this.player.gridX;
    z.gridY = this.player.gridY;
    this.zombies.add(z);
  }
}
