/**
 * Main Application Module
 * Orchestrates the game visualization with proper game engine integration
 */

class NeuroBotwarsVisualizer {
  constructor() {
    // Scene and visuals
    this.sceneSetup = null;
    this.gridRenderer = null;
    this.aegisVisual = null;
    this.veloVisual = null;
    this.arenaVisual = null;
    
    // Game management
    this.gameEngine = null;
    this.animationController = null;
    this.isSimulationRunning = false;
    this.lastFrameTime = Date.now();
    
    // Agent visual positions (for interpolation)
    this.agentVisualPositions = {
      aegis: { x: gameState.aegis.x, y: gameState.aegis.y },
      velo: { x: gameState.velo.x, y: gameState.velo.y }
    };
    
    // UI references
    this.uiElements = {
      aegisHPBar: null,
      veloHPBar: null,
      turnCounter: null,
      phaseDisplay: null,
      startBtn: null,
      pauseBtn: null,
      resetBtn: null,
      debugPanel: null
    };
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize the visualizer
   */
  init() {
    this.log('Creating scene...');
    
    // Initialize scene
    const container = document.getElementById('game-container');
    this.sceneSetup = new SceneSetup(container);
    
    // Create game visuals
    this.gridRenderer = new GridRenderer(this.sceneSetup.getScene(), gameState);
    this.aegisVisual = new AegisVisual(this.sceneSetup.getScene(), gameState);
    this.veloVisual = new VeloVisual(this.sceneSetup.getScene(), gameState);
    this.arenaVisual = new ArenaVisual(this.sceneSetup.getScene(), gameState);
    
    // Setup arena lights
    this.sceneSetup.setupArenaLights();
    
    this.log('Creating game engine...');
    
    // Create game engine and animation controller
    this.gameEngine = new GameEngine();
    this.animationController = new AnimationController();
    
    // Setup UI
    this.setupUI();
    
    // Setup game engine callbacks
    this.setupGameEngineCallbacks();
    
    this.log('Starting animation loop...');
    
    // Start animation loop
    this.animate();
  }
  
  /**
   * Setup UI controls and references
   */
  setupUI() {
    this.uiElements.aegisHPBar = document.getElementById('aegis-hp-bar');
    this.uiElements.veloHPBar = document.getElementById('velo-hp-bar');
    this.uiElements.turnCounter = document.getElementById('turn-counter');
    this.uiElements.phaseDisplay = document.getElementById('phase-display');
    
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    this.uiElements.startBtn = startBtn;
    this.uiElements.pauseBtn = pauseBtn;
    this.uiElements.resetBtn = resetBtn;
    
    // Start button
    startBtn.addEventListener('click', () => this.startGame());
    
    // Pause button
    pauseBtn.addEventListener('click', () => this.togglePause());
    
    // Reset button
    resetBtn.addEventListener('click', () => this.resetGame());
    
    // Create debug panel
    this.createDebugPanel();
  }
  
  /**
   * Create debug panel
   */
  createDebugPanel() {
    let debugPanel = document.getElementById('debug-panel');
    if (!debugPanel) {
      debugPanel = document.createElement('div');
      debugPanel.id = 'debug-panel';
      debugPanel.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 350px;
        height: 200px;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #00ff88;
        border-radius: 5px;
        padding: 10px;
        font-family: monospace;
        font-size: 11px;
        color: #00ff88;
        overflow-y: auto;
        z-index: 10000;
      `;
      document.body.appendChild(debugPanel);
    }
    this.uiElements.debugPanel = debugPanel;
  }
  
  /**
   * Log to debug panel
   */
  log(message) {
    console.log(`[NeuroVisualizer] ${message}`);
    if (this.uiElements.debugPanel) {
      const time = new Date().toLocaleTimeString();
      const line = document.createElement('div');
      line.textContent = `[${time}] ${message}`;
      this.uiElements.debugPanel.appendChild(line);
      this.uiElements.debugPanel.scrollTop = this.uiElements.debugPanel.scrollHeight;
      
      // Keep only last 50 lines
      while (this.uiElements.debugPanel.children.length > 50) {
        this.uiElements.debugPanel.removeChild(this.uiElements.debugPanel.firstChild);
      }
    }
  }
  
  /**
   * Setup game engine callbacks
   */
  setupGameEngineCallbacks() {
    this.gameEngine.on('stateChange', (data) => {
      this.log(`State: ${data.from} -> ${data.to}`);
      
      if (data.to === 'transition') {
        this.sceneSetup.zoomToArena();
        this.arenaVisual.activateCombat();
        this.sceneSetup.setArenaLightIntensity(1);
      }
      
      this.updatePhaseDisplay();
    });
    
    this.gameEngine.on('turnStart', (data) => {
      this.log(`Turn ${data.turn} (${data.phase})`);
    });
    
    this.gameEngine.on('agentMove', (data) => {
      const agent = data.agent;
      const pos = data.pos;
      this.log(`${agent} -> [${pos[0]},${pos[1]}]`);
      
      // Animate movement
      this.animateAgentMovement(agent, pos);
    });
    
    this.gameEngine.on('damage', (data) => {
      const hp = gameState.getAgent(data.agent).hp;
      this.log(`${data.agent} -${data.damage} HP (${hp})`);
      
      if (data.agent === 'aegis') {
        this.aegisVisual.animateDamage();
      } else {
        this.veloVisual.animateDamage();
      }
    });
    
    this.gameEngine.on('trapActivate', (data) => {
      this.log(`TRAP at [${data.pos[0]},${data.pos[1]}]`);
      this.gridRenderer.activateTrap(data.pos[0], data.pos[1]);
    });
    
    this.gameEngine.on('gameOver', (data) => {
      this.log(`GAME OVER: ${data.winner}`);
      this.isSimulationRunning = false;
      this.uiElements.startBtn.disabled = false;
      this.uiElements.pauseBtn.disabled = true;
    });
  }
  
  /**
   * Animate agent movement
   */
  animateAgentMovement(agent, newPos) {
    const visual = agent === 'aegis' ? this.aegisVisual : this.veloVisual;
    const oldPos = this.agentVisualPositions[agent];
    const worldOldPos = gameState.gridToWorld(oldPos.x, oldPos.y);
    const worldNewPos = gameState.gridToWorld(newPos[0], newPos[1]);
    
    this.animationController.addAnimation(
      `${agent}-move`,
      worldOldPos,
      worldNewPos,
      0.3, // 300ms movement
      {
        onUpdate: (pos, progress) => {
          visual.group.position.set(pos.x, 0.3, pos.z);
        },
        onComplete: () => {
          this.agentVisualPositions[agent] = { x: newPos[0], y: newPos[1] };
        }
      }
    );
  }
  
  /**
   * Start game
   */
  startGame() {
    if (this.isSimulationRunning) return;
    
    this.log('Starting simulation...');
    this.isSimulationRunning = true;
    gameState.reset();
    this.gameEngine.initialize();
    this.gameEngine.start();
    this.lastFrameTime = Date.now();
    
    this.uiElements.startBtn.disabled = true;
    this.uiElements.pauseBtn.disabled = false;
  }
  
  /**
   * Toggle pause
   */
  togglePause() {
    if (this.gameEngine.isPaused) {
      this.gameEngine.resume();
      this.log('Game resumed');
      this.uiElements.pauseBtn.textContent = 'PAUSE';
    } else {
      this.gameEngine.pause();
      this.log('Game paused');
      this.uiElements.pauseBtn.textContent = 'RESUME';
    }
  }
  
  /**
   * Reset game
   */
  resetGame() {
    this.log('Resetting game...');
    this.gameEngine.stop();
    this.isSimulationRunning = false;
    gameState.reset();
    this.animationController.activeAnimations.clear();
    
    // Reset agent positions
    this.agentVisualPositions.aegis = { x: gameState.aegis.x, y: gameState.aegis.y };
    this.agentVisualPositions.velo = { x: gameState.velo.x, y: gameState.velo.y };
    
    this.aegisVisual.updatePosition();
    this.veloVisual.updatePosition();
    
    this.uiElements.startBtn.disabled = false;
    this.uiElements.pauseBtn.disabled = true;
    this.uiElements.pauseBtn.textContent = 'PAUSE';
    
    this.updatePhaseDisplay();
  }
  
  /**
   * Update phase display
   */
  updatePhaseDisplay() {
    const state = this.gameEngine.getState();
    const phaseText = state.currentState === 'maze' ? 'Maze Navigation' 
                    : state.currentState === 'battle' ? 'Combat Arena'
                    : state.currentState === 'transition' ? 'Transitioning...'
                    : 'Game Over';
    
    this.uiElements.phaseDisplay.textContent = phaseText;
    this.uiElements.turnCounter.textContent = state.turn;
  }
  
  /**
   * Main animation loop
   */
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Calculate delta time
    const currentTime = Date.now();
    const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = currentTime;
    
    // Update game engine
    if (this.isSimulationRunning) {
      this.gameEngine.update(deltaTime);
    }
    
    // Update animations
    this.animationController.update(deltaTime);
    
    // Update UI
    this.updateUI();
    
    // Render scene
    this.sceneSetup.render();
  }
  
  /**
   * Update UI elements
   */
  updateUI() {
    const aegisHp = gameState.aegis.hp;
    const veloHp = gameState.velo.hp;
    const maxHp = gameState.aegis.maxHp;
    
    const aegisPercent = Math.max(0, (aegisHp / maxHp) * 100);
    const veloPercent = Math.max(0, (veloHp / maxHp) * 100);
    
    this.uiElements.aegisHPBar.style.width = aegisPercent + '%';
    this.uiElements.veloHPBar.style.width = veloPercent + '%';
    
    this.uiElements.turnCounter.textContent = this.gameEngine.getState().turn;
    
    document.getElementById('aegis-hp-text').textContent = `${Math.max(0, aegisHp)}/${maxHp}`;
    document.getElementById('velo-hp-text').textContent = `${Math.max(0, veloHp)}/${maxHp}`;
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new NeuroBotwarsVisualizer();
});

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NeuroBotwarsVisualizer;
}
