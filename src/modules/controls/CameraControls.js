/**
 * CameraControls - Handles all camera movement and zooming
 */
export class CameraControls {
  /**
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {Object} config - Configuration object
   * @param {number} [config.minZoom=0.5] - Minimum zoom level
   * @param {number} [config.maxZoom=2] - Maximum zoom level
   * @param {number} [config.zoomSensitivity=0.01] - Zoom sensitivity
   */
  constructor(scene, config = {}) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.minZoom = config.minZoom || 0.5;
    this.maxZoom = config.maxZoom || 2;
    this.zoomSensitivity = config.zoomSensitivity || 0.01;
    this.isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent);
    
    // Track drag state
    this.isDragging = false;
    this.startDragX = 0;
    this.startDragY = 0;
    this.startCameraX = 0;
    this.startCameraY = 0;
    this.isCommandDown = false;
    
    // Bind methods
    this.handleWheel = this.handleWheel.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }
  
  /**
   * Enable camera controls
   * @param {number} width - Scene width
   * @param {number} height - Scene height
   */
  enable(width, height) {
    // Set up camera bounds with some padding
    this.camera.setBounds(-1000, -1000, width + 2000, height + 2000);
    this.camera.setZoom(1);
    
    // Make canvas focusable and add tabindex
    const canvas = this.scene.game.canvas;
    if (canvas) {
      canvas.tabIndex = 0;
      canvas.style.outline = 'none';
      canvas.focus();
      
      // Add event listeners directly to canvas
      canvas.addEventListener('keydown', (e) => {
        if (e.key === 'Meta') {
          this.handleKeyDown(e);
        }
      });
      
      canvas.addEventListener('keyup', (e) => {
        if (e.key === 'Meta') {
          this.handleKeyUp(e);
        }
      });
      
      // Keep focus on canvas when clicking
      canvas.addEventListener('mousedown', () => {
        canvas.focus();
      });
    }
    
    // Set up input handlers
    this.scene.input.on('pointerdown', this.handlePointerDown);
    this.scene.input.on('pointermove', this.handlePointerMove);
    this.scene.input.on('pointerup', this.handlePointerUp);
    this.scene.input.on('wheel', this.handleWheel);
    
    // Set up keyboard controls
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.scene.input.keyboard.on('keydown-R', () => this.reset());
    
    // Add update listener for keyboard controls
    this.scene.events.on('update', this.update, this);
    
    return this;
  }
  
  /**
   * Disable camera controls
   */
  disable() {
    // Remove event listeners from canvas
    const canvas = this.scene.game.canvas;
    if (canvas) {
      canvas.removeEventListener('keydown', this.handleKeyDown);
      canvas.removeEventListener('keyup', this.handleKeyUp);
      canvas.removeEventListener('mousedown', this.handleCanvasClick);
    }
    
    // Remove Phaser input handlers
    this.scene.input.off('pointerdown', this.handlePointerDown);
    this.scene.input.off('pointermove', this.handlePointerMove);
    this.scene.input.off('pointerup', this.handlePointerUp);
    this.scene.input.off('wheel', this.handleWheel);
    this.scene.input.keyboard.off('keydown-META', this.handleKeyDown);
    this.scene.input.keyboard.off('keyup-META', this.handleKeyUp);
    this.scene.events.off('update', this.update, this);
  }
  
  /**
   * Reset camera to default position and zoom
   */
  reset() {
    const { width, height } = this.scene.scale;
    this.camera.pan(width / 2, height / 2, 300, 'Power2');
    this.camera.zoomTo(1, 300);
  }
  
  /**
   * Handle pointer down event
   * @param {Phaser.Input.Pointer} pointer - The pointer object
   */
  handleKeyDown(event) {
    if (event.key === 'Meta') {
      this.isCommandDown = true;
      
      // Add CSS class to canvas parent
      const canvas = this.scene.game.canvas;
      if (canvas && canvas.parentElement) {
        canvas.parentElement.classList.add('command-pressed');
      }
      
      // Also set cursor directly on canvas
      if (canvas) {
        canvas.style.cursor = 'grab';
      }
    }
  }
  
  handleKeyUp(event) {
    if (event.key === 'Meta') {
      this.isCommandDown = false;
      this.isDragging = false;
      
      // Remove CSS class from canvas parent
      const canvas = this.scene.game.canvas;
      if (canvas && canvas.parentElement) {
        canvas.parentElement.classList.remove('command-pressed');
        canvas.parentElement.classList.remove('dragging');
      }
      
      // Reset cursor
      if (canvas) {
        canvas.style.cursor = 'default';
      }
    }
  }
  
  handlePointerDown(pointer) {
    // On Mac: Start drag if command key is down
    // On other platforms: Start drag on right click
    const shouldDrag = this.isMac 
      ? this.isCommandDown
      : pointer.rightButtonDown();
    
    if (shouldDrag) {
      this.isDragging = true;
      this.startDragX = pointer.x;
      this.startDragY = pointer.y;
      this.startCameraX = this.camera.scrollX;
      this.startCameraY = this.camera.scrollY;
      
      // Update cursor using CSS class and direct style
      const canvas = this.scene.game.canvas;
      if (canvas) {
        if (canvas.parentElement) {
          canvas.parentElement.classList.add('dragging');
          canvas.parentElement.classList.remove('command-pressed');
        }
        canvas.style.cursor = 'grabbing';
      }
      
      if (pointer.event) {
        pointer.event.preventDefault();
      }
    }
  }
  
  handlePointerMove(pointer) {
    if (this.isDragging) {
      const dx = (pointer.x - this.startDragX) / this.camera.zoom;
      const dy = (pointer.y - this.startDragY) / this.camera.zoom;
      
      // Use setScroll to update camera position instead of direct assignment
      this.camera.setScroll(
        this.startCameraX - dx,
        this.startCameraY - dy
      );
      
      if (pointer.event) {
        pointer.event.preventDefault();
      }
    }
  }
  
  handlePointerUp() {
    this.isDragging = false;
    
    const canvas = this.scene.game.canvas;
    if (!canvas) return;
    
    if (this.isCommandDown) {
      // If command is still down, go back to grab cursor
      if (canvas.parentElement) {
        canvas.parentElement.classList.add('command-pressed');
        canvas.parentElement.classList.remove('dragging');
      }
      canvas.style.cursor = 'grab';
    } else {
      // Otherwise, reset to default
      if (canvas.parentElement) {
        canvas.parentElement.classList.remove('command-pressed', 'dragging');
      }
      canvas.style.cursor = 'default';
    }
  }
  
  /**
   * Handle mouse wheel events for zooming
   * @param {Phaser.Input.Pointer} pointer - The pointer object
   * @param {GameObject[]} gameObjects - Array of game objects
   * @param {number} deltaX - The x scroll amount
   * @param {number} deltaY - The y scroll amount (negative for up, positive for down)
   */
  handleWheel(pointer, gameObjects, deltaX, deltaY) {
    // Prevent default to avoid page scrolling
    if (pointer.event) {
      pointer.event.preventDefault();
    }
    
    // Calculate zoom delta based on input
    const isTrackpad = Math.abs(deltaY) < 10 && Math.abs(deltaX) < 10;
    const zoomDelta = isTrackpad ? deltaY * this.zoomSensitivity : deltaY * 0.001;
    
    // Calculate new zoom level
    const newZoom = Phaser.Math.Clamp(
      this.camera.zoom - zoomDelta, 
      this.minZoom, 
      this.maxZoom
    );
    
    // If zoom didn't change, do nothing
    if (newZoom === this.camera.zoom) return;
    
    // Get the world point under the cursor before zooming
    const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
    
    // Set the new zoom
    this.camera.setZoom(newZoom);
    
    // Calculate the new camera position to keep the cursor over the same world point
    const newWorldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
    const newScrollX = this.camera.scrollX + (worldPoint.x - newWorldPoint.x);
    const newScrollY = this.camera.scrollY + (worldPoint.y - newWorldPoint.y);
    this.camera.setScroll(newScrollX, newScrollY);
  }
  
  /**
   * Update handler for keyboard controls
   */
  update() {
    if (!this.cursors) return;
    
    const speed = 10 / this.camera.zoom; // Pan faster when zoomed out
    let newScrollX = this.camera.scrollX;
    let newScrollY = this.camera.scrollY;
    let needsUpdate = false;
    
    if (this.cursors.left.isDown) {
      newScrollX -= speed;
      needsUpdate = true;
    } else if (this.cursors.right.isDown) {
      newScrollX += speed;
      needsUpdate = true;
    }
    
    if (this.cursors.up.isDown) {
      newScrollY -= speed;
      needsUpdate = true;
    } else if (this.cursors.down.isDown) {
      newScrollY += speed;
      needsUpdate = true;
    }
    
    // Apply all scroll changes at once
    if (needsUpdate) {
      this.camera.setScroll(newScrollX, newScrollY);
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.disable();
    this.scene = null;
    this.camera = null;
    this.cursors = null;
  }
}
