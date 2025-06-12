import { TILE_SIZE, MOVEMENT, TILE } from '../constants.js';

export default class MovementSystem {
  constructor(scene) {
    this.scene = scene;
    this.movementRange = [];
    this.movementGraphics = null;
    this.rangeTexts = [];
    this.pathGraphics = null;  // For drawing the path preview
    this.currentPath = [];     // Current path being previewed
    this.mousePath = [];       // Track the actual mouse path
    this.lastGridX = -1;     // Last grid X position
    this.lastGridY = -1;     // Last grid Y position
    this.lastDirX = 0;
    this.lastDirY = 0;
    this.isBuildingPath = false; // Prevent multiple updates
    this.obstacles = [];
    this.unit = null;
    this.invalidMove = null; // Track invalid moves for visual feedback
    
    // Initialize graphics
    this.init();
    
    // Initialize obstacles
    this.initializeObstacles();
  }
  
  // Initialize graphics objects
  init() {
    if (!this.movementGraphics) {
      this.movementGraphics = this.scene.add.graphics();
      this.movementGraphics.setDepth(50);
    }
    
    if (!this.pathGraphics) {
      this.pathGraphics = this.scene.add.graphics();
      this.pathGraphics.setDepth(60); // Above movement range but below UI
    }
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

  // Add a point to the mouse path if it's a new grid cell
  addMousePoint(gridX, gridY) {
    // Initialize last grid position if needed
    if (this.lastGridX === -1 || this.lastGridY === -1) {
      this.lastGridX = gridX;
      this.lastGridY = gridY;
      this.mousePath = [{ x: gridX, y: gridY }];
      console.log('Initialized path at', { x: gridX, y: gridY });
      return true;
    }

    // Skip if we're still on the same grid cell
    if (this.lastGridX === gridX && this.lastGridY === gridY) {
      return false;
    }
    
    // Calculate direction and distance
    const dx = gridX - this.lastGridX;
    const dy = gridY - this.lastGridY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    
    // Only allow single-tile moves (orthogonal or diagonal)
    if (absDx > 1 || absDy > 1) {
      console.log('Skipping multi-tile move', { dx, dy });
      return false;
    }
    
    // Check if we're moving back to a previous point in the path
    if (this.mousePath.length > 1) {
      const prevPoint = this.mousePath[this.mousePath.length - 2];
      if (prevPoint && prevPoint.x === gridX && prevPoint.y === gridY) {
        // Moving back one step - trim the last point
        this.mousePath.pop();
        this.lastGridX = gridX;
        this.lastGridY = gridY;
        console.log('Trimmed path back to', { x: gridX, y: gridY });
        return true;
      }
      
      // Check if we're crossing back over the path (not just the previous point)
      const existingIndex = this.mousePath.findIndex(p => p.x === gridX && p.y === gridY);
      if (existingIndex >= 0 && existingIndex < this.mousePath.length - 2) {
        // Moving back to a point earlier in the path - trim to that point
        this.mousePath = this.mousePath.slice(0, existingIndex + 1);
        this.lastGridX = gridX;
        this.lastGridY = gridY;
        console.log('Trimmed path back to earlier point', { x: gridX, y: gridY });
        return true;
      }
    }
    
    // Check if destination is blocked (for both orthogonal and diagonal)
    const destBlocked = this.scene.isUnitAt(gridX, gridY) || this.isObstacle(gridX, gridY);
    if (destBlocked) {
      console.log('Move blocked at destination', { gridX, gridY });
      return false;
    }
    
    // For diagonal moves, check if we're cutting corners
    if (absDx === 1 && absDy === 1) {
      // Check if either adjacent orthogonal move would be blocked
      const corner1Blocked = this.scene.isUnitAt(this.lastGridX, gridY) || this.isObstacle(this.lastGridX, gridY);
      const corner2Blocked = this.scene.isUnitAt(gridX, this.lastGridY) || this.isObstacle(gridX, this.lastGridY);
      
      // If both orthogonal moves are blocked, diagonal move is not allowed
      if (corner1Blocked && corner2Blocked) {
        console.log('Diagonal move blocked by corners', { gridX, gridY });
        return false;
      }
      
      // If one of the orthogonal moves is blocked, we might still allow the diagonal
      // but we should check if the path is valid
      if (corner1Blocked || corner2Blocked) {
        // Check if the path would go through a wall
        const midX = this.lastGridX + dx;
        const midY = this.lastGridY + dy;
        
        // If the midpoint is blocked, don't allow the diagonal
        if (this.isObstacle(midX, midY)) {
          console.log('Diagonal move blocked by midpoint obstacle', { midX, midY });
          return false;
        }
      }
    }
    
    // Add the point to the path
    this.mousePath.push({ x: gridX, y: gridY });
    this.lastGridX = gridX;
    this.lastGridY = gridY;
    this.lastDirX = dx;
    this.lastDirY = dy;
    
    console.log('Added point to path', { x: gridX, y: gridY }, 'Path length:', this.mousePath.length);
    return true;
  }
  
  // Clear the current mouse path and reset tracking state
  clearMousePath() {
    console.log('Clearing mouse path');
    this.mousePath = [];
    this.lastGridX = -1;
    this.lastGridY = -1;
    this.lastDirX = 0;
    this.lastDirY = 0;
    this.isBuildingPath = false;
  }
  
  // Try to add a diagonal move
  tryAddDiagonalMove(x, y, dx, dy) {
    const diagonalX = x + dx;
    const diagonalY = y + dy;
    
    // Check if diagonal move is valid
    if (this.addMousePoint(diagonalX, diagonalY)) {
      this.rebuildPathFromMousePath();
    }
    
    this.isBuildingPath = false;
    return true;
  }
  
  // Clear the path preview
  clearPathPreview() {
    if (this.pathGraphics) {
      this.pathGraphics.clear();
    }
    this.currentPath = [];
    this.clearMousePath();
  }
  
  // Show movement range on the grid
  showRange(range) {
    // Clear any existing range display first
    this.hideRange();
    
    if (!range || range.length === 0) {
      console.log('[MOVEMENT] No range to display');
      return;
    }
    
    // Store the range for later use
    this.movementRange = [...range];
    
    try {
      // Create new graphics for range display
      this.rangeGraphics = this.scene.add.graphics();
      this.rangeGraphics.setDepth(40); // Below path preview but above grid
      
      // Draw each tile in range
      range.forEach(tile => {
        const x = tile.x * TILE_SIZE;
        const y = tile.y * TILE_SIZE;
        
        // Calculate AP cost based on movement points (4 tiles per AP)
        // For orthogonal moves: 4 tiles = 1 AP
        // For diagonal moves: 2.67 tiles = 1 AP (1.5 MP per diagonal tile)
        let apCost = Math.ceil(tile.cost / MOVEMENT.BASE_SPEED);
        // Clamp between 1 and 2 AP
        const displayApCost = Math.min(Math.max(1, apCost), 2);
        
        // Debug log for specific tiles
        if ((tile.x === 5 && tile.y === 4) || (tile.x === 3 && tile.y === 1)) {
          console.log(`[RENDER] Tile (${tile.x},${tile.y}) - MP: ${tile.cost}, AP: ${displayApCost}`);
        }
        
        // Set colors based on AP cost (≤1 AP is low cost)
        const isLowCost = displayApCost <= 1;
        const highlightColor = isLowCost ? 0xffa500 : 0xffffff; // Orange for ≤1 AP, White for >1 AP
        const textColor = isLowCost ? '#ffa500' : '#ffffff';
        
        // Draw highlight
        this.rangeGraphics.fillStyle(highlightColor, 0.3);
        this.rangeGraphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        
        // Draw border
        this.rangeGraphics.lineStyle(1, highlightColor, 0.7);
        this.rangeGraphics.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        
        // Add AP cost text
        const costText = this.scene.add.text(
          x + TILE_SIZE / 2,
          y + TILE_SIZE / 2,
          displayApCost.toString(),
          { 
            font: 'bold 12px Arial',
            fill: textColor,
            stroke: '#000',
            strokeThickness: 2,
            align: 'center'
          }
        );
        costText.setOrigin(0.5);
        costText.setDepth(45);
        
        // Store the text for later cleanup
        this.rangeTexts.push(costText);
      });
      
      console.log(`[MOVEMENT] Displaying ${range.length} tiles in movement range`);
    } catch (error) {
      console.error('[MOVEMENT] Error showing range:', error);
      this.hideRange(); // Clean up on error
    }
  }
  
  // Hide movement range
  hideRange() {
    // Clear all graphics contexts
    if (this.movementGraphics) {
      this.movementGraphics.clear();
    }
    
    if (this.pathGraphics) {
      this.pathGraphics.clear();
    }
    
    if (this.rangeGraphics) {
      this.rangeGraphics.clear();
      this.rangeGraphics.destroy();
      this.rangeGraphics = null;
    }
    
    // Clear all range texts
    this.rangeTexts.forEach(text => {
      if (text && typeof text.destroy === 'function') {
        text.destroy();
      }
    });
    this.rangeTexts = [];
    
    // Reset path tracking
    this.currentPath = [];
    this.clearMousePath();
    
    // Reset the movement range
    this.movementRange = [];
  }
  
  // Clean up resources
  destroy() {
    // Clean up all graphics and texts
    if (this.movementGraphics) {
      this.movementGraphics.destroy();
      this.movementGraphics = null;
    }
    
    if (this.pathGraphics) {
      this.pathGraphics.destroy();
      this.pathGraphics = null;
    }
    
    if (this.rangeGraphics) {
      this.rangeGraphics.destroy();
      this.rangeGraphics = null;
    }
    
    // Clean up all text objects
    this.rangeTexts.forEach(text => {
      if (text && typeof text.destroy === 'function') {
        text.destroy();
      }
    });
    this.rangeTexts = [];
    
    // Reset all state
    this.currentPath = [];
    this.clearMousePath();
    this.obstacles = [];
    this.unit = null;
  }
  
  // Add an obstacle at the given grid coordinates
  addObstacle(x, y) {
    this.obstacles.push({ x, y });
  }
  
  // Check if there's an obstacle at the given grid coordinates
  isObstacle(x, y) {
    // Only count non-unit obstacles or enemies as obstacles
    return this.obstacles.some(obs => obs.x === x && obs.y === y) || 
           (this.scene.isUnitAt(x, y) && !this.scene.isSurvivorAt(x, y));
  }
  
  // Set the current unit for movement
  setUnit(unit) {
    this.unit = unit;
    this.clearMousePath();
  }
  
  // Clear the current unit
  clearUnit() {
    this.unit = null;
    this.clearMousePath();
  }
  
  // Set obstacles
  setObstacles(obstacles) {
    this.obstacles = [...obstacles];
  }
  
  // Clear all obstacles
  clearObstacles() {
    this.obstacles = [];
  }
  
  // Rebuild the current path from the mouse path and update movement range
  rebuildPathFromMousePath() {
    // Implementation for rebuilding path from mouse path
  }
  
  // Update the remaining movement range based on used AP
  updateRemainingRange(remainingMovementPoints) {
    // Implementation for updating remaining range
  }
  
  // Calculate remaining movement range from a position with given movement points
  calculateRemainingRange(startX, startY, maxMovementPoints) {
    // Implementation for calculating remaining range
  }
  
  // Show the remaining movement range
  showRemainingRange(range, startX, startY) {
    // Implementation for showing remaining range
  }
  
  // Helper to draw an arrow
  drawArrow(fromX, fromY, toX, toY, headLength = 16, headWidth = 12, color = 0xffff00) {
    if (!this.pathGraphics) return;
    
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    // Draw arrow shaft
    this.pathGraphics.lineStyle(4, color, 1);
    this.pathGraphics.beginPath();
    this.pathGraphics.moveTo(fromX, fromY);
    this.pathGraphics.lineTo(
      toX - headLength * 0.9 * Math.cos(angle),
      toY - headLength * 0.9 * Math.sin(angle)
    );
    this.pathGraphics.strokePath();
    
    // Draw arrow head
    this.pathGraphics.fillStyle(color, 0.9);
    this.pathGraphics.beginPath();
    this.pathGraphics.moveTo(toX, toY);
    this.pathGraphics.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.pathGraphics.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.pathGraphics.closePath();
    this.pathGraphics.fillPath();
  }
  
  // Calculate movement range for a unit
  calculateRange(unit, obstacles = []) {
    const startX = unit.gridX;
    const startY = unit.gridY;
    
    // If no AP left, return empty range
    if (unit.actionPoints <= 0) {
      console.log(`[MOVEMENT] No AP left for movement (has ${unit.actionPoints} AP)`);
      return [];
    }
    
    // Calculate max movement points based on AP and BASE_SPEED
    const maxMP = unit.actionPoints * MOVEMENT.BASE_SPEED;
    console.log(`[MOVEMENT] Calculating range for unit at (${startX},${startY}) with ${unit.actionPoints} AP (${maxMP} MP)`);
    
    // Directions: 4 orthogonal, then 4 diagonal
    const directions = [
      { dx: 1, dy: 0, cost: MOVEMENT.TILE_COST_ORTHOGONAL },
      { dx: -1, dy: 0, cost: MOVEMENT.TILE_COST_ORTHOGONAL },
      { dx: 0, dy: 1, cost: MOVEMENT.TILE_COST_ORTHOGONAL },
      { dx: 0, dy: -1, cost: MOVEMENT.TILE_COST_ORTHOGONAL },
      { dx: 1, dy: 1, cost: MOVEMENT.TILE_COST_DIAGONAL },
      { dx: -1, dy: 1, cost: MOVEMENT.TILE_COST_DIAGONAL },
      { dx: 1, dy: -1, cost: MOVEMENT.TILE_COST_DIAGONAL },
      { dx: -1, dy: -1, cost: MOVEMENT.TILE_COST_DIAGONAL }
    ];
    
    const queue = [{ x: startX, y: startY, cost: 0, path: [] }];
    const visited = new Map();
    const range = [];
    
    visited.set(`${startX},${startY}`, 0);
    
    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      
      for (const dir of directions) {
        const x = current.x + dir.dx;
        const y = current.y + dir.dy;
        const moveCost = dir.cost;
        const newCost = current.cost + moveCost;
        
        // Skip if this move would exceed remaining movement points
        if (newCost > maxMP) {
          continue;
        }
        
        // Skip if out of bounds
        if (x < 0 || y < 0 || x >= this.scene.grid[0].length || y >= this.scene.grid.length) {
          continue;
        }
        
        // Skip if obstacle or occupied (unless it's the starting position)
        if ((x !== startX || y !== startY) && (this.isObstacle(x, y) || this.scene.isUnitAt(x, y))) {
          continue;
        }
        
        // For diagonal moves, check corners
        if (dir.cost === MOVEMENT.TILE_COST_DIAGONAL) {
          const corner1Blocked = this.scene.isUnitAt(current.x, y) || this.isObstacle(current.x, y);
          const corner2Blocked = this.scene.isUnitAt(x, current.y) || this.isObstacle(x, current.y);
          if (corner1Blocked && corner2Blocked) {
            continue;
          }
        }
        
        const key = `${x},${y}`;
        
        if (!visited.has(key) || newCost < visited.get(key)) {
          visited.set(key, newCost);
          
          // Calculate AP cost based on movement points
          // 0-4 MP = 1 AP, 4.1-8 MP = 2 AP
          const apCost = newCost <= MOVEMENT.BASE_SPEED ? 1 : 2;
          
          // Only add to range if it's not the starting position
          if (x !== startX || y !== startY) {
            range.push({ x, y, cost: newCost, apCost });
          }
          
          queue.push({ x, y, cost: newCost });
        }
      }
    }
    
    return range;
  }
  
