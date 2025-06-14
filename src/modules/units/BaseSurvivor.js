import { Unit } from './Unit.js';

export class BaseSurvivor extends Unit {
  /**
   * Create a new BaseSurvivor
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {number} x - The x position
   * @param {number} y - The y position
   * @param {Object} [options={}] - The unit options
   */
  constructor(scene, x, y, options = {}) {
    const stats = {
      q: options.gridX || 0,
      r: options.gridY || 0,
      health: options.health || 100,
      maxHealth: options.maxHealth || 100,
      attack: options.attack || 10,
      defense: options.defense || 2,
      movement: options.movementRange || 2,
      range: options.range || 1,
      type: 'survivor',
      faction: 'survivor',
      ...options
    };
    
    super(scene, x, y, stats);
    
    console.log('[BaseSurvivor] Creating sprite with texture:', this.getDefaultTexture());
    
    // Initialize animations from child class
    this.animations = this.getAnimations();
    
    // Create a container for the unit
    this.container = this.scene.add.container(x, y);
    this.container.setSize(64, 64);
    this.container.setInteractive();
    
    // Create sprite with default texture (first frame of idle animation)
    const idleAnim = this.animations?.idle || {};
    const frameKey = idleAnim.key || this.getDefaultTexture();
    this.sprite = this.scene.add.sprite(0, 0, frameKey, 0);
    this.sprite.setOrigin(0.5, 0.8);
    this.container.add(this.sprite);
    
    // Add to the scene's display list
    this.scene.add.existing(this.container);
    
    // Create health bar
    this.createHealthBar();
    
    // Queue the idle animation to play once the animation is created
    this.scene.time.delayedCall(100, () => {
      if (this.sprite && this.sprite.play) {
        // Create animations if they don't exist
        if (this.animations) {
          Object.entries(this.animations).forEach(([name, config]) => {
            if (!this.scene.anims.exists(config.key)) {
              this.scene.anims.create({
                key: config.key,
                frames: this.scene.anims.generateFrameNumbers(config.key, config.frames || { start: 0, end: 0 }),
                frameRate: config.frameRate || 5,
                repeat: config.repeat !== undefined ? config.repeat : -1,
                yoyo: config.yoyo || false
              });
            }
          });
        }
        // Start with idle animation
        this.playAnimation('idle');
      }
    });
}  // <-- This closing brace was missing
  /**
   * Create a health bar for the unit
   */
  createHealthBar() {
    // Health bar background
    const bg = this.scene.add.rectangle(0, -50, 60, 6, 0x000000, 0.7);
    bg.setOrigin(0.5, 0.5);
    
    // Health bar fill
    this.healthBar = this.scene.add.rectangle(-30, -50, 56, 4, 0xff0000, 1);
    this.healthBar.setOrigin(0, 0.5);
    
    this.container.add([bg, this.healthBar]);
    this.updateHealthBar();
  }
  
  /**
   * Update the health bar to reflect current health
   */
  updateHealthBar() {
    if (!this.healthBar) return;
    
    const health = this.stats.health;
    const maxHealth = this.stats.maxHealth;
    const healthPercent = health / maxHealth;
    
    this.healthBar.displayWidth = Math.max(0, 56 * healthPercent);
    this.healthBar.fillColor = healthPercent > 0.6 ? 0x00ff00 : 
                               healthPercent > 0.3 ? 0xffff00 : 0xff0000;
  }
  
