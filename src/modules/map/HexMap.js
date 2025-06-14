/**
 * HexMap - Manages a hexagonal grid using rexBoard
 */
export class HexMap {
  /**
   * Create a new HexMap
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {Object} config - Configuration object
   * @param {number} config.width - Grid width in tiles
   * @param {number} config.height - Grid height in tiles
   * @param {number} config.tileSize - Size of each hex tile
   * @param {number} [config.x=0] - X position of the grid
   * @param {number} [config.y=0] - Y position of the grid
   * @param {string} [config.staggerAxis='y'] - Stagger axis ('x' or 'y')
   * @param {string} [config.staggerIndex='odd'] - Stagger index ('odd' or 'even')
   * @param {boolean} [config.debug=false] - Enable debug mode
   */
  constructor(scene, config = {}) {
    // Store scene reference
    this._scene = scene;
    
    // Initialize with default config
    this._config = {
      width: 10,
      height: 10,
      tileSize: 40,
      x: 0,
      y: 0,
      staggerAxis: 'y',
      staggerIndex: 'odd',
      debug: false,
      ...config
    };
    
    // Initialize internal state
    this._board = null;
    this._tiles = [];
    this._container = null;
    this._rexBoard = null;
    this._rexHexagon = null;
    
    // Initialize the board
    this._initialize();
  }
  
  // Getters
  get board() { return this._board; }
  get container() { return this._container; }
  get tiles() { return this._tiles; }
  get config() { return { ...this._config }; } // Return a copy to prevent direct modification
  get rexBoard() { return this._rexBoard; }
  get rexHexagon() { return this._rexHexagon; }
  
  /**
   * Initialize the hex map
   * @private
   */
  _initialize() {
    try {
      // Initialize rexBoard
      this._initializeRexBoard();
      
      // Create container for grid elements
      this._container = this._scene.add.container(this._config.x, this._config.y);
      
      // Draw the grid
      this.drawGrid();
    } catch (error) {
      console.error('Failed to initialize HexMap:', error);
      throw error;
    }
  }
  
  /**
   * Initialize the RexBoard plugin
   * @private
   */
  _initializeRexBoard() {
    // Try to get rexBoard from various sources
    this._rexBoard = (
      this._scene.rexBoard ||                  // Scene plugin
      this._scene.sys?.game?.rexBoard ||      // Game instance
      window.rexBoard ||                     // Global window
      (window.RexPlugins && (               // RexPlugins object
        window.RexPlugins.Board ||
        window.RexPlugins.BoardPlugin ||
        (window.RexPlugins.default && window.RexPlugins.default.BoardPlugin)
      ))
    );
    
    // Log available plugins for debugging
    console.log('Available plugins:', {
      scenePlugins: this._scene.plugins?.list || 'No scene plugins',
      sceneRexBoard: this._scene.rexBoard ? 'Available' : 'Not available',
      gameRexBoard: this._scene.sys?.game?.rexBoard ? 'Available' : 'Not available',
      windowRexBoard: window.rexBoard ? 'Available' : 'Not available',
      RexPlugins: window.RexPlugins ? {
        keys: Object.keys(window.RexPlugins),
        hasBoard: !!window.RexPlugins.Board,
        hasBoardPlugin: !!window.RexPlugins.BoardPlugin,
        hasDefault: !!window.RexPlugins.default
      } : 'Not available'
    });
    
    if (!this._rexBoard) {
      const error = new Error('Rex Board plugin not available in HexMap');
      console.error(error.message, {
        sceneRexBoard: !!this._scene.rexBoard,
        gameRexBoard: !!(this._scene.sys?.game?.rexBoard),
        windowRexBoard: !!window.rexBoard,
        hasRexPlugins: !!window.RexPlugins,
        rexPluginsKeys: window.RexPlugins ? Object.keys(window.RexPlugins) : []
      });
      throw error;
    }
    
    // Get rexHexagon from window or scene
    this._rexHexagon = window.rexHexagon || (window.RexPlugins && window.RexPlugins.Hexagon);
    
    if (!this._rexHexagon) {
      console.warn('Rex Hexagon plugin not available, some features may be limited');
    }
    
    // Initialize the board
    this.initBoard();
  }
  