  // Update path preview based on mouse position
  updatePathPreview(mouseX, mouseY) {
    if (!this.unit) return;
    
    // Convert mouse position to grid coordinates
    const gridX = Math.floor(mouseX / TILE_SIZE);
    const gridY = Math.floor(mouseY / TILE_SIZE);
    
    // Clear previous path
    if (this.pathGraphics) {
      this.pathGraphics.clear();
    }
    
    // Use the mouse path if we have one, otherwise use direct path
    let path = [];
    
    if (this.mousePath.length > 0) {
      // Use the actual mouse path
      path = [...this.mousePath];
      
      // Add current grid position if it's different from the last point
      const lastPoint = path[path.length - 1];
      if (lastPoint.x !== gridX || lastPoint.y !== gridY) {
        path.push({ x: gridX, y: gridY });
      }
    } else {
      // Fall back to direct path if no mouse path is available
      path = this.findPath(this.unit.gridX, this.unit.gridY, gridX, gridY);
    }
    
    // Filter out invalid moves and limit to movement range
    const validPath = [];
    let currentX = this.unit.gridX;
    let currentY = this.unit.gridY;
    
    // Calculate total available movement points (AP * BASE_SPEED)
    let remainingMP = this.unit.actionPoints * MOVEMENT.BASE_SPEED;
    
    for (const point of path) {
      const dx = point.x - currentX;
      const dy = point.y - currentY;
      
      // Only allow single-tile moves (orthogonal or diagonal)
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        console.log('Multi-tile move detected, breaking path');
        break;
      }
      
      // Skip if we haven't moved
      if (dx === 0 && dy === 0) {
        continue;
      }
      
      // Calculate move cost
      const isDiagonal = dx !== 0 && dy !== 0;
      const moveCost = isDiagonal ? MOVEMENT.TILE_COST_DIAGONAL : MOVEMENT.TILE_COST_ORTHOGONAL;
      
      console.log(`Move from (${currentX},${currentY}) to (${point.x},${point.y}) - Cost: ${moveCost} MP, Remaining: ${remainingMP} MP`);
      
      // Check if we have enough MP left
      if (moveCost > remainingMP) {
        console.log('Not enough MP for move, stopping path');
        break;
      }
      
      // Check if the tile is walkable
      if ((point.x !== this.unit.gridX || point.y !== this.unit.gridY) && 
          (this.isObstacle(point.x, point.y) || this.scene.isUnitAt(point.x, point.y))) {
        break;
      }
      
      // For diagonal moves, check corners
      if (isDiagonal) {
        const corner1Blocked = this.scene.isUnitAt(currentX, point.y) || this.isObstacle(currentX, point.y);
        const corner2Blocked = this.scene.isUnitAt(point.x, currentY) || this.isObstacle(point.x, currentY);
        if (corner1Blocked && corner2Blocked) {
          break;
        }
      }
      
      // Add to path and update position/MP
      validPath.push({ x: point.x, y: point.y });
      currentX = point.x;
      currentY = point.y;
      remainingMP -= moveCost;
    }
    
