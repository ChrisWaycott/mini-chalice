import { TILE, COLORS, MOVEMENT } from '../constants';
import PriorityQueue from '../utils/PriorityQueue';

// Hex grid directions for flat-top hexes (q, r, s) where q + r + s = 0
const HEX_DIRECTIONS = [
  { q: 1, r: 0, s: -1 },   // E
  { q: 1, r: -1, s: 0 },  // NE
  { q: 0, r: -1, s: 1 },  // NW
  { q: -1, r: 0, s: 1 },  // W
  { q: -1, r: 1, s: 0 },  // SW
  { q: 0, r: 1, s: -1 }   // SE
];

/**
 * Hex utility functions
 */

// Convert hex coordinates to a string key
const hexKey = (q, r) => `${q},${r}`;

// Calculate distance between two hex coordinates
const hexDistance = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;

/**
 * Get all 6 adjacent hexes for a given position
 */
const getHexNeighbors = (q, r) => {
  return [
    { q: q + 1, r: r },     // E
    { q: q + 1, r: r - 1 }, // NE
    { q: q, r: r - 1 },     // NW
    { q: q - 1, r: r },     // W
    { q: q - 1, r: r + 1 }, // SW
    { q: q, r: r + 1 }      // SE
  ];
};

/**
 * Get all hexes in a ring around center with given radius
 */
const hexRing = (center, radius) => {
  const results = [];
  if (radius === 0) return [center];
  
  // Start at the top and move around the ring
  let hex = { q: center.q, r: center.r - radius };
  
  // Move in each of the 6 directions around the ring
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push({ q: hex.q, r: hex.r });
      const dir = HEX_DIRECTIONS[(i + 2) % 6]; // +2 for clockwise movement
      hex = { q: hex.q + dir.q, r: hex.r + dir.r };
    }
  }
  
  return results;
};

/**
 * Get all hexes in range of center (including center)
 */
const getHexesInRange = (center, radius) => {
  const results = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      const s = -q - r;
      if (Math.abs(s) <= radius) {
        results.push({
          q: center.q + q,
          r: center.r + r
        });
      }
    }
  }
  return results;
};

/**
 * MovementSystem handles all movement-related functionality for units on a hex grid
 */
export default class MovementSystem {
  constructor(scene) {
    // Store a reference to the scene without modifying it
    this._scene = scene;
    
    // Movement state
    this.unit = null;               // Currently selected unit
    this.obstacles = new Set();     // Set of obstacle coordinates as strings 'q,r'
    this.movementRange = [];        // Tiles the unit can move to
    this.currentPath = [];          // Current path being previewed
    this.movementCosts = new Map(); // Movement costs for each tile
    this.range = 3;                 // Default movement range
    
    // Graphics layers
    this.rangeGraphics = null;      // For movement range overlay
    this.pathGraphics = null;       // For path preview
    this.rangeTexts = [];           // Text objects for movement costs
    
    // Debug
    this.debug = false;
    
    // Initialize graphics
    this.initGraphics();
  }
  
  /**
   * Get the scene instance
   */
  get scene() {
    return this._scene;
  }
  
  /**
   * Set the scene instance
   */
  set scene(value) {
    this._scene = value;
  }
  
  // Initialize graphics objects
  initGraphics() {
    if (!this._scene) {
      console.warn('MovementSystem: Cannot initialize graphics - scene not available');
      return;
    }
    
    // Create graphics objects if they don't exist
    if (!this.rangeGraphics) {
      this.rangeGraphics = this._scene.add.graphics();
    }
    
    if (!this.pathGraphics) {
      this.pathGraphics = this._scene.add.graphics();
    }
    
    // Clear any existing texts
    this.clearTexts();
  }
  
  // Add an obstacle at the given grid coordinates
  addObstacle(q, r) {
    this.obstacles.add(hexKey(q, r));
  }
  
  // Remove an obstacle at the given grid coordinates
  removeObstacle(q, r) {
    this.obstacles.delete(hexKey(q, r));
  }
  
