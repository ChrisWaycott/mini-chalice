// src/utils/scaleToTile.js
import { TILE_SIZE } from '../constants.js';

/**
 * Scales any Phaser Sprite so its displayed width equals TILE_SIZE.
 * Call it immediately after you create (or change the texture of) a sprite.
 */
export function scaleToTile(sprite) {
  const frameW = sprite.frame.width;            // original pixel width of frame
  const ratio  = TILE_SIZE / frameW;            // e.g. 64 / 128 = 0.5  or 64 / 96 ≈ 0.667
  sprite.setScale(ratio);
}
