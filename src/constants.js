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
  // Base movement points per AP (4 tiles per AP)
  BASE_SPEED: 4,           // Tiles per AP
  // Movement costs in movement points
  TILE_COST_ORTHOGONAL: 1,   // 1 MP per orthogonal tile
  TILE_COST_DIAGONAL: 1.5,   // 1.5 MP per diagonal tile
  // Maximum AP per turn
  ACTION_POINTS: 2,         // 2 AP per turn = 8 MP
  // Maximum movement per turn (2 AP * 4 tiles/AP = 8 MP)
  MAX_MOVEMENT_POINTS: 8    // 8 MP = 2 AP
};