import Phaser from 'phaser';
import { TILE_SIZE, MOVE_TWEEN_MS, TILE, VISION, MOVEMENT } from '../constants.js';
import MovementSystem from '../systems/MovementSystem.js';
import { scaleToTile } from '../utils/scaleToTile.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  preload() { /* nothing */ }

  create() {
    this.turn = 'player'; // 'player' or 'enemy'
    this.enemyMoved = false;
    this.survivors = []; // Initialize survivors array
    this.selectedSurvivor = null; // Track selected survivor
    this.currentTurn = 'player'; // Track current turn
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

    // Initialize movement system
    this.movementSystem = new MovementSystem(this);
    this.selectedSurvivor = null;
    this.currentTurn = 'player'; // 'player' or 'enemy'
    this.survivors = [];
    
    // Set up input handling - bind the method to maintain 'this' context
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.input.on('pointerdown', this.handlePointerDown);
    
    // Add end turn button
    this.endTurnButton = this.add.text(
      this.cameras.main.width - 150,
      20,
      'End Turn',
      { font: '20px Arial', color: '#ffffff', backgroundColor: '#333333', padding: { x: 10, y: 5 }}
    )
    .setInteractive()
    .on('pointerdown', this.endPlayerTurn, this);
    
    // Raider_1
    const p1 = this.add
      .sprite(1 * TILE_SIZE + TILE_SIZE / 2, 1 * TILE_SIZE + TILE_SIZE, 'raider-idle')
      .setOrigin(0.5, 1)
      .setDepth(10)
      .play('raider-idle')
      .setInteractive();

    scaleToTile(p1);
    p1.setScale(p1.scaleX * 1.6);
    p1.gridX = 1;
    p1.gridY = 1;
    p1.hp = 5;
    p1.maxHp = 5;
    p1.actionPoints = MOVEMENT.ACTION_POINTS; // Initialize action points
    p1.hpText = this.add.text(
      p1.x,
      p1.y - 54,
      p1.hp.toString(),
      { font: '16px Inter', color: '#fff', stroke: '#000', strokeThickness: 3 }
    ).setOrigin(0.5, 1).setDepth(12);
    p1.spriteKey = 'raider-idle';
    p1.walkKey = 'raider-walk';
    p1.attackKey = 'raider-attack';
    p1.idleKey = 'raider-idle';
    p1.alive = true;
    p1.visionRange = VISION.BASE_RANGE; // Base vision range
    p1.shadow = this.add.ellipse(p1.x, p1.y - 4, 32, 10, 0x000000, 0.3).setOrigin(0.5, 0.5).setDepth(9);
    this.survivors.push(p1);
    
    // Raider_2 with enhanced vision
    const p2 = this.add
      .sprite(3 * TILE_SIZE + TILE_SIZE / 2, 1 * TILE_SIZE + TILE_SIZE, 'raider2-idle')
      .setOrigin(0.5, 1)
      .setDepth(10)
      .play('raider2-idle')
      .setInteractive();

    scaleToTile(p2);
    p2.setScale(p2.scaleX * 1.6);
    p2.gridX = 3;
    p2.gridY = 1;
    p2.hp = 5;
    p2.maxHp = 5;
    p2.actionPoints = MOVEMENT.ACTION_POINTS; // Initialize action points
    p2.hpText = this.add.text(
      p2.x,
      p2.y - 54,
      p2.hp.toString(),
      { font: '16px Inter', color: '#9ef', stroke: '#000', strokeThickness: 3 }
    ).setOrigin(0.5, 1).setDepth(12);
    p2.spriteKey = 'raider2-idle';
    p2.walkKey = 'raider2-walk';
    p2.attackKey = 'raider2-attack';
    p2.idleKey = 'raider2-idle';
    p2.alive = true;
    p2.visionRange = VISION.INCREASED_RANGE; // Increased vision range
    p2.shadow = this.add.ellipse(p2.x, p2.y - 4, 32, 10, 0x000000, 0.3).setOrigin(0.5, 0.5).setDepth(9);
    this.survivors.push(p2);
    // Set active survivor
    this.activeSurvivorIndex = 0;
    this.player = this.survivors[this.activeSurvivorIndex]; // for compatibility


    /* ========== INFECTION HAZE ========== */
    console.log('Initializing Infection Haze system...', new Date().toISOString());
    
    // Track tile states: 0=unexplored, 1=explored (fog of war), 2=visible
    this.infectionHaze = Array(10).fill().map(() => Array(10).fill(0));
    
    // Create a single graphics object for the fog of war
    this.hazeLayer = this.add.graphics()
      .fillStyle(0x1a3a1a, 1)
      .fillRect(0, 0, 10 * TILE_SIZE, 10 * TILE_SIZE)
      .setDepth(1000);
    
    // Initialize explored areas around starting survivors
    this.survivors.forEach(survivor => {
      if (survivor) {
        const tileX = Math.floor(survivor.x / TILE_SIZE);
        const tileY = Math.floor(survivor.y / TILE_SIZE);
        
        // Mark a 3x3 area as explored around each survivor
        for (let y = -1; y <= 1; y++) {
          for (let x = -1; x <= 1; x++) {
            const nx = tileX + x;
            const ny = tileY + y;
            if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
              this.infectionHaze[ny][nx] = 2; // 2 = visible
            }
          }
        }
      }
    });
    
    // Update the fog of war immediately
    this.updateHazeMask();
    
    // Update on movement
    this.events.on('update', this.updateHazeMask, this);
    
    // Store visible tiles for reference
    this.visibleTiles = new Set();
    
    // Initial update
    this.updateHazeMask();
    
    // Update haze on movement
    this.events.on('update', this.updateHazeMask, this);
    
    console.log('Infection Haze ready');

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
        { font: '16px Inter', color: '#fff', stroke: '#000', strokeThickness: 3 }
      ).setOrigin(0.5, 1);
      // Add shadow
      z.shadow = this.add.ellipse(z.x, z.y - 4, 32, 10, 0x000000, 0.3).setOrigin(0.5, 0.5);
      this.undead.add(z);
    }
  }

  update() {
    // Update HP text positions for all survivors
    this.survivors.forEach(s => {
      if (s.hpText) {
        s.hpText.setPosition(s.x, s.y - 54);
        s.hpText.setText(s.hp.toString());
      }
    });
    
    // Update undead HP text and shadows
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
    
    // Check for game over
    if (this.turn === 'player' && !this.survivors.some(s => s.alive)) {
      console.log('Game Over - All survivors are dead');
      // TODO: trigger game over UI
      return;
    }
    
    // Handle enemy turn
    if (this.turn === 'enemy' && !this.enemyMoved) {
      this.undead.getChildren().forEach((u) => {
        if (!u.moving) {
          // Find any adjacent alive survivor
          const targetSurvivor = this.survivors.find(s => 
            s.alive && Math.abs(u.gridX - s.gridX) + Math.abs(u.gridY - s.gridY) === 1
          );
          
          if (targetSurvivor) {
            // Attack survivor
            u.flipX = (targetSurvivor.gridX < u.gridX);
            u.play('zombie-attack', true);
            targetSurvivor.hp -= 1;
            
            if (targetSurvivor.hpText) {
              targetSurvivor.hpText.setText(targetSurvivor.hp.toString());
            }
            
            if (targetSurvivor.hp <= 0) {
              if (targetSurvivor.hpText) targetSurvivor.hpText.destroy();
              this.killSurvivor(targetSurvivor);
            }
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
            const occupied = this.survivors.some(s => 
              s.alive && s.gridX === u.gridX + mx && s.gridY === u.gridY + my
            ) || this.undead.getChildren().some(other => 
              other !== u && other.gridX === u.gridX + mx && other.gridY === u.gridY + my
            );
            
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
      onUpdate: () => {
        // Update infection haze during movement for smoother visual feedback
        if (this.survivors.includes(sprite)) {
          this.updateHazeMask();
        }
      },
      onComplete: () => {
        sprite.moving = false;
        // Idle animation for survivors or undead
        if (this.survivors.includes(sprite)) {
          sprite.play(sprite.idleKey || 'raider-idle');
          // Update infection haze after movement completes
          this.updateHazeMask();
        } else {
          sprite.play('zombie-walk');
        }
        cb();
      },
    });
  }

  /* ---------- infection-haze ---------- */
  updateHazeMask() {
    if (!this.survivors || !this.hazeLayer) {
      return;
    }
    
    // Clear the haze layer
    this.hazeLayer.clear();
    
    // Track visible tiles for game logic
    const visibleTiles = new Set();
    
    // First pass: reset visibility for all tiles (only show explored areas)
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (this.infectionHaze[y][x] === 2) {
          this.infectionHaze[y][x] = 1; // Set previously visible to explored
        }
      }
    }
    
    // Second pass: update visibility based on survivor positions
    this.survivors.forEach(survivor => {
      if (survivor && survivor.alive) {
        const centerX = Math.floor(survivor.x / TILE_SIZE);
        const centerY = Math.floor(survivor.y / TILE_SIZE);
        const visionRange = survivor.visionRange || VISION.BASE_RANGE;
        const visionRangeSquared = visionRange * visionRange;
        
        // Calculate vision area based on range
        for (let y = -visionRange; y <= visionRange; y++) {
          for (let x = -visionRange; x <= visionRange; x++) {
            const nx = centerX + x;
            const ny = centerY + y;
            const distSq = x * x + y * y;
            
            // Check if within bounds and within vision range
            if (distSq <= visionRangeSquared && nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
              // Mark as explored (if not already visible)
              if (this.infectionHaze[ny][nx] !== 2) {
                this.infectionHaze[ny][nx] = 1;
              }
              
              // Mark as visible if in vision range
              if (distSq <= visionRangeSquared) {
                this.infectionHaze[ny][nx] = 2;
                visibleTiles.add(`${nx},${ny}`);
              }
            }
          }
        }
      }
    });
    
    // Draw the fog of war
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const state = this.infectionHaze[y][x];
        
        if (state === 0) {
          // Unexplored - dark
          this.hazeLayer.fillStyle(0x1a3a1a, VISION.UNEXPLORED_OPACITY);
        } else if (state === 1) {
          // Explored but not currently visible - dim
          this.hazeLayer.fillStyle(0x1a3a1a, VISION.EXPLORED_OPACITY);
        } else {
          // Currently visible - clear
          continue;
        }
        
        this.hazeLayer.fillRect(
          x * TILE_SIZE,
          y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE
        );
      }
    }
    
    // Store visible tiles for reference
    this.visibleTiles = visibleTiles;
  }
  
  // This will be called after the scene is fully created
  createPost() {
    // Ensure the infection haze is properly initialized
    this.time.delayedCall(100, () => {
      if (this.updateHazeMask) {
        this.updateHazeMask();
      }
    });
    
    // Update infection haze periodically for smooth transitions
    this.time.addEvent({
      delay: 100,
      callback: this.updateHazeMask,
      callbackScope: this,
      loop: true
    });
  }

  /* ---------- death → zombie ---------- */
  killSurvivor(survivor) {
    survivor.alive = false;
    survivor.setTint(0x555555);
    if (survivor.hpText) survivor.hpText.destroy();
    if (survivor.shadow) survivor.shadow.destroy();
    survivor.destroy();

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
          { font: '16px Inter', color: '#fff', stroke: '#000', strokeThickness: 3 }
        ).setOrigin(0.5, 1).setDepth(12);
        z.shadow = this.add.ellipse(z.x, z.y - 4, 32, 10, 0x000000, 0.3).setOrigin(0.5, 0.5).setDepth(9);
        this.undead.add(z);
      });
    }

    // Optionally, play a special effect for turning
    // (skip the delayed glyph/undead spawn)
  }
  // Handle pointer down events
  handlePointerDown(pointer) {
    if (this.currentTurn !== 'player') return;
    
    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);
    
    // Check if clicking on a survivor
    const clickedSurvivor = this.survivors.find(s => 
      s.alive && 
      s.actionPoints > 0 &&
      Math.floor(s.x / TILE_SIZE) === tileX && 
      Math.floor(s.y / TILE_SIZE) === tileY
    );
    
    if (clickedSurvivor) {
      if (this.selectedSurvivor === clickedSurvivor) {
        // Clicked the same survivor - deselect
        this.clearSelection();
      } else {
        this.selectSurvivor(clickedSurvivor);
      }
      return;
    }
    
    // If we have a selected survivor with AP, try to move
    if (this.selectedSurvivor?.actionPoints > 0) {
      this.moveSelectedSurvivor(tileX, tileY);
    } else {
      this.clearSelection();
    }
  }
  
  // Select a survivor and show movement range
  selectSurvivor(survivor) {
    // Clear previous selection
    this.clearSelection();
    
    // Set new selection
    this.selectedSurvivor = survivor;
    survivor.setTint(0xFFA500); // Orange tint for selection
    
    // Initialize action points if not set
    if (survivor.actionPoints === undefined) {
      survivor.actionPoints = MOVEMENT.ACTION_POINTS;
    }
    
    // Calculate and show movement range
    this.movementSystem.calculateRange(survivor, survivor.actionPoints * MOVEMENT.BASE_SPEED);
    this.movementSystem.showRange();
  }
  
  // Move selected survivor to target tile
  moveSelectedSurvivor(tileX, tileY) {
    if (!this.selectedSurvivor) return;
    
    const path = this.movementSystem.getPathTo(tileX, tileY);
    if (!path || path.length === 0) return;
    
    const survivor = this.selectedSurvivor;
    const target = path[path.length - 1];
    
    // Calculate movement cost
    const isDiagonal = path.length > 1 && 
      (Math.abs(path[0].x - path[1].x) === 1 && Math.abs(path[0].y - path[1].y) === 1);
    const moveCost = isDiagonal ? Math.ceil(MOVEMENT.DIAGONAL_COST) : 1;
    
    if (survivor.actionPoints < moveCost) {
      return; // Not enough AP
    }
    
    // Update survivor state
    survivor.actionPoints -= moveCost;
    survivor.gridX = target.x;
    survivor.gridY = target.y;
    
    // Animate movement
    this.tweens.add({
      targets: [survivor, survivor.shadow],
      x: target.x * TILE_SIZE + TILE_SIZE / 2,
      y: (target.y * TILE_SIZE) + TILE_SIZE,
      duration: 300,
      onComplete: () => {
        // Update fog of war after moving
        this.updateHazeMask();
        
        // If no more AP, clear selection
        if (survivor.actionPoints <= 0) {
          this.clearSelection();
        }
      }
    });
    
    // Update movement range for remaining AP
    if (survivor.actionPoints > 0) {
      this.movementSystem.calculateRange(survivor, survivor.actionPoints * MOVEMENT.BASE_SPEED);
      this.movementSystem.showRange();
    } else {
      this.movementSystem.hideRange();
    }
  }
  
  // Clear current selection and hide movement range
  clearSelection() {
    if (this.selectedSurvivor) {
      this.selectedSurvivor.clearTint();
      this.selectedSurvivor = null;
    }
    this.movementSystem.hideRange();
  }
  
  // End current turn and start enemy turn
  endPlayerTurn() {
    this.currentTurn = 'enemy';
    this.clearSelection();
    
    // Reset AP for all survivors
    this.survivors.forEach(s => {
      if (s.alive) {
        s.actionPoints = MOVEMENT.ACTION_POINTS;
      }
    });
    
    // Start enemy turn after a delay
    this.time.delayedCall(1000, () => this.startEnemyTurn());
  }
  
  // Enemy turn logic
  startEnemyTurn() {
    // TODO: Implement enemy AI
    console.log('Enemy turn started');
    
    // For now, just end the enemy turn after a delay
    this.time.delayedCall(1000, () => {
      this.currentTurn = 'player';
      console.log('Player turn started');
    });
  }
  
  // For compatibility
  killHero() {
    this.killSurvivor(this.player);
  }

  spawnUndead() {
    const z = this.add
      .sprite(this.player.x, this.player.y, 'zombie-dead')
      .setOrigin(0.5, 1)
      .play('zombie-rise');

    scaleToTile(z);
    z.setScale(z.scaleX * 1.2);
    z.gridX = this.player.gridX;
    z.gridY = this.player.gridY;
    this.undead.add(z);
  }
}
