import { TILE_SIZE, MOVEMENT, TILE } from '../constants.js';

export default class MovementSystem {
  constructor(scene) {
    this.scene = scene;
    this.movementRange = [];
    this.rangeTexts = []; // Array to store text objects for AP costs
    this.obstacles = []; // Stores grid coordinates of obstacles
    this.unit = null; // Reference to the currently selected unit
    
    // Create movement graphics with a higher depth to be above tiles but below UI
    this.movementGraphics = scene.add.graphics();
    this.movementGraphics.setDepth(50);
    
    console.log('MovementSystem initialized with graphics depth:', this.movementGraphics.depth);
    
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

  // Calculate movement range using BFS with action points
  // Each move must consume whole action points (1 AP = 4 movement points)
  // Orthogonal moves cost 1 MP (1/4 AP), diagonal moves cost 1.5 MP (3/8 AP)
  calculateRange(unit, maxAP) {
    this.movementRange = [];
    this.movementGraphics.clear();

    // Convert AP to movement points (4 per AP)
    // Use all available movement points, including partial AP
    const maxMovementPoints = maxAP * 4;
    
    // Use the unit's grid position directly
    const startX = unit.gridX;
    const startY = unit.gridY;
    
    // If the unit is not on a valid tile, return empty range
    if (startX === undefined || startY === undefined || 
        startX < 0 || startX >= 10 || startY < 0 || startY >= 10) {
      console.warn('Unit is not on a valid tile');
      return [];
    }
    
    // Add starting position to range with 0 cost
    const range = [{
      x: startX,
      y: startY,
      cost: 0,
      path: [],
      isDiagonal: false,
      remainingAP: maxAP,
      remainingMP: maxMovementPoints
    }];
    
    // Track visited tiles and best remaining AP
    const visited = new Map();
    visited.set(`${startX},${startY}`, maxAP);
    
    // Define movement directions with their costs
    const directions = [
      { dx: -1, dy: 0, cost: 1, isDiagonal: false },  // left
      { dx: 1, dy: 0, cost: 1, isDiagonal: false },   // right
      { dx: 0, dy: -1, cost: 1, isDiagonal: false },  // up
      { dx: 0, dy: 1, cost: 1, isDiagonal: false },   // down
      { dx: -1, dy: -1, cost: 1.5, isDiagonal: true }, // top-left
      { dx: 1, dy: -1, cost: 1.5, isDiagonal: true },  // top-right
      { dx: -1, dy: 1, cost: 1.5, isDiagonal: true },  // bottom-left
      { dx: 1, dy: 1, cost: 1.5, isDiagonal: true }    // bottom-right
    ];
    
    // Use BFS to explore all reachable tiles
    const queue = [{
      x: startX,
      y: startY,
      remainingAP: maxAP,
      remainingMP: maxMovementPoints,
      path: []
    }];
    
    while (queue.length > 0) {
      const current = queue.shift();
      
      // Check all 8 directions
      for (const { dx, dy, cost, isDiagonal } of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = `${nx},${ny}`;
        
        // Skip if out of bounds
        if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10) continue;
        
        // Skip if undead is in the target tile or it's an obstacle
        if (this.scene.isUndeadAt(nx, ny) || this.isObstacle(nx, ny)) {
          continue;
        }
        
        // For diagonal moves, check if we can move between units
        if (isDiagonal && !this.canMoveDiagonally(current.x, current.y, nx, ny)) {
          continue;
        }
        
        // Skip if target tile has a survivor and we're not moving diagonally
        if (this.scene.isSurvivorAt(nx, ny) && !isDiagonal) {
          continue;
        }
        
        // Calculate remaining movement points after this move
        const newRemainingMP = current.remainingMP - cost;
        
        // Skip if not enough movement points for this move
        if (newRemainingMP < 0) continue;
        
        // Calculate remaining AP, allowing for partial AP usage
        const usedMP = maxMovementPoints - newRemainingMP;
        // Calculate exact AP used (can be fractional)
        const usedAP = usedMP / 4;
        const remainingAP = maxAP - usedAP;
        
        // Skip if we've used more AP than we have
        if (remainingAP < 0) continue;
        
        // Skip if we've found a better path to this tile (more remaining AP)
        const bestRemainingAP = visited.get(key) || -1;
        if (remainingAP <= bestRemainingAP) continue;
        
        // Update best path to this tile
        visited.set(key, remainingAP);
        
        // Create a new path to this tile
        const path = [...current.path, { x: nx, y: ny, isDiagonal }];
        
        // Add to range
        range.push({ 
          x: nx, 
          y: ny, 
          cost: usedAP,
          path,
          isDiagonal,
          remainingAP,
          remainingMP: newRemainingMP
        });
        
        // Add to queue to explore from this tile if we have AP left
        if (remainingAP > 0) {
          queue.push({
            x: nx,
            y: ny,
            remainingAP,
            remainingMP: newRemainingMP,
            path
          });
        }
      }
    }
    
    this.movementRange = range;
    console.log(`Movement range calculated with ${range.length} reachable tiles`);
    return range;
  }

