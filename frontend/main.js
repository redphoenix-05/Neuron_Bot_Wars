/**
 * Main Application Module
 * Orchestrates the game visualization — wires GameEngine, AnimationController,
 * and all visuals into a single animation loop.
 */

class NeuroBotwarsVisualizer {
  constructor() {
    // ── Core systems ──
    this.sceneSetup          = null;
    this.gridRenderer        = null;
    this.aegisVisual         = null;
    this.veloVisual          = null;
    this.arenaVisual         = null;
    this.gameEngine          = new GameEngine();
    this.animationController = new AnimationController();

    // ── Timing ──
    this.lastFrameTime = Date.now();
    this.isSimulationRunning = false;

    // ── UI refs ──
    this.ui = {};

    this.init();
  }

  // ════════════════════════════════════════
  //   INITIALISATION
  // ════════════════════════════════════════
  init() {
    try {
      this.log('Creating scene...');
      const container = document.getElementById('game-container');
      if (!container) throw new Error('game-container not found');

      this.sceneSetup = new SceneSetup(container);
      this.log('Scene created');

      // Grid + maze
      this.gridRenderer = new GridRenderer(this.sceneSetup.getScene(), gameState);
      this.log('Grid created');

      // Agents
      this.aegisVisual = new AegisVisual(this.sceneSetup.getScene(), gameState);
      this.veloVisual  = new VeloVisual(this.sceneSetup.getScene(), gameState);
      this.log('Agents created');

      // Arena
      this.arenaVisual = new ArenaVisual(this.sceneSetup.getScene(), gameState);
      this.arenaVisual.hide(); // hidden during maze
      this.log('Arena created (hidden)');

      // Lights
      this.sceneSetup.setupArenaLights();

      // UI
      this.setupUI();
      this.wireEngineEvents();

      // Start animation loop
      this.animate();
      this.log('Visualizer ready!');
    } catch (err) {
      this.log(`ERROR: ${err.message}`);
      console.error('Init error:', err);
    }
  }

  // ════════════════════════════════════════
  //   UI SETUP
  // ════════════════════════════════════════
  setupUI() {
    this.ui.aegisHPBar  = document.getElementById('aegis-hp-bar');
    this.ui.veloHPBar   = document.getElementById('velo-hp-bar');
    this.ui.turnCounter = document.getElementById('turn-counter');
    this.ui.phaseDisplay= document.getElementById('phase-display');
    this.ui.aegisHPText = document.getElementById('aegis-hp-text');
    this.ui.veloHPText  = document.getElementById('velo-hp-text');

    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('reset-btn').addEventListener('click', () => this.resetGame());

    this.createDebugPanel();
  }

  createDebugPanel() {
    let panel = document.getElementById('debug-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'debug-panel';
      panel.style.cssText = `
        position:fixed; bottom:10px; right:10px; width:380px; height:220px;
        background:rgba(0,0,0,0.92); border:2px solid #00ff88; border-radius:5px;
        padding:10px; font-family:monospace; font-size:11px; color:#00ff88;
        overflow-y:auto; z-index:10000;
      `;
      document.body.appendChild(panel);
    }
    this.ui.debugPanel = panel;
  }

  log(message) {
    console.log(`[Visualizer] ${message}`);
    if (this.ui.debugPanel) {
      const t = new Date().toLocaleTimeString();
      const line = document.createElement('div');
      line.textContent = `[${t}] ${message}`;
      this.ui.debugPanel.appendChild(line);
      this.ui.debugPanel.scrollTop = this.ui.debugPanel.scrollHeight;
      while (this.ui.debugPanel.children.length > 60) {
        this.ui.debugPanel.removeChild(this.ui.debugPanel.firstChild);
      }
    }
  }

  // ════════════════════════════════════════
  //   ENGINE EVENT WIRING
  // ════════════════════════════════════════
  wireEngineEvents() {
    const engine = this.gameEngine;

    // ── Agent move ──
    engine.on('agentMove', (data) => {
      const { agent, from, to, instant } = data;
      const visual = agent === 'aegis' ? this.aegisVisual : this.veloVisual;

      if (instant) {
        // Teleport (e.g. battle spawn)
        visual.setGridPosition(to.x, to.y, true);
        return;
      }

      // Smooth animated move
      visual.setGridPosition(to.x, to.y, false);
      const fromWorld = gameState.gridToWorld(from.x, from.y);
      const toWorld   = gameState.gridToWorld(to.x, to.y);

      const speed = agent === 'aegis' ? 0.35 : 0.25; // VELO faster

      gameState.animating = true;
      this.animationController.addAnimation(
        `${agent}-move`,
        fromWorld, toWorld, speed,
        {
          onUpdate: (pos, progress) => {
            visual.group.position.set(pos.x, 0.3 + Math.sin(progress * Math.PI) * 0.08, pos.z);
          },
          onComplete: () => {
            visual.syncPosition();
            gameState.animating = false;
          }
        }
      );
    });

    // ── State change ──
    engine.on('stateChange', (data) => {
      this.log(`Phase: ${data.from} → ${data.to}`);

      if (data.to === 'transition') {
        this.handleTransitionStart();
      } else if (data.to === 'battle') {
        this.handleBattleStart();
      } else if (data.to === 'finished') {
        this.handleGameFinished();
      }
    });

    // ── Transition progress ──
    engine.on('transitionProgress', (data) => {
      // Smooth camera zoom during transition
      const camY = 10 - data.progress * 2; // 10 → 8
      this.sceneSetup.getCamera().position.y = camY;
    });

    // ── Damage ──
    engine.on('damage', (data) => {
      const visual = data.agent === 'aegis' ? this.aegisVisual : this.veloVisual;
      visual.animateDamage();
    });

    // ── Attack visual ──
    engine.on('attack', (data) => {
      this.arenaVisual.createBattleFlash();
    });

    // ── Trap activation ──
    engine.on('trapActivate', (data) => {
      if (this.gridRenderer.activateTrap) {
        this.gridRenderer.activateTrap(data.x, data.y);
      }
    });

    // ── Game over ──
    engine.on('gameOver', (data) => {
      this.log(`🏆 GAME OVER — Winner: ${data.winner}`);
    });

    // ── Debug log forwarding ──
    engine.on('debugLog', (data) => {
      this.log(data.message);
    });
  }

