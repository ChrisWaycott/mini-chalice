import { TILE_SIZE, MOVEMENT } from '../constants.js';

export default class MovementSystem {
  constructor(scene) {
    this.scene = scene;
    this.movementRange = [];
    this.movementGraphics = scene.add.graphics();
    this.movementGraphics.setDepth(5);
    this.obstacles = []; // Will store grid coordinates of obstacles
  }

  // Calculate movement range using BFS
  calculateRange(unit, maxCost = MOVEMENT.BASE_SPEED * MOVEMENT.ACTION_POINTS) {
    this.movementRange = [];
    this.movementGraphics.clear();

    const startX = Math.floor(unit.x / TILE_SIZE);
    const startY = Math.floor(unit.y / TILE_SIZE);
    
    const queue = [{ x: startX, y: startY, cost: 0, path: [] }];
    const visited = new Set([`${startX},${startY}`]);
    const range = [];

    while (queue.length > 0) {
      const current = queue.shift();
      range.push(current);

      // Check all 8 directions
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const nx = current.x + dx;
          const ny = current.y + dy;
          const key = `${nx},${ny}`;

          // Skip if out of bounds, obstacle, or already visited
          if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10 || 
              this.isObstacle(nx, ny) || 
              visited.has(key)) {
            continue;
          }

          // Calculate movement cost
          const isDiagonal = Math.abs(dx) === 1 && Math.abs(dy) === 1;
          const cost = current.cost + (isDiagonal ? MOVEMENT.DIAGONAL_COST : 1);
          
          if (cost <= maxCost) {
            visited.add(key);
            const path = [...current.path, { x: nx, y: ny }];
            queue.push({ x: nx, y: ny, cost, path });
          }
        }
      }
    }

    this.movementRange = range;
    return range;
  }

  // Draw movement range overlay
  showRange(range = this.movementRange) {
    this.movementGraphics.clear();
    
    range.forEach(tile => {
      const alpha = 0.2 + (1 - tile.cost / (MOVEMENT.BASE_SPEED * 2)) * 0.5;
      // Use orange tones: darker orange for 1AP, lighter orange/white for 2AP
      const color = tile.cost <= MOVEMENT.BASE_SPEED ? 0xFF8C00 : 0xFFD700;
      
      this.movementGraphics.fillStyle(color, alpha);
      this.movementGraphics.fillRect(
        tile.x * TILE_SIZE + 2,
        tile.y * TILE_SIZE + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4
      );
    });
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
  getPathTo(targetX, targetY) {
    const target = this.movementRange.find(
      tile => tile.x === targetX && tile.y === targetY
    );
    return target ? target.path : null;
  }
}
