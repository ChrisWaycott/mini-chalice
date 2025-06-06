import Phaser from 'phaser';
import { TILE_SIZE, MOVE_TWEEN_MS, TILE } from '../constants.js';
import { scaleToTile } from '../utils/scaleToTile.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  preload() { /* nothing */ }

  create() {
    // Set up movement keys ONCE
    this.keys = this.input.keyboard.addKeys({
      LEFT: 'LEFT',
      RIGHT: 'RIGHT',
      UP: 'UP',
      DOWN: 'DOWN',
      A: 'A',
      D: 'D',
      W: 'W',
      S: 'S'
    });
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
        const tile = this.add.image(x * TILE_SIZE, y * TILE_SIZE, key).setOrigin(0).setDepth(0);
        this.tileLayer.add(tile);
        this.grid[y][x] = { key, walkable: !key.startsWith('wall_') };
      }
    }

    /* -------- hero start tile -------- */
const START_GX = 1;          // grid X
const START_GY = 1;          // grid Y
const px = START_GX;
const py = START_GY;

    this.survivors = [];
    // Raider_1
    const p1 = this.add
      .sprite(px * TILE_SIZE + TILE_SIZE / 2, py * TILE_SIZE + TILE_SIZE, 'raider-idle')
      .setOrigin(0.5, 1)
      .setDepth(10)
      .play('raider-idle');
    scaleToTile(p1);
    p1.setScale(p1.scaleX * 1.6);
    p1.gridX = px;
    p1.gridY = py;
    p1.hp = 3;
    p1.hpText = this.add.text(
      p1.x,
      p1.y - 54,
      p1.hp.toString(),
      { font: '16px Arial', color: '#fff', stroke: '#000', strokeThickness: 3 }
    ).setOrigin(0.5, 1).setDepth(12);
    p1.spriteKey = 'raider-idle';
    p1.walkKey = 'raider-walk';
    p1.attackKey = 'raider-attack';
    p1.idleKey = 'raider-idle';
    p1.alive = true;
    p1.shadow = this.add.ellipse(p1.x, p1.y - 4, 32, 10, 0x000000, 0.3).setOrigin(0.5, 0.5).setDepth(9);
    this.survivors.push(p1);
    // Raider_2 (spawn at opposite corner)
    const p2 = this.add
      .sprite(8 * TILE_SIZE + TILE_SIZE / 2, 8 * TILE_SIZE + TILE_SIZE, 'raider2-idle')
      .setOrigin(0.5, 1)
      .setDepth(10)
      .play('raider2-idle');
    scaleToTile(p2);
    p2.setScale(p2.scaleX * 1.6);
    p2.gridX = 8;
    p2.gridY = 8;
    p2.hp = 3;
    p2.hpText = this.add.text(
      p2.x,
      p2.y - 54,
      p2.hp.toString(),
      { font: '16px Arial', color: '#9ef', stroke: '#000', strokeThickness: 3 }
    ).setOrigin(0.5, 1).setDepth(12);
    p2.spriteKey = 'raider2-idle';
    p2.walkKey = 'raider2-walk';
    p2.attackKey = 'raider2-attack';
    p2.idleKey = 'raider2-idle';
    p2.alive = true;
    p2.shadow = this.add.ellipse(p2.x, p2.y - 4, 32, 10, 0x000000, 0.3).setOrigin(0.5, 0.5).setDepth(9);
    this.survivors.push(p2);
    // Set active survivor
    this.activeSurvivorIndex = 0;
    this.player = this.survivors[this.activeSurvivorIndex]; // for compatibility


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
        this.survivors.some(s => s.alive && s.gridX === gx && s.gridY === gy) ||
        this.undead && this.undead.getChildren().some(u => u.gridX === gx && u.gridY === gy) ||
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
      // Add shadow
      z.shadow = this.add.ellipse(z.x, z.y - 4, 32, 10, 0x000000, 0.3).setOrigin(0.5, 0.5);
      this.undead.add(z);
    }
  }

  update() {
    // Toggle between survivors with 1 and 2
    // Only allow toggling to alive survivors
    if (Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey('ONE')) && this.survivors[0].alive) {
      this.activeSurvivorIndex = 0;
      this.player = this.survivors[0];
    }
    if (Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey('TWO')) && this.survivors[1].alive) {
      this.activeSurvivorIndex = 1;
      this.player = this.survivors[1];
    }
    // If active survivor is dead, auto-switch to next alive
    if (!this.player.alive) {
      const nextAlive = this.survivors.findIndex(s => s.alive);
      if (nextAlive !== -1) {
        this.activeSurvivorIndex = nextAlive;
        this.player = this.survivors[nextAlive];
      }
    }

    // Update HP text positions for all survivors
    this.survivors.forEach(s => {
      s.hpText.setPosition(s.x, s.y - 54);
      s.hpText.setText(s.hp.toString());
    });
    this.undead.getChildren().forEach(u => {
      if (u.hpText) {
        u.hpText.setPosition(u.x, u.y - 54);
        u.hpText.setText(u.hp.toString());
      }
      if (u.shadow) {
        u.shadow.setPosition(u.x, u.y - 4);
      }
    });
    // Update survivor shadows
    this.survivors.forEach(s => {
      if (s.shadow) {
        s.shadow.setPosition(s.x, s.y - 4);
      }
    });
    if (this.turn === 'player') {
      // DEBUG: Reset .moving for all survivors and log their state
      this.survivors.forEach((s, i) => {
        if (s.moving) {
          console.warn(`Survivor ${i + 1} (${s.spriteKey}) was stuck moving. Forcibly resetting.`);
        }
        s.moving = false;
        console.log(`Survivor ${i + 1} alive=${s.alive} moving=${s.moving}`);
      });
      // If all survivors are dead, game over
      if (!this.survivors.some(s => s.alive)) {
        // TODO: trigger game over UI
        return;
      }
      if (!this.player.moving && this.player.alive && this.playerMovesLeft > 0) {
        const dir = this.getDirJustDown();
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
        this.killSurvivor(this.player);
      }
    } else if (this.turn === 'enemy') {
      if (!this.enemyMoved) {
        this.undead.getChildren().forEach((u) => {
          if (!u.moving) {
            // Find any adjacent alive survivor
            const targetSurvivor = this.survivors.find(s => s.alive && Math.abs(u.gridX - s.gridX) + Math.abs(u.gridY - s.gridY) === 1);
            if (targetSurvivor) {
              // Flip undead sprite for attack direction
              u.flipX = (targetSurvivor.gridX < u.gridX);
              u.play('zombie-attack', true);
              targetSurvivor.hp -= 1;
              if (targetSurvivor.hpText) targetSurvivor.hpText.setText(targetSurvivor.hp.toString());
              if (targetSurvivor.hp <= 0) {
                if (targetSurvivor.hpText) targetSurvivor.hpText.destroy();
                this.killSurvivor(targetSurvivor);
              }
              // No move if attacking
              return;
            }
            // Move toward nearest alive survivor
            const aliveSurvivors = this.survivors.filter(s => s.alive);
            if (aliveSurvivors.length === 0) return; // no targets left
            // Find closest survivor
            let closest = aliveSurvivors[0];
            let minDist = Math.abs(u.gridX - closest.gridX) + Math.abs(u.gridY - closest.gridY);
            for (const s of aliveSurvivors) {
              const dist = Math.abs(u.gridX - s.gridX) + Math.abs(u.gridY - s.gridY);
              if (dist < minDist) {
                minDist = dist;
                closest = s;
              }
            }
            const dx = closest.gridX - u.gridX;
            const dy = closest.gridY - u.gridY;
            let mx = 0, my = 0;
            if (Math.abs(dx) > Math.abs(dy)) {
              mx = Math.sign(dx);
            } else if (dy !== 0) {
              my = Math.sign(dy);
            }
            if (mx !== 0 || my !== 0) {
              // Prevent undead from moving onto survivors or other undead
              const occupied = this.survivors.some(s => s.alive && s.gridX === u.gridX + mx && s.gridY === u.gridY + my) ||
                this.undead.getChildren().some(other => other !== u && other.gridX === u.gridX + mx && other.gridY === u.gridY + my);
              if (!occupied) {
                this.moveSprite(u, mx, my);
              }
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
  getDirJustDown() {
  const k = this.keys;
  if (Phaser.Input.Keyboard.JustDown(k.LEFT)  || Phaser.Input.Keyboard.JustDown(k.A)) return { dx: -1, dy: 0 };
  if (Phaser.Input.Keyboard.JustDown(k.RIGHT) || Phaser.Input.Keyboard.JustDown(k.D)) return { dx:  1, dy: 0 };
  if (Phaser.Input.Keyboard.JustDown(k.UP)    || Phaser.Input.Keyboard.JustDown(k.W)) return { dx:  0, dy: -1 };
  if (Phaser.Input.Keyboard.JustDown(k.DOWN)  || Phaser.Input.Keyboard.JustDown(k.S)) return { dx:  0, dy: 1 };
  return null;
}

  tryMove(dx, dy) {
    const nx = this.player.gridX + dx;
    const ny = this.player.gridY + dy;
    if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10) return;
    if (!this.grid[ny][nx].walkable) return;
    // Prevent moving onto another survivor
    if (this.survivors.some(s => s !== this.player && s.alive && s.gridX === nx && s.gridY === ny)) return;
    // Check for attack on undead
    const target = this.undead.getChildren().find(u => u.gridX === nx && u.gridY === ny);
    if (target) {
      // Flip survivor sprite for attack direction
      this.player.flipX = (target.gridX < this.player.gridX);
      // Defensive animation check
      const attackAnim = this.player.attackKey || 'raider-attack';
      if (!this.anims.exists(attackAnim)) {
        console.error(`Missing attack animation: '${attackAnim}' for survivor`, this.player);
        this.player.moving = false;
        return;
      }
      this.player.play(attackAnim, true);
      // Prevent immediate movement and further input
      this.player.moving = true;
      this.player.once('animationcomplete', () => {
        target.hp -= 1;
        if (target.hpText) target.hpText.setText(target.hp.toString());
        if (target.hp <= 0) {
          if (target.hpText) target.hpText.destroy();
          if (target.shadow) target.shadow.destroy();
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
    // Flip sprite based on intended movement direction (left = true, right = false)
    if (dx !== 0) sprite.flipX = dx < 0;
    // Play correct walk animation for survivors or undead
    if (this.survivors.includes(sprite)) {
      sprite.play(sprite.walkKey || 'raider-walk');
    } else {
      sprite.play('zombie-walk');
    }

    this.tweens.add({
      targets: sprite,
      x: sprite.gridX * TILE_SIZE + TILE_SIZE / 2,
      y: sprite.gridY * TILE_SIZE + TILE_SIZE,   // feet on tile
      duration: MOVE_TWEEN_MS,
      onUpdate: () => {},
      onComplete: () => {
        sprite.moving = false;
        // Idle animation for survivors or undead
        if (this.survivors.includes(sprite)) {
          sprite.play(sprite.idleKey || 'raider-idle');
        } else {
          sprite.play('zombie-walk');
        }
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
  killSurvivor(survivor) {
    survivor.alive = false;
    survivor.setTint(0x555555);
    if (survivor.hpText) survivor.hpText.destroy();

    /* corrupt tile */
    const t = this.grid[survivor.gridY][survivor.gridX];
    t.key      = TILE.CORRUPT;
    t.walkable = false;
    this.add.image(
      survivor.gridX * TILE_SIZE,
      survivor.gridY * TILE_SIZE,
      TILE.CORRUPT
    ).setOrigin(0).setDepth(1);

    // Immediately spawn an undead at survivor's position (full HP)
    // Only if no other undead is on this tile
    if (!this.undead.getChildren().some(u => u.gridX === survivor.gridX && u.gridY === survivor.gridY) &&
        !this.survivors.some(s => s !== survivor && s.alive && s.gridX === survivor.gridX && s.gridY === survivor.gridY)) {
      // Show spawn_glyph and pulse for 2s, then spawn undead
      const glyph = this.add.image(
        survivor.gridX * TILE_SIZE + TILE_SIZE / 2,
        survivor.gridY * TILE_SIZE + TILE_SIZE / 2,
        'spawn_glyph'
      ).setDepth(10).setScale(0.8).setAlpha(0);
      this.tweens.add({
        targets: glyph,
        alpha:   1,
        scale:   1,
        duration: 400,
        yoyo:     true,
        repeat:   2 // 3 flashes total
      });
      this.time.delayedCall(2000, () => {
        glyph.destroy();
        const z = this.add
          .sprite(survivor.gridX * TILE_SIZE + TILE_SIZE / 2, survivor.gridY * TILE_SIZE + TILE_SIZE, 'zombie-dead')
          .setOrigin(0.5, 1)
          .play('zombie-rise')
          .setDepth(10);
        scaleToTile(z);
        z.setScale(z.scaleX * 1.2);
        z.gridX = survivor.gridX;
        z.gridY = survivor.gridY;
        z.hp = 2;
        z.hpText = this.add.text(
          z.x,
          z.y - 54,
          z.hp.toString(),
          { font: '16px Arial', color: '#fff', stroke: '#000', strokeThickness: 3 }
        ).setOrigin(0.5, 1).setDepth(12);
        z.shadow = this.add.ellipse(z.x, z.y - 4, 32, 10, 0x000000, 0.3).setOrigin(0.5, 0.5).setDepth(9);
        this.undead.add(z);
      });
    }

    // Optionally, play a special effect for turning
    // (skip the delayed glyph/undead spawn)
  }
  // For compatibility
  killHero() {
    this.killSurvivor(this.player);
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
