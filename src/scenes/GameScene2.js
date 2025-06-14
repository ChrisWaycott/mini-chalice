import Phaser from 'phaser';
import { HexMap } from '../modules/map/HexMap.js';
import { MapRenderer } from '../modules/map/MapRenderer.js';
import { CameraControls } from '../modules/controls/CameraControls.js';
import { UnitHandler } from '../modules/units/UnitHandler.js';
import { Raider1 } from '../modules/units/survivors/raider-1/Raider1.js';
import { Zombie } from '../modules/units/undead/zombie/Zombie.js';
import { PluginInitializer } from '../modules/core/PluginInitializer.js';
import { UnitSpawner } from '../modules/units/UnitSpawner.js';
import MovementSystem from '../systems/MovementSystem.js';

export default class GameScene2 extends Phaser.Scene {
  constructor() {
    super('Game2');
    this.selectedUnit = null;  // Track selected unit
  }

  preload() {
    // Preload map assets
    MapRenderer.preload(this);
    
    // Preload unit assets
    UnitHandler.preload(this);
    
    // Preload unit-specific assets
    Raider1.preload(this);
    Zombie.preload(this);
    
    // Load character spritesheets
    this.loadCharacterSprites();
  }
  
  loadCharacterSprites() {
    // Add any additional sprites needed for the game
  }

  async create() {
    console.log('GameScene2 - create() called');
    
    try {
      // Initialize plugins (may be async)
      const initResult = await PluginInitializer.initialize(this);
      
      // If we got here, plugins are loaded
      const { plugins, status } = initResult;
      
      // Assign plugins to instance for easy access, but only if they don't exist yet
      Object.entries(plugins).forEach(([key, value]) => {
        if (value !== undefined && !this[key]) {
          this[key] = value;
        }
      });
      
      // Log plugin status
      console.log('GameScene2 - Plugin Status:', status);
      
      // Continue with scene setup
      this.setupScene();
    } catch (error) {
      console.error('Failed to initialize plugins:', error);
      PluginInitializer.createErrorDisplay(this, { error: error.message });
      return;
    }
  }
  
  /**
   * Set up the game scene after plugins are loaded
   */
  async setupScene() {
    // Initialize camera bounds
    const camera = this.cameras.main;
    
    try {
      // Create the hex map with proper configuration
      this.hexMap = new HexMap(this, {
        width: 20,
        height: 20,
        tileSize: 40,
        x: camera.width / 2,
        y: camera.height / 2,
        debug: true
      });
      
      if (!this.hexMap || !this.hexMap.board) {
        throw new Error('Failed to create HexMap');
      }
      
      // Create the map renderer with the hex map
      this.mapRenderer = new MapRenderer(this, this.hexMap);
      
      // Call render instead of create since MapRenderer doesn't have a create method
      this.mapRenderer.render();
      
      // Add the map container to the scene
      if (this.hexMap.container) {
        this.add.existing(this.hexMap.container);
      } else {
        console.warn('HexMap container not available');
      }
      
      // Set up camera controls before creating units
      this.setupCameraControls();
      
      // Initialize movement system after scene is set up
      this.movementSystem = new MovementSystem(this);
      
      // Create unit handler
      this.unitHandler = new UnitHandler(this);
      
      // Create unit spawner
      this.unitSpawner = new UnitSpawner(this, this.hexMap, this.unitHandler);
      this.unitSpawner.initSpawnPoints();
      
      // Set up input handling
      this.setupInput();
      
      // Spawn initial units
      this.spawnInitialUnits();
      
    } catch (error) {
      console.error('Error initializing game scene:', error);
      // Show error message to user
      this.add.text(100, 100, 'Error initializing game: ' + error.message, {
        font: '16px Arial',
        fill: '#ff0000'
      });
      throw error; // Re-throw to be caught by the outer try-catch
    }
  }
  
  /**
   * Spawn initial units for the game
   */
  spawnInitialUnits() {
    // Spawn starting survivors
    this.unitSpawner.spawnSurvivor('raider1', { 
      maxHealth: 120, 
      attack: 12, 
      defense: 4 
    });
    
    this.unitSpawner.spawnSurvivor('raider2', { 
      maxHealth: 100, 
      attack: 15, 
      defense: 3, 
      range: 2 
    });
    
    // Spawn 5 zombies with a small delay between each
    const zombieCount = 5;
    const spawnDelay = 1000; // 1 second between spawns
    
    for (let i = 0; i < zombieCount; i++) {
      this.time.delayedCall(3000 + (i * spawnDelay), () => {
        this.unitSpawner.spawnUndead('zombie', { 
          maxHealth: 80, 
          attack: 8, 
          defense: 2 
        });
      });
    }
  }

  setupCameraControls() {
    // Initialize camera controls
    this.cameraControls = new CameraControls(this, {
      minZoom: 0.5,
      maxZoom: 2,
      zoomSensitivity: 0.01
    });
    
    // Enable camera controls
    const { width, height } = this.scale;
    this.cameraControls.enable(width, height);
  }
  
  setupInput() {
    const scene = this;
    
    // Handle tile clicks (left click only)
    this.input.on('pointerdown', function(pointer) {
      if (pointer.leftButtonDown() && !(pointer.ctrlKey || pointer.metaKey)) {
        const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileCoords = scene.hexMap.worldToTileXY(worldPoint.x, worldPoint.y);
        
        if (tileCoords) {
          const tile = scene.hexMap.getTile(tileCoords.q, tileCoords.r);
          if (tile) {
            // Toggle walkable state on click
            tile.walkable = !tile.walkable;
            scene.hexMap.drawTile(tile);
            console.log(`Tile clicked: ${tileCoords.q},${tileCoords.r} - Walkable: ${tile.walkable}`);
          }
        }
      }
    });
  }

  update(time, delta) {
    // Update logic can go here if needed
  }

  destroy() {
    // Clean up camera controls when scene is destroyed
    if (this.cameraControls) {
      this.cameraControls.destroy();
      this.cameraControls = null;
    }
    
    // Clean up input handlers
    this.input.off('pointerdown');
    this.input.off('pointerup');
    this.input.off('pointermove');
    this.input.off('wheel');
    this.input.keyboard.off('keydown-R');
    
    // Clean up hex map
    if (this.hexMap) {
      this.hexMap.destroy();
      this.hexMap = null;
    }
  }
}