  // Draw movement range overlay
  showRange(range = this.movementRange) {
    console.log('showRange called with:', range);
    
    // Clear any existing graphics and texts first
    this.hideRange();
    
    // Ensure we have a valid graphics object
    if (!this.movementGraphics) {
      console.log('Creating movement graphics');
      this.movementGraphics = this.scene.add.graphics();
      this.movementGraphics.setDepth(50);
    }
    
    if (!range || range.length === 0) {
      console.log('No range to display');
      return;
    }
    
    // Store the range for later use
    this.movementRange = range;
    
    // Clear any existing range texts
    this.clearRangeTexts();
    
    // Group tiles by their coordinates to handle overlapping ranges
    const tileMap = new Map();
    
    range.forEach(tile => {
      const key = `${tile.x},${tile.y}`;
      if (!tileMap.has(key)) {
        tileMap.set(key, []);
      }
      tileMap.get(key).push(tile);
    });
    
    // Draw each tile in the movement range
    tileMap.forEach((tiles, key) => {
      const [x, y] = key.split(',').map(Number);
      const tileX = x * TILE_SIZE;
      const tileY = y * TILE_SIZE;
      
      // Skip if this is the unit's current position
      const isUnitPosition = this.unit && x === this.unit.gridX && y === this.unit.gridY;
      if (isUnitPosition) {
        return;
      }
      
      // Skip if there's an obstacle or another unit
      if (this.isObstacle(x, y) || this.scene.isUnitAt(x, y)) {
        return;
      }
      
      // Find the tile with the lowest cost for this position
      const bestTile = tiles.reduce((best, current) => 
        (current.cost < best.cost) ? current : best
      );
      
      // Get the AP cost from the tile (already calculated in calculateRange)
      const apCost = bestTile.cost; // This is already in AP units
      
      // Round to 2 decimal places for display
      const displayAP = Math.round(apCost * 100) / 100;
      
      // Determine the fill and border colors based on AP cost
      let fillColor, borderColor, textColor;
      
      if (displayAP > 1) {
        // White highlight for >1 AP moves
        fillColor = 0xffffff;
        borderColor = 0xdddddd;
        textColor = '#000';
      } else {
        // Orange for 1 AP or less moves
        fillColor = 0xffa500;
        borderColor = 0xff8c00;
        textColor = '#fff';
      }
      
      // Draw the movement tile with the appropriate color
      this.movementGraphics.fillStyle(fillColor, 0.3);
      this.movementGraphics.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
      
      // Draw border
      this.movementGraphics.lineStyle(2, borderColor, 0.8);
      this.movementGraphics.strokeRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
      
      // Add AP cost text
      const textX = tileX + TILE_SIZE / 2;
      const textY = tileY + TILE_SIZE / 2;
      
      const text = this.scene.add.text(
        textX, 
        textY - 10, // Slightly above the center
        displayAP.toString(),
        { 
          fontSize: '14px', 
          fill: textColor, 
          fontStyle: 'bold', 
          backgroundColor: 'rgba(0, 0, 0, 0.7)', 
          padding: { x: 4, y: 2 }, 
          stroke: textColor === '#000' ? '#fff' : '#000',
          strokeThickness: 2 
        }
      );
      text.setOrigin(0.5);
      text.setDepth(100);
      this.rangeTexts.push(text);
    });
    
    // Store the current unit for reference if available
    if (range.length > 0 && range[0].unit) {
      this.unit = range[0].unit;
    }
  }