  /**
   * Check if a hex is walkable
   */
  isWalkable(q, r) {
    // Check if out of bounds
    if (!this.scene.isInBounds(q, r)) {
      return false;
    }
    
    // Check if there's an obstacle
    if (this.obstacles.has(hexKey(q, r))) {
      return false;
    }
    
    // Check if there's a unit at this position
    if (this.scene.isUnitAt(q, r)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get walkable neighbors for a hex with their movement costs
   */
  getWalkableNeighbors(q, r) {
    const neighbors = [];
    
    for (const dir of HEX_DIRECTIONS) {
      const nq = q + dir.q;
      const nr = r + dir.r;
      
      if (this.isWalkable(nq, nr)) {
        const cost = this.getMovementCost(nq, nr);
        neighbors.push({ q: nq, r: nr, cost });
      }
    }
    
    return neighbors;
  }
  
  /**
   * Get movement cost for a tile
   * Override this method to implement terrain-based movement costs
   */
  getMovementCost(q, r) {
    // Default movement cost is 1 per hex
    // You can add terrain-based costs here
    return 1;
  }
  
  /**
   * Calculate movement range from a starting position using Dijkstra's algorithm
   * @param {number} startQ - Starting q coordinate
   * @param {number} startR - Starting r coordinate
   * @param {number} movementPoints - Maximum movement points available
   * @returns {Array} Array of reachable {q, r, cost} positions
   */
  calculateMovementRange(startQ, startR, movementPoints) {
    const openSet = new PriorityQueue((a, b) => a.cost - b.cost);
    const movementCosts = new Map();
    const movementRange = [];
    
    // Add start position with cost 0
    openSet.enqueue({ q: startQ, r: startR, cost: 0 });
    movementCosts.set(hexKey(startQ, startR), 0);

    while (!openSet.isEmpty()) {
      const current = openSet.dequeue();
      const currentKey = hexKey(current.q, current.r);
      
      // Skip if we've already found a better path to this node
      if (current.cost > (movementCosts.get(currentKey) || Infinity)) {
        continue;
      }
      
      // Add to movement range if not the start position
      if (current.cost > 0) {
        movementRange.push({ 
          q: current.q, 
          r: current.r, 
          cost: current.cost 
        });
      }
      
      // Check all 6 directions
      for (const neighbor of getHexNeighbors(current.q, current.r)) {
        // Skip if out of bounds or not walkable
        if (!this.scene.isInBounds(neighbor.q, neighbor.r) || 
            !this.isWalkable(neighbor.q, neighbor.r)) {
          continue;
        }
        
        // Calculate movement cost (can be modified for different terrain costs)
        const moveCost = this.getMovementCost(neighbor.q, neighbor.r);
        const newCost = current.cost + moveCost;
        
        // Skip if exceeds movement points
        if (newCost > movementPoints) {
          continue;
        }
        
        const neighborKey = hexKey(neighbor.q, neighbor.r);
        const existingCost = movementCosts.get(neighborKey) || Infinity;
        
        // If we found a better path to this neighbor
        if (newCost < existingCost) {
          movementCosts.set(neighborKey, newCost);
          openSet.enqueue({
            q: neighbor.q,
            r: neighbor.r,
            cost: newCost
          });
        }
      }
    }
    
    this.movementRange = movementRange;
    this.movementCosts = movementCosts;
    
    if (this.debug) {
      this.debugMovementRange(movementRange);
    }
    
    return movementRange;
  }
  
  /**
   * Find path from start to target using A* algorithm
   * @param {number} startQ - Starting q coordinate
   * @param {number} startR - Starting r coordinate
   * @param {number} targetQ - Target q coordinate
   * @param {number} targetR - Target r coordinate
   * @returns {Array} Array of {q, r} positions representing the path
   */
  findPath(startQ, startR, targetQ, targetR) {
    const startKey = hexKey(startQ, startR);
    const targetKey = hexKey(targetQ, targetR);
    
    // If target is the same as start
    if (startKey === targetKey) {
      return [];
    }
    
    // If target is not walkable (unless it's the actual target with a unit)
    if (!this.isWalkable(targetQ, targetR) && !this.scene.isUnitAt(targetQ, targetR)) {
      return [];
    }
    
    const openSet = new PriorityQueue((a, b) => a.fScore - b.fScore);
    const cameFrom = new Map();
    
    // gScore[node] = cost from start to node
    const gScore = new Map();
    gScore.set(startKey, 0);
    
    // fScore[node] = gScore[node] + h(node)
    const fScore = new Map();
    fScore.set(startKey, hexDistance({ q: startQ, r: startR }, { q: targetQ, r: targetR }));
    
    openSet.enqueue({
      q: startQ,
      r: startR,
      fScore: fScore.get(startKey)
    });
    
    while (!openSet.isEmpty()) {
      const current = openSet.dequeue();
      const currentKey = hexKey(current.q, current.r);
      
      // Reconstruct path if we've reached the target
      if (currentKey === targetKey) {
        return this.reconstructPath(cameFrom, currentKey, startKey);
      }
      
      // Check all 6 directions
      for (const neighbor of getHexNeighbors(current.q, current.r)) {
        // Skip if out of bounds
        if (!this.scene.isInBounds(neighbor.q, neighbor.r)) {
          continue;
        }
        
        const neighborKey = hexKey(neighbor.q, neighbor.r);
        
        // Skip if not walkable (unless it's the target)
        if (neighborKey !== targetKey && !this.isWalkable(neighbor.q, neighbor.r)) {
          continue;
        }
        
        // Calculate movement cost
        const moveCost = this.getMovementCost(neighbor.q, neighbor.r);
        const tentativeGScore = (gScore.get(currentKey) || Infinity) + moveCost;
        
        // If we haven't visited this node yet, or found a better path
        if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeGScore);
          
          // Calculate heuristic (hex distance)
          const h = hexDistance(
            { q: neighbor.q, r: neighbor.r },
            { q: targetQ, r: targetR }
          );
          
          const newFScore = tentativeGScore + h;
          fScore.set(neighborKey, newFScore);
          
          // Add to open set if not already there
          if (!openSet.has(neighborKey, (item) => hexKey(item.q, item.r) === neighborKey)) {
            openSet.enqueue({
              q: neighbor.q,
              r: neighbor.r,
              fScore: newFScore
            });
          }
        }
      }
    }
    
    // No path found
    return [];
  }
  
