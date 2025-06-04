import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor(){
    super('Boot');
  }
  preload(){
    this.load.image('hero', '/assets/placeholder/hero.png');
  }
  create(){
    this.scene.start('Game');
  }
}
