// src/constants.js
export const TILE_SIZE      = 64;
export const MOVE_TWEEN_MS  = 240;

// Vision system
export const VISION = {
  BASE_RANGE: 3,        // Base vision range in tiles
  INCREASED_RANGE: 4,
  UNEXPLORED_OPACITY: 1.0 // Opacity for unexplored areas
};

export const TILE = {
  CLEAN:    'stone_clean',
  CRACKED:  'stone_cracked',
  CORRUPT:  'stone_corrupt',
};

export const ENEMY = {
  UNDEAD: 'zombie', // asset key unchanged
};

export const MOVEMENT = {
  BASE_SPEED: 4,          // Tiles per AP (from glossary)
  DIAGONAL_COST: 1.5,    // Movement point multiplier for diagonal movement
  ACTION_POINTS: 2,      // AP per turn
  TILE_COST_ORTHOGONAL: 1, // Movement points per orthogonal tile
  TILE_COST_DIAGONAL: 1.5  // Movement points per diagonal tile
};