  /**
   * Take damage and update health
   * @param {number} amount - The amount of damage to take
   * @param {Object} [source] - The source of the damage (e.g., the attacker)
   * @returns {number} The actual damage taken
   */
  takeDamage(amount, source) {
    // Ensure amount is a positive number
    const damage = Math.max(0, Math.floor(amount));
    
    // Reduce health but don't go below 0
    const newHealth = Math.max(0, this.stats.health - damage);
    const actualDamage = this.stats.health - newHealth;
    this.stats.health = newHealth;
    
    // Update health bar if it exists
    if (this.healthBar) {
      this.updateHealthBar();
    }
    
    // Visual feedback
    if (this.sprite) {
      // Flash white to indicate damage
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0.5,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          if (this.sprite) this.sprite.clearTint();
        }
      });
    }
    
    // Emit event
    this.emit('damage', { amount: actualDamage, source });
    
    // Check if unit is dead
    if (this.stats.health <= 0) {
      this.die(source);
    }
    
    return actualDamage;
  }
  
  /**
   * Handle unit death
   * @param {Object} [killer] - The unit or object that killed this unit
   */
  die(killer) {
    // If already dead, do nothing
    if (this.dead) return;
    
    this.dead = true;
    
    // Disable input
    this.setInteractive(false);
    
    // Play death animation if available
    if (this.animations && this.animations.die) {
      this.playAnimation('die', false, () => {
        this._handlePostDeath(killer);
      });
    } else {
      // If no death animation, fade out and handle post-death
      this.scene.tweens.add({
        targets: this.container || this.sprite,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this._handlePostDeath(killer);
        }
      });
    }
    
    // Emit death event with killer info
    this.emit('die', { killer });
  }
  
  /**
   * Handle post-death logic (resurrection, cleanup, etc.)
   * @private
   * @param {Object} [killer] - The unit or object that killed this unit
   */
  _handlePostDeath(killer) {
    // Resurrect as zombie (100% chance for now, can be adjusted)
    this._resurrectAsZombie();
    
    // Clean up health bar if it exists
    if (this.healthBar) {
      this.healthBar.destroy();
      this.healthBar = null;
    }
    
    // Clean up name tag if it exists
    if (this.nameTag) {
      this.nameTag.destroy();
      this.nameTag = null;
    }
    
    // Destroy the unit
    this.destroy();
  }
  
  /**
   * Resurrect the unit as an undead zombie
   * @private
   */
  _resurrectAsZombie() {
    if (!this.scene || this.destroyed) return;
    
    // Get current position
    const x = this.x;
    const y = this.y;
    const gridX = this.stats.q;
    const gridY = this.stats.r;
    
    // Find the unit handler in the scene
    const unitHandler = this.scene.unitHandler;
    if (!unitHandler) {
      console.warn('UnitHandler not found in scene');
      return;
    }
    
    // Create a zombie at the same position
    const zombie = unitHandler.createUnit('zombie', {
      x,
      y,
      gridX,
      gridY,
      // Transfer some stats to the zombie
      health: Math.floor(this.stats.maxHealth * 0.5), // Zombie gets 50% of max health
      maxHealth: this.stats.maxHealth,
      attack: Math.max(1, Math.floor(this.stats.attack * 0.7)), // 70% of original attack
      defense: Math.max(0, this.stats.defense - 1) // Slightly less defense
    });
    
    if (zombie) {
      // Start with alpha 0 and hidden
      zombie.setAlpha(0);
      
      // Play the rise animation
      if (zombie.playAnimation) {
        // Play the rise animation
        zombie.playAnimation('zombie-rise', false);
        
        // Fade in during the rise animation
        this.scene.tweens.add({
          targets: zombie,
          alpha: 1,
          duration: 1500, // Match this with the rise animation duration
          ease: 'Power2',
          onComplete: () => {
            // After rising, play idle animation
            if (zombie.playAnimation) {
              zombie.playAnimation('idle');
            }
          }
        });
      } else {
        // Fallback if playAnimation is not available
        this.scene.tweens.add({
          targets: zombie,
          alpha: 1,
          duration: 1000,
          ease: 'Power2'
        });
      }
      
      // Emit event
      this.emit('resurrected', { as: 'zombie', zombie });
      return zombie;
    }
    
    return null;
  }
  
  /**
   * Move the unit to a new position
   * @param {number} x - The target x position
   * @param {number} y - The target y position
   * @param {Function} [onComplete] - Callback when movement is complete
   */
  moveTo(x, y, onComplete) {
    // Face the direction of movement
    this.faceTowards(x, y);
    
    // Play walk animation if available
    if (this.animations?.walk) {
      this.playAnimation('walk');
    } else if (this.anims && this.anims.get('walk')) {
      this.play('walk');
    }
    
    // Move the unit and its container if it exists
    const targets = this.container ? [this, this.container] : [this];
    
    this.scene.tweens.add({
      targets: targets,
      x: x,
      y: y,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        // Return to idle animation if available
        if (this.animations?.idle) {
          this.playAnimation('idle');
        } else if (this.anims && this.anims.get('idle')) {
          this.play('idle');
        }
        if (onComplete) onComplete();
      }
    });
  }
  
  /**
   * Face towards a point
   * @param {number} x - Target x position
   * @param {number} y - Target y position
   */
  faceTowards(x, y) {
    if (!this.sprite) return;
    
    const dx = x - (this.container ? this.container.x : this.x);
    // Flip sprite based on direction
    if (dx !== 0) {
      const flipX = dx < 0;
      if (this.sprite.setFlipX) {
        this.sprite.setFlipX(flipX);
      } else if (this.sprite.flipX !== undefined) {
        this.sprite.flipX = flipX;
      }
    }
  }
  
  /**
   * Don't create a default sprite in the Unit constructor
   * @returns {boolean} False to prevent default sprite creation
   */
  shouldCreateDefaultSprite() {
    return false;
  }
  
  /**
   * Get the default texture for this survivor
   * @returns {string} Texture key
   */
  getDefaultTexture() {
    return 'survivor';
  }
  
  /**
   * Get the animations configuration for this survivor
   * Should be implemented by child classes
   * @returns {Object} Animation configurations
   */
  getAnimations() {
    // Default implementation - should be overridden by child classes
    return {
      idle: {
        key: 'idle',
        frames: { start: 0, end: 0 },
        frameRate: 5,
        repeat: -1
      }
    };
  }
  
  /**
   * Called when the unit is added to the scene
   */
  addedToScene() {
    super.addedToScene();
    
    // Make sure we're interactive
    this.container.setInteractive();
    
    // Add to the scene's display list if not already added
    if (this.scene && !this.scene.children.exists(this.container)) {
      this.scene.add.existing(this.container);
    }
  }
  
  /**
   * Set the position of the unit
   * @param {number} x - The x position
   * @param {number} [y] - The y position (optional if y is provided in x)
   * @param {number} [z] - The z position (depth)
   * @param {number} [w] - The w position (4th dimension, rarely used)
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setPosition(x, y, z, w) {
    // Handle both object and individual parameters
    if (typeof x === 'object' && x !== null) {
      // Object parameter {x, y, z, w}
      const { x: posX, y: posY, z: posZ, w: posW } = x;
      
      // Set position on container or sprite
      if (this.container) {
        this.container.setPosition(posX, posY, posZ, posW);
      } else if (this.sprite) {
        this.sprite.setPosition(posX, posY, posZ, posW);
      }
      
      // Call parent's setPosition
      super.setPosition(posX, posY, posZ, posW);
    } else {
      // Standard x, y, z, w parameters
      const newX = (typeof x === 'number') ? x : this.x;
      const newY = (typeof y === 'number') ? y : this.y;
      
      // Set position on container or sprite
      if (this.container) {
        this.container.setPosition(newX, newY, z, w);
      } else if (this.sprite) {
        this.sprite.setPosition(newX, newY, z, w);
      }
      
      // Call parent's setPosition
      super.setPosition(newX, newY, z, w);
    }
    
    return this;
  }

  /**
   * Get the x position of the unit
   * @returns {number}
   */
  get x() {
    return this.container ? this.container.x : 0;
  }

  /**
   * Get the y position of the unit
   * @returns {number}
   */
  get y() {
    return this.container ? this.container.y : 0;
  }

  // This should be implemented by child classes
  // Example:
  // if (typeof this.scene.anims.create === 'function' && !this.scene.anims.exists('idle')) {
  //   this.scene.anims.create({
  //     key: 'idle',
  //     frames: this.scene.anims.generateFrameNumbers('survivor', { start: 0, end: 3 }),
  //     frameRate: 5,
  //     repeat: -1
  //   });
  // }
  
  /**
   * Don't create a default sprite in the Unit constructor
   * @returns {boolean} False to prevent default sprite creation
   */
  shouldCreateDefaultSprite() {
    return false;
  }
  
  /**
   * Get the default texture for this survivor
   * @returns {string} Texture key
   */
  getDefaultTexture() {
    return 'survivor';
  }

  /**
   * Play an animation on the unit's sprite
   * @param {string} animKey - The animation key to play
   * @param {boolean} [ignoreIfPlaying=false] - If true, won't restart if already playing
   * @param {Function} [onComplete] - Callback when animation completes
   * @returns {Phaser.GameObjects.Sprite|null} The sprite or null if failed
   */
  playAnimation(animKey, ignoreIfPlaying = false, onComplete) {
    if (!animKey) {
      console.warn('[BaseSurvivor] No animation key provided');
      return null;
    }
    
    console.log(`[BaseSurvivor] Attempting to play animation: ${animKey}`);
    
    // Check sprite
    if (!this.sprite || typeof this.sprite.play !== 'function') {
      console.warn('[BaseSurvivor] Sprite not available or missing play method');
      return null;
    }
    
    // Check scene and animation manager
    if (!this.scene || !this.scene.anims) {
      console.warn('[BaseSurvivor] Scene or animation manager not available');
      return null;
    }
    
    // Get the animation manager
    const anims = this.scene.anims.animationManager || this.scene.anims;
    
    try {
      // Check if animation exists
      let animExists = false;
      
      // Try different ways to check if animation exists
      if (anims.exists && typeof anims.exists === 'function') {
        animExists = anims.exists(animKey);
      } else if (this.scene.anims['anims.anims'] && this.scene.anims['anims.anims'][animKey]) {
        animExists = true;
      } else if (this.scene.anims.get && typeof this.scene.anims.get === 'function') {
        animExists = !!this.scene.anims.get(animKey);
      }
      
      console.log(`[BaseSurvivor] Animation '${animKey}' exists: ${animExists}`);
      
      if (!animExists) {
        // Try to list available animations for debugging
        try {
          let availableAnims = [];
          if (this.scene.anims['anims.anims']) {
            availableAnims = Object.keys(this.scene.anims['anims.anims']);
          } else if (this.scene.anims.anims) {
            availableAnims = Object.keys(this.scene.anims.anims);
          }
          console.warn(`[BaseSurvivor] Animation '${animKey}' not found. Available animations:`, availableAnims);
        } catch (e) {
          console.warn('[BaseSurvivor] Could not list available animations:', e);
        }
        return null;
      }
      
      // Try to play the animation
      try {
        console.log(`[BaseSurvivor] Playing animation: ${animKey}`);
        const anim = this.sprite.play(animKey, ignoreIfPlaying);
        console.log(`[BaseSurvivor] Animation play result:`, anim);
        
        // Set up completion callback if provided
        if (onComplete && anim && typeof anim.once === 'function') {
          anim.once('animationcomplete', onComplete, this);
        }
        
        return this.sprite;
      } catch (playError) {
        console.error(`[BaseSurvivor] Error playing animation '${animKey}':`, playError);
        return null;
      }
    } catch (error) {
      console.error(`[BaseSurvivor] Error in playAnimation for '${animKey}':`, error);
      return null;
    }
  }
  
  /**
   * Clean up resources
   */
  /**
   * Set the visibility of the unit
   * @param {boolean} visible - Whether the unit should be visible
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setVisible(visible) {
    if (this.container) {
      this.container.setVisible(visible);
    } else if (this.sprite) {
      this.sprite.setVisible(visible);
    }
    return this;
  }
  
  /**
   * Set the depth of the unit (rendering order)
   * @param {number} depth - The depth value (higher values render on top)
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setDepth(depth) {
    if (this.container) {
      this.container.setDepth(depth);
    } else if (this.sprite) {
      this.sprite.setDepth(depth);
    }
    return this;
  }
  
  /**
   * Get the bounds of the unit
   * @returns {Phaser.Geom.Rectangle} The bounds rectangle
   */
  getBounds() {
    if (this.container) {
      return this.container.getBounds();
    } else if (this.sprite) {
      return this.sprite.getBounds();
    }
    return new Phaser.Geom.Rectangle(this.x, this.y, 0, 0);
  }
  
  /**
   * Set the scale of the unit
   * @param {number} x - The x scale factor
   * @param {number} [y] - The y scale factor (if not provided, x will be used)
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setScale(x, y) {
    if (this.container) {
      this.container.setScale(x, y);
    } else if (this.sprite) {
      this.sprite.setScale(x, y);
    }
    return this;
  }
  
  /**
   * Set the alpha (transparency) of the unit
   * @param {number} value - The alpha value (0 = fully transparent, 1 = fully opaque)
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setAlpha(value) {
    if (this.container) {
      this.container.setAlpha(value);
      // Also set alpha on all children for consistency
      this.container.each(child => {
        if (child.setAlpha) child.setAlpha(value);
      });
    } else if (this.sprite) {
      this.sprite.setAlpha(value);
    }
    return this;
  }
  
  /**
   * Set the angle (rotation) of the unit in degrees
   * @param {number} degrees - The angle in degrees
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setAngle(degrees) {
    if (this.container) {
      this.container.setAngle(degrees);
    } else if (this.sprite) {
      this.sprite.setAngle(degrees);
    }
    return this;
  }
  
  /**
   * Set the origin point of the unit (0-1 for x and y)
   * @param {number} [x=0.5] - The x origin (0 = left, 0.5 = center, 1 = right)
   * @param {number} [y=x] - The y origin (0 = top, 0.5 = middle, 1 = bottom)
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setOrigin(x = 0.5, y) {
    if (y === undefined) y = x;
    
    if (this.container) {
      this.container.setOrigin(x, y);
      // Also set origin on the main sprite if it exists
      if (this.sprite && this.sprite.setOrigin) {
        this.sprite.setOrigin(x, y);
      }
    } else if (this.sprite) {
      this.sprite.setOrigin(x, y);
    }
    return this;
  }
  
  /**
   * Set the horizontal flip state of the unit
   * @param {boolean} value - Whether to flip the unit horizontally
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setFlipX(value) {
    if (this.container) {
      if (this.sprite && this.sprite.setFlipX) {
        this.sprite.setFlipX(value);
      } else if (this.container.setFlipX) {
        this.container.setFlipX(value);
      }
    } else if (this.sprite && this.sprite.setFlipX) {
      this.sprite.setFlipX(value);
    }
    return this;
  }
  
  /**
   * Set the vertical flip state of the unit
   * @param {boolean} value - Whether to flip the unit vertically
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setFlipY(value) {
    if (this.container) {
      if (this.sprite && this.sprite.setFlipY) {
        this.sprite.setFlipY(value);
      } else if (this.container.setFlipY) {
        this.container.setFlipY(value);
      }
    } else if (this.sprite && this.sprite.setFlipY) {
      this.sprite.setFlipY(value);
    }
    return this;
  }
  
  /**
   * Set the blend mode of the unit
   * @param {string|number} value - The blend mode to use (e.g., 'ADD', 'MULTIPLY', 'SCREEN')
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setBlendMode(value) {
    if (this.container) {
      if (this.sprite && this.sprite.setBlendMode) {
        this.sprite.setBlendMode(value);
      } else if (this.container.setBlendMode) {
        this.container.setBlendMode(value);
      }
      
      // Apply to all children
      this.container.each(child => {
        if (child.setBlendMode) child.setBlendMode(value);
      });
    } else if (this.sprite && this.sprite.setBlendMode) {
      this.sprite.setBlendMode(value);
    }
    return this;
  }
  
  /**
   * Set the scroll factor of the unit (for parallax effects)
   * @param {number} x - The horizontal scroll factor (1 = moves with camera, 0 = fixed)
   * @param {number} [y] - The vertical scroll factor (if not provided, x will be used)
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setScrollFactor(x, y) {
    if (y === undefined) y = x;
    
    if (this.container) {
      this.container.setScrollFactor(x, y);
      
      // Apply to all children
      this.container.each(child => {
        if (child.setScrollFactor) child.setScrollFactor(x, y);
      });
    } else if (this.sprite) {
      this.sprite.setScrollFactor(x, y);
    }
    return this;
  }
  
  /**
   * Set the active state of the unit
   * @param {boolean} value - Whether the unit is active
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setActive(value) {
    this.active = !!value;
    
    // Update visibility based on active state
    this.setVisible(this.active);
    
    // Enable/disable input handling
    if (this.container) {
      this.container.setInteractive({ useHandCursor: this.active });
    } else if (this.sprite) {
      this.sprite.setInteractive({ useHandCursor: this.active });
    }
    
    return this;
  }
  
  /**
   * Store a value in the unit's data store
   * @param {string|object} key - The key to store the value under, or an object of key-value pairs
   * @param {*} [value] - The value to store (if key is a string)
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setData(key, value) {
    if (this.container && this.container.setData) {
      this.container.setData(key, value);
    } else if (this.sprite && this.sprite.setData) {
      this.sprite.setData(key, value);
    } else {
      // Fallback to direct property access
      if (typeof key === 'object' && key !== null) {
        Object.assign(this, key);
      } else if (typeof key === 'string') {
        this[key] = value;
      }
    }
    return this;
  }
  
  /**
   * Retrieve a value from the unit's data store
   * @param {string} key - The key of the value to retrieve
   * @param {*} [defaultValue] - The default value to return if the key doesn't exist
   * @returns {*} The stored value or the default value
   */
  getData(key, defaultValue) {
    if (this.container && this.container.getData) {
      return this.container.getData(key, defaultValue);
    } else if (this.sprite && this.sprite.getData) {
      return this.sprite.getData(key, defaultValue);
    }
    return this[key] !== undefined ? this[key] : defaultValue;
  }
  
  /**
   * Enable or disable input handling for the unit
   * @param {boolean} [enabled=true] - Whether to enable input handling
   * @param {object} [options] - Additional options for input handling
   * @param {boolean} [options.useHandCursor=false] - Whether to show a hand cursor on hover
   * @param {boolean} [options.pixelPerfect=false] - Whether to use pixel-perfect hit detection
   * @param {number} [options.alphaTolerance=1] - The alpha tolerance for hit detection
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setInteractive(enabled = true, options = {}) {
    const { useHandCursor = false, pixelPerfect = false, alphaTolerance = 1 } = options;
    
    if (enabled) {
      const hitArea = this.hitArea || new Phaser.Geom.Rectangle(0, 0, this.width, this.height);
      
      if (this.container) {
        this.container.setInteractive({
          hitArea,
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          useHandCursor,
          pixelPerfect,
          alphaTolerance,
          cursor: useHandCursor ? 'pointer' : 'default'
        });
      } else if (this.sprite) {
        this.sprite.setInteractive({
          hitArea,
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          useHandCursor,
          pixelPerfect,
          alphaTolerance,
          cursor: useHandCursor ? 'pointer' : 'default'
        });
      }
    } else if (this.container) {
      this.container.disableInteractive();
    } else if (this.sprite) {
      this.sprite.disableInteractive();
    }
    
    return this;
  }
  
  /**
   * Set the hit area for input detection
   * @param {Phaser.Geom.Rectangle|Phaser.Geom.Circle|Phaser.Geom.Polygon} shape - The shape to use as the hit area
   * @param {Function} [hitAreaCallback] - The hit area callback function
   * @returns {BaseSurvivor} This unit instance for method chaining
   */
  setHitArea(shape, hitAreaCallback) {
    this.hitArea = shape;
    
    // Default hit area callback based on shape type
    if (!hitAreaCallback) {
      if (shape instanceof Phaser.Geom.Rectangle) {
        hitAreaCallback = Phaser.Geom.Rectangle.Contains;
      } else if (shape instanceof Phaser.Geom.Circle) {
        hitAreaCallback = Phaser.Geom.Circle.Contains;
      } else if (shape instanceof Phaser.Geom.Polygon) {
        hitAreaCallback = Phaser.Geom.Polygon.Contains;
      } else {
        console.warn('[BaseSurvivor] No hit area callback provided for shape type', shape);
        hitAreaCallback = () => false;
      }
    }
    
    // Update the hit area on the interactive object if it exists
    const target = this.container || this.sprite;
    if (target && target.setInteractive) {
      target.setInteractive({
        hitArea: shape,
        hitAreaCallback,
        useHandCursor: target.input?.useHandCursor || false,
        pixelPerfect: target.input?.pixelPerfect || false,
        alphaTolerance: target.input?.alphaTolerance || 1
      });
    }
    
    return this;
  }
  
  /**
   * Set a name tag or label for the unit
   * @param {string} text - The text to display
   * @param {object} [style] - The text style configuration
   * @param {string} [style.font='16px Arial'] - The font style
   * @param {string} [style.fill='#ffffff'] - The text color
   * @param {string} [style.stroke='#000000'] - The stroke color
   * @param {number} [style.strokeThickness=2] - The stroke thickness
   * @param {boolean} [style.shadow=true] - Whether to add a shadow
   * @param {number} [offsetY=-40] - The vertical offset from the unit's position
   * @returns {Phaser.GameObjects.Text} The created text object
   */
  setNameTag(text, style = {}, offsetY = -40) {
    // Remove existing name tag if it exists
    if (this.nameTag) {
      this.nameTag.destroy();
      this.nameTag = null;
    }
    
    if (!this.scene) {
      console.warn('[BaseSurvivor] Cannot create name tag: scene is not available');
      return null;
    }
    
    // Default style
    const defaultStyle = {
      font: '16px Arial',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      shadow: {
        offsetX: 1,
        offsetY: 1,
        color: '#000000',
        blur: 2,
        fill: true
      }
    };
    
    // Merge styles
    const textStyle = { ...defaultStyle, ...style };
    
    // Create the text object
    this.nameTag = this.scene.add.text(0, offsetY, text, textStyle);
    this.nameTag.setOrigin(0.5, 0.5);
    
    // Add to container if it exists, otherwise position manually
    if (this.container) {
      this.container.add(this.nameTag);
    } else {
      this.nameTag.setPosition(this.x, this.y + offsetY);
      
      // Update position when the unit moves
      this.on('update', () => {
        this.nameTag.setPosition(this.x, this.y + offsetY);
      });
    }
    
    return this.nameTag;
  }
  
  /**
   * Create a health bar for the unit
   * @param {object} [options] - Health bar options
   * @param {number} [options.width=60] - The width of the health bar
   * @param {number} [options.height=8] - The height of the health bar
   * @param {number} [options.x=0] - The x offset from the unit's position
   * @param {number} [options.y=-20] - The y offset from the unit's position
   * @param {number} [options.borderThickness=2] - The thickness of the border
   * @param {number|string} [options.borderColor=0x000000] - The color of the border
   * @param {number|string} [options.backgroundColor=0x333333] - The background color of the health bar
   * @param {number|string} [options.fillColor=0x00ff00] - The fill color of the health bar
   * @param {number|string} [options.lowHealthColor=0xff0000] - The color when health is low
   * @param {number} [options.lowHealthThreshold=0.3] - The health threshold for low health (0-1)
   * @returns {Phaser.GameObjects.Graphics} The created health bar
   */
  createHealthBar(options = {}) {
    // Remove existing health bar if it exists
    if (this.healthBar) {
      this.healthBar.destroy();
      this.healthBar = null;
    }
    
    if (!this.scene) {
      console.warn('[BaseSurvivor] Cannot create health bar: scene is not available');
      return null;
    }
    
    // Default options
    const {
      width = 60,
      height = 8,
      x = 0,
      y = -20,
      borderThickness = 2,
      borderColor = 0x000000,
      backgroundColor = 0x333333,
      fillColor = 0x00ff00,
      lowHealthColor = 0xff0000,
      lowHealthThreshold = 0.3
    } = options;
    
    // Create a container for the health bar
    this.healthBar = this.scene.add.graphics();
    this.healthBar.x = x;
    this.healthBar.y = y;
    
    // Store health bar properties
    this.healthBar.width = width;
    this.healthBar.height = height;
    this.healthBar.borderThickness = borderThickness;
    this.healthBar.borderColor = borderColor;
    this.healthBar.backgroundColor = backgroundColor;
    this.healthBar.fillColor = fillColor;
    this.healthBar.lowHealthColor = lowHealthColor;
    this.healthBar.lowHealthThreshold = lowHealthThreshold;
    
    // Add to container if it exists, otherwise position manually
    if (this.container) {
      this.container.add(this.healthBar);
    } else {
      this.healthBar.setPosition(this.x + x, this.y + y);
      
      // Update position when the unit moves
      this.on('update', () => {
        this.healthBar.setPosition(this.x + x, this.y + y);
      });
    }
    
    // Initial draw
    this.updateHealthBar();
    
    return this.healthBar;
  }
  
  /**
   * Update the health bar based on current health
   */
  updateHealthBar() {
    if (!this.healthBar || !this.maxHealth || this.health <= 0) {
      return;
    }
    
    const healthPercent = this.health / this.maxHealth;
    const fillWidth = Math.floor(this.healthBar.width * healthPercent);
    const fillColor = healthPercent <= this.healthBar.lowHealthThreshold 
      ? this.healthBar.lowHealthColor 
      : this.healthBar.fillColor;
    
    // Clear the health bar
    this.healthBar.clear();
    
    // Draw background
    this.healthBar.fillStyle(this.healthBar.backgroundColor);
    this.healthBar.fillRect(0, 0, this.healthBar.width, this.healthBar.height);
    
    // Draw fill
    this.healthBar.fillStyle(fillColor);
    this.healthBar.fillRect(0, 0, fillWidth, this.healthBar.height);
    
    // Draw border
    this.healthBar.lineStyle(this.healthBar.borderThickness, this.healthBar.borderColor);
    this.healthBar.strokeRect(0, 0, this.healthBar.width, this.healthBar.height);
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Clean up any tweens targeting this object or its children
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this);
      if (this.container) this.scene.tweens.killTweensOf(this.container);
      if (this.sprite) this.scene.tweens.killTweensOf(this.sprite);
    }
    
    // Clean up sprite
    if (this.sprite) {
      if (this.sprite.destroy) {
        this.sprite.destroy();
      }
      this.sprite = null;
    }
    
    // Clean up health bar
    if (this.healthBar) {
      if (this.healthBar.destroy) {
        this.healthBar.destroy();
      }
      this.healthBar = null;
    }
    
    // Clean up container and its children
    if (this.container) {
      // Remove all children first
      if (this.container.removeAll) {
        this.container.removeAll(true);
      }
      
      // Destroy the container
      if (this.container.destroy) {
        this.container.destroy();
      }
      this.container = null;
    }
    
    // Clear references
    this.animations = null;
    
    // Call parent destroy
    if (super.destroy) {
      super.destroy();
    }
  }
}
