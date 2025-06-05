import "./index.css";
import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: 640,
  height: 640,
  parent: "phaser-game",        // Phaser will insert its <canvas> here
  scene: [BootScene, GameScene],
  // …other config options
};

new Phaser.Game(config);