  // ════════════════════════════════════════
  //   PHASE HANDLERS
  // ════════════════════════════════════════
  handleTransitionStart() {
    this.log('Transition: hiding maze, showing arena...');
    // Fade/hide maze, show arena
    if (this.gridRenderer.hideMaze) this.gridRenderer.hideMaze();
    this.arenaVisual.show();
    this.arenaVisual.activateCombat();
    this.sceneSetup.setArenaLightIntensity(0.8);
  }

  handleBattleStart() {
    this.log('Battle phase started!');
    // Ensure agents are at correct battle positions visually
    this.aegisVisual.syncPosition();
    this.veloVisual.syncPosition();
  }

  handleGameFinished() {
    this.isSimulationRunning = false;
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.disabled = false;
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.disabled = true;
  }

  // ════════════════════════════════════════
  //   GAME CONTROLS
  // ════════════════════════════════════════
  startGame() {
    if (this.isSimulationRunning) {
      this.log('Game already running');
      return;
    }

    this.log('Starting new game...');
    this.isSimulationRunning = true;
    document.getElementById('start-btn').disabled = true;
    document.getElementById('pause-btn').disabled = false;

    // Reset visuals
    this.animationController.clear();
    this.arenaVisual.hide();
    if (this.gridRenderer.showMaze) this.gridRenderer.showMaze();
    this.sceneSetup.setArenaLightIntensity(0);
    this.sceneSetup.getCamera().position.set(0, 10, 0);

    // Start engine (handles gameState.reset + trap gen + pathfinding)
    this.gameEngine.start();

    // Rebuild grid visuals for new traps
    this.gridRenderer.rebuildTraps();

    // Place agent visuals at spawn
    this.aegisVisual.setGridPosition(gameState.aegis.x, gameState.aegis.y, true);
    this.veloVisual.setGridPosition(gameState.velo.x, gameState.velo.y, true);

    this.log('Game started! Maze phase.');
  }

  togglePause() {
    if (!this.isSimulationRunning) return;
    if (this.gameEngine.isPaused) {
      this.gameEngine.resume();
      this.log('Resumed');
    } else {
      this.gameEngine.pause();
      this.log('Paused');
    }
  }

  resetGame() {
    this.log('Resetting...');
    this.gameEngine.stop();
    this.isSimulationRunning = false;
    this.animationController.clear();
    gameState.reset();

    this.aegisVisual.setGridPosition(gameState.aegis.x, gameState.aegis.y, true);
    this.veloVisual.setGridPosition(gameState.velo.x, gameState.velo.y, true);

    this.arenaVisual.hide();
    if (this.gridRenderer.showMaze) this.gridRenderer.showMaze();
    this.sceneSetup.setArenaLightIntensity(0);
    this.sceneSetup.getCamera().position.set(0, 10, 0);

    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;

    this.updateUI();
  }

  // ════════════════════════════════════════
  //   MAIN ANIMATION LOOP
  // ════════════════════════════════════════
  animate() {
    requestAnimationFrame(() => this.animate());

    // Delta time
    const now = Date.now();
    const dt  = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;

    // 1. Update game logic
    if (this.isSimulationRunning) {
      this.gameEngine.update(dt);
    }

    // 2. Update animations
    this.animationController.update(dt);

    // 3. Update agent idle animations (pulsing etc.)
    if (this.aegisVisual && this.aegisVisual.updateIdle) this.aegisVisual.updateIdle(dt);
    if (this.veloVisual  && this.veloVisual.updateIdle)  this.veloVisual.updateIdle(dt);

    // 4. Update UI
    this.updateUI();

    // 5. Render
    if (this.sceneSetup) this.sceneSetup.render();
  }

  updateUI() {
    if (!gameState.aegis) return;

    const aegisP = Math.max(0, (gameState.aegis.hp / gameState.aegis.maxHp) * 100);
    const veloP  = Math.max(0, (gameState.velo.hp  / gameState.velo.maxHp)  * 100);

    if (this.ui.aegisHPBar) this.ui.aegisHPBar.style.width = aegisP + '%';
    if (this.ui.veloHPBar)  this.ui.veloHPBar.style.width  = veloP  + '%';

    if (this.ui.aegisHPText) this.ui.aegisHPText.textContent = `${Math.max(0, gameState.aegis.hp)}/${gameState.aegis.maxHp}`;
    if (this.ui.veloHPText)  this.ui.veloHPText.textContent  = `${Math.max(0, gameState.velo.hp)}/${gameState.velo.maxHp}`;

    if (this.ui.turnCounter)  this.ui.turnCounter.textContent  = gameState.turnCount;

    if (this.ui.phaseDisplay) {
      const labels = {
        'maze':       'Maze Navigation',
        'transition': 'Transition',
        'battle':     'Combat Arena',
        'finished':   `Game Over${gameState.winner ? ' — ' + gameState.winner + ' wins!' : ''}`
      };
      this.ui.phaseDisplay.textContent = labels[gameState.phase] || gameState.phase;
    }
  }
}

// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', () => {
  window.visualizer = new NeuroBotwarsVisualizer();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NeuroBotwarsVisualizer;
}
