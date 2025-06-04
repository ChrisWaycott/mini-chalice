import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  constructor(){
    super('Game');
  }
  create(){
    this.add.text(10,10,'Mini‑Chalice').setFontSize(24);
    this.add.image(400,300,'hero').setScale(4);
  }
}