  /**
   * Initialize the rexBoard instance
   */
  /**
   * Initialize the game board
   */
  initBoard() {
    console.log('Initializing HexMap with rexBoard:', {
      rexBoard: this._rexBoard,
      hasAddBoard: this.rexBoard && 'add' in this.rexBoard && 'board' in this.rexBoard.add,
      hasBoardPlugin: this.rexBoard && 'BoardPlugin' in this.rexBoard,
      hasPathFollower: this.rexBoard && 'PathFollower' in this.rexBoard,
      version: this.rexBoard?.version,
      windowRexBoard: window.rexBoard,
      windowRexPlugins: window.RexPlugins ? Object.keys(window.RexPlugins) : []
    });
    
    if (!this.rexBoard) {
      console.error('rexBoard plugin not available');
      return;
    }
    
    try {
      // Try different ways to create the board
      if (this._rexBoard.add?.board) {
        // Try using the plugin's add.board method
        console.log('Creating board using rexBoard.add.board');
        this._board = this._scene.rexBoard.add.board({
          grid: {
            gridType: 'hexagonGrid',
            x: 0,
            y: 0,
            size: this._config.tileSize,
            staggeraxis: this._config.staggerAxis,
            staggerindex: this._config.staggerIndex
          },
          width: this._config.width,
          height: this._config.height
        });
      } else if (this._rexBoard.Board) {
        // Try using rexBoard.Board directly
        console.log('Creating board using rexBoard.Board');
        this._board = new this._rexBoard.Board({
          grid: {
            gridType: 'hexagonGrid',
            x: 0,
            y: 0,
            size: this._config.tileSize,
            staggeraxis: this._config.staggerAxis,
            staggerindex: this._config.staggerIndex
          },
          width: this._config.width,
          height: this._config.height
        });
      } else if (this._rexBoard.default?.BoardPlugin) {
        // Try using the default export pattern
        console.log('Creating board using rexBoard.default.BoardPlugin');
        const BoardPlugin = this._rexBoard.default.BoardPlugin;
        this._board = new BoardPlugin(this._scene, {
          grid: {
            gridType: 'hexagonGrid',
            x: 0,
            y: 0,
            size: this._config.tileSize,
            staggeraxis: this._config.staggerAxis,
            staggerindex: this._config.staggerIndex
          },
          width: this._config.width,
          height: this._config.height
        });
      } else {
        throw new Error('Could not find a valid way to create the board. Available methods: ' + 
          Object.keys(this._rexBoard).join(', '));
      }
      
      if (this._board) {
        console.log('✅ Hex board initialized successfully:', this._board);
        
        // Initialize tiles array
        this._tiles = Array(this._config.width).fill().map(() => Array(this._config.height).fill(null));
        
        // Make sure we can access the grid
        if (!this._board.grid) {
          throw new Error('Board grid not properly initialized');
        }
        
        console.log('Grid type:', this._board.grid.gridType);
      } else {
        console.error('Board was created but is null/undefined');
        return;
      }
      
      console.log('Grid type:', this._board.grid.gridType);
      
    } catch (error) {
      console.error('Error creating board:', error);
      console.error('Available rexBoard methods:', Object.keys(this._rexBoard || {}));
      throw error; // Re-throw to be caught by the caller
    }
  }
  
  /**
   * Draw the hex grid
   */
  drawGrid() {
    const { debug } = this._config;
    
    // Clear previous graphics
    this._container.removeAll(true);
    
    // Initialize tiles array if needed
    if (!this._tiles || this._tiles.length === 0) {
      this._tiles = Array(this._config.width).fill().map(() => Array(this._config.height).fill(null));
    }
    
    try {
      // Verify board is properly initialized
      if (!this._board || !this._board.tileXYToWorldXY) {
        throw new Error('Board not properly initialized');
      }
      
      // Draw each hex in the grid
      for (let q = 0; q < this._config.width; q++) {
        for (let r = 0; r < this._config.height; r++) {
          // Get world position from rexBoard
          const worldXY = this._board.tileXYToWorldXY(q, r, true);
          
          if (!worldXY) {
            console.warn(`Could not get world position for tile (${q},${r})`);
            continue;
          }
          
          // Initialize row if needed
          if (!this._tiles[q]) {
            this._tiles[q] = [];
          }
          
          // Create a tile object if it doesn't exist
          if (!this._tiles[q][r]) {
            this._tiles[q][r] = {
              q,
              r,
              worldX: worldXY.x,
              worldY: worldXY.y,
              walkable: true,
              graphics: this._scene.add.graphics()
            };
          }
          
          const tile = this._tiles[q][r];
          
          // Update position
          tile.worldX = worldXY.x;
          tile.worldY = worldXY.y;
          
          // Draw the hexagon
          this.drawTile(tile);
          
          // Add to container if not already added
          if (tile.graphics && tile.graphics.parentContainer !== this._container) {
            this._container.add(tile.graphics);
          }
          
          // Add debug text if enabled
          if (debug) {
            // Remove old text if it exists
            if (tile.debugText) {
              tile.debugText.destroy();
              tile.debugText = null;
            }
            
            tile.debugText = this._scene.add.text(worldXY.x, worldXY.y, `${q},${r}`, {
              fontSize: '10px',
              fill: '#ffffff'
            }).setOrigin(0.5);
            
            this._container.add(tile.debugText);
          }
        }
      }
    } catch (error) {
      console.error('Error in drawGrid:', error);
      // Try to provide helpful debug info
      console.log('Board state:', {
        board: this._board,
        hasTileXYToWorldXY: !!this._board?.tileXYToWorldXY,
        config: { ...this._config }
      });
    }
  }
  
