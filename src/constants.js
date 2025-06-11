// src/constants.js
export const TILE_SIZE      = 64;
export const MOVE_TWEEN_MS  = 240;

// Vision system
export const VISION = {
  BASE_RANGE: 3,        // Base vision range in tiles
  INCREASED_RANGE: 4,   // Vision range for units with enhanced vision
  EXPLORED_OPACITY: 0.6,// Opacity for explored but not visible areas
  UNEXPLORED_OPACITY: 0.9 // Opacity for unexplored areas
};

export const TILE = {
  CLEAN:    'stone_clean',
  CRACKED:  'stone_cracked',
  CORRUPT:  'stone_corrupt',
};

export const ENEMY = {
  UNDEAD: 'zombie', // asset key unchanged
};