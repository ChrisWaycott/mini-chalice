import Phaser from 'phaser';
import { TILE_SIZE, MOVE_TWEEN_MS, TILE } from '../constants.js';
import { scaleToTile } from '../utils/scaleToTile.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  preload() { /* nothing */ }

  create() {
    this.turn = 'player'; // 'player' or 'enemy'
    this.playerMovesLeft = 5; // player can move up to 5 tiles per turn
    this.enemyMoved = false;
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

    /* -------- hero start tile -------- */
const START_GX = 1;          // grid X
const START_GY = 1;          // grid Y

    this.player = this.add
      // feet start on bottom-edge of tile (y = TILE_SIZE)
      .sprite(
    START_GX * TILE_SIZE + TILE_SIZE / 2,   // x centre of tile (1)
    START_GY * TILE_SIZE + TILE_SIZE,       // y feet on tile (1)
    'raider-idle'
  )
      .setOrigin(0.5, 1)
      .play('raider-idle');

    scaleToTile(this.player);                    // width → 64 px
    this.player.setScale(this.player.scaleX * 1.6); // boost to compensate padding
    this.player.gridX = START_GX;
this.player.gridY = START_GY;
    this.player.alive = true;
    this.player.hp = 3;
    this.player.hpText = this.add.text(
      this.player.x,
      this.player.y - 54,
      this.player.hp.toString(),
      { font: '16px Arial', color: '#fff', stroke: '#000', strokeThickness: 3 }
    ).setOrigin(0.5, 1);

    /* shadow (slightly above feet) */
    this.shadow = this.add.ellipse(
      this.player.x,
      this.player.y - 4,
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

    /* undead */
    this.undead = this.add.group();

    // Spawn multiple undead at mission start
    const NUM_UNDEAD = 4;
    const getRandomUndeadSpawn = () => {
      let gx, gy;
      do {
        gx = Phaser.Math.Between(1, 8); // avoid walls (0,9)
        gy = Phaser.Math.Between(1, 8);
      } while (
        (gx === this.player.gridX && gy === this.player.gridY) ||
        !this.grid[gy][gx].walkable
      );
      return { gx, gy };
    };

    for (let i = 0; i < NUM_UNDEAD; i++) {
      const { gx, gy } = getRandomUndeadSpawn();
      const z = this.add
        .sprite(gx * TILE_SIZE + TILE_SIZE / 2, gy * TILE_SIZE + TILE_SIZE, 'zombie-dead')
        .setOrigin(0.5, 1)
        .play('zombie-rise');
      scaleToTile(z);
      z.setScale(z.scaleX * 1.2);
      z.gridX = gx;
      z.gridY = gy;
      z.hp = 2;
      z.hpText = this.add.text(
        z.x,
        z.y - 54,
        z.hp.toString(),
        { font: '16px Arial', color: '#fff', stroke: '#000', strokeThickness: 3 }
      ).setOrigin(0.5, 1);
      this.undead.add(z);
    }
  }

  update() {
    // Update HP text positions
    this.player.hpText.setPosition(this.player.x, this.player.y - 54);
    this.player.hpText.setText(this.player.hp.toString());
    this.undead.getChildren().forEach(u => {
      if (u.hpText) {
        u.hpText.setPosition(u.x, u.y - 54);
        u.hpText.setText(u.hp.toString());
      }
    });
    if (this.turn === 'player') {
      if (!this.player.moving && this.player.alive && this.playerMovesLeft > 0) {
        const dir = this.getDir();
        if (dir) {
          this.tryMove(dir.dx, dir.dy);
          this.playerMovesLeft--;
        }
      }
      // End turn with ENTER or when out of moves
      if ((this.playerMovesLeft === 0 || Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey('ENTER'))) && !this.player.moving) {
        this.turn = 'enemy';
      }
      // Death test key
      if (this.player.alive && Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.killHero();
      }
    } else if (this.turn === 'enemy') {
      if (!this.enemyMoved) {
        this.undead.getChildren().forEach((u) => {
          if (!u.moving) {
            // Check if adjacent to player for attack
            if (Math.abs(u.gridX - this.player.gridX) + Math.abs(u.gridY - this.player.gridY) === 1) {
              // Flip undead sprite for attack direction
              u.flipX = (this.player.gridX < u.gridX);
              u.play('zombie-attack', true);
              this.player.hp -= 1;
              if (this.player.hpText) this.player.hpText.setText(this.player.hp.toString());
              if (this.player.hp <= 0) {
                this.player.hpText.destroy();
                this.killHero();
              }
              // No move if attacking
              return;
            }
            const dx = this.player.gridX - u.gridX;
            const dy = this.player.gridY - u.gridY;
            let mx = 0, my = 0;
            if (Math.abs(dx) > Math.abs(dy)) {
              mx = Math.sign(dx);
            } else if (dy !== 0) {
              my = Math.sign(dy);
            }
            if (mx !== 0 || my !== 0) {
              this.moveSprite(u, mx, my);
            }
          }
        });
        this.enemyMoved = true;
      }
      // Wait for all undead to finish moving before returning to player turn
      const anyMoving = this.undead.getChildren().some(u => u.moving);
      if (!anyMoving && this.enemyMoved) {
        this.turn = 'player';
        this.playerMovesLeft = 5;
        this.enemyMoved = false;
      }
    }
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
    // Check for attack on undead
    const target = this.undead.getChildren().find(u => u.gridX === nx && u.gridY === ny);
    if (target) {
      // Flip player sprite for attack direction
      this.player.flipX = (target.gridX < this.player.gridX);
      this.player.play('raider-attack', true);
      // Prevent immediate movement and further input
      this.player.moving = true;
      this.player.once('animationcomplete', () => {
        target.hp -= 1;
        if (target.hpText) target.hpText.setText(target.hp.toString());
        if (target.hp <= 0) {
          if (target.hpText) target.hpText.destroy();
          target.destroy();
          this.undead.remove(target);
        }
        this.player.moving = false;
      });
      return; // Never move into the undead's tile
    }
    this.moveSprite(this.player, dx, dy);
  }

  moveSprite(sprite, dx, dy, cb = () => {}) {
    sprite.moving = true;
    sprite.gridX += dx;
    sprite.gridY += dy;
    sprite.play(sprite === this.player ? 'raider-walk' : 'zombie-walk'); // asset key unchanged

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
        sprite.play(sprite === this.player ? 'raider-idle' : 'zombie-walk'); // asset key unchanged
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

    /* spawn undead in 2 s */
    this.time.delayedCall(2000, () => { glyph.destroy(); this.spawnUndead(); });
  }

  spawnUndead() {
    const z = this.add
      .sprite(this.player.x, this.player.y, 'zombie-dead') // asset key unchanged
      .setOrigin(0.5, 1)
      .play('zombie-rise'); // asset key unchanged

    scaleToTile(z);                         // width → 64 px
    z.setScale(z.scaleX * 1.2);             // slight boost to match Raider
    z.gridX = this.player.gridX;
    z.gridY = this.player.gridY;
    this.undead.add(z);
  }
}