  // Hide movement range
  hideRange() {
    if (this.movementGraphics) {
      this.movementGraphics.clear();
    }
    this.clearRangeTexts();
    this.movementRange = [];
  }
  
  // Clear all range text objects
  clearRangeTexts() {
    if (this.rangeTexts) {
      this.rangeTexts.forEach(text => {
        if (text && text.destroy) {
          text.destroy();
        }
      });
      this.rangeTexts = [];
    }
  }

  // Check if a tile contains an obstacle (terrain only)
  isObstacle(x, y) {
    return this.obstacles.some(obs => obs.x === x && obs.y === y);
  }
  
  // Check if diagonal movement is allowed between two tiles
  canMoveDiagonally(fromX, fromY, toX, toY) {
    // For diagonal moves, check the two adjacent orthogonal tiles
    const dx = toX - fromX;
    const dy = toY - fromY;
    
    // If not a diagonal move, return true (let other checks handle it)
    if (Math.abs(dx) !== 1 || Math.abs(dy) !== 1) {
      return true;
    }
    
    // Check the two adjacent orthogonal tiles
    const tile1Blocked = this.scene.isUnitAt(fromX + dx, fromY) || this.isObstacle(fromX + dx, fromY);
    const tile2Blocked = this.scene.isUnitAt(fromX, fromY + dy) || this.isObstacle(fromX, fromY + dy);
    
    // Diagonal movement is allowed if at least one adjacent tile is clear
    return !(tile1Blocked && tile2Blocked);
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

  // Set all obstacles at once
  setObstacles(obstacles) {
    this.obstacles = [...obstacles];
    console.log('Obstacles set:', this.obstacles);
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
      console.warn(`Target (${x}, ${y}) is not reachable`);
      return null;
    }
    
    // If no path exists (shouldn't happen if target is in movementRange), return null
    if (!target.path || target.path.length === 0) {
      console.warn('No valid path found to target');
      return null;
    }
    
    // Reconstruct and validate the entire path
    const fullPath = [
      { x: this.movementRange[0].x, y: this.movementRange[0].y },
      ...target.path.map(step => ({ x: step.x, y: step.y, isDiagonal: step.isDiagonal }))
    ];
    
    // Validate each step of the path
    for (let i = 1; i < fullPath.length; i++) {
      const prev = fullPath[i - 1];
      const current = fullPath[i];
      const isDiagonal = Math.abs(current.x - prev.x) === 1 && Math.abs(current.y - prev.y) === 1;
      
      // Check for obstacles or invalid moves
      if (this.isObstacle(current.x, current.y)) {
        console.warn(`Path is blocked by obstacle at (${current.x}, ${current.y})`);
        return null;
      }
      
      // For diagonal moves, check if we can move between units
      if (isDiagonal && !this.canMoveDiagonally(prev.x, prev.y, current.x, current.y)) {
        console.warn(`Diagonal move from (${prev.x},${prev.y}) to (${current.x},${current.y}) is blocked`);
        return null;
      }
      
      // Check for undead in the target tile
      if (this.scene.isUndeadAt(current.x, current.y)) {
        console.warn(`Path is blocked by undead at (${current.x}, ${current.y})`);
        return null;
      }
      
      // Check for survivors in the target tile (unless moving diagonally)
      if (this.scene.isSurvivorAt(current.x, current.y) && !isDiagonal) {
        console.warn(`Path is blocked by survivor at (${current.x}, ${current.y})`);
        return null;
      }
    }
    
    // Use the pre-calculated AP cost from the movement range
    const totalAPCost = target.cost;
    const hasDiagonal = target.path.some(step => step.isDiagonal);
    
    console.log(`Found valid path to (${x}, ${y}) with AP cost ${totalAPCost}`);
    return {
      path: target.path.map(step => ({ x: step.x, y: step.y, isDiagonal: step.isDiagonal })),
      apCost: totalAPCost,
      isDiagonal: hasDiagonal
    };
  }
}