  /**
   * Draw a single tile
   * @param {Object} tile - The tile to draw
   */
  drawTile(tile) {
    const { q, r, worldX, worldY } = tile;
    
    // Clear previous drawing
    tile.graphics.clear();
    
    try {
      // Get hexagon points relative to the tile's position
      const points = this._board.getGridPoints(0, 0, true);
      
      if (!points || points.length === 0) {
        console.error('Failed to get grid points for tile', tile);
        return;
      }
      
      // Begin a new path for the hexagon
      tile.graphics.fillStyle(tile.walkable ? 0x4a7c59 : 0xaa4a4a, 0.5);
      tile.graphics.lineStyle(1, 0xffffff, 0.5);
      
      // Start the path
      tile.graphics.beginPath();
      
      // Move to the first point
      tile.graphics.moveTo(points[0].x, points[0].y);
      
      // Draw lines to the other points
      for (let i = 1; i < points.length; i++) {
        tile.graphics.lineTo(points[i].x, points[i].y);
      }
      
      // Close the path and fill it
      tile.graphics.closePath();
      tile.graphics.fillPath();
      tile.graphics.strokePath();
      
      // Position the graphics at the tile's world position
      tile.graphics.setPosition(worldX, worldY);
      
      // Make sure the graphics is visible
      tile.graphics.setVisible(true);
      
    } catch (error) {
      console.error(`Error drawing tile at (${q},${r}):`, error);
      console.error('Tile details:', tile);
    }
  }
  
  /**
   * Get a tile at grid coordinates
   * @param {number} q - Column
   * @param {number} r - Row
   * @returns {Object|null} The tile or null if out of bounds
   */
  getTile(q, r) {
    if (q >= 0 && q < this._config.width && r >= 0 && r < this._config.height) {
      return this._tiles[q]?.[r] || null;
    }
    return null;
  }
  
  /**
   * Convert world coordinates to tile coordinates
   * @param {number} x - World X
   * @param {number} y - World Y
   * @returns {Object} Tile coordinates {q, r} or null if out of bounds
   */
  worldToTileXY(x, y) {
    // Adjust for container position
    const localX = x - this._config.x;
    const localY = y - this._config.y;
    
    const tileXY = this._board.worldXYToTileXY(localX, localY, true);
    if (!tileXY) return null;
    
    // Check bounds
    if (tileXY.x >= 0 && tileXY.x < this._config.width && 
        tileXY.y >= 0 && tileXY.y < this._config.height) {
      return { q: tileXY.x, r: tileXY.y };
    }
    
    return null;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Clean up tiles
    if (this._tiles) {
      for (let q = 0; q < this._tiles.length; q++) {
        const row = this._tiles[q];
        if (!row) continue;
        
        for (let r = 0; r < row.length; r++) {
          const tile = row[r];
          if (!tile) continue;
          
          // Clean up graphics
          if (tile.graphics) {
            tile.graphics.destroy();
            tile.graphics = null;
          }
          
          // Clean up debug text
          if (tile.debugText) {
            tile.debugText.destroy();
            tile.debugText = null;
          }
        }
      }
      this._tiles = [];
    }
    
    // Clean up container
    if (this._container) {
      this._container.destroy();
      this._container = null;
    }
    
    // Clean up board
    if (this._board) {
      // Check if the board has a destroy method before calling it
      if (typeof this._board.destroy === 'function') {
        this._board.destroy();
      }
      this._board = null;
    }
  }
}
