import { TILE_SIZE, MOVEMENT, TILE } from '../constants.js';

export default class MovementSystem {
  constructor(scene) {
    this.scene = scene;
    this.movementRange = [];
    this.movementGraphics = scene.add.graphics();
    this.movementGraphics.setDepth(5);
    this.obstacles = []; // Will store grid coordinates of obstacles
    
    // Initialize with map obstacles
    this.initializeObstacles();
  }
  
  // Initialize obstacles from the game grid
  initializeObstacles() {
    if (!this.scene.grid) return;
    
    for (let y = 0; y < this.scene.grid.length; y++) {
      for (let x = 0; x < this.scene.grid[y].length; x++) {
        const tile = this.scene.grid[y][x];
        if (tile && !tile.walkable) {
          this.addObstacle(x, y);
        }
      }
    }
  }

  // Calculate movement range using BFS
  calculateRange(unit, maxCost = MOVEMENT.BASE_SPEED * MOVEMENT.ACTION_POINTS) {
    this.movementRange = [];
    this.movementGraphics.clear();

    // Use the unit's grid position directly
    const startX = unit.gridX;
    const startY = unit.gridY;
    
    // If the unit is not on a valid tile, return empty range
    if (startX === undefined || startY === undefined || 
        startX < 0 || startX >= 10 || startY < 0 || startY >= 10) {
      console.warn('Unit has invalid grid position:', { gridX: startX, gridY: startY });
      return [];
    }
    
    const queue = [{ x: startX, y: startY, cost: 0, path: [] }];
    const visited = new Map();
    const range = [];
    
    // Add starting position to range with 0 cost
    range.push({ x: startX, y: startY, cost: 0, path: [] });
    visited.set(`${startX},${startY}`, 0);

    const directions = [
      { dx: -1, dy: 0 },  // left
      { dx: 1, dy: 0 },   // right
      { dx: 0, dy: -1 },  // up
      { dx: 0, dy: 1 },   // down
      { dx: -1, dy: -1 }, // top-left
      { dx: 1, dy: -1 },  // top-right
      { dx: -1, dy: 1 },  // bottom-left
      { dx: 1, dy: 1 }    // bottom-right
    ];


    while (queue.length > 0) {
      const current = queue.shift();
      
      // Check all 8 directions
      for (const { dx, dy } of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = `${nx},${ny}`;

        // Skip if out of bounds
        if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10) continue;
        
        // Skip if it's an obstacle
        if (this.isObstacle(nx, ny)) continue;
        
        // Calculate movement cost
        const isDiagonal = Math.abs(dx) === 1 && Math.abs(dy) === 1;
        const cost = current.cost + (isDiagonal ? MOVEMENT.DIAGONAL_COST : 1);
        
        // Skip if we've already found a better path to this tile
        if (visited.has(key) && visited.get(key) <= cost) continue;
        
        // Skip if the cost exceeds max cost
        if (cost > maxCost) continue;
        
        // Add to visited with current cost
        visited.set(key, cost);
        
        // Create a new path to this tile
        const path = [...current.path, { x: nx, y: ny }];
        const tileInfo = { x: nx, y: ny, cost, path };
        
        // Add to range if we can move here
        range.push(tileInfo);
        
        // Add to queue to explore from this tile
        queue.push(tileInfo);
      }
    }

    this.movementRange = range;
    console.log(`Movement range calculated with ${range.length} reachable tiles`);
    return range;
  }

  // Draw movement range overlay
  showRange(range = this.movementRange) {
    this.movementGraphics.clear();
    
    // Don't show range if there's no range to show
    if (!range || range.length === 0) {
      console.log('No range to show');
      return;
    }
    
    console.log(`Showing movement range for ${range.length} tiles`);
    
    // First pass: draw all reachable tiles with lower opacity
    range.forEach(tile => {
      if (tile.cost === 0) return; // Skip the starting tile
      
      // Higher base alpha for better visibility
      const baseAlpha = 0.6;
      const alpha = baseAlpha + ((1 - (tile.cost / (MOVEMENT.BASE_SPEED * 2))) * 0.3);
      
      // Use more vibrant colors
      const color = tile.cost <= MOVEMENT.BASE_SPEED ? 0xFF6B00 : 0xFFC000;
      
      // Draw a larger highlight with rounded corners
      const padding = 2;
      const cornerRadius = 4;
      
      // Draw the tile highlight with a border
      this.movementGraphics.fillStyle(color, alpha);
      this.movementGraphics.fillRoundedRect(
        tile.x * TILE_SIZE + padding,
        tile.y * TILE_SIZE + padding,
        TILE_SIZE - (padding * 2),
        TILE_SIZE - (padding * 2),
        cornerRadius
      );
      
      // Add a more visible border
      this.movementGraphics.lineStyle(2, 0xFFFFFF, alpha * 0.8);
      this.movementGraphics.strokeRoundedRect(
        tile.x * TILE_SIZE + padding,
        tile.y * TILE_SIZE + padding,
        TILE_SIZE - (padding * 2),
        TILE_SIZE - (padding * 2),
        cornerRadius
      );
    });
    
    // Second pass: highlight the starting position
    const start = range[0];
    if (start) {
      this.movementGraphics.fillStyle(0x00FF00, 0.5);
      this.movementGraphics.fillRoundedRect(
        start.x * TILE_SIZE + 2,
        start.y * TILE_SIZE + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4,
        4
      );
    }
  }

  hideRange() {
    this.movementGraphics.clear();
  }

  // Check if a tile contains an obstacle
  isObstacle(x, y) {
    return this.obstacles.some(obs => obs.x === x && obs.y === y);
  }

  // Add obstacle at grid coordinates
  addObstacle(x, y) {
    if (!this.isObstacle(x, y)) {
      this.obstacles.push({ x, y });
    }
  }

  // Remove obstacle at grid coordinates
  removeObstacle(x, y) {
    this.obstacles = this.obstacles.filter(obs => !(obs.x === x && obs.y === y));
  }

  // Get path to target tile if reachable
  getPathTo(x, y) {
    // First, check if the target coordinates are valid
    if (x < 0 || x >= 10 || y < 0 || y >= 10) {
      console.warn(`Target coordinates (${x}, ${y}) are out of bounds`);
      return null;
    }
    
    // If no movement range is calculated, return null
    if (!this.movementRange || this.movementRange.length === 0) {
      console.warn('No movement range calculated. Call calculateRange() first.');
      return null;
    }
    
    // Find the target tile in the movement range
    const target = this.movementRange.find(tile => tile.x === x && tile.y === y);
    
    if (!target) {
      console.log(`No valid path to (${x}, ${y}) - tile is either blocked or out of range`);
      return null;
    }
    
    console.log(`Found path to (${x}, ${y}) with cost ${target.cost}`);
    return target.path;
  }
}