    this.currentPath = validPath;
    this.drawPathPreview();
  }
  
  // Find path using A* algorithm
  findPath(startX, startY, targetX, targetY) {
    // Simple implementation - replace with A* if needed
    const path = [];
    let x = startX;
    let y = startY;
    
    while (x !== targetX || y !== targetY) {
      const dx = targetX > x ? 1 : targetX < x ? -1 : 0;
      const dy = targetY > y ? 1 : targetY < y ? -1 : 0;
      
      x += dx;
      y += dy;
      
      // Check if the tile is walkable
      if (this.isObstacle(x, y) || this.scene.isUnitAt(x, y)) {
        break;
      }
      
      path.push({ x, y });
    }
    
    return path;
  }
  
  // Draw the path preview
  drawPathPreview() {
    if (!this.pathGraphics || !this.currentPath || this.currentPath.length === 0) return;
    
    this.pathGraphics.clear();
    this.pathGraphics.lineStyle(2, 0xffffff, 0.8);
    
    // Start from unit's position
    let lastX = this.unit.gridX * TILE_SIZE + TILE_SIZE / 2;
    let lastY = this.unit.gridY * TILE_SIZE + TILE_SIZE / 2;
    
    // Draw line to each point in the path
    this.pathGraphics.beginPath();
    this.pathGraphics.moveTo(lastX, lastY);
    
    for (const point of this.currentPath) {
      const x = point.x * TILE_SIZE + TILE_SIZE / 2;
      const y = point.y * TILE_SIZE + TILE_SIZE / 2;
      
      this.pathGraphics.lineTo(x, y);
      lastX = x;
      lastY = y;
    }
    
    this.pathGraphics.strokePath();
    
    // Draw arrow heads at each segment
    lastX = this.unit.gridX * TILE_SIZE + TILE_SIZE / 2;
    lastY = this.unit.gridY * TILE_SIZE + TILE_SIZE / 2;
    
    for (const point of this.currentPath) {
      const x = point.x * TILE_SIZE + TILE_SIZE / 2;
      const y = point.y * TILE_SIZE + TILE_SIZE / 2;
      
      this.drawArrow(lastX, lastY, x, y);
      lastX = x;
      lastY = y;
    }
  }
}
