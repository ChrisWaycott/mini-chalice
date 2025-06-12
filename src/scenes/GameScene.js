import Phaser from 'phaser';
import { TILE_SIZE, MOVE_TWEEN_MS, TILE, VISION, MOVEMENT } from '../constants.js';
import MovementSystem from '../systems/MovementSystem.js';
import { scaleToTile } from '../utils/scaleToTile.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  preload() { /* nothing */ }

  // Check if there's an undead at the given grid coordinates
  isUndeadAt(x, y) {
    return this.undead && this.undead.getChildren().some(u => u.gridX === x && u.gridY === y);
  }

  // Check if there's a survivor at the given grid coordinates
  isSurvivorAt(x, y) {
    return this.survivors.some(s => s.alive && s.gridX === x && s.gridY === y);
  }

  // Check if there's any unit (survivor or undead) at the given grid coordinates
  isUnitAt(x, y) {
    return this.isSurvivorAt(x, y) || this.isUndeadAt(x, y);
  }
  
  // Check if the given grid coordinates are within the game's grid bounds (10x10 grid)
  isInBounds(x, y) {
    return x >= 0 && y >= 0 && x < 10 && y < 10;
  }

  create() {
    this.turn = 'player'; // 'player' or 'enemy'
    this.enemyMoved = false;
    this.survivors = []; // Initialize survivors array
    this.selectedSurvivor = null; // Track selected survivor
    this.currentTurn = 'player'; // Track current turn
    this.lastClickTime = 0; // For debouncing clicks
    
    // Track the last grid position for path preview
    this.lastPreviewX = null;
    this.lastPreviewY = null;
    
    // Set up pointer move handler for cursor changes and path preview
    this.input.on('pointermove', (pointer) => {
      if (this.currentTurn !== 'player') {
        this.game.canvas.style.cursor = 'default';
        return;
      }
      
      // Convert to grid coordinates
      const gridX = Math.floor(pointer.worldX / TILE_SIZE);
      const gridY = Math.floor(pointer.worldY / TILE_SIZE);
      
      // Only update if we've moved to a new grid cell
      if (this.lastPreviewX === gridX && this.lastPreviewY === gridY) {
        return;
      }
      
      // Update last position
      this.lastPreviewX = gridX;
      this.lastPreviewY = gridY;
      
      // Update path preview if we have a selected survivor
      if (this.selectedSurvivor) {
        this.movementSystem.updatePathPreview(pointer.worldX, pointer.worldY);
      }
      
      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      
      // Check bounds
      if (tileX < 0 || tileX >= 10 || tileY < 0 || tileY >= 10) {
        this.game.canvas.style.cursor = 'default';
        return;
      }
      
      // Check if hovering over a selectable survivor
      const hoveredSurvivor = this.survivors.find(s => {
        if (!s.alive || s.actionPoints <= 0) return false;
        
        // Calculate tile position based on sprite's grid position
        const spriteTileX = s.gridX;
        const spriteTileY = s.gridY;
        
        // Check if the hovered tile matches the sprite's grid position
        // Also check adjacent tiles since the sprite might span multiple tiles
        const dx = Math.abs(tileX - spriteTileX);
        const dy = Math.abs(tileY - spriteTileY);
        
        return dx <= 0 && dy <= 0; // Check if within the same tile
      });
      
      // Check if hovering over a valid movement tile
      const isMovementTile = this.movementSystem?.movementRange?.some(
        tile => tile.x === tileX && tile.y === tileY
      );
      
      if (hoveredSurvivor || (isMovementTile && this.selectedSurvivor?.actionPoints > 0)) {
        this.game.canvas.style.cursor = 'pointer';
      } else {
        this.game.canvas.style.cursor = 'default';
      }
    });
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
    console.log('Initializing movement system...');
    this.movementSystem = new MovementSystem(this);
    console.log('Movement system initialized:', this.movementSystem);
    
    this.selectedSurvivor = null;
    this.currentTurn = 'player'; // 'player' or 'enemy'
    this.survivors = [];
    this.visibleTiles = new Set(); // Track visible tiles for game logic
    
    // Set up input handling - bind the method to maintain 'this' context
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.input.on('pointerdown', this.handlePointerDown);
    
    // Enable input on the entire game canvas
    this.input.setDefaultCursor('pointer');
    
    // Set up mouse move handler for path preview
    this.input.on('pointermove', (pointer) => {
      if (this.selectedSurvivor && this.selectedSurvivor.actionPoints > 0) {
        const tileX = Math.floor(pointer.worldX / TILE_SIZE);
        const tileY = Math.floor(pointer.worldY / TILE_SIZE);
        
        // Only process if we're within bounds
        if (tileX >= 0 && tileX < 10 && tileY >= 0 && tileY < 10) {
          // Add point to mouse path
          if (this.movementSystem.addMousePoint(tileX, tileY)) {
            // Update path preview
            this.movementSystem.updatePathPreview(pointer.worldX, pointer.worldY);
          }
        }
      }
    });
    
    // Clear mouse path on pointer up
    this.input.on('pointerup', () => {
      if (this.movementSystem) {
        this.movementSystem.clearMousePath();
      }
    });
    
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
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer) => {
        if (this.currentTurn === 'player') {
          this.handlePointerDown(pointer);
        }
      });

    scaleToTile(p1);
    p1.setScale(p1.scaleX * 1.6);
    p1.gridX = 1;
    p1.gridY = 1;
    p1.hp = 5;
    p1.maxHp = 5;
    p1.actionPoints = MOVEMENT.ACTION_POINTS; // Initialize action points
    console.log(`[INIT] Survivor 1 AP set to: ${p1.actionPoints}`);
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
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer) => {
        if (this.currentTurn === 'player') {
          this.handlePointerDown(pointer);
        }
      });

    scaleToTile(p2);
    p2.setScale(p2.scaleX * 1.6);
    p2.gridX = 3;
    p2.gridY = 1;
    p2.hp = 5;
    p2.maxHp = 5;
    p2.actionPoints = MOVEMENT.ACTION_POINTS; // Initialize action points
    console.log(`[INIT] Survivor 2 AP set to: ${p2.actionPoints}`);
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
    // Create the haze layer with proper depth (above tiles, below UI)
    this.hazeLayer = this.add.graphics()
      .fillStyle(0x1a3a1a, 1)
      .fillRect(0, 0, 10 * TILE_SIZE, 10 * TILE_SIZE)
      .setDepth(1000); // Set a high depth to ensure it's above the tiles but below UI elements
    
    // Initialize infectionHaze array (0 = unexplored, 1 = explored, 2 = visible)
    this.infectionHaze = [];
    for (let y = 0; y < 10; y++) {
      this.infectionHaze[y] = [];
      for (let x = 0; x < 10; x++) {
        this.infectionHaze[y][x] = 0; // Start with all tiles unexplored
      }
    }
    
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
    if (!this.survivors || !this.hazeLayer || !this.infectionHaze) {
      console.warn('Haze system not properly initialized');
      return;
    }
    
    // Clear the haze layer
    this.hazeLayer.clear();
    
    // Track visible tiles for game logic
    const visibleTiles = new Set();
    
    // First pass: mark all currently visible tiles as explored
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (this.infectionHaze[y][x] === 1) {
          this.infectionHaze[y][x] = 1; // Already explored
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
              // Mark as explored
              this.infectionHaze[ny][nx] = 1;
              visibleTiles.add(`${nx},${ny}`);
            }
          }
        }
      }
    });
    
    // Third pass: draw the fog of war with edge effect
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const isExplored = this.infectionHaze[y][x] === 1;
        
        // Skip explored tiles (they're fully visible)
        if (isExplored) continue;
        
        // Check if this tile is adjacent to an explored tile
        let isEdge = false;
        let edgeDirection = { top: false, right: false, bottom: false, left: false };
        
        // Check all four directions for explored tiles
        const directions = [
          { dx: 0, dy: -1, edge: 'top' },
          { dx: 1, dy: 0, edge: 'right' },
          { dx: 0, dy: 1, edge: 'bottom' },
          { dx: -1, dy: 0, edge: 'left' }
        ];
        
        for (const dir of directions) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && this.infectionHaze[ny][nx] === 1) {
            isEdge = true;
            edgeDirection[dir.edge] = true;
          }
        }
        
        // Draw unexplored tile with edge effect
        const alpha = isEdge ? 0.7 : VISION.UNEXPLORED_OPACITY;
        
        // Use fillStyle with hex color for better compatibility
        this.hazeLayer.fillStyle(0x207320, alpha);
        this.hazeLayer.fillRect(
          x * TILE_SIZE,
          y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE
        );
        
        // Draw edge highlights
        if (isEdge) {
          this.hazeLayer.lineStyle(2, 0x4ca64c, .9);
          
          
        }
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
        // Mark starting area as explored
        const startX = 0;
        const startY = 0;
        const startRadius = 3;
        
        for (let y = -startRadius; y <= startRadius; y++) {
          for (let x = -startRadius; x <= startRadius; x++) {
            const nx = 1 + x; // Center around first survivor
            const ny = 1 + y;
            if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
              this.infectionHaze[ny][nx] = 2; // Mark as visible
            }
          }
        }
        
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
  // Track last click time to prevent double-clicks
  lastClickTime = 0;
  
  // Handle pointer down events
  handlePointerDown(pointer) {
    // Don't process input if it's not the player's turn
    if (this.currentTurn !== 'player') {
      console.log('Not player\'s turn');
      return;
    }
    
    // Debounce rapid clicks (less than 200ms apart)
    const now = Date.now();
    if (now - this.lastClickTime < 200) {
      console.log('Ignoring rapid click');
      return;
    }
    this.lastClickTime = now;
    
    // Convert pointer coordinates to tile coordinates
    const tileX = Math.floor(pointer.worldX / TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / TILE_SIZE);
    
    // Debug log
    console.log(`Click at (${tileX}, ${tileY})`);
    
    // Check if the click is within bounds
    if (tileX < 0 || tileX >= 10 || tileY < 0 || tileY >= 10) {
      console.log('Click out of bounds, clearing selection');
      this.clearSelection();
      return;
    }
    
    // Check if clicking on a survivor with AP
    const clickedSurvivor = this.survivors.find(s => {
      if (!s.alive) return false;
      
      // Get the sprite's grid position directly from its properties
      const spriteTileX = s.gridX;
      const spriteTileY = s.gridY;
      
      // Check if the click is on the same tile as the survivor's grid position
      const isClickingThisSurvivor = tileX === spriteTileX && tileY === spriteTileY;
      
      // Only allow selecting if the survivor has AP left
      if (isClickingThisSurvivor && s.actionPoints <= 0) {
        console.log(`[CLICK] Survivor at (${tileX},${tileY}) has no AP left`);
        return false;
      }
      
      return isClickingThisSurvivor;
    });
    
    console.log('Clicked survivor:', clickedSurvivor ? 'found' : 'not found');
    
    // If clicking on the already selected survivor, clear selection
    if (clickedSurvivor === this.selectedSurvivor) {
      console.log('Deselecting current survivor');
      this.clearSelection();
      return;
    }
    
    // If clicking on a different survivor, select it
    if (clickedSurvivor) {
      console.log('Selecting new survivor');
      this.selectSurvivor(clickedSurvivor);
      return;
    }
    
    // Check if we have a valid path to the clicked tile
    if (this.selectedSurvivor?.actionPoints > 0 && this.movementSystem.currentPath?.length > 0) {
      const lastStep = this.movementSystem.currentPath[this.movementSystem.currentPath.length - 1];
      
      // Check if the last step of the current path matches the clicked tile
      if (lastStep.x === tileX && lastStep.y === tileY) {
        console.log(`Moving to (${tileX}, ${tileY}) using exact path`);
        this.moveSelectedSurvivor(tileX, tileY);
        return;
      } else {
        console.log('Not the end of the current path, clearing selection');
        this.clearSelection();
        return;
      }
    }
    
    // If we get here, no valid action was taken
    console.log('No valid action, clearing selection');
    this.clearSelection();
  }
  
  // Select a survivor and show movement range
  selectSurvivor(survivor) {
    console.log('[SELECT] Selecting survivor at', {x: survivor.gridX, y: survivor.gridY}, 'with AP:', survivor.actionPoints);
    
    // Clear previous selection
    this.clearSelection();
    
    // Set the selected survivor and update movement system
    this.selectedSurvivor = survivor;
    this.movementSystem.unit = survivor; // Set the unit in movement system for path preview
    
    // Initialize action points if not set
    if (survivor.actionPoints === undefined) {
      console.log('[SELECT] Initializing action points to', MOVEMENT.ACTION_POINTS);
      survivor.actionPoints = MOVEMENT.ACTION_POINTS;
    } else {
      console.log('[SELECT] Survivor has', survivor.actionPoints, 'action points');
    }
    
    // Highlight the selected survivor
    survivor.setTint(0x00ff00);
    survivor.setScale(1.1);
    
    // Get grid position
    const startX = survivor.gridX;
    const startY = survivor.gridY;
    
    console.log(`[SELECT] Calculating movement range from (${startX}, ${startY}) with ${survivor.actionPoints} AP`);
    
    // Clear any existing range display
    if (!this.movementSystem) {
      console.error('Movement system not initialized!');
      return;
    }
    
    console.log('[SELECT] Hiding previous range...');
    this.movementSystem.hideRange();
    
    // If no AP left, don't show movement range
    if (survivor.actionPoints <= 0) {
      console.log('[SELECT] No AP left, not showing movement range');
      return;
    }
    
    // Update obstacles in the movement system (walls and other survivors block movement)
    const obstacles = [];
    
    // Add other survivors as obstacles
    this.survivors.forEach(s => {
      if (s !== survivor && s.alive) {
        obstacles.push({ x: s.gridX, y: s.gridY });
      }
    });
    
    // Add walls as obstacles
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        if (this.grid[y][x] && !this.grid[y][x].walkable) {
          obstacles.push({ x, y });
        }
      }
    }
    
    console.log('[SELECT] Setting obstacles:', obstacles);
    this.movementSystem.setObstacles(obstacles);
    
    try {
      console.log('[SELECT] Calculating movement range with AP:', survivor.actionPoints);
      const range = this.movementSystem.calculateRange(survivor, obstacles);
      
      if (!range) {
        console.log('[SELECT] No movement range calculated - possibly no AP');
        return;
      }
      
      // Add unit reference to each tile in range
      const rangeWithUnit = range.map(tile => ({
        ...tile,
        unit: survivor // Add reference to the unit for each tile
      }));
      
      console.log('[SELECT] Movement range calculated, showing range...');
      this.movementSystem.showRange(rangeWithUnit);
      
      // Log selection for debugging
      console.log(`[SELECT] Selected survivor at (${startX},${startY}) with ${survivor.actionPoints} AP, found ${range?.length || 0} reachable tiles`);
      console.log('[SELECT] Movement range tiles:', rangeWithUnit);
    } catch (error) {
      console.error('[SELECT] Error calculating movement range:', error);
    }
    
    // Force redraw the haze to ensure it's on top
    this.updateHazeMask();
  }
  
  // Move selected survivor to target tile
  moveSelectedSurvivor(tileX, tileY) {
    if (!this.selectedSurvivor) {
      console.log('No survivor selected');
      return;
    }
    
    const survivor = this.selectedSurvivor;
    console.log(`[MOVE] Starting move for survivor at (${survivor.gridX},${survivor.gridY}) with ${survivor.actionPoints} AP`);
    
    // Check if survivor has AP left
    if (survivor.actionPoints <= 0) {
      console.log('[MOVE] No AP left for movement');
      return;
    }
    
    console.log('[MOVE] Starting move for survivor at', {x: survivor.gridX, y: survivor.gridY}, 'AP:', survivor.actionPoints);
    
    // Use the exact path that was previewed
    const path = [...(this.movementSystem.currentPath || [])];
    
    console.log('[MOVE] Raw path from movement system:', JSON.parse(JSON.stringify(path)));
    
    if (path.length === 0) {
      console.log('[MOVE] No path to follow');
      return;
    }
    
    const target = path[path.length - 1];
    const movementCost = this.movementSystem.currentAPCost || 0;
    
    // Determine AP cost based on movement distance
    const apCost = Math.ceil(movementCost / MOVEMENT.BASE_SPEED);
    
    // Check if survivor has enough AP for this move
    if (survivor.actionPoints < apCost) {
      console.log(`[MOVE] Not enough AP for this move (needs ${apCost}, has ${survivor.actionPoints})`);
      return;
    }
    
    console.log('[MOVE] Using path with', path.length, 'steps, ending at:', 
      {x: target.x, y: target.y}, 'movement cost:', movementCost, 'AP cost:', apCost);
    
    // Verify the target matches the clicked tile
    if (target.x !== tileX || target.y !== tileY) {
      console.log(`[MOVE] Target (${target.x},${target.y}) doesn't match clicked tile (${tileX},${tileY}), aborting`);
      return;
    }
    
    console.log(`[MOVE] Moving from (${survivor.gridX},${survivor.gridY}) to (${tileX},${tileY}) with ${path.length} steps`);
    
    // Will deduct AP after movement is complete
    
    // Store starting position
    const oldX = survivor.gridX;
    const oldY = survivor.gridY;
    
    // Log the full path for debugging
    console.log('[MOVE] Full path steps:');
    path.forEach((step, i) => {
      console.log(`  [${i}] (${step.x},${step.y})${step.isDiagonal ? ' (diagonal)' : ''}`);
    });
    
    console.log(`[MOVE] Moving from (${oldX},${oldY}) to (${target.x},${target.y})`);
    
    // Clear any existing movement tweens
    this.tweens.killTweensOf([survivor, survivor.shadow]);
    
    // Play walk animation
    if (survivor.play) {
      survivor.play(survivor.walkKey);
    }
    
    // Create a chain of tweens for each step in the path
    const movementPath = [...path]; // Create a copy to avoid reference issues
    let currentTween = null;
    
    // Function to move to the next point in the path
    const moveNext = (index) => {
      // If we've reached the end of the path
      if (index >= movementPath.length) {
        // Update fog of war after movement
        this.updateHazeMask();
        
        // Return to idle animation
        if (survivor && survivor.play) {
          survivor.play(survivor.idleKey);
        }
        
        // Update survivor's final grid position to the last step in the path
        if (movementPath.length > 0) {
          const lastStep = movementPath[movementPath.length - 1];
          survivor.gridX = lastStep.x;
          survivor.gridY = lastStep.y;
          console.log(`[MOVE] Final position updated to (${lastStep.x},${lastStep.y})`);
          
          // Calculate total movement cost in MP
          let totalMPCost = 0;
          for (let i = 0; i < path.length; i++) {
            const step = path[i];
            const nextStep = path[i + 1];
            if (!nextStep) break;
            
            // Check if this is a diagonal move (both x and y change)
            const isDiagonal = (step.x !== nextStep.x) && (step.y !== nextStep.y);
            totalMPCost += isDiagonal ? MOVEMENT.TILE_COST_DIAGONAL : MOVEMENT.TILE_COST_ORTHOGONAL;
          }
          
          // Convert MP cost to AP (rounding up to nearest 0.5 AP)
          const apCost = Math.ceil((totalMPCost / MOVEMENT.BASE_SPEED) * 2) / 2;
          
          // Deduct AP after movement is complete
          const oldAP = survivor.actionPoints;
          survivor.actionPoints = Math.max(0, oldAP - apCost);
          console.log(`[MOVE] Moved ${path.length} steps (${totalMPCost} MP = ${apCost} AP)`);
          console.log(`[MOVE] Deducted ${apCost} AP after movement (${oldAP} -> ${survivor.actionPoints} remaining)`);
          
          // Log current AP for all survivors
          console.log('[AP STATUS] Current AP for all survivors:');
          this.survivors.forEach((s, i) => {
            if (s.alive) {
              console.log(`  Survivor ${i} at (${s.gridX},${s.gridY}): ${s.actionPoints} AP`);
            }
          });
        }
        
        // Clear selection after movement
        this.clearSelection();
        return;
      }
      
      const point = movementPath[index];
      const targetX = point.x * TILE_SIZE + TILE_SIZE / 2;
      const targetY = (point.y * TILE_SIZE) + TILE_SIZE; // Adjust for origin point
      
      // Calculate duration based on whether it's a diagonal move
      const duration = point.isDiagonal ? 450 : 300; // Diagonal takes 1.5x longer
      
      console.log(`[MOVE] Moving to step ${index}: (${point.x},${point.y})${point.isDiagonal ? ' (diagonal)' : ''}`);
      
      // Update survivor's grid position for this step
      survivor.gridX = point.x;
      survivor.gridY = point.y;
      
      currentTween = this.tweens.add({
        targets: [survivor, survivor.shadow],
        x: targetX,
        y: targetY,
        duration: duration,
        ease: 'Linear',
        onComplete: () => moveNext(index + 1)
      });
    };
    
    // Start the movement chain
    moveNext(0);
    
    // Store the current tween so we can cancel it if needed
    survivor.currentTween = currentTween;
  }
  
  // End current turn and start enemy turn
  endPlayerTurn() {
    console.log('[TURN] Player ending turn');
    this.currentTurn = 'enemy';
    this.clearSelection();
    
    // Start enemy turn after a delay
    this.time.delayedCall(1000, () => this.startEnemyTurn());
  }
  
  // Enemy turn logic
  startEnemyTurn() {
    console.log('[TURN] Enemy turn started');
    
    // First, reset action points for all survivors
    this.resetActionPoints();
    
    // For now, just end the enemy turn after a delay
    this.time.delayedCall(1000, () => {
      console.log('[TURN] Enemy turn ended, starting player turn');
      this.currentTurn = 'player';
      
      // Reset action points for all survivors at the start of player's turn
      this.resetActionPoints();
    });
  }
  
  // Clear current selection and hide movement range
  clearSelection() {
    if (this.selectedSurvivor) {
      // Clear any active tweens on the survivor
      this.tweens.killTweensOf(this.selectedSurvivor);
      // Reset scale to original size
      this.selectedSurvivor.setScale(1);
      // Clear tint
      this.selectedSurvivor.clearTint();
      this.selectedSurvivor = null;
      console.log('Cleared selection');
    }
    
    // Hide movement range and clear path preview
    if (this.movementSystem) {
      this.movementSystem.hideRange();
      this.movementSystem.clearPathPreview();
    }
    
    // Force redraw the haze to ensure it's updated
    this.updateHazeMask();
  }
  
  // Reset AP for all survivors at the start of the player's turn
  resetActionPoints() {
    console.log('[TURN] Resetting AP for all survivors');
    this.survivors.forEach((s, index) => {
      if (s && s.alive) {
        const oldAP = (s.actionPoints !== undefined) ? s.actionPoints : 'undefined';
        s.actionPoints = MOVEMENT.ACTION_POINTS;
        console.log(`[TURN] Reset AP for survivor ${index} at (${s.gridX},${s.gridY}): ${oldAP} -> ${s.actionPoints}`);
      } else if (s) {
        console.log(`[TURN] Skipping dead survivor at (${s.gridX},${s.gridY})`);
      } else {
        console.error('[TURN] Found invalid survivor in survivors array');
      }
    });
    
    // Start player turn
    this.currentTurn = 'player';
    console.log('[TURN] Player turn started');
    
    // Update UI
    if (this.turnText) {
      this.turnText.setText('Turn: Player');
    }
    
    // Update haze mask at the start of player turn
    this.updateHazeMask();
  }
  
  // For compatibility
  killHero() {
    if (this.player) {
      this.killSurvivor(this.player);
    }
  }
  
  spawnUndead() {
    if (!this.player) return;
    
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
