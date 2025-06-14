/**
 * Base Unit class that all game units inherit from
 */
export class Unit extends Phaser.GameObjects.Container {
  /**
   * Create a new Unit
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {number} x - The x position
   * @param {number} y - The y position
   * @param {Object} stats - Unit stats
   */
  constructor(scene, x, y, stats = {}) {
    super(scene, x, y);
    
    // Store references
    this.scene = scene;
    this.stats = {
      health: stats.health || 100,
      maxHealth: stats.maxHealth || 100,
      attack: stats.attack || 10,
      defense: stats.defense || 5,
      movement: stats.movement || 3,
      range: stats.range || 1,
      ...stats
    };
    
    // Grid position
    this.q = stats.q || 0;
    this.r = stats.r || 0;
    this.type = stats.type || 'unit';
    this.faction = stats.faction || 'neutral';
    
    // Initialize sprite (will be set by child classes)
    this.sprite = null;
    
    // Set a default size (can be updated when sprite is set)
    this.setSize(64, 64);
    this.setInteractive();
    
    // Add to scene
    scene.add.existing(this);
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  /**
   * Initialize the unit's sprite
   * Should be implemented by child classes
   */
  initializeSprite() {
    // To be implemented by child classes
  }
  
  /**
   * Set the unit's sprite or container
   * @param {Phaser.GameObjects.Sprite|Phaser.GameObjects.Container} sprite - The sprite or container to use
   */
  setSprite(sprite) {
    if (this.sprite) {
      if (this.sprite instanceof Phaser.GameObjects.Container) {
        this.sprite.destroy();
      } else {
        this.remove(this.sprite, true);
        this.sprite.destroy();
      }
    }
    
    this.sprite = sprite;
    
    if (sprite) {
      if (sprite instanceof Phaser.GameObjects.Container) {
        // If it's a container, update our position to match
        this.x = sprite.x;
        this.y = sprite.y;
        // Set our size to match the container
        this.setSize(sprite.width || 64, sprite.height || 64);
        // Make sure the container is interactive
        sprite.setInteractive();
      } else {
        // Original sprite handling
        this.add(sprite);
        this.setSize(sprite.width || 64, sprite.height || 64);
      }
    }
  }
  
  /**
   * Set up event handlers for the unit
   */
  setupEventHandlers() {
    // Forward pointer events to the container if it exists
    const target = this.sprite?.container || this.sprite || this;
    
    // Handle selection
    target.setInteractive();
    target.on('pointerdown', () => {
      if (this.scene.selectedUnit === this) {
        // Deselect if already selected
        this.scene.selectedUnit = null;
        this.setTint(0xffffff);
        if (this.scene.movementSystem) {
          this.scene.movementSystem.clearMovementRange();
        }
      } else {
        // Select this unit
        if (this.scene.selectedUnit) {
          this.scene.selectedUnit.setTint(0xffffff);
        }
        this.scene.selectedUnit = this;
        this.setTint(0x00ff00);
        
        // Show movement range
        if (this.scene.movementSystem) {
          this.scene.movementSystem.showMovementRange(
            this.getData('q'),
            this.getData('r'),
            this.getData('movementPoints')
          );
        }
      }
    });
    
    // Handle movement when clicking on a tile
    this.scene.input.on('gameobjectdown', (pointer, gameObject) => {
      if (gameObject !== this && this.scene.selectedUnit === this) {
        const tile = this.scene.hexMap.worldToTileXY(pointer.worldX, pointer.worldY);
        if (tile) {
          this.moveTo(tile.q, tile.r);
        }
      }
    });
  }
  
  // ... rest of the file remains the same ...
  
  /**
   * Update the unit
   * @param {number} time - The current time
   * @param {number} delta - The delta time in ms since the last frame
   */
  update(time, delta) {
    // Update logic can go here
    if (this.sprite) {
      if (this.sprite instanceof Phaser.GameObjects.Container) {
        // If we have a container, sync our position with it using setPosition
        super.setPosition(this.sprite.x, this.sprite.y);
      } else if (this.sprite.setPosition) {
        // Original sprite positioning
        this.sprite.setPosition(0, 0);
      }
    }
  }
  
  /**
   * Set the position of the unit
   * @param {number} x - The x position
   * @param {number} [y] - The y position
   * @param {number} [z] - The z position
   * @param {number} [w] - The w position
   * @returns {this} This Unit instance
   */
  setPosition(x, y, z, w) {
    // Handle object parameter
    if (typeof x === 'object' && x !== null) {
      const { x: posX, y: posY, z: posZ, w: posW } = x;
      super.setPosition(posX, posY, posZ, posW);
      return this;
    }
    
    // Handle individual parameters
    super.setPosition(x, y, z, w);
    return this;
  }
  
  // ... rest of the file remains the same ...
}