  /**
   * Reconstruct path from cameFrom map
   */
  reconstructPath(cameFrom, currentKey, startKey) {
    const path = [];
    
    while (currentKey && currentKey !== startKey) {
      const [q, r] = currentKey.split(',').map(Number);
      path.unshift({ q, r });
      currentKey = cameFrom.get(currentKey);
    }
    
    return path;
  }
  
  /**
   * Check if a position is within movement range
   * @param {number} q - q coordinate
   * @param {number} r - r coordinate
   * @returns {boolean} True if position is in movement range
   */
  isInMovementRange(q, r) {
    return this.movementCosts.has(hexKey(q, r));
  }
  
  /**
   * Set the current unit and calculate its movement range
   * @param {Phaser.GameObjects.GameObject} unit - The unit to set
   */
  setUnit(unit) {
    this.unit = unit;
    if (unit) {
      const q = unit.getData('q');
      const r = unit.getData('r');
      const movementPoints = unit.getData('movementPoints') || this.range;
      this.calculateMovementRange(q, r, movementPoints);
    } else {
      this.clearMovementRange();
    }
  }
  
  /**
   * Update unit position in the movement system
   * @param {number} oldQ - Previous q coordinate
   * @param {number} oldR - Previous r coordinate
   * @param {number} newQ - New q coordinate
   * @param {number} newR - New r coordinate
   */
  updateUnitPosition(oldQ, oldR, newQ, newR) {
    // Remove old position from obstacles
    this.obstacles.delete(hexKey(oldQ, oldR));
    
    // Add new position to obstacles if there's a unit there
    if (this.scene.isUnitAt(newQ, newR)) {
      this.obstacles.add(hexKey(newQ, newR));
    }
  }
  
  /**
   * Set a path to the target position
   * @param {number} targetQ - Target q coordinate
   * @param {number} targetR - Target r coordinate
   * @returns {boolean} True if a valid path was found
   */
  setPathTo(targetQ, targetR) {
    if (!this.unit) return false;
    
    const q = this.unit.getData('q');
    const r = this.unit.getData('r');
    
    this.currentPath = this.findPath(q, r, targetQ, targetR);
    
    if (this.currentPath.length > 0) {
      // Remove the starting position from the path
      this.currentPath.shift();
      return true;
    }
    
    return false;
  }
  
  /**
   * Execute the current movement path
   * @returns {Promise} Resolves when movement is complete
   */
  async executeMovement() {
    if (!this.unit || this.currentPath.length === 0) {
      return Promise.resolve();
    }
    
    const unit = this.unit;
    let totalCost = 0;
    
    // Calculate total movement cost
    for (const { q, r } of this.currentPath) {
      totalCost += this.getMovementCost(q, r);
    }
    
    // Deduct movement points from unit
    const movementPoints = unit.getData('movementPoints') || 0;
    unit.setData('movementPoints', Math.max(0, movementPoints - totalCost));
    
    // Move the unit along the path
    for (const { q, r } of this.currentPath) {
      const worldPos = this.scene.hexToPixel(q, r);
      await new Promise(resolve => {
        this.scene.tweens.add({
          targets: unit,
          x: worldPos.x,
          y: worldPos.y,
          duration: 200,
          ease: 'Power1',
          onComplete: resolve
        });
      });
    }
    
    this.currentPath = [];
    return Promise.resolve();
  }
  
