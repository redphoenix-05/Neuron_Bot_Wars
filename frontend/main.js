// FILE: frontend/main.js
'use strict';

class NeuroBotwarsVisualizer {
  constructor() {
    this.engine = null;
    this.sceneSetup = null;
    this.isRunning = false;
    this.uiInterval = null;
    this.init();
  }

  init() {
    const container = document.getElementById('game-container');
    if (!container) { console.error('game-container not found'); return; }
    this.sceneSetup = new SceneSetup(container);
    this.setupButtons();
    this.log('Ready. Press START to begin.');
  }

  setupButtons() {
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('reset-btn').addEventListener('click', () => this.resetGame());
  }

  startGame() {
    if (this.isRunning) return;
    this.isRunning = true;
    document.getElementById('start-btn').disabled = true;
    document.getElementById('pause-btn').disabled = false;
    this.engine = new CoreEngine();
    this.engine.init(this.sceneSetup);
    this.log('Game started!');
    this.uiInterval = setInterval(() => this.updateUI(), 200);
  }

  togglePause() {
    if (!this.engine) return;
    if (this.engine.isPaused_) {
      this.engine.resume();
      document.getElementById('pause-btn').textContent = 'PAUSE';
      this.log('Resumed.');
    } else {
      this.engine.pause();
      document.getElementById('pause-btn').textContent = 'RESUME';
      this.log('Paused.');
    }
  }

  resetGame() {
    if (this.engine) { this.engine.stop(); this.engine = null; }
    if (this.uiInterval) { clearInterval(this.uiInterval); this.uiInterval = null; }
    this.isRunning = false;
    document.getElementById('start-btn').disabled = false;
    document.getElementById('start-btn').textContent = 'START';
    document.getElementById('pause-btn').disabled = true;
    document.getElementById('pause-btn').textContent = 'PAUSE';
    // Remove end screen if present
    var es = document.getElementById('end-screen');
    if (es) es.remove();
    // Remove banner messages
    var banner = document.getElementById('banner');
    if (banner) banner.innerHTML = '';
    this.log('Reset. Press START to play again.');
  }

  updateUI() {
    if (!this.engine) return;
    var phase = this.engine.getPhase();
    var phases = {
      maze: 'Maze Navigation', transition: 'Transition',
      battle: 'Combat Arena', finished: 'Game Over'
    };
    var phaseEl = document.getElementById('phase-display');
    if (phaseEl) phaseEl.textContent = phases[phase] || phase;
    var turnEl = document.getElementById('turn-counter');
    if (turnEl) turnEl.textContent = this.engine.getTurnCount();
    // Sidebar HP bars (the overlay bars are updated by coreEngine itself)
    var aegisHp = this.engine.getAegisHP();
    var veloHp  = this.engine.getVeloHP();
    var aegisBar = document.getElementById('aegis-hp-bar');
    var veloBar  = document.getElementById('velo-hp-bar');
    if (aegisBar) aegisBar.style.width = Math.max(0, aegisHp) + '%';
    if (veloBar)  veloBar.style.width  = Math.max(0, veloHp)  + '%';
    var aegisText = document.getElementById('aegis-hp-text');
    var veloText  = document.getElementById('velo-hp-text');
    if (aegisText) aegisText.textContent = Math.max(0, aegisHp) + '/100';
    if (veloText)  veloText.textContent  = Math.max(0, veloHp)  + '/100';
  }

  log(msg) {
    console.log('[Visualizer] ' + msg);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  window.visualizer = new NeuroBotwarsVisualizer();
});
