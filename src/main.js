import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  backgroundColor: '#2d2d2d',
  scene: [BootScene, GameScene],
  pixelArt: true,
  physics: { default: 'arcade' }
};

window.game = new Phaser.Game(config);