  /**
   * Draw the movement range on the grid
   */
  drawMovementRange() {
    this.rangeGraphics.clear();
    this.rangeTexts.forEach(text => text.destroy());
    this.rangeTexts = [];
    
    this.movementRange.forEach(tile => {
      const worldPos = this.scene.hexToPixel(tile.q, tile.r);
      
      // Draw movement range tile
      this.rangeGraphics.fillStyle(0x00ff00, 0.3);
      this.rangeGraphics.fillPoints(this.scene.hexTileToPolygon(tile.q, tile.r).points, true);
      
      // Draw movement cost
      const text = this.scene.add.text(
        worldPos.x,
        worldPos.y,
        tile.cost.toString(),
        { 
          font: '16px Arial',
          fill: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3
        }
      );
      text.setOrigin(0.5);
      text.setDepth(100);
      this.rangeTexts.push(text);
    });
  }
  
  /**
   * Draw the current path preview
   */
  drawPathPreview() {
    this.pathGraphics.clear();
    
    if (this.currentPath.length === 0) {
      return;
    }
    
    // Draw path lines
    this.pathGraphics.lineStyle(2, 0x00ff00, 1);
    
    // Get unit's current position
    let lastPos = this.scene.hexToPixel(
      this.unit.getData('q'),
      this.unit.getData('r')
    );
    
    // Draw line from unit to first path point
    const firstStep = this.currentPath[0];
    const firstPos = this.scene.hexToPixel(firstStep.q, firstStep.r);
    this.pathGraphics.beginPath();
    this.pathGraphics.moveTo(lastPos.x, lastPos.y);
    this.pathGraphics.lineTo(firstPos.x, firstPos.y);
    this.pathGraphics.strokePath();
    
    // Draw lines between path points
    for (let i = 1; i < this.currentPath.length; i++) {
      const step = this.currentPath[i];
      const nextPos = this.scene.hexToPixel(step.q, step.r);
      
      this.pathGraphics.beginPath();
      this.pathGraphics.moveTo(lastPos.x, lastPos.y);
      this.pathGraphics.lineTo(nextPos.x, nextPos.y);
      this.pathGraphics.strokePath();
      
      lastPos = nextPos;
    }
    
    // Draw arrow head at the end of the path
    if (this.currentPath.length > 0) {
      const lastStep = this.currentPath[this.currentPath.length - 1];
      const lastPos2 = this.scene.hexToPixel(lastStep.q, lastStep.r);
      this.drawArrowHead(lastPos.x, lastPos.y, lastPos2.x, lastPos2.y);
    }
  }
  
  /**
   * Draw an arrow head at the end of the path
   */
  drawArrowHead(x1, y1, x2, y2) {
    const headLength = 10;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    
    this.pathGraphics.lineStyle(2, 0x00ff00, 1);
    this.pathGraphics.beginPath();
    this.pathGraphics.moveTo(x2, y2);
    this.pathGraphics.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.pathGraphics.moveTo(x2, y2);
    this.pathGraphics.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.pathGraphics.strokePath();
  }
  
  /**
   * Clear movement range and path
   */
  clearMovementRange() {
    this.movementRange = [];
    this.movementCosts.clear();
    this.currentPath = [];
    this.clearGraphics();
  }
  
  /**
   * Clear all text objects
   */
  clearTexts() {
    if (this.rangeTexts && this.rangeTexts.length > 0) {
      this.rangeTexts.forEach(text => {
        if (text && typeof text.destroy === 'function') {
          text.destroy();
        }
      });
      this.rangeTexts = [];
    }
  }
  
  /**
   * Clear all graphics
   */
  clearGraphics() {
    if (this.rangeGraphics) this.rangeGraphics.clear();
    if (this.pathGraphics) this.pathGraphics.clear();
    this.clearTexts();
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.clearGraphics();
    
    // Clean up graphics objects
    if (this.rangeGraphics) {
      this.rangeGraphics.destroy();
      this.rangeGraphics = null;
    }
    
    if (this.pathGraphics) {
      this.pathGraphics.destroy();
      this.pathGraphics = null;
    }
    
    // Clear all arrays and maps
    this.clearTexts();
    this.rangeTexts = [];
    this.unit = null;
    this.obstacles.clear();
    this.movementRange = [];
    this.currentPath = [];
    this.movementCosts.clear();
    this._scene = null;
  }
}
